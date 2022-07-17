import * as THREE from 'three';
import InputManager from './inputManager';

export default class Physics {

    // Transform to local coordinates
    static getMeshGlobalPos(mesh) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrix);
        return normalMatrix;
    }

    static applyPlayerMovement(elapsed, player, playerHeight, surfaceHeight, isSelf) {
        // Intercept movement and modify based on input.
        if (isSelf) 
            InputManager.applyPlayerInput(elapsed, player, playerHeight, surfaceHeight);

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
