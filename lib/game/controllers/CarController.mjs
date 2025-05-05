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
    
    // Camera state - ENHANCED with better tracking properties
    static cameraState = {
        isSetup: false,
        lastSetupTime: 0,
        setupCount: 0,
        updateInterval: 16,
        lastUpdateTime: 0,
        smoothPosition: null,
        smoothUpVector: null,
        transitionProgress: 0,
        initialPosition: null,
        targetPosition: null,
        initialLookAt: null,
        targetLookAt: null,
        transitionSpeed: 0.07, // How quickly camera transitions to new position
        collisionAvoidanceRays: [], // ADDED: For camera collision detection
        lastObstacleCheck: 0,
        cameraObstructed: false
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
    
    // Reset controller state when entering car
    static reset() {
        console.log('Initializing Car Controller with improved camera and physics');
        
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        try {
            // Reset camera and steering states
            this.cameraRotation = { yaw: Math.PI, pitch: 0.2 };
            this.cameraState = {
                isSetup: false,
                lastSetupTime: 0,
                setupCount: 0,
                updateInterval: 16,
                lastUpdateTime: 0,
                smoothPosition: null,
                smoothUpVector: null,
                transitionProgress: 0,
                initialPosition: null,
                targetPosition: null,
                initialLookAt: null,
                targetLookAt: null,
                transitionSpeed: 0.07,
                collisionAvoidanceRays: [],
                lastObstacleCheck: 0,
                cameraObstructed: false
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
            
            // Mark car as actively controlled by this controller with more flags for better debugging
            car.userData.isActivelyControlled = true;
            car.userData.falling = false;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            car.userData._controlledByCarController = true;
            car.userData._controllerStartTime = Date.now();
            car.userData._controlType = 'CarController';
            
            // Clear extra adhesion flags
            car.userData._needsGroundAdhesion = false;
            
            // Store initial wheel positions for stability checking
            this.storeWheelPositions(car);
            
            // ADDED: Debug output of vehicle state for troubleshooting
            console.log(`Car initial position: ${car.position.toArray()}`);
            if (car.userData.planet) {
                const planetCenter = car.userData.planet.object.position;
                const distanceToCenter = car.position.distanceTo(planetCenter);
                const distanceToSurface = distanceToCenter - car.userData.planet.radius;
                console.log(`Distance to planet center: ${distanceToCenter}, height above surface: ${distanceToSurface}`);
            }
            
            // Get initial surface normal
            this.updateSurfaceNormal(car);
            
            // IMPROVED: Setup camera with smooth transition
            this.setupCamera(true);
            
            console.log('Car Controller initialized with improved camera and physics');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // NEW: Store wheel positions for reference
    static storeWheelPositions(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        this.vehicleState.wheelPositions = [];
        
        // Store local and world positions of each wheel
        Object.values(car.userData.wheels).forEach(wheel => {
            if (wheel) {
                const localPos = wheel.position.clone();
                const worldPos = new Vector3();
                wheel.getWorldPosition(worldPos);
                
                this.vehicleState.wheelPositions.push({
                    localPos: localPos,
                    worldPos: worldPos,
                    wheel: wheel
                });
            }
        });
    }

    // COMPLETELY REDESIGNED CAMERA SETUP: Smooth camera transitions similar to ThirdPersonController
    static setupCamera(immediate = false) {
        const car = VehicleManager.currentVehicle;
        if (!car || !Engine.camera) return false;
        
        try {
            // Get surface normal for proper orientation
            const surfaceNormal = this.getSurfaceNormal(car);
            
            // Detach camera from any parent to ensure it's a scene child like in ThirdPersonController
            if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
                Engine.camera.quaternion.copy(worldQuat);
            }
            
            console.log("Setting up car camera with orbital position like ThirdPersonController");
            
            // Calculate ideal camera position behind the car
            const carPosition = car.position.clone();
            
            // Store camera's current position for smooth transition
            if (!this.cameraState.initialPosition) {
                this.cameraState.initialPosition = Engine.camera.position.clone();
            }
            
            // Calculate target camera position like ThirdPersonController
            // 1. Start with car position
            const targetPosition = carPosition.clone();
            
            // 2. Get car's forward and right vectors
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            
            // 3. Calculate horizontal and vertical components
            const horizontalDistance = this.cameraDistance * Math.cos(this.cameraRotation.pitch);
            const verticalOffset = this.cameraDistance * Math.sin(this.cameraRotation.pitch);
            
            // 4. Move backward from car and adjust height
            targetPosition.addScaledVector(carForward, -horizontalDistance);
            targetPosition.addScaledVector(surfaceNormal, this.cameraHeight + verticalOffset);
            
            // Store target position for transition
            this.cameraState.targetPosition = targetPosition.clone();
            
            // Calculate look target (slightly ahead of car)
            const lookAtTarget = carPosition.clone()
                .addScaledVector(surfaceNormal, this.cameraLookOffset * 0.5);
            
            // Store camera's current look target
            if (!this.cameraState.initialLookAt) {
                // If no initial look target, use car position
                this.cameraState.initialLookAt = carPosition.clone();
            }
            
            this.cameraState.targetLookAt = lookAtTarget.clone();
            
            // Set camera up vector based on planet surface
            Engine.camera.up.copy(surfaceNormal);
            
            // If immediate transition requested, skip the smooth transition
            if (immediate) {
                Engine.camera.position.copy(targetPosition);
                Engine.camera.lookAt(lookAtTarget);
                this.cameraState.transitionProgress = 1.0;
                this.cameraState.smoothPosition = targetPosition.clone();
            } else {
                // Initialize transition
                this.cameraState.transitionProgress = 0;
            }
            
            // Initialize camera state for tracking
            this.cameraState.isSetup = true;
            this.cameraState.lastSetupTime = Date.now();
            this.cameraState.setupCount++;
            if (!this.cameraState.smoothPosition) {
                this.cameraState.smoothPosition = Engine.camera.position.clone();
            }
            this.cameraState.smoothUpVector = surfaceNormal.clone();
            
            // Set flag on car to indicate camera is properly configured
            car.userData._cameraAttached = false; // Camera is NOT physically attached to car
            car.userData._cameraConfigured = true;
            car.userData._cameraConfigTime = Date.now();
            
            console.log("Camera configured with improved orbital positioning");
            return true;
        } catch (e) {
            console.error('Error in setupCamera:', e);
            return false;
        }
    }
    
    // Get the current surface normal for a car
    static getSurfaceNormal(car) {
        if (!car || !car.userData || !car.userData.planet || !car.userData.planet.object) {
            return new Vector3(0, 1, 0); // Default up vector
        }
        
        // Calculate surface normal from planet center to car position
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        return car.position.clone().sub(planetCenter).normalize();
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
            
            // NEW: Update camera with orbital behavior like ThirdPersonController
            this.updateCamera(car);
            
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
    
    // NEW: Check if wheels are in contact with the surface
    static checkWheelSurfaceContact(car) {
        if (!car || !car.userData || !car.userData.wheels || !car.userData.planet) return;
        
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        const planetRadius = planet.radius;
        
        this.vehicleState.surfaceContactPoints = [];
        
        // Check each wheel's distance from surface
        Object.values(car.userData.wheels).forEach(wheel => {
            if (!wheel) return;
            
            // Get wheel's world position
            const wheelPos = new Vector3();
            wheel.getWorldPosition(wheelPos);
            
            // Calculate distance to planet center
            const distToCenter = wheelPos.distanceTo(planetCenter);
            const heightAboveSurface = distToCenter - planetRadius;
            
            // Check if wheel is close to surface (within 0.3 units)
            const isOnSurface = heightAboveSurface < 0.3;
            
            // Store contact information
            if (isOnSurface) {
                const surfaceNormal = wheelPos.clone().sub(planetCenter).normalize();
                this.vehicleState.surfaceContactPoints.push({
                    position: wheelPos.clone(),
                    normal: surfaceNormal,
                    wheel: wheel
                });
            }
        });
        
        // Update vehicle stability based on wheel contact
        // Car is stable if at least 2 wheels are touching (for a 4-wheel vehicle)
        this.vehicleState.isStable = this.vehicleState.surfaceContactPoints.length >= 2;
        
        // Update vehicle falling state
        if (this.vehicleState.surfaceContactPoints.length === 0) {
            // No wheels touching - car is airborne
            this.vehicleState.airTime += 1/60; // Assuming 60fps
            car.userData.falling = true;
        } else {
            // At least one wheel touching - car is grounded
            this.vehicleState.airTime = 0;
            car.userData.falling = false;
            
            // Reset bounce counter when grounded
            if (this.vehicleState.bounceCount > 0) {
                this.vehicleState.bounceCount = 0;
            }
        }
    }

    // COMPLETELY REDESIGNED: Camera update with orbital behavior like ThirdPersonController
    static updateCamera(car) {
        if (!car || !Engine.camera) return;
        
        try {
            // Process camera rotation input like ThirdPersonController
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
                
                // When user provides input, force a camera reconfiguration
                this.setupCamera(false);
            }
            
            // If camera transition is in progress, update it
            if (this.cameraState.transitionProgress < 1.0) {
                // Progress the transition
                this.cameraState.transitionProgress += this.cameraState.transitionSpeed;
                if (this.cameraState.transitionProgress > 1.0) {
                    this.cameraState.transitionProgress = 1.0;
                }
                
                // Interpolate between initial and target camera positions
                if (this.cameraState.initialPosition && this.cameraState.targetPosition) {
                    const newPosition = this.cameraState.initialPosition.clone().lerp(
                        this.cameraState.targetPosition,
                        this.cameraState.transitionProgress
                    );
                    this.cameraState.smoothPosition = newPosition;
                    Engine.camera.position.copy(newPosition);
                }
                
                // Interpolate look target
                if (this.cameraState.initialLookAt && this.cameraState.targetLookAt) {
                    const newLookAt = this.cameraState.initialLookAt.clone().lerp(
                        this.cameraState.targetLookAt,
                        this.cameraState.transitionProgress
                    );
                    Engine.camera.lookAt(newLookAt);
                }
            } else {
                // After transition, use orbital camera positioning like in ThirdPersonController
                
                // Get planetary up vector (surface normal)
                const surfaceNormal = car.userData.surfaceNormal || new Vector3(0, 1, 0);
                
                // Calculate camera position based on yaw around the car
                const horizontalDistance = this.cameraDistance * Math.cos(this.cameraRotation.pitch);
                const verticalOffset = this.cameraDistance * Math.sin(this.cameraRotation.pitch);
                
                // Car forward and right vectors
                const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
                
                // Calculate orbit position
                // Start with car position
                const orbitPosition = car.position.clone();
                
                // Calculate rotation matrix for orbit position
                const rotationY = this.cameraRotation.yaw;
                
                // Calculate offset vector using sin/cos
                const xOffset = Math.sin(rotationY) * horizontalDistance;
                const zOffset = Math.cos(rotationY) * horizontalDistance;
                
                // Apply horizontal offset in world space aligned to car orientation
                orbitPosition.addScaledVector(carRight, xOffset);
                orbitPosition.addScaledVector(carForward, -zOffset);
                
                // Apply vertical offset along surface normal
                orbitPosition.addScaledVector(surfaceNormal, verticalOffset + this.cameraHeight);
                
                // Check for obstacles between car and camera
                const carToCam = orbitPosition.clone().sub(car.position);
                const distance = carToCam.length();
                const direction = carToCam.clone().normalize();
                
                // ADDED: Camera obstacle avoidance
                const ray = new THREE.Raycaster(car.position, direction, 0, distance);
                const obstacles = ray.intersectObjects(Engine.scene.children, true);
                
                // Filter obstacles that aren't the car or its parts
                const validObstacles = obstacles.filter(hit => {
                    // Skip the car itself and its children
                    let obj = hit.object;
                    while (obj) {
                        if (obj === car) return false;
                        obj = obj.parent;
                    }
                    return true;
                });
                
                // Adjust camera position if obstacle found
                let adjustedPosition = orbitPosition.clone();
                if (validObstacles.length > 0) {
                    // Get the closest hit that's not the car
                    const closest = validObstacles[0];
                    
                    // Move camera closer to avoid obstacle
                    adjustedPosition = car.position.clone().add(
                        direction.multiplyScalar(closest.distance * 0.9)
                    );
                    
                    this.cameraState.cameraObstructed = true;
                } else {
                    this.cameraState.cameraObstructed = false;
                }
                
                // Smoothly interpolate camera position
                if (!this.cameraState.smoothPosition) {
                    this.cameraState.smoothPosition = Engine.camera.position.clone();
                }
                
                // Use stronger lerp factor if camera was obstructed
                const lerpFactor = this.cameraState.cameraObstructed ? 0.25 : 0.1;
                
                // Apply smoothed position
                this.cameraState.smoothPosition.lerp(adjustedPosition, lerpFactor);
                Engine.camera.position.copy(this.cameraState.smoothPosition);
                
                // Update camera up vector based on planet surface normal
                Engine.camera.up.copy(surfaceNormal);
                
                // Look at car with slight height offset
                const lookTarget = car.position.clone()
                    .addScaledVector(surfaceNormal, this.cameraLookOffset * 0.5);
                
                // Apply lookAt
                Engine.camera.lookAt(lookTarget);
            }
        } catch (e) {
            console.error('Error updating camera:', e);
        }
    }

    // Update surface normal and store it in the car
    static updateSurfaceNormal(car) {
        if (!car || !car.userData || !car.userData.planet || !car.userData.planet.object) return;
        
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        
        // Calculate surface normal pointing away from planet center
        const surfaceNormal = car.position.clone().sub(planetCenter).normalize();
        
        // Store for later use
        car.userData.surfaceNormal = surfaceNormal;
        this.vehicleState.lastSurfaceNormal = surfaceNormal.clone();
        
        // Calculate and store height above surface
        const distance = car.position.distanceTo(planetCenter);
        car.userData.heightAboveSurface = distance - planet.radius;
        this.vehicleState.lastGroundHeight = car.userData.heightAboveSurface;
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
        
        // Update wheel visuals
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
            
            // Create rotation around surface normal (planet's "up" direction)
            const rotationQ = new Quaternion().setFromAxisAngle(surfaceNormal, turnAmount);
            
            // Apply to car orientation
            car.quaternion.premultiply(rotationQ);
            
            // Apply surface alignment using centralized method in ObjectManager
            if (window.ObjectManager && typeof window.ObjectManager.alignObjectToSurface === 'function') {
                window.ObjectManager.alignObjectToSurface(car, surfaceNormal, {
                    lerpFactor: 0.15, // More responsive alignment during turns
                    maintainForwardDirection: true,
                    skipIfFalling: false,
                    alignmentType: 'carController'
                });
            } else {
                // Fallback if ObjectManager not available
                this.alignCarToSurface(car, 0.15);
            }
            
            // Ensure wheels stay on the surface
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
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            const heightDifference = currentDistance - targetDistance;
            
            // IMPROVED: Adaptive correction based on vehicle state
            // More aggressive when clearly below surface, gentler otherwise
            let correctionFactor;
            
            if (heightDifference < -0.5) {
                // Vehicle is sinking into surface - strong correction
                correctionFactor = 0.5;
            } else if (heightDifference < -0.1) {
                // Slightly below surface - moderate correction
                correctionFactor = 0.3;
            } else if (Math.abs(heightDifference) < 0.1) {
                // Near target height - minimal correction
                correctionFactor = 0.1;
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
            
            // CRITICAL FIX: Only apply surface alignment when car is not falling and is moving
            if (!car.userData.falling) {
                // IMPROVED: Explicitly set car's up vector to match the surface normal
                // This is crucial for proper alignment like the player handle uses
                car.up = surfaceNormalUpdated.clone();
                
                // IMPROVED: Use more aggressive alignment when the car is moving
                // This keeps the car properly aligned with the surface during movement
                const movingAlignFactor = Math.abs(car.userData.speed) > 0.5 ? 0.15 : 0.05;
                
                // Apply alignment with stronger factor during movement
                if (window.ObjectManager && typeof window.ObjectManager.alignObjectToSurface === 'function') {
                    window.ObjectManager.alignObjectToSurface(car, surfaceNormalUpdated, {
                        lerpFactor: movingAlignFactor,
                        maintainForwardDirection: true,
                        skipIfFalling: false,
                        alignmentType: 'carMovement'
                    });
                } else {
                    // Fallback if ObjectManager not available
                    this.alignCarToSurface(car, movingAlignFactor);
                }
            } else {
                // For airborne vehicles, gently align to expected landing normal
                if (this.vehicleState.airTime > 0.5 && window.ObjectManager) {
                    window.ObjectManager.alignObjectToSurface(car, surfaceNormalUpdated, {
                        lerpFactor: 0.01, // Very gentle alignment when airborne
                        maintainForwardDirection: true,
                        skipIfFalling: false,
                        alignmentType: 'carAirborne'
                    });
                }
            }
            
            // CRITICAL FIX: Add flag to prevent Physics system from also adjusting height
            // This explicitly tells Physics that CarController is actively managing this vehicle's height
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
            // IMPROVED: Better wheel placement relative to surface
            this.alignWheelsToSurface(car);
            
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

    // NEW: Handle landing after being airborne
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

    // COMPLETELY REDESIGNED: Better wheel alignment with surface
    static alignWheelsToSurface(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            const planetCenter = planet.object.position;
            const wheels = car.userData.wheels;
            
            // Define target wheel height off the surface
            const targetWheelHeight = 0.1;
            
            // Get vehicle's up vector (surface normal)
            const vehicleUp = car.userData.surfaceNormal.clone();
            
            // Get vehicle's forward and right directions
            const vehicleForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const vehicleRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            
            // Process each wheel
            Object.entries(wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // Get wheel's world position
                const wheelPos = new Vector3();
                wheel.getWorldPosition(wheelPos);
                
                // Calculate surface normal for this specific wheel position
                const wheelToCenter = wheelPos.clone().sub(planetCenter);
                const wheelDistance = wheelToCenter.length();
                const wheelSurfaceNormal = wheelToCenter.normalize();
                
                // Calculate height above surface for this wheel
                const wheelHeightAboveSurface = wheelDistance - planet.radius;
                
                // Determine if wheel needs adjustment
                const heightError = wheelHeightAboveSurface - targetWheelHeight;
                
                // Only adjust significant errors to prevent jitter
                if (Math.abs(heightError) > 0.05) {
                    // Calculate ideal position for wheel
                    const idealWheelPos = planetCenter.clone().add(
                        wheelSurfaceNormal.multiplyScalar(planet.radius + targetWheelHeight)
                    );
                    
                    // Rather than moving the wheel directly (which could cause issues),
                    // We'll use this information to affect the car's suspension
                    
                    // For now, just store the height error for debugging
                    wheel.userData = wheel.userData || {};
                    wheel.userData.heightError = heightError;
                    wheel.userData.idealHeight = targetWheelHeight;
                    wheel.userData.currentHeight = wheelHeightAboveSurface;
                }
                
                // IMPROVED: Align wheel orientation to surface
                const isSteeringWheel = wheelName.includes('front');
                
                // Start with current wheel rotation to preserve steering
                const wheelRotation = wheel.rotation.clone();
                
                // For wheel roll animation, preserve the X rotation
                const currentRoll = wheel.rotation.x;
                
                if (isSteeringWheel) {
                    // Front wheels need to preserve steering angle (Y rotation)
                    const steeringAngle = car.userData.steeringAngle || 0;
                    wheel.rotation.set(currentRoll, steeringAngle, Math.PI/2);
                } else {
                    // Rear wheels have no steering
                    wheel.rotation.set(currentRoll, 0, Math.PI/2);
                }
            });
        } catch (e) {
            console.error('Error aligning wheels to surface:', e);
        }
    }
    
    // IMPROVED: Update wheel visuals with better animations
    static updateWheelVisuals(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Apply steering to front wheels
            if (wheels.frontLeft) {
                const currentRoll = wheels.frontLeft.rotation.x;
                wheels.frontLeft.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            if (wheels.frontRight) {
                const currentRoll = wheels.frontRight.rotation.x;
                wheels.frontRight.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            // Reset rear wheel steering (always straight)
            if (wheels.rearLeft) {
                const currentRoll = wheels.rearLeft.rotation.x;
                wheels.rearLeft.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            if (wheels.rearRight) {
                const currentRoll = wheels.rearRight.rotation.x;
                wheels.rearRight.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            // IMPROVED: More realistic wheel rotation based on speed and surface contact
            if (Math.abs(car.userData.speed) > 0.01) {
                // Base rotation speed - proportional to vehicle speed
                const baseRotationAmount = car.userData.speed * 0.06;
                
                // If car is airborne, wheels should spin freely
                const airborneMultiplier = car.userData.falling ? 0.3 : 1.0;
                
                // Check each wheel's contact with surface
                Object.entries(wheels).forEach(([wheelName, wheel]) => {
                    if (!wheel) return;
                    
                    // Check if this specific wheel is touching the surface
                    const contactPoint = this.vehicleState.surfaceContactPoints.find(cp => cp.wheel === wheel);
                    
                    // If wheel is touching, use full rotation based on speed
                    // If not touching, spin more slowly (free spin)
                    const rotationAmount = contactPoint ? 
                        baseRotationAmount : baseRotationAmount * airborneMultiplier;
                    
                    // Apply rotation around wheel's X axis
                    wheel.rotation.x += rotationAmount;
                });
            }
        } catch (e) {
            console.error('Error updating wheel visuals:', e);
        }
    }
    
    // IMPROVED: Clean up when exiting car with better camera handling
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Reset camera and controller states
            this.cameraState.isSetup = false;
            this.steeringAngle = 0;
            
            // IMPROVED: Better camera transition when exiting vehicle
            if (Engine.camera) {
                // Make sure camera is a direct child of scene
                if (Engine.camera.parent !== Engine.scene) {
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
                if (car.userData && car.userData.surfaceNormal) {
                    Engine.camera.up.copy(car.userData.surfaceNormal);
                }
                
                console.log('Camera detached from vehicle with preserved orientation');
            }
            
            // Clear controller flags
            car.userData._heightManagedByController = false;
            car.userData._alignedByCarController = false;
            car.userData._cameraAttached = false;
            car.userData._cameraConfigured = false;
            
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
