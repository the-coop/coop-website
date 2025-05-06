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
    
    // IMPROVED: Handle car movement with proper surface alignment and turning
    static handleCarMovementOnPlanet(car) {
        if (!car || !car.userData) return;
        
        try {
            // Get planetary information
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            // Get surface normal (up vector relative to planet)
            const surfaceNormal = this.getSurfaceNormal(car);
            if (!surfaceNormal) return;
            
            // Store surface normal for reference
            car.userData.surfaceNormal = surfaceNormal;
            
            // Calculate forward vector from car's rotation
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // CRITICAL FIX: Calculate right vector perpendicular to surface normal and forward
            // This ensures turns happen in the plane tangent to the planet surface
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward vector perpendicular to surface normal and right vector
            // This ensures forward direction always follows the planet's curvature
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Get steering input
            const steeringInput = this.input.movement.x;
            let targetSteeringAngle = 0;
            
            // Apply steering input with better smoothing
            if (Math.abs(steeringInput) > 0.1) {
                targetSteeringAngle = steeringInput * this.maxSteeringAngle;
                
                // IMPROVED: Apply turn in the plane tangent to the planet surface
                // Create rotation quaternion for steering
                const turnAngle = -steeringInput * 0.03; // Adjust turn speed here
                const steerQuat = new Quaternion().setFromAxisAngle(surfaceNormal, turnAngle);
                
                // Apply rotation to car quaternion
                car.quaternion.premultiply(steerQuat);
                
                // NEW: Update car's up vector to ensure it aligns with the planet
                car.up.copy(surfaceNormal);
                
                // Store steering angle for wheel visualization
                car.userData.steeringAngle = targetSteeringAngle;
            } else {
                car.userData.steeringAngle = 0;
            }
            
            // Get acceleration/braking input
            const accelerationInput = this.input.movement.z;
            
            // Apply acceleration/braking with improved physics
            if (Math.abs(accelerationInput) > 0.1) {
                // Acceleration force depends on surface alignment
                const accelerationForce = 0.03 * Math.max(0.3, trueForward.dot(carForward));
                
                // Apply acceleration in the true forward direction
                const accelerationVector = trueForward.clone().multiplyScalar(
                    accelerationInput * accelerationForce
                );
                
                // Add to car velocity
                car.userData.velocity.add(accelerationVector);
                
                // Limit speed
                const currentSpeed = car.userData.velocity.length();
                if (currentSpeed > car.userData.maxSpeed) {
                    car.userData.velocity.normalize().multiplyScalar(car.userData.maxSpeed);
                }
                
                // Store speed for wheel animation
                car.userData.speed = car.userData.velocity.length() * Math.sign(accelerationInput);
                
                // Mark car as having acceleration applied
                car.userData.acceleration = accelerationInput * accelerationForce;
                car.userData.lastInputTime = Date.now();
            } else {
                // Apply drag when no input
                car.userData.velocity.multiplyScalar(1 - car.userData.drag);
                car.userData.acceleration = 0;
                
                // Update speed for wheel animation
                car.userData.speed *= 0.95;
                
                // If nearly stopped, zero out speed
                if (Math.abs(car.userData.speed) < 0.01) {
                    car.userData.speed = 0;
                }
            }
            
            // IMPROVED: Ensure car stays properly oriented to planet surface
            this.alignCarToSurface(car, surfaceNormal);
            
            // Mark that car controller is managing this vehicle
            car.userData._controlledByCarController = true;
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
        } catch (err) {
            console.error("Error handling car movement:", err);
        }
    }
    
    // IMPROVED: Perfect surface alignment without pitch influence
    static alignCarToSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Set car's up vector to match surface normal
            car.up.copy(surfaceNormal);
            
            // Get car's current forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project forward onto tangent plane to ensure it follows planet surface
            const projectedForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // If the projected vector is too small, use a fallback direction
            if (projectedForward.lengthSq() < 0.001) {
                // Use current right vector as basis to find a valid forward direction
                const currentRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
                const tangentRight = currentRight.clone().projectOnPlane(surfaceNormal).normalize();
                projectedForward.crossVectors(surfaceNormal, tangentRight).normalize();
            }
            
            // Calculate right vector for complete orthogonal basis
            const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
            
            // Ensure forward vector is perpendicular to both up and right (re-orthogonalize)
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Build a rotation matrix from the orthogonal basis vectors
            const rotMatrix = new Matrix4().makeBasis(
                rightVector,
                surfaceNormal,
                trueForward.clone().negate() // Negate for correct orientation
            );
            
            // Extract target quaternion from rotation matrix
            const targetQuaternion = new Quaternion().setFromRotationMatrix(rotMatrix);
            
            // Get alignment strength
            const alignmentStrength = this.alignmentStrength;
            
            // Smoothly interpolate to target orientation with stronger alignment
            car.quaternion.slerp(targetQuaternion, alignmentStrength);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // Update wheels to match steering
            if (car.userData.wheels) {
                VehicleManager.resetWheelsBaseOrientation(car);
            }
        } catch (err) {
            console.error("Error aligning car to surface:", err);
        }
    }
    
    // IMPROVED: Method to snap car exactly to planet surface (no gap)
    static snapToSurface(car, planet) {
        if (!car || !planet || !planet.object) return;
        
        try {
            // Get planet center and current position
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            // Use consistent height offset for wheel position
            const heightOffset = 1.8; // Increased from 1.5 to 1.8 to prevent wheels clipping through surface
            
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
