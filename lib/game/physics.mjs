import { Vector3, Matrix4 } from 'three';
import SceneManager from './scene.mjs';
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
            
            if (distanceToCenter <= planetRadius + 1) {
                // Align player with surface on landing
                const up = toCenter.normalize();
                player.position.copy(player.soi.position).add(up.multiplyScalar(planetRadius + 1));
                
                if (player.falling) {
                    // Orient player to surface normal
                    const forward = new Vector3(0, 0, -1)
                        .applyQuaternion(player.quaternion)
                        .projectOnPlane(up)
                        .normalize();
                    const right = forward.clone().cross(up).normalize();
                    forward.crossVectors(up, right);
                    
                    const matrix = new Matrix4().makeBasis(right, up, forward);
                    player.quaternion.setFromRotationMatrix(matrix);
                    
                    player.falling = false;
                    player.velocity.set(0, 0, 0);
                }
            } else {
                player.falling = true;
                const gravityStrength = this.GRAVITY_CONSTANT / Math.pow(distanceToCenter / planetRadius, 2);
                player.velocity.add(toCenter.normalize().multiplyScalar(-gravityStrength));
                player.position.add(player.velocity);
            }
            
            return player;
        });
    }
}
