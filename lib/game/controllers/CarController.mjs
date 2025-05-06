// Controller specifically for car vehicle operation - REVAMPED FOR SURFACE ALIGNMENT
import { Vector3, Quaternion, Euler, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';
import PlayersManager from '../players.mjs'; // CRITICAL FIX: Add missing PlayersManager import

export default class CarController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };

    // Third-person camera configuration for car
    static cameraDistance = 15; 
    static cameraHeight = 5;    
    static cameraLookOffset = 3;    
    
    // Camera state to track accumulated rotation
    static cameraRotation = {
        yaw: Math.PI,
        pitch: 0.2
    };
    
    // Camera constraints
    static MIN_PITCH = -0.4;
    static MAX_PITCH = 0.7;
    static ROTATION_SPEED = 0.003;
    
    // SIMPLIFIED: Camera state with minimal needed properties
    static cameraState = {
        lastPosition: new Vector3(),
        smoothPosition: null,
        smoothUpVector: null,
    };
    
    // Steering state
    static steeringAngle = 0;
    static maxSteeringAngle = 0.4;
    
    // ADDED: Track vehicle state for better physics
    static vehicleState = {
        lastGroundHeight: 0,
        wheelPositions: [],
        previousPosition: null,
        previousRotation: null,
        airTime: 0,
        surfaceContactPoints: [],
        lastSurfaceNormal: null,
        isStable: false,
        bounceCount: 0
    };
    
    // SIMPLIFIED: Reset controller state when entering car
    static reset() {
        console.log('Initializing Car Controller with simplified camera');
        
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        try {
            // Reset camera and steering states
            this.cameraRotation = { yaw: Math.PI, pitch: 0.2 };
            this.cameraState = {
                lastPosition: new Vector3(),
                smoothPosition: null,
                smoothUpVector: null,
            };
            this.steeringAngle = 0;
            
            // Reset vehicle state tracking
            this.vehicleState = {
                lastGroundHeight: 0,
                wheelPositions: [],
                previousPosition: car.position.clone(),
                previousRotation: car.quaternion.clone(),
                airTime: 0,
                surfaceContactPoints: [],
                lastSurfaceNormal: car.userData.surfaceNormal ? car.userData.surfaceNormal.clone() : new Vector3(0, 1, 0),
                isStable: false,
                bounceCount: 0
            };
            
            // Reset input
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Mark car as actively controlled by this controller
            car.userData.isActivelyControlled = true;
            
            // IMPROVED: Don't override falling state - let physics system manage it
            // car.userData.falling = false; // REMOVED: Don't force falling state
            
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            car.userData._controlledByCarController = true;
            car.userData._controllerStartTime = Date.now();
            car.userData._controlType = 'CarController';
            
            // ENHANCED: Grace period for both falling state and collision prevention
            car.userData._entryGracePeriod = true;
            car.userData._entryGraceEndTime = Date.now() + 2000; // Extended to 2 seconds
            
            // CRITICAL FIX: Ensure collision is disabled between player and vehicle
            if (PlayersManager && PlayersManager.self && PlayersManager.self.handle) {
                // Set bidirectional collision exclusion
                car._ignoreCollisionWith = PlayersManager.self.handle;
                PlayersManager.self.handle._ignoreCollisionWith = car;
                
                // Store player reference in car for collision system to check
                car.userData.currentDriver = PlayersManager.self;
                car.userData.isOccupied = true;
                car.userData.occupiedBy = PlayersManager.self.handle;
                
                console.log('Set explicit collision exclusion between vehicle and player');
                
                // Disable player collisions more aggressively
                if (PlayersManager.self.collidable) {
                    PlayersManager.self.collidable.active = false;
                    console.log('Disabled player collision processing');
                }
                
                // Also store vehicle reference on player to mark relationship
                PlayersManager.self.currentVehicle = car;
                PlayersManager.self.inVehicle = true;
                
                // Hide player mesh
                PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            } else {
                console.warn("PlayersManager not defined or player not available for collision setup");
            }
            
            // Clear extra adhesion flags
            car.userData._needsGroundAdhesion = false;
            
            // Store initial wheel positions for stability checking
            this.storeWheelPositions(car);
            
            // Get initial surface normal
            this.updateSurfaceNormal(car);
            
            // SIMPLIFIED: Setup camera as scene child (not attached to car)
            this.setupCamera();
            
            console.log('Car Controller initialized with simplified camera');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // FURTHER SIMPLIFIED: Store minimal wheel references for visuals only
    static storeWheelPositions(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        // We only need references to the wheel objects for visual updates
        // No need to track positions or other data since they're just for display
        this.vehicleState.wheelPositions = [];
        Object.values(car.userData.wheels).forEach(wheel => {
            if (wheel) this.vehicleState.wheelPositions.push({ wheel });
        });
    }

    // SIMPLIFIED: Camera setup like ThirdPersonController
    static setupCamera() {
        const car = VehicleManager.currentVehicle;
        if (!car || !Engine.camera) return false;
        
        try {
            // Get surface normal for proper orientation
            const surfaceNormal = this.getSurfaceNormal(car);
            
            // IMPORTANT: Always ensure camera is a direct child of scene
            if (Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                }
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
                Engine.camera.quaternion.copy(worldQuat);
            }
            
            console.log("Setting up car camera with simplified orbital positioning");
            
            // Calculate initial camera position behind the car
            this.updateCameraPosition();
            
            // Set camera up vector based on planet surface
            Engine.camera.up.copy(surfaceNormal);
            
            console.log("Camera configured as scene child with orbital positioning");
            return true;
        } catch (e) {
            console.error('Error in setupCamera:', e);
            return false;
        }
    }
    
    // SIMPLIFIED: Get surface normal from object's userData instead of recalculating
    static getSurfaceNormal(car) {
        if (!car) return new Vector3(0, 1, 0);
        
        // First try to get the pre-calculated surface normal from the object
        if (car.userData && car.userData.surfaceNormal) {
            return car.userData.surfaceNormal;
        }
        
        // Fall back to calculating it if not available
        if (car.userData && car.userData.planet && car.userData.planet.object) {
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            return car.position.clone().sub(planetCenter).normalize();
        }
        
        // Default if no planet data is available
        return new Vector3(0, 1, 0);
    }
    
    // SIMPLIFIED: Update local reference to surface normal without recalculating
    static updateSurfaceNormal(car) {
        if (!car) return;
        
        // Just use the existing surface normal from the object
        const surfaceNormal = this.getSurfaceNormal(car);
        
        // Store in controller state for reference
        this.vehicleState.lastSurfaceNormal = surfaceNormal.clone();
        
        // Store height data if available
        if (car.userData && car.userData.heightAboveSurface !== undefined) {
            this.vehicleState.lastGroundHeight = car.userData.heightAboveSurface;
        } else if (car.userData && car.userData.planet) {
            // Calculate height only if not already available
            const planet = car.userData.planet;
            const distance = car.position.distanceTo(planet.object.position);
            this.vehicleState.lastGroundHeight = distance - planet.radius;
        }
    }

    // Main update loop
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car) return null;
        
        // Check for exit request
        if (this.input.exit || this.input.action) {
            this.input.exit = false;
            this.input.action = false;
            return 'exit';
        }
        
        try {
            // IMPROVED: First capture current state for physics calculations
            this.captureVehicleState(car);
            
            // Update surface normal
            this.updateSurfaceNormal(car);
            
            // Process car movement with surface alignment
            this.handleCarMovement(car);
            
            // CRITICAL FIX: Explicitly maintain height when stationary
            if (Math.abs(car.userData.speed) < 0.01) {
                this.maintainStationaryHeight(car);
            }
            
            // SIMPLIFIED: Update camera position like ThirdPersonController
            this.updateCameraPosition();
            
            // Reset rotation input
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // NEW: Add method to maintain height when vehicle is stationary
    static maintainStationaryHeight(car) {
        if (!car || !car.userData || !car.userData.planet) return;
        
        try {
            // Get planet data
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            const surfaceNormal = car.userData.surfaceNormal;
            if (!surfaceNormal) return;
            
            // IMPROVED: Just track stability locally, don't override physics system
            // Mark vehicle as stable and not falling when stationary
            // car.userData.falling = false; // REMOVED
            
            this.vehicleState.isStable = true;
            this.vehicleState.airTime = 0;
            
            // IMPROVED: Correct height if needed without using moveCarOnSurface
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            const heightDifference = currentDistance - targetDistance;
            
            // Only correct if significantly different from target
            if (Math.abs(heightDifference) > 0.1) {
                const correctionFactor = heightDifference < 0 ? 0.3 : 0.15;
                
                // Apply height correction
                const newPosition = planetCenter.clone().add(
                    surfaceNormal.clone().multiplyScalar(targetDistance)
                );
                car.position.lerp(newPosition, correctionFactor);
                
                // Make sure matrices are updated
                car.updateMatrix();
                car.updateMatrixWorld(true);
            }
            
            // Add flags to prevent physics system adjustment
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
            // CRITICAL: Add a contact point for alignment even when stationary
            const contactPoint = car.position.clone().add(
                surfaceNormal.clone().multiplyScalar(-1.2)
            );
            this.vehicleState.surfaceContactPoints = [contactPoint];
            
        } catch (e) {
            console.error('Error maintaining stationary height:', e);
        }
    }

    // NEW: Simplified car stability check - no wheel physics needed
    static checkWheelSurfaceContact(car) {
        if (!car || !car.userData || !car.userData.planet) return;
        
        // Use a simpler distance check for the entire car
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        const planetRadius = planet.radius;
        
        // Calculate distance to planet center
        const distToCenter = car.position.distanceTo(planetCenter);
        const heightAboveSurface = distToCenter - planetRadius;
        
        // Clear contact points as we're not tracking individual wheels
        this.vehicleState.surfaceContactPoints = [];
        
        // IMPROVED: Check for grace period after player entry
        const now = Date.now();
        const inGracePeriod = car.userData._entryGracePeriod && 
                              car.userData._entryGraceEndTime && 
                              now < car.userData._entryGraceEndTime;
        
        if (inGracePeriod) {
            // During grace period, force the car to be considered on ground
            this.vehicleState.isStable = true;
            this.vehicleState.airTime = 0;
            
            // IMPROVED: Don't directly set the falling state, just track locally
            // car.userData.falling = false; // REMOVED
            
            this.vehicleState.bounceCount = 0;
            
            // Store this height as a reference
            this.vehicleState.lastGroundHeight = heightAboveSurface;
            
            // Add a fake contact point for landing logic to work properly
            const contactPoint = car.position.clone().add(
                new Vector3(0, -1, 0).applyQuaternion(car.quaternion)
            );
            this.vehicleState.surfaceContactPoints = [contactPoint];
            
            return;
        }
        
        // Clear grace period flag if it's expired
        if (car.userData._entryGracePeriod && now >= car.userData._entryGraceEndTime) {
            car.userData._entryGracePeriod = false;
            car.userData._entryGraceEndTime = 0;
        }
        
        // CRITICAL FIX: Get surface normal explicitly - previously this was undefined
        const surfaceNormal = car.userData.surfaceNormal || 
                             car.position.clone().sub(planetCenter).normalize();
        
        // CRITICAL FIX: Use a greater height threshold to prevent frequent state changes
        // This will help prevent the constant landing/snapping cycle observed in logs
        const groundThreshold = 1.2; // Increased from 0.8
        const isOnGround = heightAboveSurface < groundThreshold;
        
        // IMPROVED: Add hysteresis to ground detection to prevent oscillation
        // If we were stable before, require a bigger threshold to become unstable
        if (this.vehicleState.isStable && !isOnGround) {
            // Only transition to unstable if significantly above threshold
            this.vehicleState.isStable = heightAboveSurface < (groundThreshold * 1.5);
        } else {
            this.vehicleState.isStable = isOnGround;
        }
        
        // CRITICAL FIX: Special case for stationary vehicles - always consider them stable
        if (Math.abs(car.userData.speed) < 0.01) {
            this.vehicleState.isStable = true;
        }
        
        // Update vehicle state
        if (!this.vehicleState.isStable) {
            this.vehicleState.airTime += 1/60;
            
            // UPDATED: Only track falling in local state, don't override physics system
            // car.userData.falling = true; // REMOVED
        } else {
            this.vehicleState.airTime = 0;
            
            // UPDATED: Only track falling in local state, don't override physics system
            // car.userData.falling = false; // REMOVED
            
            this.vehicleState.bounceCount = 0;
            
            // FIXED: Explicitly use the surface normal we calculated above
            const contactPoint = car.position.clone().add(
                surfaceNormal.clone().multiplyScalar(-groundThreshold)
            );
            this.vehicleState.surfaceContactPoints = [contactPoint];
        }
    }

    // IMPROVED CORE METHOD: Move car on surface with better physics
    static moveCarOnSurface(car) {
        if (!car || !car.userData) return;
        
        // CRITICAL FIX: Skip movement when stationary, but continue with height and alignment
        const isMoving = Math.abs(car.userData.speed) >= 0.01;
        
        try {
            // Get planet data
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            const surfaceNormal = car.userData.surfaceNormal;
            if (!surfaceNormal) return;
            
            // Only apply movement if actually moving
            if (isMoving) {
                // Calculate car's forward direction
                const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Project forward onto tangent plane of planet surface
                const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                // Apply movement along the surface with consideration of stability
                let moveVector = surfaceForward.multiplyScalar(car.userData.speed);
                
                // IMPROVED: Apply reduced traction when unstable
                if (!this.vehicleState.isStable && !car.userData.falling) {
                    // Skidding effect when fewer wheels are on ground
                    const skidReduction = 0.7; // 30% reduction in control when unstable
                    moveVector.multiplyScalar(skidReduction);
                    
                    // Add some randomization for skidding effect
                    if (Math.abs(car.userData.speed) > 1) {
                        const skidRandom = (Math.random() - 0.5) * 0.04;
                        const skidDir = new Vector3().crossVectors(surfaceNormal, surfaceForward).normalize();
                        moveVector.addScaledVector(skidDir, skidRandom * Math.abs(car.userData.speed));
                    }
                }
                
                // Apply movement
                car.position.add(moveVector);
                
                // Store velocity for physics system
                if (!car.userData.velocity) {
                    car.userData.velocity = new Vector3();
                }
                car.userData.velocity.copy(moveVector);
            } else {
                // For stationary vehicles, zero out velocity
                if (car.userData.velocity) {
                    car.userData.velocity.set(0, 0, 0);
                }
            }
            
            // IMPROVED: Update surface normal immediately after moving position
            // This ensures we have the correct normal for the new position
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const surfaceNormalUpdated = toVehicle.normalize();
            
            // Store the updated surface normal
            car.userData.surfaceNormal = surfaceNormalUpdated;
            this.vehicleState.lastSurfaceNormal = surfaceNormalUpdated.clone();
            
            // IMPROVED: More precise height maintenance to prevent sinking/bouncing
            // CRITICAL FIX: Set a consistent target height and stop repeated height corrections
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            const heightDifference = currentDistance - targetDistance;
            
            // IMPROVED: Only correct height if significantly different from target
            // This prevents constant landing/snapping cycles
            if (Math.abs(heightDifference) > 0.1) {
                // IMPROVED: Adaptive correction based on vehicle state
                // More aggressive when clearly below surface, gentler otherwise
                let correctionFactor;
                
                if (heightDifference < -0.5) {
                    // Vehicle is sinking into surface - strong correction
                    correctionFactor = 0.5;
                } else if (heightDifference < -0.1) {
                    // Slightly below surface - moderate correction
                    correctionFactor = 0.3;
                } else if (heightDifference > 0.5) {
                    // Well above surface - stronger correction to bring down
                    correctionFactor = 0.25;
                } else {
                    // Slightly above surface - gentle correction
                    correctionFactor = 0.15;
                }
                
                // If vehicle is airborne, reduce correction strength
                if (car.userData.falling) {
                    correctionFactor *= 0.5;
                }
                
                // Apply height correction
                const newPosition = planetCenter.clone().add(
                    surfaceNormalUpdated.multiplyScalar(targetDistance)
                );
                car.position.lerp(newPosition, correctionFactor);
            } else {
                // CRITICAL FIX: If already at correct height, completely stabilize
                car.userData.falling = false;
                this.vehicleState.airTime = 0;
                this.vehicleState.isStable = true;
            }
            
            // CRITICAL FIX: Only apply surface alignment when car is not falling
            if (!car.userData.falling) {
                // IMPROVED: Explicitly set car's up vector to match the surface normal
                car.up = surfaceNormalUpdated.clone();
                
                // RESTORED WORKING CODE: Use more gentle surface alignment that preserves turning
                // This ensures the car maintains its steering direction while staying aligned to the surface
                
                // Calculate a rotation that aligns the car's up vector with the surface normal
                // but preserves its forward direction as much as possible
                const currentUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
                
                // Only realign if the car's up vector is not already aligned with the surface normal
                if (currentUp.dot(surfaceNormalUpdated) < 0.99) {
                    // Find the rotation needed to align with the surface
                    const alignAxis = new Vector3().crossVectors(currentUp, surfaceNormalUpdated).normalize();
                    
                    // If alignAxis is valid (not zero length), apply the rotation
                    if (alignAxis.lengthSq() > 0.001) {
                        const alignAngle = Math.acos(Math.min(1, Math.max(-1, currentUp.dot(surfaceNormalUpdated))));
                        const alignQuat = new Quaternion().setFromAxisAngle(alignAxis, alignAngle);
                        
                        // Apply with appropriate smoothing (gentler to prevent jumpy rotation)
                        const alignFactor = isMoving ? 
                            Math.min(0.15, Math.abs(car.userData.speed) * 0.03) : 
                            0.05; // Lower alignment factor when stationary
                        
                        car.quaternion.slerp(
                            new Quaternion().multiplyQuaternions(alignQuat, car.quaternion),
                            alignFactor
                        );
                    }
                }
                
                // CRITICAL FIX: Explicitly mark vehicle as properly aligned
                car.userData._alignedByCarController = true;
                car.userData._lastAlignmentTime = Date.now();
                car.userData._needsGroundAdhesion = false;
            }
            
            // CRITICAL FIX: Add flag to prevent Physics system from also adjusting height
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
            // IMPROVED: Better wheel visualization without physics
            this.updateWheelVisuals(car);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // IMPROVED: Handle landing after being airborne
            if (car.userData.falling && this.vehicleState.surfaceContactPoints.length > 0) {
                this.handleVehicleLanding(car);
            }
            
        } catch (e) {
            console.error('Error moving car:', e);
        }
    }

    // SIMPLIFIED: Handle vehicle landing with focus on car body, not wheels
    static handleVehicleLanding(car) {
        if (!car || !car.userData) return;
        
        console.log("Vehicle landing detected");
        
        // Calculate impact force based on air time and velocity
        const airTime = this.vehicleState.airTime;
        const verticalVelocity = car.userData.velocity ? 
            car.userData.velocity.dot(car.userData.surfaceNormal) : 0;
        
        // Impact is based on air time and vertical velocity
        const impactForce = Math.abs(verticalVelocity) * (1 + airTime * 2);
        
        console.log(`Landing impact: ${impactForce.toFixed(2)} (airtime: ${airTime.toFixed(2)}s, velocity: ${verticalVelocity.toFixed(2)})`);
        
        // Apply bounce based on impact force
        if (impactForce > 2) {
            // Calculate bounce vector - opposite to surface normal
            const bounceStrength = Math.min(6, impactForce * 0.15);
            
            // Add upward bounce
            if (!car.userData.velocity) car.userData.velocity = new Vector3();
            car.userData.velocity.addScaledVector(car.userData.surfaceNormal, bounceStrength);
            
            // Add some random horizontal component for realistic bounce
            const randomHorizontal = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
                .projectOnPlane(car.userData.surfaceNormal)
                .normalize()
                .multiplyScalar(bounceStrength * 0.2);
                
            car.userData.velocity.add(randomHorizontal);
            
            // Force alignment to surface
            if (window.VehicleManager && typeof window.VehicleManager.alignVehicleToPlanetSurface === 'function') {
                window.VehicleManager.alignVehicleToPlanetSurface(car, car.userData.surfaceNormal, 0.5, true);
            }
            
            // Increment bounce counter to track multiple bounces
            this.vehicleState.bounceCount++;
            
            // Keep vehicle in falling state for continued bouncing
            car.userData.falling = true;
            this.vehicleState.airTime = 0.1; // Reset but don't zero out air time
            
            console.log(`Applied bounce ${this.vehicleState.bounceCount} with strength ${bounceStrength.toFixed(2)}`);
            
            // If too many bounces, stabilize the vehicle
            if (this.vehicleState.bounceCount > 3) {
                console.log("Too many bounces - stabilizing vehicle");
                car.userData.velocity.multiplyScalar(0.2); // Greatly reduce velocity
                car.userData.falling = false;
                this.vehicleState.airTime = 0;
                this.vehicleState.bounceCount = 0;
            }
        } else {
            // Small impact - just land normally
            car.userData.falling = false;
            this.vehicleState.airTime = 0;
            this.vehicleState.bounceCount = 0;
            
            // Apply strong alignment to surface
            if (window.VehicleManager && typeof window.VehicleManager.alignVehicleToPlanetSurface === 'function') {
                window.VehicleManager.alignVehicleToPlanetSurface(car, car.userData.surfaceNormal, 0.3, true);
            }
            
            console.log("Smooth landing completed");
        }
        
        // Reset wheel orientation
        if (window.VehicleManager && typeof window.VehicleManager.resetWheelsBaseOrientation === 'function') {
            window.VehicleManager.resetWheelsBaseOrientation(car);
        }
    }

    // SIMPLIFIED: Only set wheel rotations for visual purposes
    static alignWheelsToSurface(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Process each wheel, only adjusting rotation for visuals
            Object.entries(wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // For wheel roll animation, preserve the X rotation
                const currentRoll = wheel.rotation.x;
                
                // Apply steering to front wheels only
                const isSteeringWheel = wheelName.includes('front');
                
                if (isSteeringWheel) {
                    // Front wheels need to preserve steering angle (Y rotation)
                    wheel.rotation.set(currentRoll, steeringAngle, Math.PI/2);
                } else {
                    // Rear wheels have no steering
                    wheel.rotation.set(currentRoll, 0, Math.PI/2);
                }
            });
        } catch (e) {
            console.error('Error aligning wheels for visuals:', e);
        }
    }
    
    // SIMPLIFIED: Update wheel visuals with focus on rotation and steering
    static updateWheelVisuals(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Apply steering angles to wheels
            Object.entries(wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // Get current roll rotation value (X axis)
                const currentRoll = wheel.rotation.x;
                
                // Set appropriate steering based on wheel position
                if (wheelName.includes('front')) {
                    // Front wheels show steering angle
                    wheel.rotation.set(currentRoll, steeringAngle, Math.PI/2);
                } else {
                    // Rear wheels always straight
                    wheel.rotation.set(currentRoll, 0, Math.PI/2);
                }
                
                // Apply wheel roll rotation based on vehicle speed
                if (Math.abs(car.userData.speed) > 0.01) {
                    // Simplified rolling - same speed for all wheels
                    const rotationAmount = car.userData.speed * 0.06;
                    wheel.rotation.x += rotationAmount;
                }
            });
        } catch (e) {
            console.error('Error updating wheel visuals:', e);
        }
    }
    
    // IMPROVED: Clean up when exiting car
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Reset camera and controller states
            this.steeringAngle = 0;
            
            // SIMPLIFIED: Just ensure camera is properly set as scene child
            if (Engine.camera && Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                
                // Preserve world position and orientation
                Engine.camera.position.copy(worldPos);
                Engine.camera.quaternion.copy(worldQuat);
            }
            
            // Set camera up vector to match planet surface
            if (car.userData?.surfaceNormal && Engine.camera) {
                Engine.camera.up.copy(car.userData.surfaceNormal);
            }
            
            console.log('Camera properly detached from vehicle');
            
            // Clear controller flags
            car.userData._heightManagedByController = false;
            car.userData._alignedByCarController = false;
            
            // Store surface normal for next controller
            if (car.userData?.surfaceNormal) {
                window.lastSurfaceNormal = car.userData.surfaceNormal.clone();
            }
            
            // Reset car state
            car.userData.isActivelyControlled = false;
            car.userData._controlledByCarController = false;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            console.log('CarController cleanup complete');
        } catch (e) {
            console.error('Error in CarController cleanup:', e);
        }
    }
    
    // IMPROVED: Align car to planet surface using ObjectManager's method
    static alignCarToSurface(car, forcedLerpFactor = null) {
        if (!car || !car.userData || !car.userData.surfaceNormal) return;
        
        try {
            // ADDED: Mark that we're handling alignment to prevent redundant processing
            car.userData._alignedByCarController = true;
            car.userData._lastAlignmentTime = Date.now();
            
            const surfaceNormal = car.userData.surfaceNormal;
            
            // Use ObjectManager's alignObjectToSurface method
            if (window.ObjectManager && typeof window.ObjectManager.alignObjectToSurface === 'function') {
                window.ObjectManager.alignObjectToSurface(car, surfaceNormal, {
                    lerpFactor: forcedLerpFactor !== null ? forcedLerpFactor : 0.05,
                    maintainForwardDirection: true,
                    skipIfFalling: car.userData.falling,
                    alignmentType: 'carController'
                });
            }
        } catch (e) {
            console.error('Error in alignCarToSurface:', e);
        }
    }
}
