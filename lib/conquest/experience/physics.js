import * as THREE from 'three';

export default class Physics {

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
    
    }
}