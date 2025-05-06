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
    
    // IMPROVED: Fixed camera positioning with better surface normal handling
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
            
            // FIX: Match camera angle with FPS controller to feel consistent
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to up and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward perpendicular to surface normal and right vector
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Calculate camera position behind and above car
            const cameraPosition = car.position.clone();
            
            // Move backward by distance
            cameraPosition.addScaledVector(trueForward, -this.fixedCameraOffset.distance);
            
            // Move up by height
            cameraPosition.addScaledVector(surfaceNormal, this.fixedCameraOffset.height);
            
            // Apply position with stronger smoothing for a more stable camera
            Engine.camera.position.lerp(cameraPosition, 0.08);
            
            // Calculate look target position with higher offset like FPS controller
            const lookTarget = car.position.clone();
            lookTarget.addScaledVector(trueForward, this.fixedCameraOffset.lookAhead);
            lookTarget.addScaledVector(surfaceNormal, 2); // Look slightly above car at driver height
            
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
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to up and forward for stable turning
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward perpendicular to surface normal and right vector
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Store the true forward vector for reference in other methods
            this.currentForwardVector = trueForward.clone();
            
            // Handle accelerator and brake input
            const forwardInput = this.input.movement.z;
            const lateralInput = this.input.movement.x;
            
            // Apply acceleration and speed calculations
            let targetSpeed = 0;
            const maxSpeed = car.userData.maxSpeed || 12;
            const currentSpeed = car.userData.speed || 0;
            
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
            
            // IMPROVED: Handle steering with proper physics
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
            
            // FIXED: Calculate turn rate based on steering angle, speed and wheelbase
            // This is the key improvement - cars shouldn't just rotate on their axis
            const wheelbase = 4.0; // Distance between front and rear axles
            const speedFactor = Math.min(Math.abs(car.userData.speed) / 4, 1); // Normalize speed for turn rate
            
            // Ackerman steering formula: turn rate = speed * tan(steering angle) / wheelbase
            // This creates a more realistic turning radius based on the steering angle
            if (Math.abs(car.userData.speed) > 0.1) {
                const steeringAngleRadians = this.steeringAngle;
                const turnRate = (car.userData.speed * Math.tan(steeringAngleRadians) / wheelbase) * 0.03;
                
                if (Math.abs(turnRate) > 0.0001) {
                    // Create quaternion for turning around surface normal
                    const turnQuat = new Quaternion().setFromAxisAngle(
                        surfaceNormal,
                        turnRate
                    );
                    
                    // Apply turn quaternion to car's quaternion
                    car.quaternion.multiply(turnQuat);
                    
                    // Update car's up vector to match surface normal
                    this.alignCarToPlanetSurface(car, surfaceNormal);
                }
            }
            
            // Apply movement in car's forward direction based on speed
            if (Math.abs(car.userData.speed) > 0.01) {
                // Get the current forward direction after turning
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Project this onto the surface tangent plane
                const moveDirection = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                // Apply speed to move in this direction
                car.position.addScaledVector(moveDirection, car.userData.speed * 0.15);
                
                // Store position for next update
                this.lastPosition = car.position.clone();
                
                // Update matrices after position change
                car.updateMatrix();
                car.updateMatrixWorld(true);
                
                // Make sure car stays at the correct height above ground
                this.maintainCarHeight(car, car.userData.planet);
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
    
    // Align car to planet surface with better quaternion handling
    static alignCarToPlanetSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Get current car orientation 
            const currentUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate rotation axis and angle
            const rotationAxis = new Vector3().crossVectors(currentUp, surfaceNormal).normalize();
            
            // Only rotate if we have a valid rotation axis
            if (rotationAxis.lengthSq() > 0.001) {
                const angle = Math.acos(Math.min(1, Math.max(-1, currentUp.dot(surfaceNormal))));
                
                // Create quaternion for alignment
                const alignmentQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                
                // Apply alignment with smoothing
                const lerpFactor = car.userData.justLanded ? 0.3 : 0.1;
                car.quaternion.multiply(alignmentQuat);
                
                // Calculate the forward direction that's perpendicular to the new up vector
                const rightVector = new Vector3().crossVectors(surfaceNormal, currentForward).normalize();
                const newForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
                
                // Create target quaternion that maintains forward direction while aligning with surface
                const targetMatrix = new Matrix4().makeBasis(
                    rightVector,
                    surfaceNormal,
                    newForward.clone().negate() // Negate for correct orientation
                );
                const targetQuat = new Quaternion().setFromRotationMatrix(targetMatrix);
                
                // Smoothly interpolate to target orientation
                car.quaternion.slerp(targetQuat, lerpFactor);
            }
            
            // Clear landing flag after alignment
            if (car.userData.justLanded && 
                Date.now() - (car.userData.landingTime || 0) > 1000) {
                car.userData.justLanded = false;
            }
            
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
    
    // Update wheel visuals
    static updateWheelVisuals(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            // Get steering angle and speed
            const steeringAngle = this.steeringAngle;
            const speed = car.userData.speed || 0;
            
            // Get references to wheel objects
            const wheels = car.userData.wheels;
            
            // Update front wheels steer angle
            if (wheels.frontLeft) {
                wheels.frontLeft.rotation.y = steeringAngle;
            }
            
            if (wheels.frontRight) {
                wheels.frontRight.rotation.y = steeringAngle;
            }
            
            // Rotate wheels based on speed
            const wheelRadius = 0.6; // approximate wheel radius
            const rotationSpeed = speed / wheelRadius;
            
            // Apply rotation to all wheels
            Object.values(wheels).forEach(wheel => {
                if (wheel) {
                    wheel.rotation.x += rotationSpeed * 0.1; // Apply wheel rotation
                }
            });
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
        
        return this.alignCarToPlanetSurface(car, surfaceNormal);
    }
}
