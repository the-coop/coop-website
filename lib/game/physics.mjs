import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';

// Lower values create "moon-like" gravity, higher values "earth-like"
const GRAVITY_CONSTANT = 0.5;

// Handles gravity and ground detection for spherical planets
// SOI (Sphere of Influence) determines which planet affects the player
export default class Physics {

    // Finds the planet with strongest gravitational influence
    // Distance is scaled by planet radius to handle different sized planets
    static calculateSOI(position) {
        let closestPlanet = SceneManager.planets[0];
        let closestDistance = Infinity;
        
        SceneManager.planets.map(planet => {
            // Get planet's radius for scaling
            const radius = planet.geometry.parameters.radius;
            
            // Raw euclidean distance from player to planet center
            // Uses Three.js distanceTo() which computes sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-x1)^2)
            const distance = position.distanceTo(planet.position);
            
            // Scale distance by planet radius to normalize influence
            // This makes bigger planets have stronger gravitational reach:
            // - A planet with R=2 and D=10 has scaledDistance = 5
            // - A planet with R=5 and D=10 has scaledDistance = 2
            // Therefore larger planets "win" the SOI check at greater distances
            const scaledDistance = distance / radius;
            
            // Track the planet with smallest scaled distance
            // This effectively finds the planet with strongest gravitational influence
            if (scaledDistance < closestDistance) {
                closestDistance = scaledDistance;
                closestPlanet = planet;
            }
        });
        
        return closestPlanet;
    };
    
    // Updates player physics:
    // - Determines current planetary influence
    // - Handles ground contact and alignment
    // - Applies gravity when falling
    // - Updates visual representation
    static update() {
        PlayersManager.players.map(player => {
            // Calculate vector pointing from planet center to player
            // This is used for both gravity direction and ground alignment
            const toPlayer = player.position.clone().sub(player.soi.position);
            const planetRadius = player.soi.geometry.parameters.radius;
            
            // Total collision distance includes planet radius plus player radius
            const collisionDistance = planetRadius + 0.5; 
            const distance = toPlayer.length();

            // Update which planet has the strongest gravitational pull on the player
            // This allows for seamless transitions between planetary bodies
            player.soi = this.calculateSOI(player.position);

            // Ground collision occurs when player is at or below the collision distance
            // This prevents falling through planets and handles landing
            if (distance <= collisionDistance) {
                // Calculate exact surface position of collision.
                const surfacePosition = player.soi.position.clone()
                .add(toPlayer.normalize().multiplyScalar(collisionDistance));
                
                // Place player exactly at surface level
                // This prevents floating point errors from accumulating
                player.position.copy(surfacePosition);
                player.handle.position.copy(surfacePosition);

                // Pass the up vector and surface position to the landing method
                if (player.falling) 
                    ControlManager.controller?.landing(toPlayer.normalize(), surfacePosition);

                // Reset falling state and velocity upon landing
                player.falling = false;
                player.velocity.set(0, 0, 0);
            }

            // Apply gravity when player is above the surface
            // Uses inverse square law for realistic gravitational falloff
            if (distance > collisionDistance) {
                // Mark player as falling if they just left the ground
                if (!player.falling) player.falling = true;

                // Calculate gravity strength based on distance
                // Normalized by planet radius to work with different sized planets
                const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
                player.velocity.add(toPlayer.normalize().multiplyScalar(-gravity));
                player.position.add(player.velocity);
                player.handle.position.copy(player.position);
            }
        });
    };
    
};
