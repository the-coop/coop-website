import { Quaternion, Vector3, Euler, Matrix4 } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    // Input adapter that standardizes different input methods (keyboard/mouse, gamepad)
    // into a shared format that the FPS controller can process:
    // - movement: unified directional input (WASD/Stick)
    // - rotation: unified view changes (Mouse/Stick)
    // - jump: unified action button (Space/Button)
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false,
        landedFrames: 0
    };

    // Ground aiming Pitch (YXZ order matches natural view rotation).
    static surfacePitch = 0;  

    // Camera reset with improved handling for vehicle transitions
    static reset() {
        console.log('FPSController reset called');
        
        if (!PlayersManager.self) {
            console.warn('FPSController.reset called but no player exists');
            return;
        }
        
        try {
            // IMPROVED: Set stage flag to track state
            const isTransitioningFromVehicle = PlayersManager.self.inVehicle;
            
            // CRITICAL FIX: Make sure we have a clean slate
            // Clear vehicle state
            PlayersManager.self.inVehicle = false;
            
            if (PlayersManager.self.handle && PlayersManager.self.handle.userData) {
                PlayersManager.self.handle.userData.inVehicle = false;
                PlayersManager.self.handle.userData.currentVehicle = null;
            }
            
            // IMPROVED: Check if player handle and mesh exist and are in the correct relationship
            if (PlayersManager.self.mesh && PlayersManager.self.handle) {
                // Make sure mesh is attached to handle if it isn't already
                if (PlayersManager.self.mesh.parent !== PlayersManager.self.handle) {
                    console.log("Reattaching player mesh to handle");
                    if (PlayersManager.self.mesh.parent) {
                        PlayersManager.self.mesh.parent.remove(PlayersManager.self.mesh);
                    }
                    PlayersManager.self.handle.add(PlayersManager.self.mesh);
                    PlayersManager.self.mesh.position.set(0, 0, 0);
                }
                
                // IMPROVED: Make sure player mesh is visible
                PlayersManager.self.mesh.visible = true;
                PlayersManager.self.handle.visible = true;
                
                // IMPROVED: If transitioning from vehicle, handle camera differently
                if (isTransitioningFromVehicle) {
                    // Get current camera world position and direction
                    const worldPos = new Vector3();
                    const worldQuat = new Quaternion();
                    
                    if (Engine.camera.parent) {
                        Engine.camera.getWorldPosition(worldPos);
                        Engine.camera.getWorldQuaternion(worldQuat);
                        Engine.camera.parent.remove(Engine.camera);
                    } else {
                        worldPos.copy(Engine.camera.position);
                        worldQuat.copy(Engine.camera.quaternion);
                    }
                    
                    // First add to scene to reset hierarchy
                    Engine.scene.add(Engine.camera);
                    
                    // Then attach to player mesh directly
                    PlayersManager.self.mesh.add(Engine.camera);
                    
                    // Set position directly above player
                    Engine.camera.position.set(0, 1, 0);
                    
                    // IMPROVED: Start with camera pointing in the same world direction
                    // to prevent jarring camera jumps
                    const forward = new Vector3(0, 0, -1).applyQuaternion(worldQuat);
                    const tempQuat = new Quaternion().setFromUnitVectors(
                        new Vector3(0, 0, 1), 
                        forward.clone().negate()
                    );
                    Engine.camera.quaternion.copy(tempQuat);
                    
                    // IMPROVED: Keep correct up vector
                    if (PlayersManager.self.surfaceNormal) {
                        Engine.camera.up.copy(PlayersManager.self.surfaceNormal);
                    } else {
                        Engine.camera.up.set(0, 1, 0);
                    }
                    
                    console.log('Camera positioned in FPS view from vehicle transition');
                } else {
                    // Standard camera attachment for non-transition cases
                    if (Engine.camera.parent) {
                        Engine.camera.parent.remove(Engine.camera);
                    }
                    
                    PlayersManager.self.mesh.add(Engine.camera);
                    Engine.camera.position.set(0, 1, 0);
                    Engine.camera.rotation.set(0, 0, 0);
                    
                    if (PlayersManager.self.surfaceNormal) {
                        Engine.camera.up.copy(PlayersManager.self.surfaceNormal);
                    } else {
                        Engine.camera.up.set(0, 1, 0);
                    }
                    
                    console.log('Camera positioned in FPS view (standard)');
                }
                
                // Reset pitch to 0 (straight ahead)
                this.surfacePitch = 0;
            } else {
                console.error('Missing player components');
            }
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.jump = false;
            this.input.landedFrames = 0;
            
            console.log("FPSController reset complete");
        } catch (e) {
            console.error('Error in FPSController reset:', e);
        }
    }

    // ENHANCED: Add safety checks in FPS controllers
    static update() {
        if (!PlayersManager.self) {
            console.warn("FPSController update called with no player");
            return null;
        }
        
        try {
            // Choose aiming mode based on falling state
            if (PlayersManager.self.falling && !PlayersManager.self.standingOnObject) {
                this.falling();
            } else {
                this.grounded();
            }

            // Reset input for next frame
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.jump = false;
        } catch (err) {
            console.error("Error in FPSController update:", err);
        }
        
        return null;
    }

    static falling() {
        if (!PlayersManager.self || !PlayersManager.self.handle) return;
        
        try {
            // Maintain orientation in space using world-aligned rotations
            const yawRotation = new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),
                this.input.rotation.x
            );
            const pitchRotation = new Quaternion().setFromAxisAngle(
                new Vector3(1, 0, 0),
                this.input.rotation.y
            );
            
            PlayersManager.self.handle.quaternion.multiply(yawRotation).multiply(pitchRotation);
            PlayersManager.self.aim.copy(PlayersManager.self.handle.quaternion);

            if (this.input.movement.lengthSq() > 0) {
                const airControlSpeed = 0.03; // FURTHER REDUCED from 0.04 to 0.03 (70% slower than original)
                const desiredMovement = this.input.movement.clone().normalize().multiplyScalar(airControlSpeed);
                const worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.aim);
                
                if (PlayersManager.self.velocity) {
                    PlayersManager.self.velocity.add(worldSpaceMovement);
                } else {
                    console.warn("Player missing velocity in FPSController.falling");
                    PlayersManager.self.velocity = worldSpaceMovement;
                }
            }
        } catch (err) {
            console.error("Error in FPSController falling:", err);
        }
    }

    // Properly handle grounded movement with safety checks
    static grounded() {
        if (!PlayersManager.self) return;
        
        try {
            // IMPROVED: Increased vertical look limits for more freedom
            // Changed from -0.4/0.45 to -0.7/0.7 (120 degrees total range)
            this.surfacePitch = Math.max(
                -Math.PI * 0.7,
                Math.min(Math.PI * 0.7, this.surfacePitch + this.input.rotation.y)
            );

            if (this.input.landedFrames > 0) this.input.landedFrames--;
            
            if (!PlayersManager.self.surfaceNormal) {
                console.warn("Missing surfaceNormal in FPSController.grounded");
                PlayersManager.self.surfaceNormal = new Vector3(0, 1, 0);
            }
            
            const surfaceNormal = PlayersManager.self.surfaceNormal;
            
            if (!PlayersManager.self.handle || !PlayersManager.self.handle.quaternion) {
                console.warn("Invalid player handle in FPSController.grounded");
                return;
            }
            
            // CRITICAL FIX: Get current view direction before applying rotation
            const viewDirection = new Vector3(0, 0, 1).applyQuaternion(PlayersManager.self.handle.quaternion);
            const rightVector = new Vector3().crossVectors(surfaceNormal, viewDirection).normalize();

            // IMPROVED: Make horizontal rotation more responsive
            const horizontalRotation = this.input.rotation.x * 1.5; // Increased rotation speed by 50%
            
            const desiredDirection = new Vector3()
                .addScaledVector(viewDirection, Math.cos(horizontalRotation))
                .addScaledVector(rightVector, Math.sin(horizontalRotation))
                .projectOnPlane(surfaceNormal)
                .normalize();
                
            // Get world position safely
            const worldPos = new Vector3();
            try {
                PlayersManager.self.handle.getWorldPosition(worldPos);
            } catch (err) {
                console.warn("Error getting world position:", err);
                worldPos.copy(PlayersManager.self.position);
            }
            
            desiredDirection.add(worldPos);

            // Apply rotation
            PlayersManager.self.handle.up.copy(surfaceNormal);
            try {
                PlayersManager.self.handle.lookAt(desiredDirection);
            } catch (err) {
                console.error("Error in lookAt:", err);
            }
            
            // Set camera pitch with INCREASED freedom
            if (Engine.camera) {
                Engine.camera.quaternion.setFromEuler(new Euler(this.surfacePitch, 0, 0));
            }

            // Apply movement
            if (this.input.movement.lengthSq() > 0) {
                const groundMoveSpeed = 0.15; // FURTHER REDUCED from 0.2 to 0.15
                const desiredMovement = this.input.movement.clone().normalize().multiplyScalar(groundMoveSpeed);
                
                // Safety check for quaternion
                let worldSpaceMovement;
                try {
                    worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.handle.quaternion);
                } catch (err) {
                    console.error("Error applying quaternion:", err);
                    worldSpaceMovement = desiredMovement.clone();
                }
                
                // NEW: Check if we're trying to move against a collision normal
                // and block movement along collision surfaces if needed
                if (PlayersManager.self._lastCollisions && PlayersManager.self._lastCollisions.length > 0) {
                    // Get recent collisions (within the last 200ms)
                    const now = Date.now();
                    const recentCollisions = PlayersManager.self._lastCollisions.filter(
                        c => now - c.time < 200
                    );
                    
                    for (const collision of recentCollisions) {
                        const normal = collision.normal;
                        // Check if we're trying to move into this collision
                        const movementDot = worldSpaceMovement.dot(normal);
                        
                        if (movementDot < 0) {
                            // Remove the component of movement in the direction of the collision
                            const normalComponent = normal.clone().multiplyScalar(movementDot);
                            worldSpaceMovement.sub(normalComponent);
                            console.log("Blocked movement into collision surface");
                        }
                    }
                }
                
                if (PlayersManager.self.velocity) {
                    PlayersManager.self.velocity.add(worldSpaceMovement);
                } else {
                    PlayersManager.self.velocity = worldSpaceMovement;
                }
            }

            // Handle jumping
            if (this.input.jump && this.input.landedFrames == 0) {
                const jumpForce = surfaceNormal.clone().multiplyScalar(8); // Reduced jump force
                if (PlayersManager.self.velocity) {
                    PlayersManager.self.velocity.multiplyScalar(0.5);
                    PlayersManager.self.velocity.add(jumpForce);
                } else {
                    PlayersManager.self.velocity = jumpForce;
                }
                this.input.landedFrames = 10;
            }
        } catch (err) {
            console.error("Error in FPSController.grounded:", err);
        }
    }

    // This creates a smooth transition from space to surface movement
    static landing(up) {
        // Check how much its up or down, and convert it to an angle
        const forward = new Vector3(0, 0, -1).applyQuaternion(PlayersManager.self.handle.quaternion);
        const upFacing = forward.dot(up);

        // Dot product gives cos batween the vectors, but we want the direction forwards thats 90deg out so its sin
        const currentYaw = Math.asin(upFacing); 

        // Set the camera angle
        this.surfacePitch = Math.max(
            -Math.PI * 0.4,
            Math.min(Math.PI * 0.45, currentYaw)
        );
    };

    // This creates a smooth transition from surface movement to space
    static liftoff() {
        //get old rotation of camera
        const quaternion = new Quaternion();
        Engine.camera.getWorldQuaternion(quaternion);
        
        //set handle to camera rotation
        Engine.camera.quaternion.setFromEuler(new Euler(0, 0, 0));
        PlayersManager.self.handle.setRotationFromQuaternion(quaternion);
        
        // IMPROVED: Double-check vehicle relationship is cleared
        PlayersManager.self.inVehicle = false;
        if (PlayersManager.self.handle && PlayersManager.self.handle.userData) {
            PlayersManager.self.handle.userData.inVehicle = false;
            PlayersManager.self.handle.userData.currentVehicle = null;
        }
    };

};