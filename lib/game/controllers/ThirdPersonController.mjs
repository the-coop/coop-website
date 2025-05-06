import { Quaternion, Vector3, Euler, Matrix4 } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';
import FPSController from './FPSController.mjs';

export default class ThirdPersonController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false,
        landedFrames: 0
    };

    // Third-person camera configuration
    static cameraDistance = 8;    // Increased distance behind player
    static cameraHeight = 3;      // Height above player
    static cameraLookOffset = 1;  // Look slightly above player center

    // Ground aiming Pitch (YXZ order matches natural view rotation).
    static surfacePitch = 0;  
    
    // NEW: Add camera smoothing and state tracking
    static lastCameraPosition = new Vector3();
    static lastPlayerPosition = new Vector3();
    static cameraSmoothing = 0.15; // Lower = smoother camera (0-1)

    // Initialize the controller
    static reset() {
        console.log('ThirdPersonController reset called');
        
        if (!PlayersManager.self) {
            console.warn('ThirdPersonController.reset called but no player exists');
            return;
        }
        
        try {
            // First, check if player exists and has necessary components
            console.log('Player exists:', {
                position: PlayersManager.self.position?.toArray() || 'missing',
                hasHandle: !!PlayersManager.self.handle,
                hasMesh: !!PlayersManager.self.mesh
            });
            
            // Force camera to scene first to avoid any parenting issues
            if (Engine.camera.parent) {
                console.log('Detaching camera from', Engine.camera.parent.type || Engine.camera.parent.uuid);
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Make sure mesh is attached to handle
            if (PlayersManager.self.mesh && PlayersManager.self.handle) {
                if (PlayersManager.self.mesh.parent !== PlayersManager.self.handle) {
                    console.log('Reattaching player mesh to handle');
                    if (PlayersManager.self.mesh.parent) {
                        PlayersManager.self.mesh.parent.remove(PlayersManager.self.mesh);
                    }
                    PlayersManager.self.handle.add(PlayersManager.self.mesh);
                    PlayersManager.self.mesh.position.set(0, 0, 0);
                }
                
                // For third-person, camera should be a scene child, not player child
                console.log('Setting up third-person camera');
                if (Engine.camera.parent !== Engine.scene) {
                    if (Engine.camera.parent) {
                        Engine.camera.parent.remove(Engine.camera);
                    }
                    Engine.scene.add(Engine.camera);
                }
                
                // Position camera correctly behind player
                this.updateCameraPosition();
            } else {
                console.error('Missing player components:', {
                    hasMesh: !!PlayersManager.self.mesh,
                    hasHandle: !!PlayersManager.self.handle
                });
            }
            
            // Reset state variables and camera smoothing
            this.lastCameraPosition = new Vector3();
            this.lastPlayerPosition = new Vector3();
            
            // Reset input state and surface pitch
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.jump = false;
            this.input.landedFrames = 0;
            this.surfacePitch = 0;
            
            // ADDED: Ensure camera is attached to scene, not player
            if (Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                }
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            console.log('ThirdPersonController reset complete');
        } catch (e) {
            console.error('Error in ThirdPersonController reset:', e);
        }
    }

    // UPDATED: Apply vertical camera rotation based on surfacePitch with smoothing
    static updateCameraPosition() {
        if (!PlayersManager.self || !PlayersManager.self.handle) return;
        
        // Get player position
        const playerPos = PlayersManager.self.position.clone();
        
        // Track player position for interpolation
        if (this.lastPlayerPosition.lengthSq() === 0) {
            this.lastPlayerPosition.copy(playerPos);
        }
        
        // IMPROVED: Get surface normal from object rather than recalculating
        // Get surface normal (up direction relative to planet)
        const surfaceNormal = PlayersManager.self.surfaceNormal || 
                             (PlayersManager.self.handle.userData && 
                              PlayersManager.self.handle.userData.surfaceNormal) ||
                             new Vector3(0, 1, 0);
        
        // Get player's forward direction (based on handle orientation)
        const playerForward = new Vector3(0, 0, -1).applyQuaternion(PlayersManager.self.handle.quaternion);
        
        // Calculate right vector perpendicular to up and forward
        const rightVector = new Vector3().crossVectors(surfaceNormal, playerForward).normalize();
        
        // Recalculate true forward direction perpendicular to surface normal and right vector
        const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
        
        // ORBIT CAMERA: Calculate position on a sphere around the player
        
        // 1. Start with the player position
        const orbitPosition = playerPos.clone();
        
        // 2. Calculate distances based on pitch angle
        const horizontalDistance = this.cameraDistance * Math.cos(this.surfacePitch);
        const verticalOffset = this.cameraDistance * Math.sin(this.surfacePitch);
        
        // 3. Move backward by horizontal component
        orbitPosition.addScaledVector(trueForward, -horizontalDistance);
        
        // 4. Move up/down by vertical component
        orbitPosition.addScaledVector(surfaceNormal, verticalOffset);
        
        // 5. Add additional height offset (reduced when looking up)
        const heightFactor = Math.max(0.5, 1.0 - Math.sin(this.surfacePitch) * 0.5);
        orbitPosition.addScaledVector(surfaceNormal, this.cameraHeight * heightFactor);
        
        // ADDED: Apply smoothing between camera positions
        let finalCameraPosition;
        
        if (this.lastCameraPosition.lengthSq() === 0) {
            // First frame, just use ideal position
            finalCameraPosition = orbitPosition.clone();
            this.lastCameraPosition.copy(finalCameraPosition);
        } else {
            // Apply smoothing between positions
            finalCameraPosition = this.lastCameraPosition.clone().lerp(
                orbitPosition, 
                PlayersManager.self.falling ? this.cameraSmoothing * 0.5 : this.cameraSmoothing
            );
        }
        
        // Set camera position
        Engine.camera.position.copy(finalCameraPosition);
        this.lastCameraPosition.copy(finalCameraPosition);
        
        // Set camera up direction aligned with surface normal
        Engine.camera.up.copy(surfaceNormal);
        
        // Calculate look offset that follows pitch for more natural feeling
        const lookOffset = Math.sin(this.surfacePitch) * 1.5;
        
        // Look at player with offset
        const lookTarget = playerPos.clone()
            .addScaledVector(surfaceNormal, this.cameraLookOffset + lookOffset);
        
        // Look at the adjusted target
        Engine.camera.lookAt(lookTarget);
        
        // Save last player position for next frame
        this.lastPlayerPosition.copy(playerPos);
    }

    // COMPLETELY UPDATED: Improved falling handler with proper camera orbiting
    static falling() {
        if (!PlayersManager.self || !PlayersManager.self.handle) return;
        
        // Track the world position before rotation for proper camera positioning
        const playerWorldPos = PlayersManager.self.position.clone();
        
        // IMPROVED: Get global up from player's pre-calculated surface normal
        // Get the current "global up" direction - either from planet or default
        const globalUp = PlayersManager.self._planetSurfaceNormal || 
                        PlayersManager.self.surfaceNormal ||
                        (PlayersManager.self.handle.userData && 
                         PlayersManager.self.handle.userData.surfaceNormal) ||
                        new Vector3(0, 1, 0);
        
        // Store starting quaternion to restore later
        const originalHandleQuat = PlayersManager.self.handle.quaternion.clone();
        
        // Track pitch value for camera orbit
        if (Math.abs(this.input.rotation.y) > 0.001) {
            // Update the stored pitch angle rather than directly rotating the handle
            this.surfacePitch = Math.max(
                -Math.PI * 0.8, // Increased range for looking up/down
                Math.min(Math.PI * 0.8, this.surfacePitch + this.input.rotation.y)
            );
        }
        
        // Apply horizontal rotation directly to handle quaternion
        if (Math.abs(this.input.rotation.x) > 0.001) {
            // Create rotation quaternion for yaw (y-axis rotation)
            const yawQuat = new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),  // Y-axis rotation for yaw
                this.input.rotation.x  // X input controls yaw
            );
            
            // Apply yaw directly to handle quaternion
            PlayersManager.self.handle.quaternion.multiply(yawQuat);
        }
        
        // Store the updated player quaternion for reference
        const playerQuat = PlayersManager.self.handle.quaternion.clone();
        
        // Air control - limited movement while falling
        if (this.input.movement.lengthSq() > 0) {
            const airControlSpeed = 0.05; // Reduced control while falling
            const desiredMovement = this.input.movement.clone().normalize().multiplyScalar(airControlSpeed);
            
            // Convert movement direction to world space
            const worldSpaceMovement = desiredMovement.applyQuaternion(playerQuat);
            
            // Add to player velocity
            PlayersManager.self.velocity.add(worldSpaceMovement);
        }
        
        // Handle camera positioning for falling state with orbital behavior
        if (Engine.camera) {
            // CRITICAL: Ensure camera is attached to scene, not player
            if (Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                }
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // ORBIT CAMERA: Calculate position on a sphere around the player
            
            // Get player's forward and right vectors
            const playerForward = new Vector3(0, 0, -1).applyQuaternion(playerQuat);
            const playerRight = new Vector3(1, 0, 0).applyQuaternion(playerQuat);
            
            // Calculate orbit position
            // 1. Start with the player position
            const orbitPosition = playerWorldPos.clone();
            
            // 2. Move backward by cameraDistance
            const horizontalDistance = this.cameraDistance * Math.cos(this.surfacePitch);
            orbitPosition.addScaledVector(playerForward, -horizontalDistance);
            
            // 3. Move up/down based on pitch angle (sine of pitch)
            const verticalOffset = this.cameraDistance * Math.sin(this.surfacePitch);
            orbitPosition.addScaledVector(globalUp, verticalOffset);
            
            // Apply smoothing for camera position
            let finalCameraPosition;
            if (this.lastCameraPosition.lengthSq() === 0) {
                finalCameraPosition = orbitPosition.clone();
                this.lastCameraPosition.copy(finalCameraPosition);
            } else {
                finalCameraPosition = this.lastCameraPosition.clone().lerp(
                    orbitPosition, 
                    this.cameraSmoothing * 0.7 // Slightly faster tracking during falling
                );
            }
            
            // Set camera position
            Engine.camera.position.copy(finalCameraPosition);
            this.lastCameraPosition.copy(finalCameraPosition);
            
            // Fix camera "up" direction to global up
            Engine.camera.up.copy(globalUp);
            
            // Calculate where camera should look
            // Instead of just looking at player position, add a height offset
            // that follows the pitch angle to make camera movement feel more natural
            const lookOffset = Math.sin(this.surfacePitch) * this.cameraLookOffset;
            
            // Look at player position with appropriate offset
            const lookTarget = playerWorldPos.clone().addScaledVector(
                globalUp, 
                this.cameraLookOffset + lookOffset
            );
            
            Engine.camera.lookAt(lookTarget);
        }
    }

    // UPDATED: Handle rotation in the grounded state
    static grounded() {
        if (!PlayersManager.self || !PlayersManager.self.handle) return;
        
        // Apply vertical camera rotation with constraints
        this.surfacePitch = Math.max(
            -Math.PI * 0.5, // More constrained to prevent camera clipping ground
            Math.min(Math.PI * 0.5, this.surfacePitch + this.input.rotation.y)
        );

        if (this.input.landedFrames > 0) this.input.landedFrames--;
        
        // Get required vectors
        const surfaceNormal = PlayersManager.self.surfaceNormal || new Vector3(0, 1, 0);
        const viewDirection = new Vector3(0, 0, 1).applyQuaternion(PlayersManager.self.handle.quaternion);
        const rightVector = new Vector3().crossVectors(surfaceNormal, viewDirection).normalize();

        // Handle player rotation based on horizontal input
        const horizontalRotation = this.input.rotation.x;
        
        // Only rotate player if there's meaningful input
        if (Math.abs(horizontalRotation) > 0.001) {
            const desiredDirection = new Vector3()
                .addScaledVector(viewDirection, Math.cos(horizontalRotation))
                .addScaledVector(rightVector, Math.sin(horizontalRotation))
                .projectOnPlane(surfaceNormal)
                .normalize()
                .add(PlayersManager.self.handle.getWorldPosition(new Vector3()));

            // Align player with surface and rotate to face direction
            PlayersManager.self.handle.up.copy(surfaceNormal);
            PlayersManager.self.handle.lookAt(desiredDirection);
        }

        // Movement logic - using direct input
        if (this.input.movement.lengthSq() > 0) {
            const groundMoveSpeed = 0.5;
            const desiredMovement = this.input.movement.normalize().multiplyScalar(groundMoveSpeed);
            
            // Convert movement to world space relative to player orientation
            const worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.handle.quaternion);
            
            // Add to player velocity
            PlayersManager.self.velocity.add(worldSpaceMovement);
        }

        // Handle jumping
        if (this.input.jump && this.input.landedFrames == 0) {
            const jumpForce = surfaceNormal.clone().multiplyScalar(8);
            PlayersManager.self.velocity.multiplyScalar(0.5);
            PlayersManager.self.velocity.add(jumpForce);
            this.input.landedFrames = 10;
        }
        
        // Update camera position with player's new position
        this.updateCameraPosition();
    }

    // UPDATED: Better liftoff handling for third person
    static liftoff() {
        if (!PlayersManager.self) return;
        
        try {
            console.log("ThirdPersonController: Player lifted off surface");
            
            // Track that player is now airborne
            PlayersManager.self._wasAirborneBeforeCollision = true;
            
            if (PlayersManager.self.position) {
                PlayersManager.self._fallStartHeight = PlayersManager.self.position.length();
            }
            
            // IMPROVED: Store current surface normal in player's userData for reference
            if (PlayersManager.self.surfaceNormal && PlayersManager.self.handle && 
                PlayersManager.self.handle.userData) {
                PlayersManager.self.handle.userData.surfaceNormal = 
                    PlayersManager.self.surfaceNormal.clone();
            }
            
            // CRITICAL: Reset camera tracking variables to ensure smooth transition
            this.lastCameraPosition = new Vector3();
            
            // No need to call updateCameraPosition as main update loop will handle it
            console.log("Third person liftoff complete");
        } catch (err) {
            console.error("Error in ThirdPersonController liftoff:", err);
        }
    }

    // Main update method
    static update() {
        // ADDED: Make sure camera is never attached to player in third person mode
        if (Engine.camera.parent !== Engine.scene) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Choose appropriate movement mode
        if (PlayersManager.self && PlayersManager.self.falling) {
            this.falling();
        } else if (PlayersManager.self) {
            this.grounded();
        }

        // REMOVED: Don't call updateCameraPosition again for falling case
        // Only update camera position for grounded case or when no player exists
        if (!PlayersManager.self || !PlayersManager.self.falling) {
            this.updateCameraPosition();
        }

        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
        
        return null; // No controller exit request
    }

    // Cleanup when switching away from this controller
    static cleanup() {
        console.log('ThirdPersonController cleanup');
        
        // Ensure camera is attached to scene for clean handoff to next controller
        if (Engine.camera && Engine.camera.parent !== Engine.scene) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Reset state variables
        this.lastCameraPosition = new Vector3();
        this.lastPlayerPosition = new Vector3();
    }
}
