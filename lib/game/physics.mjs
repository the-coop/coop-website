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
        return players.map(handle => {
            if (!handle.velocity) handle.velocity = new Vector3();
            
            handle.soi = this.calculateSOI(handle.position);
            const toCenter = handle.position.clone().sub(handle.soi.position);
            const planetRadius = handle.soi.geometry.parameters.radius;
            const groundOffset = 0.5; // Half player height
            const totalRadius = planetRadius + groundOffset;
            const distanceToCenter = toCenter.length();
            
            if (distanceToCenter <= totalRadius || (handle.grounded && distanceToCenter <= totalRadius + 0.1)) {
                // Ensure exact positioning on surface
                const up = toCenter.normalize();
                handle.position.copy(handle.soi.position).add(up.multiplyScalar(totalRadius));
                
                if (!handle.grounded) {
                    handle.grounded = true;
                    handle.falling = false;
                    handle.velocity.set(0, 0, 0);
                }
                handle.velocity.set(0, 0, 0);
            } else if (handle.falling) {
                // Only apply gravity when truly falling (not jumping)
                const gravityStrength = this.GRAVITY_CONSTANT / Math.pow(distanceToCenter / planetRadius, 2);
                handle.velocity.add(toCenter.normalize().multiplyScalar(-gravityStrength));
                handle.position.add(handle.velocity);
            }
            
            return handle;
        });
    }
}
