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
    
    // NEW: Track free-aiming during falling
    static fallingAimState = {
        pitch: 0,
        yaw: 0
    };

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

    // ENHANCED: Add more robust handling for falling free aim
    static falling() {
        // Update camera rotation based on input
        this.fallingAimState.yaw += this.input.rotation.x;
        this.fallingAimState.pitch = Math.max(
            -Math.PI * 0.45, 
            Math.min(Math.PI * 0.45, this.fallingAimState.pitch + this.input.rotation.y)
        );
        
        // Apply rotation to camera for free-aiming
        if (Engine.camera) {
            Engine.camera.rotation.set(
                this.fallingAimState.pitch,
                this.fallingAimState.yaw,
                0,
                'YXZ'
            );
            
            // Store the camera quaternion for stable transitions
            if (!PlayersManager.self._lastStableCameraQuaternion) {
                PlayersManager.self._lastStableCameraQuaternion = Engine.camera.quaternion.clone();
            }
        }
        
        // Determine movement direction based on camera orientation during falling
        if (this.input.movement.lengthSq() > 0) {
            const movementSpeed = 0.1; // Reduced control during falling
            const desiredMovement = this.input.movement.clone().normalize().multiplyScalar(movementSpeed);
            
            // Transform movement to be relative to camera direction
            const cameraDirection = new Vector3(0, 0, -1).applyQuaternion(Engine.camera.quaternion);
            const cameraRight = new Vector3(1, 0, 0).applyQuaternion(Engine.camera.quaternion);
            
            // Project movement onto horizontal plane for more intuitive air control
            const worldSpaceMovement = new Vector3()
                .addScaledVector(cameraDirection, -desiredMovement.z)
                .addScaledVector(cameraRight, desiredMovement.x);
            
            // Only allow horizontal air control, no vertical boost
            worldSpaceMovement.y = 0;
            worldSpaceMovement.normalize().multiplyScalar(movementSpeed);
            
            PlayersManager.self.velocity.add(worldSpaceMovement);
        }
    }
    
    // ENHANCED: Better transition from falling to grounded
    static landing(up) {
        const player = PlayersManager.self;
        if (!player) return;
        
        try {
            console.log(`FPSController: Landing with normal ${up.x.toFixed(2)}, ${up.y.toFixed(2)}, ${up.z.toFixed(2)}`);
            
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
            player.surfaceNormal = up.clone();
            
            // Reset transition flags
            player.falling = false;
            player.wasOnObject = false;
            player._wasOnObjectTime = 0;
            
            // CRITICAL FIX: Record last landing time and reset proper airborne state
            player._lastLandingTime = Date.now();
            player._wasAirborneBeforeCollision = false;
            
            // NEW: Use centralized alignment for consistent camera behavior
            // Create options with stronger alignment for landings
            const alignOptions = {
                lerpFactor: fromObject ? 0.6 : 0.3, // Stronger for object landings
                forceFullAlignment: false,
                maintainForwardDirection: false,
                skipIfFalling: false,
                alignmentType: 'fpsLanding'
            };
            
            // Only apply if camera exists
            if (Engine.camera) {
                // Store current camera orientation
                const currentCameraQuat = Engine.camera.quaternion.clone();
                
                // Apply alignment to camera with appropriate strength
                ObjectManager.alignObjectToSurface(Engine.camera, normal, alignOptions);
                
                // Notify if debugging is enabled
                if (this._debugMode && window.gameNotify) {
                    window.gameNotify(`Landed on surface (from object: ${fromObject})`);
                }
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

    // ENHANCED: Add safety checks in FPS controllers
    static update(player, camera) {
        try {
            // CRITICAL FIX: Complete defensive programming throughout this method
            
            // First check if PlayersManager exists and has self property
            if (typeof PlayersManager === 'undefined' || !PlayersManager) {
                console.warn("FPSController update called but PlayersManager is not defined");
                return null;
            }
            
            if (!PlayersManager.self) {
                console.warn("FPSController update called with no player in PlayersManager.self");
                return null;
            }
            
            // If player parameter is undefined, use PlayersManager.self
            if (!player) {
                player = PlayersManager.self;
                console.log("Using PlayersManager.self as player was undefined");
            }
            
            // Similarly for camera parameter
            if (!camera && typeof Engine !== 'undefined' && Engine?.camera) {
                camera = Engine.camera;
                console.log("Using Engine.camera as camera was undefined");
            }
            
            // CRITICAL FIX: Verify player has all the required properties
            if (!player || typeof player !== 'object') {
                console.warn("Invalid player object in FPSController.update");
                return null;
            }
            
            // CRITICAL FIX: Ensure player has all required properties, using defaults if missing
            if (typeof player.falling === 'undefined') player.falling = true;
            if (typeof player.standingOnObject === 'undefined') player.standingOnObject = false;
            if (typeof player.currentlyColliding === 'undefined') player.currentlyColliding = false;
            
            // IMPROVED: Reset collision state on any input, not just rotation
            if (this.input.movement.lengthSq() > 0 || this.input.rotation.x !== 0 || this.input.rotation.y !== 0) {
                // Reset collision state flags when receiving any input
                const collisionEndsWithInput = Date.now() - (player._lastCollisionTime || 0) > 300;
                
                if (collisionEndsWithInput) {
                    player._collisionInProgress = false;
                    
                    // Reset camera frozen state when no collision is in progress
                    if (player._cameraFrozen) {
                        player._cameraFrozen = false;
                    }
                }
            }

            // CRITICAL FIX: Now safe to check surface state
            const isOnSurface = !player.falling || player.standingOnObject || player.currentlyColliding;
            
            if (!isOnSurface) {
                this.falling();
            } else {
                this.grounded();
                
                // Ensure falling flag is explicitly set to false
                if (player.falling) {
                    player.falling = false;
                }
            }

            // NEW: For test cube collisions, enforce camera orientation
            if (camera && player._lastCollisionObjectType === 'testCube') {
                const timeSinceCollision = Date.now() - (player._lastCollisionTime || 0);
                
                // Apply strong correction for a short period after collision
                if (timeSinceCollision < 1000) { // 1 second of aggressive correction
                    this.enforceCameraOrientation(camera, player);
                }
            }

            // Reset input for next frame
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.jump = false;
        } catch (err) {
            console.error("Error in FPSController update:", err);
        }
        
        // NEW: Safely align camera with planet surface if data exists
        if (player && camera) {
            // IMPROVED: Use surface normal from object rather than recalculating
            // First try player's userData for the pre-calculated normal
            const surfaceNormal = player.surfaceNormal || 
                                 player._planetSurfaceNormal || 
                                 (player.handle && player.handle.userData && 
                                  player.handle.userData.surfaceNormal);
            
            if (surfaceNormal) {
                camera.up.copy(surfaceNormal);
            }
        }

        return null;
    }

    // NEW: Add dedicated method to prevent camera inversion
    static enforceCameraOrientation(camera, player) {
        if (!camera || !player) return;
        
        try {
            // IMPROVED: Use surface normal from object rather than recalculating
            // Use pre-calculated normal from player object
            const upVector = player.surfaceNormal || 
                           player._planetSurfaceNormal || 
                           (player.handle && player.handle.userData && 
                            player.handle.userData.surfaceNormal) ||
                           new Vector3(0, 1, 0);
            
            // Force camera up to match planet normal
            camera.up.copy(upVector);
            
            // Get current camera forward and up directions
            const cameraForward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const cameraUp = camera.up;
            
            // Check if camera orientation is getting misaligned with planet
            const upAlignment = cameraUp.dot(upVector);
            
            // If test cube collision caused misalignment, fix it aggressively
            const isTestCubeCollision = player._lastCollisionObjectType === 'testCube';
            const isRecentCollision = player._lastCollisionTime && 
                (Date.now() - player._lastCollisionTime < 600);
            
            if ((isTestCubeCollision && isRecentCollision) || upAlignment < 0.8) {
                // First force camera up to match planet
                camera.up.copy(upVector);
                
                // If we have stored stable quaternion, use it
                if (player._lastStableQuaternion) {
                    camera.quaternion.slerp(player._lastStableQuaternion, 0.9);
                } else {
                    // Create a properly aligned quaternion
                    this.performEmergencyCameraAlignment(camera, player, upVector);
                }
                
                console.log("Applied camera orientation correction");
            }
        } catch (err) {
            console.error("Error in enforceCameraOrientation:", err);
        }
    }
    
    // NEW: Extract emergency camera alignment to a separate method for reuse
    static performEmergencyCameraAlignment(camera, player, upVector) {
        console.log("Performing emergency camera alignment");
        
        // 1. First force the correct up vector
        camera.up.copy(upVector);
        
        // 2. Start with the player's forward direction
        if (player.handle) {
            // Get the player's forward direction
            const playerForward = new Vector3(0, 0, -1).applyQuaternion(player.handle.quaternion);
            
            // Project this onto the plane defined by the up vector
            const projectedForward = playerForward.clone().projectOnPlane(upVector).normalize();
            
            if (projectedForward.lengthSq() > 0.01) {
                // Calculate a target position to look at
                const lookTarget = player.position.clone().add(projectedForward.multiplyScalar(5));
                
                // Force camera to look at this target
                const originalUp = camera.up.clone();
                camera.lookAt(lookTarget);
                camera.up.copy(originalUp);
                
                // Reset pitch to zero
                this.surfacePitch = 0;
                
                // Store this as the last good orientation
                player._lastGoodCameraOrientation = {
                    quaternion: camera.quaternion.clone(),
                    up: camera.up.clone(),
                    pitch: this.surfacePitch,
                    time: Date.now()
                };
                
                console.log("Complete camera orientation reset applied");
                return true;
            }
        }
        
        // Fallback method if we couldn't use player forward
        const cameraForward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const projectedForward = cameraForward.projectOnPlane(upVector).normalize();
        
        // If we have a valid projection, use it
        if (projectedForward.lengthSq() > 0.01) {
            const right = new Vector3().crossVectors(upVector, projectedForward).normalize();
            
            // Recalculate forward to ensure orthogonality
            const correctedForward = new Vector3().crossVectors(right, upVector).normalize();
            
            // Build rotation matrix from orthogonal vectors
            const rotMatrix = new Matrix4().makeBasis(
                right,
                upVector,
                correctedForward.clone().negate() // negate for camera space
            );
            
            // Extract quaternion from rotation matrix
            const correctionQuat = new Quaternion().setFromRotationMatrix(rotMatrix);
            
            // Apply the correction with strong blending
            camera.quaternion.slerp(correctionQuat, 0.9);
            
            // Reset pitch
            this.surfacePitch = 0;
            
            console.log("Applied fallback emergency camera orientation correction");
            return true;
        }
        
        // If all else fails, just reset to default orientation
        camera.up.copy(upVector);
        camera.lookAt(player.position.clone().add(new Vector3(1, 0, 0))); // Look along X axis as default
        this.surfacePitch = 0;
        
        console.log("Applied last-resort camera orientation reset");
        return true;
    }

    static falling() {
        // CRITICAL FIX: Add defensive programming
        if (typeof PlayersManager === 'undefined' || !PlayersManager || !PlayersManager.self) return;
        const player = PlayersManager.self;
        if (!player.handle) return;
        
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
            
            player.handle.quaternion.multiply(yawRotation).multiply(pitchRotation);
            
            // Safely copy quaternion to aim
            if (!player.aim) player.aim = new Quaternion();
            player.aim.copy(player.handle.quaternion);

            if (this.input.movement.lengthSq() > 0) {
                const airControlSpeed = 0.03;
                const desiredMovement = this.input.movement.clone().normalize().multiplyScalar(airControlSpeed);
                const worldSpaceMovement = desiredMovement.applyQuaternion(player.aim);
                
                // Ensure velocity exists
                if (!player.velocity) player.velocity = new Vector3();
                player.velocity.add(worldSpaceMovement);
            }
        } catch (err) {
            console.error("Error in FPSController falling:", err);
        }
    }

    // Properly handle grounded movement with safety checks and collision handling
    static grounded() {
        if (typeof PlayersManager === 'undefined' || !PlayersManager || !PlayersManager.self) return;
        const player = PlayersManager.self;
        
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
            
            // NEW: Always save the planet's surface normal as the definitive orientation reference
            // This ensures we always have a stable reference point for camera orientation
            if (PlayersManager.self.soi && PlayersManager.self.soi.object) {
                const planetSurfaceNormal = PlayersManager.self.position.clone()
                    .sub(PlayersManager.self.soi.object.position)
                    .normalize();
                
                // Store this separately from surfaceNormal which might get changed during collisions
                PlayersManager.self._planetSurfaceNormal = planetSurfaceNormal;
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
                    // NEW: First check if we have the planet's surface normal as reference
                    const upVector = PlayersManager.self._planetSurfaceNormal || 
                                     PlayersManager.self.surfaceNormal || 
                                     new Vector3(0, 1, 0);
                    
                    // Force camera to use correct up vector
                    Engine.camera.up.copy(upVector);
                    
                    // Then apply the stored quaternion
                    Engine.camera.quaternion.copy(PlayersManager.self._lastStableQuaternion);
                    
                    // Force the pitch to stay constant too
                    if (PlayersManager.self._lastStablePitch !== undefined) {
                        this.surfacePitch = PlayersManager.self._lastStablePitch;
                    }
                    
                    // NEW: Extra validation - if camera orientation looks wrong, use last good one
                    if (PlayersManager.self._lastGoodCameraOrientation) {
                        const cameraUp = Engine.camera.up.clone();
                        const cameraForward = new Vector3(0, 0, -1).applyQuaternion(Engine.camera.quaternion);
                        const upDot = cameraUp.dot(upVector);
                        
                        // If camera orientation is incorrect after restoration
                        if (upDot < 0.5) {
                            console.log("Using last good camera orientation after failed restoration");
                            Engine.camera.quaternion.copy(PlayersManager.self._lastGoodCameraOrientation.quaternion);
                            Engine.camera.up.copy(PlayersManager.self._lastGoodCameraOrientation.up);
                            this.surfacePitch = PlayersManager.self._lastGoodCameraOrientation.pitch;
                        }
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
                
                // NEW: Check if we're trying to move toward any no-go object from physics system
                if (player._noGoObjects && player._noGoObjects.size > 0 && player._blockMovementToward) {
                    const moveDir = worldSpaceMovement.clone().normalize();
                    const blockNormal = player._blockMovementToward.normal;
                    
                    // If moving toward blocked direction, cancel that component
                    const moveDot = moveDir.dot(blockNormal.clone().negate());
                    if (moveDot > 0) {
                        // Cancel movement into the blocked direction
                        const blockedComponent = blockNormal.clone().negate().multiplyScalar(moveDot * worldSpaceMovement.length());
                        worldSpaceMovement.sub(blockedComponent);
                        
                        console.log("FPS controller blocked movement toward known collision object");
                    }
                }
                
                // NEW: Check for movement toward actively colliding objects
                if (player.activeCollisions && player.activeCollisions.length > 0) {
                    const now = Date.now();
                    const recentCollisions = player.activeCollisions.filter(c => now - c.time < 100);
                    
                    for (const collision of recentCollisions) {
                        const normal = collision.normal;
                        const moveDot = worldSpaceMovement.dot(normal.clone().negate());
                        
                        if (moveDot > 0) {
                            // Cancel movement into the collision
                            const blockedComponent = normal.clone().negate().multiplyScalar(moveDot);
                            worldSpaceMovement.sub(blockedComponent);
                        }
                    }
                }
                
                // Check if movement should be blocked due to recent collisions from physics system
                if (PlayersManager.self._movementBlocked) {
                    const moveDirection = worldSpaceMovement.clone().normalize();
                    const dotWithNormal = moveDirection.dot(PlayersManager.self._movementBlocked.normal);
                    
                    if (dotWithNormal < 0) {
                        // CRITICAL FIX: Mark that a collision is in progress - this prevents camera rotation changes
                        PlayersManager.self._collisionInProgress = true;
                        PlayersManager.self._lastCollisionTime = Date.now();
                        
                        // FIXED: Debug the total count of active collisions
                        if (PlayersManager.self.activeCollisions) {
                            console.log(`Movement blocked by collision - active collisions: ${PlayersManager.self.activeCollisions.length}`);
                        }
                        
                        // MODIFIED: Simpler blocking approach - only remove the component of movement that's
                        // going into the collision normal direction
                        const blockerNormal = PlayersManager.self._movementBlocked.normal;
                        
                        // Calculate how much of the movement is going into the blocked direction
                        const blockedAmount = worldSpaceMovement.dot(blockerNormal);
                        
                        if (blockedAmount < 0) {
                            // Remove the component going into the blocked direction
                            const blockedComponent = blockerNormal.clone().multiplyScalar(blockedAmount);
                            worldSpaceMovement.sub(blockedComponent);
                            
                            console.log("Movement blocked in collision direction without deflection");
                        }
                        
                        // CRITICAL FIX: Make sure we preserve the original surfaceNormal
                        // This ensures planet orientation remains consistent during collisions
                        if (PlayersManager.self._originalSurfaceNormal) {
                            PlayersManager.self.surfaceNormal = PlayersManager.self._originalSurfaceNormal.clone();
                        }
                    }
                } else {
                    // Check if we recently had a collision and should still protect camera
                    const now = Date.now();
                    if (PlayersManager.self._lastCollisionTime && 
                       (now - PlayersManager.self._lastCollisionTime < 500)) { // Increased from 300ms to 500ms
                        // Still in collision recovery period, keep camera rotation protected
                        PlayersManager.self._collisionInProgress = true;
                        
                        // Also preserve surface normal during recovery period
                        if (PlayersManager.self._originalSurfaceNormal) {
                            PlayersManager.self.surfaceNormal = PlayersManager.self._originalSurfaceNormal.clone();
                        }
                    } else {
                        // No recent collisions, allow camera rotation changes
                        PlayersManager.self._collisionInProgress = false;
                        
                        // ADDED: Store current surface normal as the original for reference in collisions
                        if (PlayersManager.self.surfaceNormal) {
                            PlayersManager.self._originalSurfaceNormal = PlayersManager.self.surfaceNormal.clone();
                        }
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
                
                // Also clear the recent collision flag after a short delay if not moving
                if (PlayersManager.self._wasRecentCollision) {
                    // After 100ms of not moving, reset the recent collision flag
                    setTimeout(() => {
                        if (PlayersManager.self) {
                            PlayersManager.self._wasRecentCollision = false;
                        }
                    }, 100);
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
            
            // NEW: Use centralized alignment for consistent camera behavior
            // Create options with stronger alignment for landings
            const alignOptions = {
                lerpFactor: fromObject ? 0.6 : 0.3, // Stronger for object landings
                forceFullAlignment: false,
                maintainForwardDirection: false,
                skipIfFalling: false,
                alignmentType: 'fpsLanding'
            };
            
            // Only apply if camera exists
            if (Engine.camera) {
                // Store current camera orientation
                const currentCameraQuat = Engine.camera.quaternion.clone();
                
                // Apply alignment to camera with appropriate strength
                ObjectManager.alignObjectToSurface(Engine.camera, normal, alignOptions);
                
                // Notify if debugging is enabled
                if (this._debugMode && window.gameNotify) {
                    window.gameNotify(`Landed on surface (from object: ${fromObject})`);
                }
            }
            
        } catch (err) {
            console.error("Error in FPSController landing:", err);
        }
    }
};