import { Quaternion, Vector3, Euler, Matrix4 } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    // Input adapter that standardizes different input methods (keyboard/mouse, gamepad)
    // into a shared format that the FPS controller can process
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
                    
                    // FIXED: Increase camera height to prevent clipping through objects and ground
                    // Changed from 1 to 1.6 units above player center
                    Engine.camera.position.set(0, 1.6, 0);
                    
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
                    // FIXED: Increase camera height to prevent clipping through objects and ground
                    // Changed from 1 to 1.6 units above player center
                    Engine.camera.position.set(0, 1.6, 0);
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
    static update(player, camera) {
        if (!PlayersManager.self) {
            console.warn("FPSController update called with no player");
            return null;
        }
        
        try {
            // IMPORTANT FIX: If we receive rotation input, ensure we can aim even after collisions
            if (this.input.rotation.x !== 0 || this.input.rotation.y !== 0) {
                // Reset collision state flags when receiving rotation input
                PlayersManager.self._collisionInProgress = false;
                
                // Reset camera frozen state to ensure aiming works after collisions
                if (PlayersManager.self._cameraFrozen) {
                    PlayersManager.self._cameraFrozen = false;
                    console.log("Camera unfrozen due to aim input");
                }
            }

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
        
        // Align camera with planet surface normal if on ground
        if (!player || !camera) return;

        // Reset camera freezing if we receive input
        if (this.input.rotation.x !== 0 || this.input.rotation.y !== 0) {
            player._collisionInProgress = false;
            if (player._cameraFrozen) {
                player._cameraFrozen = false;
            }
        }

        // Prevent camera from flipping upside down
        if (camera.up.y < 0) {
            camera.up.set(0, 1, 0);
            camera.lookAt(player.position);
        }

        // Ensure camera has correct position
        const cameraHeight = player.falling ? 1.6 : 1.4; // Lower when not falling
        camera.position.copy(player.position).add(new THREE.Vector3(0, cameraHeight, 0));

        // NEW: Smooth recovery after collision
        if (player._needsOrientationFix && player._orientationFixTime) {
            const timeSinceCollision = Date.now() - player._orientationFixTime;
            
            if (timeSinceCollision < 500) { // Within 500ms of collision
                // Get current planet normal
                const planetNormal = player.soi?.object ? 
                    player.position.clone().sub(player.soi.object.position).normalize() : 
                    new Vector3(0, 1, 0);
                
                // Ensure camera is correctly aligned with surface
                camera.up.copy(planetNormal);
                
                // If player has last collision normal, use for better alignment
                if (player._lastCollisionNormal) {
                    // Project camera forward direction onto the collision plane
                    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
                    const projectedForward = forward.projectOnPlane(player._lastCollisionNormal).normalize();
                    
                    if (projectedForward.lengthSq() > 0.01) {
                        // Create a target position to look at along the projected forward
                        const targetPos = player.position.clone().add(projectedForward.multiplyScalar(5));
                        camera.lookAt(targetPos);
                    }
                }
                
                // Restore surface pitch to a reasonable value if it was extreme
                if (Math.abs(this.surfacePitch) > Math.PI * 0.5) {
                    this.surfacePitch = 0;
                }
            } else {
                // Clear fix flag after recovery period
                player._needsOrientationFix = false;
            }
        }

        // Default surface alignment
        if (!player.falling && player.soi?.object) {
            const planetNormal = player.position.clone()
                .sub(player.soi.object.position)
                .normalize();
            camera.up.copy(planetNormal);
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

    // Properly handle grounded movement with safety checks and collision handling
    static grounded() {
        if (!PlayersManager.self) return;
        
        try {
            // IMPROVED: Always process rotation input even during collisions
            // This ensures aiming always works regardless of collision state
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
            
            // Store current camera rotation for preservation during collisions
            if (Engine.camera) {
                // IMPROVED: More aggressively preserve camera orientation during collisions
                if (!PlayersManager.self._lastStableCameraRotation) {
                    PlayersManager.self._lastStableCameraRotation = new Euler().copy(Engine.camera.rotation);
                    PlayersManager.self._lastStableQuaternion = Engine.camera.quaternion.clone();
                    PlayersManager.self._lastStableTime = Date.now();
                } else if (!PlayersManager.self._collisionInProgress) {
                    // Only update stable rotation if we're not in a collision
                    PlayersManager.self._lastStableCameraRotation.copy(Engine.camera.rotation);
                    PlayersManager.self._lastStableQuaternion = Engine.camera.quaternion.clone();
                    PlayersManager.self._lastStableTime = Date.now();
                }

                // CRITICAL: Save the current pitch to restore during collisions
                if (!PlayersManager.self._collisionInProgress) {
                    PlayersManager.self._lastStablePitch = this.surfacePitch;
                }
            }

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

            // Apply rotation only if we're not in a collision
            if (!PlayersManager.self._collisionInProgress) {
                // Record the pre-collision handle rotation
                PlayersManager.self._lastStableHandleRotation = PlayersManager.self.handle.quaternion.clone();
                
                // Apply rotation
                PlayersManager.self.handle.up.copy(surfaceNormal);
                try {
                    PlayersManager.self.handle.lookAt(desiredDirection);
                } catch (err) {
                    console.error("Error in lookAt:", err);
                }
            }
            
            // CRITICAL FIX: Restore preserved camera rotation during collisions
            if (PlayersManager.self._collisionInProgress) {
                // Forcefully restore the last stable camera state
                if (PlayersManager.self._lastStableQuaternion && Engine.camera) {
                    // Completely override any camera rotation changes
                    Engine.camera.quaternion.copy(PlayersManager.self._lastStableQuaternion);
                    
                    // Force the pitch to stay constant too
                    if (PlayersManager.self._lastStablePitch !== undefined) {
                        this.surfacePitch = PlayersManager.self._lastStablePitch;
                    }
                }
                
                // CRITICAL: Restore player handle rotation too
                if (PlayersManager.self._lastStableHandleRotation) {
                    PlayersManager.self.handle.quaternion.copy(PlayersManager.self._lastStableHandleRotation);
                }
            } else {
                // Normal camera update when not in collision
                if (Engine.camera) {
                    Engine.camera.quaternion.setFromEuler(new Euler(this.surfacePitch, 0, 0));
                }
            }

            // Apply movement - IMPROVED: Check for collisions before applying movement
            if (this.input.movement.lengthSq() > 0) {
                const groundMoveSpeed = 0.12;
                const desiredMovement = this.input.movement.clone().normalize().multiplyScalar(groundMoveSpeed);
                
                // Safety check for quaternion
                let worldSpaceMovement;
                try {
                    worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.handle.quaternion);
                } catch (err) {
                    console.error("Error applying quaternion:", err);
                    worldSpaceMovement = desiredMovement.clone();
                }
                
                // NEW: Check if movement should be blocked due to recent collisions from physics system
                if (PlayersManager.self._movementBlocked) {
                    const moveDirection = worldSpaceMovement.clone().normalize();
                    const dotWithNormal = moveDirection.dot(PlayersManager.self._movementBlocked.normal);
                    
                    if (dotWithNormal < 0) {
                        // CRITICAL FIX: Mark that a collision is in progress - this prevents camera rotation changes
                        PlayersManager.self._collisionInProgress = true;
                        PlayersManager.self._lastCollisionTime = Date.now();
                        
                        // IMPROVED: Add a smoother transition for camera when blocked
                        // We're trying to move into the blocked direction - project movement along surface
                        const surfaceNormal = PlayersManager.self.surfaceNormal;
                        
                        // Create a direction perpendicular to both normals for sliding
                        const blockerNormal = PlayersManager.self._movementBlocked.normal;
                        
                        // Create a direction perpendicular to both normals for sliding
                        const slideDir = new Vector3().crossVectors(surfaceNormal, blockerNormal).normalize();
                        
                        if (slideDir.lengthSq() > 0.01) {
                            // Project onto slide direction
                            const slideComponent = worldSpaceMovement.dot(slideDir);
                            
                            // SMOOTHING: Apply gradual transition to slide direction
                            // Store the last movement direction to blend with new direction
                            if (!PlayersManager.self._lastMovementDir) {
                                PlayersManager.self._lastMovementDir = new Vector3();
                            }
                            
                            // Create a smoothed slide direction by blending with previous direction
                            const blendedDir = slideDir.clone().multiplyScalar(slideComponent);
                            if (PlayersManager.self._lastMovementDir.lengthSq() > 0) {
                                // Blend between old and new directions (70% new, 30% old)
                                blendedDir.lerp(PlayersManager.self._lastMovementDir, 0.3);
                            }
                            
                            // Store for next frame and normalize
                            PlayersManager.self._lastMovementDir.copy(blendedDir).normalize();
                            
                            // Apply the blended movement with reduced speed
                            worldSpaceMovement.copy(blendedDir.normalize().multiplyScalar(slideComponent * 0.7));
                            
                            console.log("FPS movement projected along collision surface (smoothed)");
                        } else {
                            // If valid slide direction can't be found, severely restrict movement
                            worldSpaceMovement.multiplyScalar(0.1); // 90% reduction
                            console.log("Movement heavily restricted due to collision");
                        }
                    }
                } else {
                    // Check if we recently had a collision and should still protect camera
                    const now = Date.now();
                    if (PlayersManager.self._lastCollisionTime && 
                       (now - PlayersManager.self._lastCollisionTime < 500)) { // Increased from 300ms to 500ms
                        // Still in collision recovery period, keep camera rotation protected
                        PlayersManager.self._collisionInProgress = true;
                    } else {
                        // No recent collisions, allow camera rotation changes
                        PlayersManager.self._collisionInProgress = false;
                    }
                }
                
                // FIXED: Check movement magnitude before applying to prevent accumulating tiny movements
                if (worldSpaceMovement.lengthSq() > 0.0001) {
                    if (PlayersManager.self.velocity) {
                        PlayersManager.self.velocity.add(worldSpaceMovement);
                    } else {
                        PlayersManager.self.velocity = worldSpaceMovement.clone();
                    }
                }
            } else {
                // NEW: When not moving, gradually clear the last movement direction
                if (PlayersManager.self._lastMovementDir) {
                    PlayersManager.self._lastMovementDir.multiplyScalar(0.8); // Decay previous direction
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
                
                // ADDED: Mark this as an intentional jump to help physics state validation
                PlayersManager.self.intentionalJump = true;
                PlayersManager.self.jumpInProgress = true;
                
                // Clear the intentional jump flag after a delay
                setTimeout(() => {
                    if (PlayersManager.self) {
                        PlayersManager.self.intentionalJump = false;
                    }
                }, 500);
                
                // Clear jump in progress flag after longer delay
                setTimeout(() => {
                    if (PlayersManager.self) {
                        PlayersManager.self.jumpInProgress = false;
                    }
                }, 1000);
            }
        } catch (err) {
            console.error("Error in FPSController.grounded:", err);
        }
    }

    // Enhanced landing handler to better handle transitions from objects
    static landing(normal) {
        const player = PlayersManager.self;
        if (!player) return;
        
        try {
            console.log(`FPSController: Landing with normal ${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)}`);
            
            // CRITICAL FIX: More aggressive landing prevention for object collisions
            const now = Date.now();
            
            // Prevent landing events during continuous surface collisions
            if (player._lastLandingTime && now - player._lastLandingTime < 400) {
                console.log("Skipping redundant landing event - already landed recently");
                return;
            }
            
            // CRITICAL FIX: Also check if player was already on the ground
            // If the player is colliding with an object but was never airborne,
            // this is NOT a landing event
            if (player.currentlyColliding && !player._wasAirborneBeforeCollision) {
                console.log("Skipping false landing event - player never left ground");
                return;
            }
            
            // ENHANCED: Track landing source for better debugging
            const fromObject = player.wasOnObject;
            
            // Save the normal for reference
            player.surfaceNormal = normal.clone();
            
            // Reset transition flags
            player.falling = false;
            player.wasOnObject = false;
            player._wasOnObjectTime = 0;
            
            // CRITICAL FIX: Record last landing time and reset proper airborne state
            player._lastLandingTime = Date.now();
            player._wasAirborneBeforeCollision = false;
            
            // Camera adjustment depends on the orientation of the landing surface
            const camUp = new Vector3(0, 1, 0);
            const alignmentDot = camUp.dot(normal);
            
            // CRITICAL FIX: Only do significant camera realignment for major orientation changes
            // or when landing from a significant height
            const significantFall = player._fallStartHeight ? 
                (player._fallStartHeight - player.position.length()) > 5 : false;
                
            if (Math.abs(alignmentDot) < 0.95 || significantFall) {
                console.log(`Camera realignment needed for angled landing (dot: ${alignmentDot.toFixed(2)})`);
                
                // Calculate rotation to align camera with surface normal
                const rotationAxis = new Vector3().crossVectors(camUp, normal).normalize();
                if (rotationAxis.lengthSq() > 0.001) {  // Valid rotation axis
                    const angle = Math.acos(Math.max(-1, Math.min(1, alignmentDot)));
                    
                    // Create quaternion for alignment
                    const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                    
                    // Apply the rotation to the camera - use a stronger slerp factor if coming from an object or significant fall
                    if (fromObject || significantFall) {
                        // More aggressive camera correction when landing from objects or big falls
                        Engine.camera.quaternion.slerp(alignQuat, 0.8);
                    } else {
                        // REDUCED alignment factor for minor landings (like stepping off small objects)
                        Engine.camera.quaternion.slerp(alignQuat, 0.3);
                    }
                }
            } else {
                // For very minor landings, do minimal camera adjustment
                console.log("Minor landing - minimal camera adjustment");
            }
            
            // Notify if debugging is enabled
            if (this._debugMode && window.gameNotify) {
                window.gameNotify(`Landed on surface (from object: ${fromObject})`);
            }
        } catch (err) {
            console.error("Error in FPSController landing:", err);
        }
    }

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
        
        // ADDED: Store height at liftoff to measure fall distance
        if (PlayersManager.self && PlayersManager.self.position) {
            PlayersManager.self._fallStartHeight = PlayersManager.self.position.length();
            
            // CRITICAL FIX: Track that player is now actually airborne
            PlayersManager.self._wasAirborneBeforeCollision = true;
        }
    };

};