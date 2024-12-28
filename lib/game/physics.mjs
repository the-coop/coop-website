import { Vector3, Quaternion } from 'three';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';

export default class Physics {
    static GRAVITY_CONSTANT = 0.5;
    
    static calculateSOI(position) {
        let closestPlanet = SceneManager.planets[0];
        let closestDistance = Infinity;
        
        SceneManager.planets.map(planet => {
            const radius = planet.geometry.parameters.radius;
            const distance = position.distanceTo(planet.position);
            const scaledDistance = distance / radius;
            
            if (scaledDistance < closestDistance) {
                closestDistance = scaledDistance;
                closestPlanet = planet;
            }
        });
        
        return closestPlanet;
    }
    
    static update(players) {
        return players.map(player => {
            if (!player.velocity) player.velocity = new Vector3();
            
            player.soi = this.calculateSOI(player.position);
            const toCenter = player.position.clone().sub(player.soi.position);
            const distanceToCenter = toCenter.length();
            const planetRadius = player.soi.geometry.parameters.radius;
            
            if (distanceToCenter <= planetRadius + 0.5) { // Adjusted for cube size
                if (player.falling) { // Handle landing only if the player was falling
                    // Align player with surface on landing
                    const up = toCenter.normalize();
                    player.position.copy(player.soi.position).add(up.clone().multiplyScalar(planetRadius + 0.5)); // Cube height adjustment

                    // Align rotation with surface normal using quaternion
                    const targetUp = up;
                    const currentUp = new Vector3(0, 1, 0); // Assuming player's default up is Y-axis
                    const quaternionUp = new Quaternion().setFromUnitVectors(currentUp, targetUp);

                    // Project current forward to the tangent plane
                    const currentForward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
                    const forwardTangent = currentForward.clone().sub(up.clone().multiplyScalar(currentForward.dot(up))).normalize();

                    // Create quaternion to align forward with the tangent
                    const quaternionForward = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), forwardTangent);

                    // Combine quaternions
                    player.quaternion.copy(quaternionForward.multiply(quaternionUp));

                    // Reset camera rotation to prevent distortion
                    const camera = Engine.camera;
                    if (camera.parent === player) {
                        camera.rotation.set(0, 0, 0);
                    }

                    // Update state
                    player.falling = false;
                    player.velocity.set(0, 0, 0);

                    // Ensure landing is handled only once
                    ControlManager.horizonSet = true;
                }
            } else {
                if (!player.falling) {
                    // Player starts falling
                    player.falling = true;
                    ControlManager.horizonSet = false;
                }
                // Apply gravity
                const gravityStrength = this.GRAVITY_CONSTANT / Math.pow(distanceToCenter / planetRadius, 2);
                player.velocity.add(toCenter.normalize().multiplyScalar(-gravityStrength));
                player.position.add(player.velocity);
            }
            
            return player;
        });
    }
}
