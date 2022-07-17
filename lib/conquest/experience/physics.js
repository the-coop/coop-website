import * as THREE from 'three';
import { PLAYER_SPEED, THRUST_AMOUNT } from '../config';

import ComputerInput from './inputs/computer';

export default class Physics {

    // Transform to local coordinates
    static getMeshGlobalPos(mesh) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrix);
        return normalMatrix;
    }

    static applyMovement(elapsed, player, playerHeight, surfaceHeight, isSelf) {
        // Caculate gravity
        let surfaceGravity = player.soi.surfaceGravity;
        let heightScaled = playerHeight / surfaceHeight;
        let gravity = surfaceGravity / (heightScaled * heightScaled);

        // TODO: Move the below code to the controls classes.
        // BEGIN OF REFACTOR MOVE
        // Move player
        let x = 0;
        let y = 0;
        let z = gravity;
        
        if (isSelf) {
            x = PLAYER_SPEED * ((+ComputerInput.keypad.a) - (+ComputerInput.keypad.d));
            y = PLAYER_SPEED * ((+ComputerInput.keypad.w) - (+ComputerInput.keypad.s));

            const thrustDirection = player.handle.position.clone().normalize();

            if (ComputerInput.keypad.space) {
                if (player.onGround) 
                    z = -THRUST_AMOUNT;
                else {
                    player.velocity.addScaledVector(thrustDirection, 1);
                }
            }

            if (ComputerInput.keypad.e) {
                if (!player.onGround) 
                    z = THRUST_AMOUNT;
                else {
                    player.velocity.addScaledVector(thrustDirection, -1);
                }
            }
          if (player.surfaceNormalThrust) {
            z = z + player.surfaceNormalThrust;
            player.surfaceNormalThrust = 0;
          }
         

        }
        // END OF REFACTOR MOVE

        if (isSelf) {
            // Transform global gravitational accelaration to local coordinates.
            const normalMatrix = this.getMeshGlobalPos(player.handle);
            const acceleration = new THREE.Vector3(x, y, z);
            acceleration.applyMatrix3(normalMatrix);

            // Move the player
            player.handle.position.addScaledVector(acceleration, 0.5 * elapsed * elapsed);
            player.handle.position.addScaledVector(player.velocity, elapsed);
            player.velocity.addScaledVector(acceleration, elapsed);
        }

        // Apply server correction.
        if (player.correctionTime > 0) {
            const correctionAmount = Math.min(player.correctionTime, elapsed);
            player.handle.position.addScaledVector(player.correctionVelocity, correctionAmount);
            player.correctionTime -= correctionAmount;
        }

        const updatedPlayerHeight = player.handle.position.length();
        return updatedPlayerHeight;
    }

    static applyFriction(player, playerHeight, height,elapsed) {
        // Caculate atmosphere
        let friction = 5 / Math.pow(1 + (playerHeight - height) / height, 2);
    
        // Reset friction if it becomes too extreme/corrupted.
        if (isNaN(friction)) friction = 0;
    
        // Ground collision
        if (playerHeight <= height) {
            player.handle.position.clampLength(height, 100000);
            
            friction += 300;
    
            const speed = player.velocity.length();
            const direction = player.handle.position.clone().normalize();
            player.velocity.addScaledVector(direction, -player.velocity.dot(direction) / speed);
        }

        let speedFactor = friction *elapsed;
        if (speedFactor > 1) speedFactor = 1;
        player.velocity.multiplyScalar(1 - speedFactor);
    }

    static captureSOI(player, playerHeight, worldPos, isSelf) {
        let currentSOI = player.soi;

        // Check if player left SOI gravity range.
        let bigToSmall = false;
        let newPlanet = null;
        if (playerHeight > player.soi.SOISize)
            newPlanet = currentSOI.parent;
        
        // Check if player entered another SOI gravity range.
        else {
            const matches = currentSOI.children.filter(item => {
                let itemPos = new THREE.Vector3(0, 0, 1);
                item.body.getWorldPosition(itemPos);
                return itemPos.distanceToSquared(worldPos) < item.SOISize * item.SOISize;
            });
            
            if (matches.length) {
                newPlanet = matches[0];
                bigToSmall = true;
            }
        }

        // Handle player captured by another SOI's gravity.
        if (newPlanet) { 
            // Attach the player handle to the new planet body.
            newPlanet.body.attach(player.handle);
    
            // Transform velocity to new coordinate frame
            let aMat = new THREE.Matrix3().getNormalMatrix(currentSOI.body.matrixWorld);
            let bMat = new THREE.Matrix3().getNormalMatrix(newPlanet.body.matrixWorld).invert();
            
            let planetPrograde;
            let speed;
            if (bigToSmall) {
                planetPrograde = newPlanet.body.position.clone().normalize().cross(new THREE.Vector3(0, 1, 0));
                speed = 2 * Math.PI * newPlanet.velocity * newPlanet.body.position.length();
            } else {
                planetPrograde = currentSOI.body.position.clone().normalize().cross(new THREE.Vector3(0, 1, 0));
                speed = -2 * Math.PI * currentSOI.velocity * currentSOI.body.position.length();
            }

            // Apply gravity capture velocity and newest SOI.
            player.velocity = player.velocity.applyMatrix3(aMat).applyMatrix3(bMat).addScaledVector(planetPrograde, speed);
            player.soi = newPlanet;

            // Send soi change.
            if (isSelf) {
                console.log("sending soi");
                player.soiChangeCount++;
                WORLD.me.player.emitPosition();
            }
        }
    
    }

    static update() {
        WORLD.planets.map(planet => {
            if (planet.velocity) {
                planet.pivot.rotation.y = 2 * Math.PI * planet.velocity * WORLD.timeIncrement;
                planet.body.rotation.y = 2 * Math.PI * planet.spin * WORLD.timeIncrement;
            }
        });    
    }
}
