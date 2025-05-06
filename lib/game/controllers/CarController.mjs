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
            
            // CRITICAL FIX: Reduce height offset to eliminate the gap between car and ground
            if (car.userData.fixedHeightOffset !== undefined) {
                console.log(`Previous car height offset: ${car.userData.fixedHeightOffset}`);
                car.userData.fixedHeightOffset = 0.8; // Reduced from 3.0 to 0.8
                console.log(`Adjusted car height offset to: ${car.userData.fixedHeightOffset}`);
                
                // Force car to correct height immediately
                this.snapToSurface(car, car.userData.planet);
            }
            
            console.log("Car controller initialization complete");
        } catch (e) {
            console.error("Error initializing car controller:", e);
        }
    }
    
    // Main update loop
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
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
        } catch (error) {
            console.error("Error in CarController.update:", error);
            return null;
        }
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
            
            // Position camera behind car (not in front)
            // Move backward relative to car's forward direction
            const cameraPosition = car.position.clone();
            cameraPosition.addScaledVector(trueForward, this.fixedCameraOffset.distance * -1); // Negative to be behind car
            
            // Move up by height
            cameraPosition.addScaledVector(surfaceNormal, this.fixedCameraOffset.height);
            
            // Apply position with stronger smoothing for a more stable camera
            Engine.camera.position.lerp(cameraPosition, 0.08);
            
            // Look at car (not ahead of it)
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
    
    // FIXED: Add missing getSurfaceNormal function that was causing errors
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
    
    // NEW: Method to snap car exactly to planet surface (no gap)
    static snapToSurface(car, planet) {
        if (!car || !planet || !planet.object) return;
        
        try {
            // Get planet center and current position
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            // Use consistent height offset for wheel position
            const heightOffset = 1.5; // Increased from 1.2 to 1.5 to prevent wheel clipping
            
            // Store the corrected height for other systems
            car.userData.fixedHeightOffset = heightOffset;
            
            // Calculate exact position on surface with correct height offset
            const exactPosition = planetCenter.clone().addScaledVector(
                toSurface, 
                planet.radius + heightOffset
            );
            
            // Set car position directly without any interpolation
            car.position.copy(exactPosition);
            
            // Mark car as firmly on ground (not falling)
            car.userData.falling = false;
            car.userData.onSurface = true;
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
        } catch (err) {
            console.error("Error snapping car to surface:", err);
        }
    }
    
    // IMPROVED: Handle car movement with proper surface alignment and smoother turning
    static handleCarMovementOnPlanet(car) {
        if (!car || !car.userData) return;
        
        try {
            // Get surface normal for movement calculations
            const surfaceNormal = this.getSurfaceNormal(car);
            if (!surfaceNormal) return;
            
            // Store surface normal for reference
            this.lastSurfaceNormal = surfaceNormal.clone();
            car.userData.surfaceNormal = surfaceNormal.clone();
            
            // CRITICAL: Fix car position to be exactly at the correct height FIRST
            // before any rotation or movement to ensure a stable base
            this.snapToSurface(car, car.userData.planet);
            
            // Get car's current orientation vectors
            const carUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to surface normal and forward
            const surfaceRight = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward perpendicular to surface normal and right
            const surfaceForward = new Vector3().crossVectors(surfaceRight, surfaceNormal).normalize();
            
            // Store the true forward vector for reference in other methods
            this.currentForwardVector = surfaceForward.clone();
            
            // Handle accelerator and brake input
            let targetSpeed = 0;
            const maxSpeed = car.userData.maxSpeed || 12;
            const currentSpeed = car.userData.speed || 0;
            
            // Get input values with proper direction mapping
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
            
            // Update steering angle based on input with smoothing
            const steeringInput = lateralInput;
            const targetSteeringAngle = steeringInput * this.maxSteeringAngle;
            
            this.steeringAngle = this.steeringAngle * this.steeringSmoothFactor + 
                               targetSteeringAngle * (1 - this.steeringSmoothFactor);
            
            car.userData.steeringAngle = this.steeringAngle;
            
            // Update wheel visuals
            this.updateWheelVisuals(car);
            
            // CRITICAL FIX: Apply perfect alignment BEFORE any turning to prevent conflicts
            this.alignCarToSurface(car, surfaceNormal);
            
            // Only apply turning if moving and has steering input
            if (Math.abs(car.userData.speed) > 0.1) {
                if (Math.abs(this.steeringAngle) > 0.01) {
                    // Calculate turn amount that scales with speed and steering angle
                    const turnFactor = this.steeringAngle * 0.025; // Reduced strength for smoother turns
                    
                    // Create rotation quaternion around surface normal
                    const turnQuat = new Quaternion().setFromAxisAngle(surfaceNormal, turnFactor);
                    
                    // Apply rotation to car's quaternion
                    car.quaternion.premultiply(turnQuat);
                    
                    // IMPORTANT: After turning, ensure car stays PERFECTLY aligned to surface
                    // This prevents the cumulative tilting that leads to flipping
                    this.alignCarToSurface(car, surfaceNormal);
                }
                
                // Calculate new forward direction after turning
                const newForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const newRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
                const moveDirection = newForward.clone();
                
                // Apply movement along car's forward direction
                car.position.addScaledVector(moveDirection, car.userData.speed * 0.15);
                
                // CRITICAL: Always maintain exact height above surface after movement
                this.snapToSurface(car, car.userData.planet);
                
                // Store position for next update
                this.lastPosition = car.position.clone();
                
                // Update matrices after position change
                car.updateMatrix();
                car.updateMatrixWorld(true);
                
                // Mark that controller is actively managing vehicle height
                car.userData._heightManagedByController = true;
                car.userData._lastHeightManagement = Date.now();
            } else {
                // When stationary, just ensure perfect alignment
                this.alignCarToSurface(car, surfaceNormal);
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
    
    // IMPROVED: Perfect surface alignment without pitch influence
    static alignCarToSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Get forward direction before alignment
            const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to surface normal and forward direction
            const rightVector = new Vector3().crossVectors(surfaceNormal, currentForward).normalize();
            
            // Recalculate corrected forward vector perpendicular to surface and right
            const forwardVector = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // IMPORTANT: Create rotation matrix from orthogonal basis vectors
            // This ensures the car is perfectly aligned to the surface with no pitch or roll
            const rotMatrix = new Matrix4().makeBasis(
                rightVector,               // Right vector
                surfaceNormal,             // Up vector (surface normal)
                forwardVector.negate()     // Forward vector (negated for correct orientation)
            );
            
            // Get a quaternion from the rotation matrix
            const alignmentQuaternion = new Quaternion().setFromRotationMatrix(rotMatrix);
            
            // Apply the alignment quaternion directly (no lerp/slerp to ensure perfect alignment)
            car.quaternion.copy(alignmentQuaternion);
            
            // Explicitly set car's up vector to match surface normal
            car.up.copy(surfaceNormal);
            
            // Mark that the car has been properly aligned to the surface
            car.userData._hasProperSurfaceAlignment = true;
            car.userData._lastAlignmentTime = Date.now();
        } catch (err) {
            console.error("Error aligning car to surface:", err);
        }
    }
    
    // IMPROVED: More precise surface snapping to prevent jitter
    static snapToSurface(car, planet) {
        if (!car || !planet || !planet.object) return;
        
        try {
            // Get planet center and current position
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            // Use consistent height offset for wheel position
            const heightOffset = 1.5; // Increased from 1.2 to 1.5 to prevent wheel clipping
            
            // Store the corrected height for other systems
            car.userData.fixedHeightOffset = heightOffset;
            
            // Calculate exact position on surface with correct height offset
            const exactPosition = planetCenter.clone().addScaledVector(
                toSurface, 
                planet.radius + heightOffset
            );
            
            // Set car position directly without any interpolation
            car.position.copy(exactPosition);
            
            // Mark car as firmly on ground (not falling)
            car.userData.falling = false;
            car.userData.onSurface = true;
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
        } catch (err) {
            console.error("Error snapping car to surface:", err);
        }
    }
    
    // IMPROVED: Wheel visuals that better match turning angle
    static updateWheelVisuals(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            // Apply steering to front wheels with correct pivot point
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Apply steering to front wheels only
            if (wheels.frontLeft) {
                wheels.frontLeft.rotation.y = steeringAngle;
            }
            
            if (wheels.frontRight) {
                wheels.frontRight.rotation.y = steeringAngle;
            }
            
            // Ensure rear wheels are straight
            if (wheels.rearLeft) {
                wheels.rearLeft.rotation.y = 0;
            }
            
            if (wheels.rearRight) {
                wheels.rearRight.rotation.y = 0;
            }
            
            // Apply wheel rotation based on car speed (optional)
            if (car.userData.speed) {
                const wheelRotationSpeed = car.userData.speed / 0.6; // wheel circumference approx
                const wheels = [wheels.frontLeft, wheels.frontRight, wheels.rearLeft, wheels.rearRight];
                
                wheels.forEach(wheel => {
                    if (wheel) {
                        wheel.rotation.x += wheelRotationSpeed * 0.1; // Scale for visual effect
                    }
                });
            }
        } catch (err) {
            console.error("Error updating wheel visuals:", err);
        }
    }
    
    // Validate camera state to prevent double rendering
    static validateCameraState() {
        if (!Engine.camera) return;
        
        try {
            // Ensure camera is attached directly to scene
            if (Engine.camera.parent !== Engine.scene) {
                console.warn("Car camera parent is incorrect - fixing");
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Validate camera matrices
            if (!this.validateMatrix(Engine.camera.matrix)) {
                console.warn("Car camera has invalid matrix - resetting");
                Engine.camera.updateMatrix();
                Engine.camera.updateMatrixWorld(true);
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
