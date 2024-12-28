import { Vector3 } from 'three';
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
            
            // Always update SOI and calculate surface orientation
            player.soi = this.calculateSOI(player.position);
            const toCenter = player.position.clone().sub(player.soi.position);
            const distanceToCenter = toCenter.length();
            const planetRadius = player.soi.geometry.parameters.radius;
            
            // Simple surface check
            if (distanceToCenter <= planetRadius + 1) {
                // Land on surface
                toCenter.normalize();
                player.position.copy(player.soi.position).add(toCenter.multiplyScalar(planetRadius + 1));
                player.falling = false;
                player.velocity.set(0, 0, 0);
            } else {
                // Fall towards SOI center
                player.falling = true;
                const gravityStrength = this.GRAVITY_CONSTANT / Math.pow(distanceToCenter / planetRadius, 2);
                player.velocity.add(toCenter.normalize().multiplyScalar(-gravityStrength));
                player.position.add(player.velocity);
            }
            
            return player;
        });
    }
}
