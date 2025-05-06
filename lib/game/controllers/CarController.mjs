// Controller specifically for car vehicle operation - REVAMPED FOR SURFACE ALIGNMENT
import { Vector3, Quaternion, Euler, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';

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
            car.userData.falling = false;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            car.userData._controlledByCarController = true;
            car.userData._controllerStartTime = Date.now();
            car.userData._controlType = 'CarController';
            
            // ADDED: Set a grace period to prevent false falling state on entry
            car.userData._entryGracePeriod = true;
            car.userData._entryGraceEndTime = Date.now() + 1000; // 1 second grace period
            
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
            
            // SIMPLIFIED: Update camera position like ThirdPersonController
            this.updateCameraPosition();
            
            // Reset rotation input
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // NEW: Capture state for physics calculations
    static captureVehicleState(car) {
        if (!car) return;
        
        // Store previous position and rotation
        this.vehicleState.previousPosition = car.position.clone();
        this.vehicleState.previousRotation = car.quaternion.clone();
        
        // Capture wheel positions
        this.storeWheelPositions(car);
        
        // Check if wheels are contacting the surface
        this.checkWheelSurfaceContact(car);
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
            car.userData.falling = false;
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
        
        // Update vehicle state
        if (!this.vehicleState.isStable) {
            this.vehicleState.airTime += 1/60;
            car.userData.falling = true;
        } else {
            this.vehicleState.airTime = 0;
            car.userData.falling = false;
            this.vehicleState.bounceCount = 0;
            
            // Add a contact point for alignment calculations
            const contactPoint = car.position.clone().add(
                surfaceNormal.clone().multiplyScalar(-groundThreshold)
            );
            this.vehicleState.surfaceContactPoints = [contactPoint];
        }
    }

    // SIMPLIFIED: Update camera position like ThirdPersonController
    static updateCameraPosition() {
        const car = VehicleManager.currentVehicle;
        if (!car || !Engine.camera) return;
        
        try {
            // Process camera rotation input
            if (this.input.rotation.x !== 0 || this.input.rotation.y !== 0) {
                // Update yaw (horizontal camera rotation around the car)
                this.cameraRotation.yaw += this.input.rotation.x * this.ROTATION_SPEED * 5;
                
                // Update pitch (vertical camera angle) with constraints
                this.cameraRotation.pitch = Math.max(
                    this.MIN_PITCH, 
                    Math.min(this.MAX_PITCH, 
                        this.cameraRotation.pitch + this.input.rotation.y * this.ROTATION_SPEED * 5
                    )
                );
            }
            
            // Get car position and surface normal
            const carPosition = car.position.clone();
            const surfaceNormal = car.userData.surfaceNormal || new Vector3(0, 1, 0);
            
            // CRITICAL FIX: Use car's actual orientation rather than trying to derive vectors
            // This ensures camera follows car orientation consistently
            const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate horizontal and vertical components for camera positioning
            const horizontalDistance = this.cameraDistance * Math.cos(this.cameraRotation.pitch);
            const verticalOffset = this.cameraDistance * Math.sin(this.cameraRotation.pitch);
            
            // Start with car position
            const targetPosition = carPosition.clone();
            
            // Calculate rotation around car based on yaw
            const rotationY = this.cameraRotation.yaw;
            const xOffset = Math.sin(rotationY) * horizontalDistance;
            const zOffset = Math.cos(rotationY) * horizontalDistance;
            
            // Apply offsets in world space
            targetPosition.addScaledVector(carRight, xOffset);
            targetPosition.addScaledVector(carForward, -zOffset);
            
            // Apply vertical offset along surface normal
            targetPosition.addScaledVector(surfaceNormal, verticalOffset + this.cameraHeight);
            
            // IMPROVED: Enhanced camera position smoothing
            // Use smoother lerping with speed-based factors
            let smoothingFactor = 0.1; // Base smoothing
            
            // Adjust smoothing based on car speed - faster car = faster camera
            if (Math.abs(car.userData.speed) > 2) {
                smoothingFactor = Math.min(0.2, 0.1 + (Math.abs(car.userData.speed) * 0.01));
            }
            
            // Apply position with smoothing
            if (!this.cameraState.smoothPosition) {
                this.cameraState.smoothPosition = targetPosition.clone();
            } else {
                this.cameraState.smoothPosition.lerp(targetPosition, smoothingFactor);
            }
            
            // Update camera position
            Engine.camera.position.copy(this.cameraState.smoothPosition);
            
            // CRITICAL FIX: Use pure surface normal for camera up vector
            // This ensures camera orientation is independent of car mesh rotation
            Engine.camera.up.copy(surfaceNormal);
            
            // Calculate look target with slight offset above car
            const lookTarget = carPosition.clone()
                .addScaledVector(surfaceNormal, this.cameraLookOffset * 0.5);
            
            // Look at car position
            Engine.camera.lookAt(lookTarget);
            
            // Store last position for next frame
            this.cameraState.lastPosition.copy(Engine.camera.position);
        } catch (e) {
            console.error('Error updating camera position:', e);
        }
    }

    // IMPROVED: Handle car movement with better surface alignment
    static handleCarMovement(car) {
        if (!car || !car.userData) return;
        
        // Get input
        const moveZ = this.input.movement.z; // Forward/backward
        const moveX = this.input.movement.x; // Left/right turning

        // Process acceleration
        if (moveZ > 0) {
            car.userData.acceleration += 0.025;
        } else if (moveZ < 0) {
            car.userData.acceleration -= 0.05;
        } else {
            car.userData.acceleration *= 0.95;
        }

        // Clamp acceleration
        car.userData.acceleration = Math.max(-0.3, Math.min(0.3, car.userData.acceleration));
        
        // Update speed
        car.userData.speed += car.userData.acceleration;
        
        // Apply stronger drag when airborne for better physics feel
        const dragFactor = car.userData.falling ? 1.5 : 1.0;
        car.userData.speed *= (1 - (car.userData.drag * dragFactor));
        
        // Apply speed limits with consideration of surface stability
        let maxSpeed = car.userData.maxSpeed;
        
        // Reduce max speed if car isn't stable (fewer wheels on ground)
        if (!this.vehicleState.isStable && !car.userData.falling) {
            maxSpeed *= 0.7; // 70% max speed when unstable but not falling
        }
        
        car.userData.speed = Math.max(-maxSpeed/2, Math.min(maxSpeed, car.userData.speed));
        
        // Handle steering - improved to feel more like a racing game
        if (moveX !== 0) {
            // Steering response depends on speed - more responsive at higher speeds
            const steeringResponse = Math.min(1, Math.abs(car.userData.speed) / 2) * 0.08;
            
            // Update steering angle with limits
            this.steeringAngle = Math.max(
                -this.maxSteeringAngle,
                Math.min(this.maxSteeringAngle, this.steeringAngle + (moveX * steeringResponse))
            );
            
            car.userData.steeringInput = moveX;
            car.userData.steeringAngle = this.steeringAngle;
            
            // Turn car when moving
            if (Math.abs(car.userData.speed) > 0.1) {
                this.turnCarOnSurface(car, moveX);
            }
        } else {
            // Return steering to center gradually with rate based on speed
            const returnRate = Math.min(1, Math.abs(car.userData.speed) / 3) * 0.15;
            
            if (Math.abs(this.steeringAngle) > 0.01) {
                this.steeringAngle *= (1 - returnRate); // Faster centering at higher speeds
            } else {
                this.steeringAngle = 0;
            }
            
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = this.steeringAngle;
        }
        
        // SIMPLIFIED: Only update visuals - no physics
        this.updateWheelVisuals(car);
        
        // Move car along planet surface
        this.moveCarOnSurface(car);
    }

    // IMPROVED: Turn car on planet surface with better physics
    static turnCarOnSurface(car, steeringInput) {
        if (!car || !car.userData.surfaceNormal) return;
        
        const surfaceNormal = car.userData.surfaceNormal;
        
        // IMPROVED: Handle turning differently based on falling state
        if (car.userData.falling) {
            // When falling/airborne, allow free rotation like player
            // Calculate turn amount based on speed and steering
            const speed = Math.abs(car.userData.speed);
            
            // Airborne turning should be less responsive
            const turnFactor = 0.01 * Math.min(1, speed / 8);
            const turnAmount = steeringInput * turnFactor;
            
            // Create rotation around world Y axis instead of surface normal
            const rotationQ = new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0), // Use world Y axis like FPS controller's falling state
                turnAmount
            );
            
            // Apply to car orientation
            car.quaternion.premultiply(rotationQ);
            
            // Add some roll effect for more realistic airborne physics
            const rollAxis = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            const rollAmount = -steeringInput * 0.02; // Roll opposite to turn direction
            
            const rollQ = new Quaternion().setFromAxisAngle(rollAxis, rollAmount);
            car.quaternion.multiply(rollQ);
            
            // Skip surface alignment while airborne
            // But still ensure wheels stay properly oriented
            this.alignWheelsToSurface(car);
        } else {
            // When on ground, use surface-aligned turning with more realistic physics
            // Calculate turn amount based on speed and steering
            const speed = Math.abs(car.userData.speed);
            
            // More responsive turning at higher speeds
            const turnFactor = 0.015 * Math.min(1.5, Math.max(0.5, speed / 4));
            
            // Sharp turns should have more effect at lower speeds (better handling)
            const sharpTurnMultiplier = Math.max(0.5, 1.0 - (speed / car.userData.maxSpeed));
            const turnAmount = steeringInput * turnFactor * sharpTurnMultiplier;
            
            // IMPROVED: First get current orientation on surface for reference
            const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // IMPROVED: Get right vector using cross product with surface normal for better accuracy
            const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
            
            // IMPROVED: Calculate new forward direction using stable vectors
            // This prevents distortion by ensuring we maintain perpendicularity to surface
            const newForward = new Vector3()
                .copy(projectedForward)
                .applyAxisAngle(surfaceNormal, turnAmount)
                .normalize();
                
            // IMPROVED: Create complete new orientation based on surface-aligned basis vectors
            // This completely replaces the previous rotation rather than accumulating changes
            const newUp = surfaceNormal.clone();
            const newRight = new Vector3().crossVectors(newUp, newForward).normalize();
            
            // Double-check integrity of coordinate system
            const recalculatedForward = new Vector3().crossVectors(newRight, newUp).normalize();
            
            // Build complete rotation matrix from orthogonal vectors
            const rotMatrix = new Matrix4().makeBasis(
                newRight,
                newUp,
                recalculatedForward.clone().negate() // Negate for correct orientation
            );
            
            // Extract clean quaternion from rotation matrix
            const newOrientation = new Quaternion().setFromRotationMatrix(rotMatrix);
            
            // IMPROVED: Apply new orientation with lerping to prevent sudden changes
            // This smooths the transition between orientations
            const lerpFactor = 0.2; // Higher values = more responsive steering
            car.quaternion.slerp(newOrientation, lerpFactor);
            
            // IMPROVED: Apply correction to ensure wheels are properly aligned
            this.alignWheelsToSurface(car);
        }
    }
    
    // IMPROVED CORE METHOD: Move car on surface with better physics
    static moveCarOnSurface(car) {
        if (!car || !car.userData || Math.abs(car.userData.speed) < 0.01) return;
        
        try {
            // Get planet data
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            const surfaceNormal = car.userData.surfaceNormal;
            if (!surfaceNormal) return;
            
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
                
                // CRITICAL FIX: Use complete basis vector alignment instead of slerp for driving
                // This prevents cumulative orientation distortions during driving
                
                // Step 1: Get current forward direction in world space
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Step 2: Project this onto the tangent plane of the surface
                const projectedForward = currentForward.clone().projectOnPlane(surfaceNormalUpdated).normalize();
                
                // Step 3: Ensure we have a valid projection
                if (projectedForward.lengthSq() > 0.001) {
                    // Step 4: Create a right vector perpendicular to up and forward
                    const rightVector = new Vector3().crossVectors(surfaceNormalUpdated, projectedForward).normalize();
                    
                    // Step 5: Ensure forward is perpendicular to both up and right
                    const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormalUpdated).normalize();
                    
                    // Step 6: Create rotation matrix from these orthogonal vectors
                    const rotationMatrix = new Matrix4().makeBasis(
                        rightVector, 
                        surfaceNormalUpdated, 
                        correctedForward.clone().negate() // Forward direction is negative Z
                    );
                    
                    // Step 7: Extract quaternion from rotation matrix
                    const alignmentQuaternion = new Quaternion().setFromRotationMatrix(rotationMatrix);
                    
                    // Step 8: Apply alignment with appropriate smoothing
                    // Use faster alignment when moving at higher speeds
                    const alignFactor = Math.min(0.2, Math.abs(car.userData.speed) * 0.05);
                    car.quaternion.slerp(alignmentQuaternion, alignFactor);
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
            
            // Store velocity for physics system
            if (!car.userData.velocity) {
                car.userData.velocity = new Vector3();
            }
            car.userData.velocity.copy(moveVector);
            
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
    
    // IMPROVED: Align car to planet surface using ObjectManager's method when possible
    static alignCarToSurface(car, forcedLerpFactor = null) {
        if (!car || !car.userData || !car.userData.surfaceNormal) return;
        
        try {
            // ADDED: Mark that we're handling alignment to prevent redundant processing
            car.userData._alignedByCarController = true;
            car.userData._lastAlignmentTime = Date.now();
            
            const surfaceNormal = car.userData.surfaceNormal;
            
            // IMPROVED: Try to use ObjectManager's alignObjectToSurface method
            if (window.ObjectManager && typeof window.ObjectManager.alignObjectToSurface === 'function') {
                window.ObjectManager.alignObjectToSurface(car, surfaceNormal, {
                    lerpFactor: forcedLerpFactor !== null ? forcedLerpFactor : 0.05,
                    maintainForwardDirection: true,
                    skipIfFalling: car.userData.falling,
                    alignmentType: 'carController'
                });
                return;
            }
            
            // Fallback alignment implementation if ObjectManager is not available
            // This code is based on the ObjectManager's alignment logic
            
            // Create alignment quaternion
            const defaultUp = new Vector3(0, 1, 0);
            const alignmentQuaternion = new Quaternion();
            
            // Find rotation axis and angle
            const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal);
            
            if (rotationAxis.lengthSq() < 0.001) {
                // Handle parallel case
                if (defaultUp.dot(surfaceNormal) < 0) {
                    alignmentQuaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
                }
            } else {
                rotationAxis.normalize();
                const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
            }
            
            // If maintaining forward direction
            if (true) { // We always want to maintain forward direction for cars
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                if (projectedForward.lengthSq() > 0.001) {
                    const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
                    const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
                    
                    const m = new Matrix4();
                    m.makeBasis(rightVector, surfaceNormal, correctedForward);
                    
                    const directionPreservingQuaternion = new Quaternion().setFromRotationMatrix(m);
                    alignmentQuaternion.copy(directionPreservingQuaternion);
                }
            }
            
            // Apply the rotation with appropriate lerp factor
            const lerpFactor = forcedLerpFactor !== null ? forcedLerpFactor : 0.05;
            car.quaternion.slerp(alignmentQuaternion, lerpFactor);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
        } catch (e) {
            console.error('Error in alignCarToSurface:', e);
        }
    }
}
