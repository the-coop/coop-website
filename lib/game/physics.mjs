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
            
            // Snap to surface from feet (bottom of player)
            const groundOffset = 0.5; // Half player height
            
            if (distanceToCenter <= planetRadius + groundOffset) {
                // Ensure player stays exactly on surface
                const up = toCenter.normalize();
                player.position.copy(player.soi.position)
                    .add(up.multiplyScalar(planetRadius + groundOffset));
                
                if (!player.grounded) {
                    player.grounded = true;
                    player.falling = false;
                    player.velocity.set(0, 0, 0);
                    ControlManager.controller?.onLanding?.(player);
                }
                player.velocity.set(0, 0, 0); // Always zero velocity when grounded
            } else if (player.falling) {
                // Only apply gravity when truly falling (not jumping)
                const gravityStrength = this.GRAVITY_CONSTANT / Math.pow(distanceToCenter / planetRadius, 2);
                player.velocity.add(toCenter.normalize().multiplyScalar(-gravityStrength));
                player.position.add(player.velocity);
            }
            
            return player;
        });
    }
}
