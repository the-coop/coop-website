import { Vector3, Quaternion, Euler } from 'three';
import PlayerManager from '../players/playerManager.mjs';
import FPSController from '../controllers/fps.mjs';  // Add this import

const PLAYER_RADIUS = 0.25; // Match the new player radius
const SPHERE_RADIUS = 400;  // Increased from 200 to 400

export default class Gravity {
    static GRAVITY = 60;     // Keep gravity the same
    static DAMPING = 0.99;   // Increased from 0.95 to reduce friction significantly

    static apply(delta) {
        const center = new Vector3(0, 0, 0);
        const players = PlayerManager.getAllPlayers();

        if (players.length === 0) {
            return; // Skip if no players exist
        }

        players.forEach(player => {
            if (!player?.pivot?.position) {
                console.warn('Invalid player pivot');
                return;
            }

            // Initialize player properties if needed
            if (!player.vel) player.vel = new Vector3();
            if (!player.surfaceNormal) player.surfaceNormal = new Vector3(0, 1, 0);

            // Calculate distance from center and surface
            const distanceToCenter = player.pivot.position.length();
            const distanceFromSurface = distanceToCenter - SPHERE_RADIUS;

            // Update surface normal
            player.surfaceNormal = player.pivot.position.clone().normalize();

            // Calculate gravity force towards the center
            const gravityDir = center.clone().sub(player.pivot.position).normalize();
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
            const newPosition = player.pivot.position.clone().add(player.vel.clone().multiplyScalar(delta));

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
                    player.pivot.quaternion.copy(surfaceAlign);
                }
            }

            // Update position and surface normal
            player.pivot.position.copy(newPosition);
            // Only update surface normal when not falling
            if (!player.falling) {
                player.surfaceNormal.copy(newPosition.clone().normalize());
                // Fix: Use the correct method name
                if (PlayerManager.protagonist === player) {
                    FPSController.preventDoubleJump();
                }
            }
        });
    }
}
