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

    // Properly handle grounded movement with safety checks and collision handling
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

            // Apply movement - IMPROVED: Check for collisions before applying movement
            if (this.input.movement.lengthSq() > 0) {
                const groundMoveSpeed = 0.12; // Reduced from 0.15 to 0.12 for better collision handling
                const desiredMovement = this.input.movement.clone().normalize().multiplyScalar(groundMoveSpeed);
                
                // Safety check for quaternion
                let worldSpaceMovement;
                try {
                    worldSpaceMovement = desiredMovement.applyQuaternion(PlayersManager.self.handle.quaternion);
                } catch (err) {
                    console.error("Error applying quaternion:", err);
                    worldSpaceMovement = desiredMovement.clone();
                }
                
                // NEW: Check if movement would go into any active collisions
                let movementBlocked = false;
                if (PlayersManager.self.activeCollisions && PlayersManager.self.activeCollisions.length > 0) {
                    // Process recent collisions (within last 200ms)
                    const now = Date.now();
                    const recentCollisions = PlayersManager.self.activeCollisions.filter(c => now - c.time < 200);
                    
                    // Check each collision surface
                    for (const collision of recentCollisions) {
                        // Check if our intended movement goes into this collision
                        const movementIntoCollision = worldSpaceMovement.dot(collision.normal) < 0;
                        
                        if (movementIntoCollision) {
                            // Calculate component of movement that's going into collision
                            const blockedComponent = collision.normal.clone().multiplyScalar(
                                worldSpaceMovement.dot(collision.normal)
                            );
                            
                            // CRITICAL FIX: Project movement onto the planet surface plane, not just the collision plane
                            // This prevents any upward bouncing during collisions
                            const groundPlaneMovement = worldSpaceMovement.clone().projectOnPlane(surfaceNormal);
                            
                            // Now project this ground plane movement onto the collision plane
                            worldSpaceMovement.copy(groundPlaneMovement.projectOnPlane(collision.normal));
                            
                            // Apply some friction along the surface but not too much
                            worldSpaceMovement.multiplyScalar(0.9); // Reduced from 0.8 to 0.9 - less friction
                            
                            console.log("FPSController: Projected movement onto ground plane to prevent bouncing");
                            movementBlocked = true;
                            
                            // If movement is now very small, just cancel it entirely
                            if (worldSpaceMovement.lengthSq() < 0.0005) { // Reduced from 0.001 to 0.0005
                                worldSpaceMovement.set(0, 0, 0);
                                break;
                            }
                        }
                    }
                    
                    // ENHANCED: Also check if currently colliding with any test cubes
                    if (PlayersManager.self.currentlyColliding || 
                        (typeof window !== 'undefined' && window.ObjectManager && PlayersManager.self.handle)) {
                        
                        try {
                            // Perform an immediate collision check with nearby test cubes
                            const testCubes = window.ObjectManager.collidableObjects.filter(c => 
                                c && c.type === 'testCube' && 
                                c.object && 
                                c.object.position.distanceTo(PlayersManager.self.position) < 5
                            );
                            
                            if (testCubes.length > 0) {
                                console.log(`Found ${testCubes.length} nearby test cubes - checking for immediate collision`);
                                
                                // For each test cube, see if we're trying to move into it
                                for (const testCube of testCubes) {
                                    // Get vector from player to test cube center
                                    const toTestCube = testCube.object.position.clone().sub(PlayersManager.self.position).normalize();
                                    
                                    // If we're trying to move toward the test cube
                                    if (worldSpaceMovement.dot(toTestCube) > 0) {
                                        // IMPROVED: Don't slow down too much, just redirect
                                        // Get a vector perpendicular to both the surface normal and the test cube direction
                                        const perpendicular = new Vector3().crossVectors(surfaceNormal, toTestCube).normalize();
                                        
                                        // Redirect movement along this perpendicular vector
                                        if (perpendicular.lengthSq() > 0.1) {
                                            // Project movement onto this perpendicular direction
                                            const redirectedMovement = worldSpaceMovement.projectOnVector(perpendicular);
                                            if (redirectedMovement.lengthSq() > 0.01) {
                                                worldSpaceMovement.copy(redirectedMovement);
                                                console.log("Movement redirected along test cube surface");
                                            } else {
                                                // If projection is too small, apply a small sidestep
                                                worldSpaceMovement.copy(perpendicular.multiplyScalar(0.05));
                                                console.log("Applied sidestep movement along obstacle");
                                            }
                                        } else {
                                            // If perpendicular direction is invalid, just scale back movement
                                            worldSpaceMovement.multiplyScalar(0.5);
                                            console.log("Movement scaled back near test cube");
                                        }
                                        break;
                                    }
                                }
                            }
                        } catch (checkError) {
                            console.error("Error checking test cube collisions:", checkError);
                        }
                    }
                }
                
                if (PlayersManager.self.velocity) {
                    // If movement wasn't completely blocked, apply it
                    if (worldSpaceMovement.lengthSq() > 0.0001) {
                        PlayersManager.self.velocity.add(worldSpaceMovement);
                    }
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
            
            // ENHANCED: Track landing source for better debugging
            const fromObject = player.wasOnObject;
            
            // Save the normal for reference
            player.surfaceNormal = normal.clone();
            
            // Reset transition flags
            player.falling = false;
            player.wasOnObject = false;
            player._wasOnObjectTime = 0;
            
            // FIX: Record last landing time to prevent repeated landings
            player._lastLandingTime = Date.now();
            
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
        }
    };

};