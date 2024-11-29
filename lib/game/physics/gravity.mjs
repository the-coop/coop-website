import { Vector3, Quaternion, Euler } from 'three';
import PlayerManager from '../players/playerManager.mjs';

const PLAYER_RADIUS = 0.25; // Match the new player radius
const SPHERE_RADIUS = 400;  // Increased from 200 to 400

export default class Gravity {
    static GRAVITY = 80; // Increased from 40 to 80 for faster falling
    static DAMPING = 0.95; // Reduced damping for less friction

    static apply(delta) {
        const center = new Vector3(0, 0, 0);

        PlayerManager.players.forEach(player => {
            // Check if player.object and player.object.position are defined
            if (!player.object || !player.object.position) {
                console.warn('Player object or position is undefined');
                return;
            }

            // Calculate distance from center and surface
            const distanceToCenter = player.object.position.length();
            const distanceFromSurface = distanceToCenter - SPHERE_RADIUS;

            // Update surface normal
            player.surfaceNormal = player.object.position.clone().normalize();

            // Calculate gravity force towards the center
            const gravityDir = center.clone().sub(player.object.position).normalize();
            // Optional: Adjust gravityStrength calculation for more realistic behavior
            const gravityStrength = this.GRAVITY * (1 + distanceFromSurface / SPHERE_RADIUS);
            const gravityForce = gravityDir.multiplyScalar(gravityStrength * delta);

            // Apply gravity to velocity
            player.vel.add(gravityForce);

            // Apply damping when near the surface
            if (distanceFromSurface < 1) {
                player.vel.multiplyScalar(this.DAMPING);
            }

            // Determine if the player is falling
            if (distanceFromSurface >= 0.1) {
                if (!player.falling) {
                    player.falling = true; // Player has started falling
                }
            } else {
                if (player.falling) {
                    player.falling = false; // Player has landed
                }

                // Project velocity onto the surface plane when grounded
                const tangentVel = new Vector3().copy(player.vel);
                tangentVel.sub(gravityDir.multiplyScalar(tangentVel.dot(gravityDir)));
                player.vel.copy(tangentVel);
            }

            // Update position based on velocity
            const newPosition = player.object.position.clone().add(player.vel.clone().multiplyScalar(delta));

            // Handle collision with the surface
            const minDistance = SPHERE_RADIUS + PLAYER_RADIUS;
            if (newPosition.length() < minDistance) {
                newPosition.setLength(minDistance);
                player.vel.setLength(0);
                
                // Only force orientation when landing
                if (player.falling) {
                    player.falling = false;
                    // Align with surface when landing
                    const targetUp = newPosition.clone().normalize();
                    const surfaceAlign = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), targetUp);
                    player.object.quaternion.copy(surfaceAlign);
                }
            }

            // Update position and surface normal
            player.object.position.copy(newPosition);
            // Only update surface normal when not falling
            if (!player.falling) {
                player.surfaceNormal.copy(newPosition.clone().normalize());
            }
        });
    }
}
