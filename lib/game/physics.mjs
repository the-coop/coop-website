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

        // Check for the closest planet for gravitation influence.
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
            // Update the player's state position.
            player.position.add(player.velocity);

            // Update the player rendering position (visual)
            player.handle.position.copy(player.position);



            // Update which planet has the strongest gravitational pull on the player
            player.soi = this.calculateSOI(player.position);

            // Total collision distance includes planet radius plus player radius
            const collisionDistance = planetRadius + 0.5;

            // Calculate vector pointing from planet center to player
            const toPlayer = player.position.clone().sub(player.soi.position);
            const distance = toPlayer.length();
            toPlayer.normalize()

            // Calculate gravity strength based on distance
            // Normalized by planet radius to work with different sized planets
            const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
            player.velocity.add(toPlayer.clone().multiplyScalar(-gravity));

            //todo Possibly add restitution 
            const downwardSpeed = player.velocity.dot(toPlayer);

            player.surfaceNormal = toPlayer;

            // Ground collision occurs when player is at or below the collision distance
            // This prevents falling through planets and handles landing
            // When it is on the ground it will stay on the ground untill a upwards force is applied
            if (distance <= collisionDistance || (!player.falling && downwardSpeed < 0)) {

                // Calculate exact surface position of collision.
                const surfacePosition = player.soi.position.clone()
                    .add(toPlayer.clone().multiplyScalar(collisionDistance));

                // Place player exactly at surface level
                // This prevents floating point errors from accumulating
                player.position.copy(surfacePosition);
                player.handle.position.copy(surfacePosition);

                if (downwardSpeed < 0) {
                    player.velocity.add(toPlayer.clone().multiplyScalar(-downwardSpeed));

                    // Pass the up vector and surface position to the landing method
                    if (player.falling)
                        ControlManager.controller?.landing(toPlayer, surfacePosition);
                    // Reset falling state and velocity upon landing
                }

                //apply friction
                player.velocity.multiplyScalar(0.9)
            }
            // Apply gravity when player is above the surface
            // Uses inverse square law for realistic gravitational falloff
            else {
                // Mark player as falling if they just left the ground
                if (!player.falling) {
                    ControlManager.controller?.liftoff();
                    player.falling = true;
                }
            }
        });
    };

};
