import { Vector3 } from 'three';
import SceneManager from './scene.mjs';

export default class Physics {
    static GRAVITY_CONSTANT = 0.1;
    
    static calculateSOI(position) {
        let closestPlanet = SceneManager.planets[0];
        let closestDistance = Infinity;
        
        SceneManager.planets.map(planet => {
            const radius = planet.geometry.parameters.radius;
            const distance = position.distanceTo(planet.position);
            // Scale influence by planet radius
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
            
            // Update SOI if needed
            if (!player.soi || Math.random() < 0.05) {
                player.soi = this.calculateSOI(player.position);
            }
            
            const direction = new Vector3();
            direction.subVectors(player.soi.position, player.position);
            const distanceToCenter = direction.length();
            direction.normalize();
            
            const planetRadius = player.soi.geometry.parameters.radius;
            
            // Surface collision with state transition tracking
            if (distanceToCenter < planetRadius + 1) {
                // Only trigger grounded state change once
                if (!player.grounded) {
                    player.grounded = true;
                    player.falling = false;
                    player.jumping = false;
                    player.velocity.set(0, 0, 0);
                    player.needsGroundAlign = true;  // New flag for FPS controller
                }
                
                // Keep at surface level without changing orientation
                const surfacePoint = player.soi.position.clone()
                    .add(direction.multiplyScalar(-(planetRadius + 1)));
                player.position.copy(surfacePoint);
            } else {
                if (player.grounded && !player.jumping) {
                    player.falling = true;
                    player.grounded = false;
                }
                
                // Apply gravity
                const gravityStrength = this.GRAVITY_CONSTANT * (planetRadius / distanceToCenter);
                player.velocity.add(direction.multiplyScalar(gravityStrength));
                player.position.add(player.velocity);
            }
            
            return player;
        });
    }
}
