import * as THREE from 'three';
import Controls from './experience/controls';
import ExperienceManager from './experience/experienceManager';

let time = 0;

const delta = 0.01;

export default function engine(instance) {
    // Once the component has been unmounted, this should stop being applied.
    if (instance._isDestroyed) return;

    time = time + delta;

    // Apply gravity to all players.
    Object.keys(WORLD.players).map(key => {
        const player = WORLD.players[key];
        let isSelf = player.config.player_id === WORLD?.me?.config?.player_id;

        let currentSOI = player.soi;
        const soiLimit = player.soi.SOISize;
    
        // Initialise player position.
        let worldPos = new THREE.Vector3(0, 0, 1);
        player.handle.getWorldPosition(worldPos);
        let playerHeight = player.handle.position.length();

        // Check if player left SOI gravity range.
        let bigToSmall = false;
        let newPlanet = null;
        if (playerHeight > soiLimit)
            newPlanet = currentSOI.parent;
        
        // Check if player entered another SOI gravity range.
        else {
            const matches = currentSOI.children.filter(item => {
                let itemPos = new THREE.Vector3(0, 0, 1);
                item.body.getWorldPosition(itemPos);
                return itemPos.distanceToSquared(worldPos) < item.SOISize * item.SOISize;
            });
            
            if (matches[0]) {
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
            currentSOI = player.soi = newPlanet;
            console.log("new planet");

            // Send soi change.
            if (isSelf) {
                player.soiIndex++;
                console.log("sending soi");
                window.WORLD.socket.emit('player_moved', {
                    pid: WORLD.me.config.player_id,
                    v: player.velocity,
                    p: player.handle.position,
                    r: player.handle.quaternion,
                    i: player.soiIndex,
                    soi: newPlanet.name,
                });
            }
        }
    
        // Look up planet information.
        let surfaceHeight = player.soi.surface;
        let surfaceGravity = player.soi.surfaceGravity;
    
        // Calculate and set up direction (forward)
        const planetWorldPos = new THREE.Vector3(0, 0, 1);
        currentSOI.body.getWorldPosition(planetWorldPos);
        const altDirection = player.handle.localToWorld(new THREE.Vector3(0, 1, 0))
            .sub(worldPos)
            .normalize();
        player.handle.up.set(altDirection.x, altDirection.y, altDirection.z);
    
        // Look at the ground
        player.handle.lookAt(planetWorldPos);

        // Caculate ground
        let playerSize = 0.4 / 2;
        let height = playerSize + surfaceHeight;
        
        // Caculate gravity
        let heightScaled = playerHeight / surfaceHeight;
        let gravity = surfaceGravity / (heightScaled * heightScaled);

        // Detect and update player grounded attribute.
        player.onGround = playerHeight <= (height + 0.0001);

        // Move player
        let x = 0;
        let y = 0;
        let z = gravity;
        if (isSelf) {
            x = 50 * ((Controls.keypad.a ? 1 : 0) - (Controls.keypad.d ? 1 : 0));
            y = 50 * ((Controls.keypad.w ? 1 : 0) - (Controls.keypad.s ? 1 : 0));
            z = (Controls.keypad.space ? (player.onGround ? -10 : 0) : z);
        }
        let acceleration = new THREE.Vector3(x, y, z);

        // Transform to local coordinates
        let normalMatrix = new THREE.Matrix3().getNormalMatrix(player.handle.matrix);

        if (isSelf && Controls.keypad.space) {
            if (!player.onGround) {
                const thrustDirection = player.handle.position.clone().normalize();
                player.velocity.addScaledVector(thrustDirection, 1);
            }
        }
        acceleration.applyMatrix3(normalMatrix);
    
        // Move the player
        player.velocity.addScaledVector(acceleration, delta);
        player.handle.position.addScaledVector(acceleration, 0.5 * delta * delta);
        player.handle.position.addScaledVector(player.velocity, delta);
        if (player.correctionTime > 0) {
            let correctionAmount = Math.min(player.correctionTime, delta);
            player.handle.position.addScaledVector(player.correctionVelocity, correctionAmount);
            player.correctionTime -= correctionAmount;
        }
        playerHeight = player.handle.position.length();
    
        // Caculate atmosphere
        let friction = 0;
        friction = friction + 5 / Math.pow(1 + (playerHeight - height) / height, 2);
    
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

        // Apply friction
        let speedFactor = friction * delta;
        if (speedFactor > 1) speedFactor = 1;
        player.velocity.multiplyScalar(1 - speedFactor);

        // Apply first person looking to the player rotation.
        player.mesh.quaternion.copy(player.aim);
    });

    // Send position update (seems a bit extreme every frame?).
    if (WORLD.socket && WORLD?.me?.config?.player_id) {
        window.WORLD.socket.emit('player_moved', {
            pid: WORLD.me.config.player_id,
            v: WORLD.me.player.velocity,
            p: WORLD.me.player.handle.position,
            r: WORLD.me.player.handle.quaternion,

            // One or both of these may be optional.
            i: WORLD.me.player.soiIndex,
            soi: WORLD.me.player.soi.name,
        });
    }

    // Rotate the planets.
    WORLD.planets.map(planet => {
        if (planet.velocity) {
            planet.pivot.rotation.y = 2 * Math.PI * planet.velocity * time;
            planet.body.rotation.y = 2 * Math.PI * planet.spin * time;
        }
    });

    // Handle camera changes.
    if (WORLD.settings.view.DESIRED_CAMERA_KEY !== WORLD.settings.view.CURRENT_CAMERA_KEY)
        ExperienceManager.change(WORLD.settings.view.DESIRED_CAMERA_KEY);

    // Update the camera changes over time.
    WORLD.controls.update(delta);

    // If there is an incomplete tween, process it.
    if (WORLD.tween) WORLD.tween.update();

    // Render the scene.
    WORLD.composer.render();

    // Recurse frames.
    window.requestAnimationFrame(() => engine(instance));
}
