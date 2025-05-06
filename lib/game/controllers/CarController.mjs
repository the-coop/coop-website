// Controller for car vehicle operation - fully simplified version
import { Vector3, Quaternion, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';
import PlayersManager from '../players.mjs';

export default class CarController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };
    
    // Camera configuration
    static fixedCameraOffset = {
        height: 5,
        distance: 15,
        lookAhead: 3
    };
    
    // Steering state with added smoothing
    static steeringAngle = 0;
    static maxSteeringAngle = 0.4;
    static steeringSmoothFactor = 0.85; 
    
    // Track previous movement direction
    static lastMovementDirection = null;
    static lastSurfaceNormal = null;
    static lastPosition = null;
    static currentForwardVector = null;
    
    // NEW: Track surface alignment state
    static lastUpVector = null;
    static alignmentStrength = 0.15; // Base alignment strength
    
    // Reset controller and setup car
    static reset() {
        console.log('Initializing Car Controller');
        
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error("No car vehicle found for CarController");
            return;
        }
        
        try {
            // Mark car as being controlled by this controller for physics system
            car.userData._controlledByCarController = true;
            
            // CRITICAL FIX: Ensure camera is properly handled during transition
            if (Engine.camera) {
                console.log("Setting up car camera view");
                
                // Step 1: Always detach camera from any previous parent first
                if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
                    const worldPos = new Vector3();
                    const worldQuat = new Quaternion();
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.getWorldQuaternion(worldQuat);
                    Engine.camera.parent.remove(Engine.camera);
                    
                    // Add to scene first as intermediate step
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                    Engine.camera.quaternion.copy(worldQuat);
                }
                
                // Step 2: Reset camera properties to avoid artifacts
                Engine.camera.fov = 75;
                Engine.camera.zoom = 1;
                Engine.camera.updateProjectionMatrix();
                
                // Step 3: Ensure camera is a direct child of scene to avoid double rendering
                if (Engine.camera.parent !== Engine.scene) {
                    Engine.scene.add(Engine.camera);
                }
                
                // Step 4: Initial camera positioning behind car
                this.updateFixedCameraPosition(car);
            }
            
            // Reset controller state
            this.steeringAngle = 0;
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Initialize vehicle physics state
            if (!car.userData.velocity) car.userData.velocity = new Vector3();
            car.userData.speed = 0;
            car.userData.isBraking = false;
            
            // Initialize movement tracking variables
            this.lastMovementDirection = null;
            this.lastSurfaceNormal = null;
            this.lastPosition = car.position.clone();
            this.currentForwardVector = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            console.log("Car controller initialization complete");
        } catch (e) {
            console.error("Error initializing car controller:", e);
        }
    }
    
    // Main update loop
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        // Check for exit request
        if (this.input.exit || this.input.action) {
            console.log("Exit requested from car");
            return 'exit';
        }
        
        // Handle initial freeze period
        if (car.userData._frozen && car.userData._frozenUntil && Date.now() < car.userData._frozenUntil) {
            // Car is frozen, skip movement processing
        } else {
            // Process car movement
            this.handleCarMovementOnPlanet(car);
        }
        
        // Update camera position to follow car
        this.updateFixedCameraPosition(car);
        
        // Reset rotation input
        this.input.rotation.set(0, 0, 0);
        
        // Validate camera state to prevent double rendering
        this.validateCameraState();
        
        return null;
    }
    
    // FIXED: Camera positioning to look at back of car instead of front
    static updateFixedCameraPosition(car = null) {
        if (!car || !Engine.camera) return;
        
        try {
            // Always ensure camera is a direct scene child
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
            
            // Get car's forward direction and planet surface normal
            const surfaceNormal = this.getSurfaceNormal(car);
            if (!surfaceNormal) return;
            
            // Get car's forward direction (local negative Z axis)
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to up and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward perpendicular to surface normal and right vector
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // CRITICAL FIX: Position camera behind car (not in front)
            // Move backward relative to car's forward direction
            const cameraPosition = car.position.clone();
            cameraPosition.addScaledVector(trueForward, this.fixedCameraOffset.distance * -1); // Negative to be behind car
            
            // Move up by height
            cameraPosition.addScaledVector(surfaceNormal, this.fixedCameraOffset.height);
            
            // Apply position with stronger smoothing for a more stable camera
            Engine.camera.position.lerp(cameraPosition, 0.08);
            
            // FIXED: Look at car (not ahead of it)
            const lookTarget = car.position.clone();
            // Small offset to look slightly above car center at driver height
            lookTarget.addScaledVector(surfaceNormal, 2);
            
            // Set camera up direction aligned with surface normal
            Engine.camera.up.copy(surfaceNormal);
            
            // Make camera look at target
            Engine.camera.lookAt(lookTarget);
            
            // Force matrix update to commit position changes
            Engine.camera.updateMatrix();
            Engine.camera.updateMatrixWorld(true);
        } catch (err) {
            console.error("Error updating car camera position:", err);
        }
    }
    
    // IMPROVED: Car movement with better turning and stability
    static handleCarMovementOnPlanet(car) {
        if (!car || !car.userData) return;
        
        try {
            // Get surface normal for movement calculations
            const surfaceNormal = this.getSurfaceNormal(car);
            if (!surfaceNormal) return;
            
            // Store surface normal for reference
            this.lastSurfaceNormal = surfaceNormal.clone();
            car.userData.surfaceNormal = surfaceNormal.clone();
            
            // Get car's current orientation vectors relative to planet surface
            const carUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to up and forward for stable turning
            const surfaceRight = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward perpendicular to surface normal and right vector
            const surfaceForward = new Vector3().crossVectors(surfaceRight, surfaceNormal).normalize();
            
            // Store the true forward vector for reference in other methods
            this.currentForwardVector = surfaceForward.clone();
            
            // CRITICAL FIX: Initialize lastUpVector if not set
            if (!this.lastUpVector) {
                this.lastUpVector = surfaceNormal.clone();
            }
            
            // Handle accelerator and brake input
            let targetSpeed = 0;
            const maxSpeed = car.userData.maxSpeed || 12;
            const currentSpeed = car.userData.speed || 0;
            
            // Get input values with smoothing and proper direction mapping
            const forwardInput = this.input.movement.z;
            const lateralInput = this.input.movement.x;
            
            // Handle forward/backward movement
            if (forwardInput > 0) {
                // Accelerating
                targetSpeed = maxSpeed * forwardInput;
                car.userData.isBraking = false;
            } else if (forwardInput < 0) {
                // Braking or reverse
                if (currentSpeed > 0.5) {
                    // Braking when moving forward
                    targetSpeed = 0;
                    car.userData.isBraking = true;
                } else {
                    // Reverse
                    targetSpeed = maxSpeed * 0.3 * forwardInput; // Slower in reverse
                    car.userData.isBraking = false;
                }
            } else {
                // No input - slow down gradually
                targetSpeed = currentSpeed * 0.97; // Gentle deceleration
                car.userData.isBraking = false;
            }
            
            // Apply acceleration with smoothing
            const acceleration = 0.05;
            car.userData.speed = car.userData.speed * (1 - acceleration) + targetSpeed * acceleration;
            
            // FIXED: Handle steering with proper physics and surface alignment
            // Update steering angle based on input with smoothing
            const steeringInput = lateralInput;
            const targetSteeringAngle = steeringInput * this.maxSteeringAngle;
            
            // Apply smoothing to steering angle changes
            this.steeringAngle = this.steeringAngle * this.steeringSmoothFactor + 
                               targetSteeringAngle * (1 - this.steeringSmoothFactor);
            
            // Store steering angle in car data
            car.userData.steeringAngle = this.steeringAngle;
            
            // Update wheel visuals to match steering
            this.updateWheelVisuals(car);
            
            // CRITICAL FIX: Calculate true turning radius based on steering angle
            // This is similar to the FPS controller's surface movement but with car parameters
            const wheelbase = 4.0; // Distance between front and rear axles
            
            // Only turn when car is moving and has steering input
            if (Math.abs(car.userData.speed) > 0.1 && Math.abs(this.steeringAngle) > 0.001) {
                // Calculate turning radius (simplified Ackerman steering)
                // R = wheelbase / tan(steering angle)
                const steeringAngleRad = this.steeringAngle;
                let turningRadius;
                
                if (Math.abs(steeringAngleRad) < 0.01) {
                    turningRadius = 1000; // Nearly infinite for very small angles
                } else {
                    turningRadius = wheelbase / Math.tan(Math.abs(steeringAngleRad));
                }
                
                // Calculate angular velocity based on speed and turning radius
                // ω = v / r (angular velocity = linear velocity / radius)
                const angularSpeed = (car.userData.speed / turningRadius) * 0.12; // Scale for better feel
                
                // Direction of rotation depends on steering direction
                const rotationDirection = Math.sign(this.steeringAngle);
                
                // Create rotation quaternion around surface normal (up vector)
                const turnQuat = new Quaternion().setFromAxisAngle(
                    surfaceNormal,
                    angularSpeed * rotationDirection
                );
                
                // Apply rotation to car's quaternion
                car.quaternion.premultiply(turnQuat);
            }
            
            // CRITICAL FIX: Calculate dynamic alignment strength based on movement state
            // More aggressive alignment when moving to prevent pitch rotation
            let dynamicAlignStrength = this.alignmentStrength;
            
            // Increase alignment strength when:
            // 1. The car is moving fast
            // 2. The car is accelerating or braking
            // 3. The surface normal is changing rapidly
            const isMovingFast = Math.abs(car.userData.speed) > 3;
            const isAcceleratingOrBraking = Math.abs(forwardInput) > 0.5;
            
            if (isMovingFast) {
                dynamicAlignStrength *= 2.0; // Double alignment strength when moving fast
            }
            
            if (isAcceleratingOrBraking) {
                dynamicAlignStrength *= 1.5; // 50% stronger alignment during acceleration/braking
            }
            
            // Check if surface normal is changing rapidly
            if (this.lastUpVector) {
                const normalChangeMagnitude = 1 - this.lastUpVector.dot(surfaceNormal);
                if (normalChangeMagnitude > 0.01) {
                    // Surface is changing, increase alignment strength
                    dynamicAlignStrength *= (1 + normalChangeMagnitude * 10);
                }
            }
            
            // CRITICAL FIX: Always apply surface alignment before movement
            // This ensures the car stays aligned with the surface as it moves
            this.alignCarToPlanetSurface(car, surfaceNormal, dynamicAlignStrength);
            
            // Apply movement in car's forward direction based on speed
            if (Math.abs(car.userData.speed) > 0.01) {
                // CRITICAL FIX: Use the surfaceForward vector to ensure movement along surface
                const moveDirection = surfaceForward.clone();
                
                // Apply speed to move in this direction
                car.position.addScaledVector(moveDirection, car.userData.speed * 0.15);
                
                // Store position for next update
                this.lastPosition = car.position.clone();
                
                // Update matrices after position change
                car.updateMatrix();
                car.updateMatrixWorld(true);
                
                // Make sure car stays at the correct height above ground
                this.maintainCarHeight(car, car.userData.planet);
                
                // Store the current up vector for next frame comparison
                this.lastUpVector = surfaceNormal.clone();
            }
            
            // Update car's velocity for physics system
            if (car.userData.velocity) {
                // Calculate actual velocity from position change
                const newPosition = car.position.clone();
                if (this.lastPosition) {
                    const posChange = newPosition.clone().sub(this.lastPosition);
                    car.userData.velocity.copy(posChange.multiplyScalar(60)); // Scale to units per second
                }
                this.lastPosition = newPosition.clone();
            }
        } catch (e) {
            console.error("Error handling car movement:", e);
        }
    }
    
    // IMPROVED: Align car to planet surface with better stabilization against pitch rotation
    static alignCarToPlanetSurface(car, surfaceNormal, lerpFactor = 0.1) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Get current car orientation 
            const currentUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // CRITICAL FIX: Calculate the forward vector that lies on the surface tangent plane
            // This ensures the car's forward direction stays aligned with the surface
            // First, get the right vector perpendicular to surface normal and current forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, currentForward).normalize();
            
            // Then recalculate the true forward vector perpendicular to both right and surface normal
            const surfaceAlignedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // CRITICAL FIX: Create target orientation that keeps forward direction on surface plane
            const targetMatrix = new Matrix4().makeBasis(
                rightVector, // Right vector
                surfaceNormal, // Up vector aligned with surface normal
                surfaceAlignedForward.clone().negate() // Forward vector (negated for correct orientation)
            );
            
            // Create quaternion from target orientation
            const targetQuat = new Quaternion().setFromRotationMatrix(targetMatrix);
            
            // CRITICAL FIX: Apply alignment with dynamic lerp factor
            car.quaternion.slerp(targetQuat, lerpFactor);
            
            // CRITICAL FIX: Ensure the car's up vector is exactly aligned with surface normal
            // This prevents unwanted pitch rotation during movement
            car.up.copy(surfaceNormal);
            
            // Make sure wheels stay aligned with surface
            if (car.userData.wheels) {
                VehicleManager.resetWheelsBaseOrientation(car);
            }
            
            // Mark that this controller is managing height
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
        } catch (err) {
            console.error("Error aligning car to surface:", err);
        }
    }
    
    // Helper to get surface normal
    static getSurfaceNormal(car) {
        if (!car || !car.userData || !car.userData.planet) return new Vector3(0, 1, 0);
        
        // Get planet object and position
        const planet = car.userData.planet;
        if (!planet || !planet.object) return new Vector3(0, 1, 0);
        
        // Calculate direction from planet center to car
        const toObject = car.position.clone().sub(planet.object.position);
        const surfaceNormal = toObject.normalize();
        
        return surfaceNormal;
    }
    
    // Keep car at correct height with improved stability
    static maintainCarHeight(car, planet) {
        if (!car || !planet || !planet.object) return;
        
        try {
            const planetCenter = planet.object.position;
            const toObject = car.position.clone().sub(planetCenter);
            const distance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Get appropriate height offset for the car
            const heightOffset = car.userData.fixedHeightOffset || 3.0;
            const groundLevel = planet.radius + heightOffset;
            
            // Calculate height error
            const heightError = distance - groundLevel;
            
            // Only correct if height error is significant
            if (Math.abs(heightError) > 0.1) {
                // Calculate correction amount based on error
                const correctionAmount = heightError * 0.2;
                
                // Calculate new position that maintains correct height
                const newPosition = car.position.clone().sub(
                    surfaceNormal.clone().multiplyScalar(correctionAmount)
                );
                
                // Apply new position
                car.position.copy(newPosition);
                
                // Update matrices
                car.updateMatrix();
                car.updateMatrixWorld(true);
            }
            
            // Store surface normal in car data
            car.userData.surfaceNormal = surfaceNormal;
            
            // Mark that height was maintained
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
        } catch (err) {
            console.error("Error maintaining car height:", err);
        }
    }
    
    // SIMPLIFIED: Update wheel visuals with ONLY turning (no rolling)
    static updateWheelVisuals(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            // Get steering angle
            const steeringAngle = this.steeringAngle;
            
            // Get references to wheel objects
            const wheels = car.userData.wheels;
            
            // Update front wheels steer angle only
            if (wheels.frontLeft) {
                // Apply only steering rotation, not rolling
                wheels.frontLeft.rotation.y = steeringAngle;
            }
            
            if (wheels.frontRight) {
                // Apply only steering rotation, not rolling
                wheels.frontRight.rotation.y = steeringAngle;
            }
            
            // No need to rotate wheels for rolling motion as requested
        } catch (err) {
            console.error("Error updating wheel visuals:", err);
        }
    }
    
    // Validate camera state to prevent double rendering
    static validateCameraState() {
        if (!Engine.camera) return;
        
        try {
            // 1. Ensure camera is a direct child of scene
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
            
            // 2. Check for matrix inconsistencies
            if (!this.validateMatrix(Engine.camera.matrix) || 
                !this.validateMatrix(Engine.camera.matrixWorld) ||
                !this.validateMatrix(Engine.camera.matrixWorldInverse)) {
                
                // Store position and orientation
                const pos = Engine.camera.position.clone();
                const quat = Engine.camera.quaternion.clone();
                
                // Reset all matrices
                Engine.camera.matrix.identity();
                Engine.camera.matrixWorld.identity();
                Engine.camera.matrixWorldInverse.identity();
                
                // Restore position and orientation
                Engine.camera.position.copy(pos);
                Engine.camera.quaternion.copy(quat);
                
                // Force update
                Engine.camera.updateMatrix();
                Engine.camera.updateMatrixWorld(true);
                Engine.camera.matrixWorldInverse.copy(Engine.camera.matrixWorld).invert();
            }
        } catch (err) {
            console.error("Error validating camera state:", err);
        }
    }
    
    // Helper to validate matrix has valid values
    static validateMatrix(matrix) {
        if (!matrix || !matrix.elements) return false;
        
        // Check for NaN or infinite values
        for (let i = 0; i < 16; i++) {
            if (isNaN(matrix.elements[i]) || !isFinite(matrix.elements[i])) {
                return false;
            }
        }
        return true;
    }
    
    // Improved cleanup when exiting car
    static cleanup() {
        console.log("Cleaning up Car Controller");
        
        // Reset controller state
        this.steeringAngle = 0;
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        const car = VehicleManager.currentVehicle;
        if (car) {
            // Clear controller flag
            car.userData._controlledByCarController = false;
            
            // Ensure car is marked for physics control after exiting
            car.userData._physicsControlled = true;
        }
        
        // Ensure camera is completely reset for next controller
        if (Engine.camera) {
            // First, get world position and orientation
            const worldPos = new Vector3();
            const worldQuat = new Quaternion();
            Engine.camera.getWorldPosition(worldPos);
            Engine.camera.getWorldQuaternion(worldQuat);
            
            // Detach from any parent
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            
            // Add directly to scene
            Engine.scene.add(Engine.camera);
            
            // Reset position and orientation
            Engine.camera.position.copy(worldPos);
            Engine.camera.quaternion.copy(worldQuat);
            
            // Reset camera properties
            Engine.camera.up.set(0, 1, 0);
            Engine.camera.updateProjectionMatrix();
            
            console.log("Camera detached and reset in CarController cleanup");
        }
    }
    
    // Add a method for aligning to surface that can be called from ObjectManager
    static align(car, surfaceNormal, lerpFactor = 0.1) {
        if (!car || !surfaceNormal) return false;
        
        return this.alignCarToPlanetSurface(car, surfaceNormal, lerpFactor);
    }
}
