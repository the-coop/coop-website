import { Vector3, Quaternion } from 'three';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';

// Handles gravity and ground detection for spherical planets
// SOI (Sphere of Influence) determines which planet affects the player
export default class Physics {
    // Lower values create "moon-like" gravity, higher values "earth-like"
    static GRAVITY_CONSTANT = 0.5;
    
    // Finds the planet with strongest gravitational influence
    // Distance is scaled by planet radius to handle different sized planets
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
    
    // Updates player physics:
    // - Determines current planetary influence
    // - Handles ground contact and alignment
    // - Applies gravity when falling
    // - Updates visual representation
    static update() {
        PlayersManager.players.map(player => {
            const toCenter = player.position.clone().sub(player.soi.position);
            const planetRadius = player.soi.geometry.parameters.radius;
            const totalRadius = planetRadius + 0.5;
            const distanceToCenter = toCenter.length();
            
            const updatePosition = (pos) => {
                player.position.copy(pos);
                player.handle.position.copy(pos);
            };
            
            if (distanceToCenter <= totalRadius || (!player.falling && distanceToCenter <= totalRadius + 0.1)) {
                updatePosition(player.soi.position.clone().add(toCenter.normalize().multiplyScalar(totalRadius)));
                if (player.falling) {
                    player.falling = false;
                    player.velocity.set(0, 0, 0);
                }
            } else if (player.falling) {
                const gravityStrength = this.GRAVITY_CONSTANT / Math.pow(distanceToCenter / planetRadius, 2);
                player.velocity.add(toCenter.normalize().multiplyScalar(-gravityStrength));
                updatePosition(player.position.clone().add(player.velocity));
            }
            
            player.soi = this.calculateSOI(player.position);
        });
    }
};
