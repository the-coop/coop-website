// Controller for car vehicle operation - fully simplified version

import { Vector3, Quaternion } from 'three';
import VehicleManager from '../vehicles.mjs';
import Engine from '../engine.mjs';
import Physics from '../physics.mjs';
import ObjectManager from '../object.mjs';

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
    static alignmentStrength = 0.15;    
    // Add new properties for controlling car turning physics
    static turnRadius = 8;
    static maxSteeringRate = 0.02;
    static currentBodyYaw = 0;
    
    // Reset controller and setup car
    static reset() {
        console.log('CarController reset');
        
        // Initialize input
        this.input = {
            movement: new Vector3(),
            rotation: new Vector3(),
            action: false,
            exit: false
        };
        
        // Reset steering state
        this.steeringAngle = 0;
        this.currentBodyYaw = 0;
        
        // Get current vehicle
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.warn('No vehicle available for car controller');
            return;
        }
        
        // CRITICAL FIX: Ensure car is properly aligned to surface on entry
        if (car.userData && car.userData.planet) {
            // Get planet and surface normal
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            console.log("Aligning car to surface on controller reset");
            
            // Force immediate alignment to surface
            this.snapToSurface(car, planet);
            
            // Explicitly align car to surface with strong factor
            this.forceAlignCarToSurface(car, toSurface);
            
            // FIXED: Make sure wheels are oriented correctly with zero steering
            if (car.userData.wheels) {
                this.updateWheelOrientation(car, 0);
            }
            
            // Mark car as grounded
            car.userData.falling = false;
            car.userData.onSurface = true;
        }
        
        // Reset camera position
        this.updateFixedCameraPosition(car);
        
        // Mark as controlled by car controller
        if (car.userData) {
            car.userData._controlledByCarController = true;
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
        }
        
        console.log("Car controller reset complete");
    }
    
    // Main update loop
    static update() {
        // Get the current vehicle
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        // Handle vehicle physics on planet
        this.handleCarMovementOnPlanet(car);
        
        // Update camera position
        this.updateFixedCameraPosition(car);
        
        // Reset input for next frame
        this.input.rotation.set(0, 0, 0);
        
        // Check for exit request
        if (this.input.exit) {
            console.log("Car controller received exit request");
            this.input.exit = false;
            return 'exit'; // Signal to control manager that we want to exit
        }
        
        return null;
    }
    
    // FIXED: Camera positioning to look at back of car instead of front
    static updateFixedCameraPosition(car = null) {
        if (!car) car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Get the camera
            const camera = Engine.camera;
            if (!camera) return;
            
            // Store current camera position before detaching
            const currentPosition = camera.position.clone();
            
            // Detach camera from any parent
            if (camera.parent && camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                camera.getWorldPosition(worldPos);
                camera.parent.remove(camera);
                Engine.scene.add(camera);
                camera.position.copy(worldPos);
            }
            
            // Get car orientation and position
            const carPosition = car.position.clone();
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carUp = this.getSurfaceNormal(car);
            
            // Calculate right vector perpendicular to car up and forward
            const carRight = new Vector3().crossVectors(carUp, carForward).normalize();
            
            // Recalculate forward perpendicular to right and up
            const carTrueForward = new Vector3().crossVectors(carRight, carUp).normalize();
            
            // Calculate camera position behind car - FIXED OFFSET with more distance
            const cameraOffset = new Vector3();
            cameraOffset.addScaledVector(carTrueForward, -this.fixedCameraOffset.distance);
            cameraOffset.addScaledVector(carUp, this.fixedCameraOffset.height);
            
            // Set camera position
            camera.position.copy(carPosition).add(cameraOffset);
            
            // Calculate look-ahead position in front of car
            const lookAtPosition = carPosition.clone()
                .addScaledVector(carTrueForward, this.fixedCameraOffset.lookAhead)
                .addScaledVector(carUp, 1.0); // Look slightly above car
                
            // Point camera at look-ahead position
            camera.lookAt(lookAtPosition);
            
            // Make sure camera UP vector is aligned with planet surface normal
            camera.up.copy(carUp);
            
            // Update camera projection
            camera.updateProjectionMatrix();
            
        } catch (err) {
            console.error("Error updating fixed camera position:", err);
        }
    }
    
    // FIXED: Add missing getSurfaceNormal function that was causing errors
    static getSurfaceNormal(car) {
        if (!car || !car.userData) {
            return new Vector3(0, 1, 0); // Default up if no car data
        }
        
        try {
            // First try to use pre-calculated surface normal stored on car
            if (car.userData.surfaceNormal) {
                return car.userData.surfaceNormal.clone();
            }
            
            // If not available, calculate from planet data
            if (car.userData.planet && car.userData.planet.object) {
                const planetCenter = car.userData.planet.object.position;
                const toSurface = car.position.clone().sub(planetCenter).normalize();
                
                // Store the calculated normal for future use
                car.userData.surfaceNormal = toSurface.clone();
                
                return toSurface;
            }
        } catch (err) {
            console.error("Error getting surface normal:", err);
        }
        
        // Fallback to global up vector
        return new Vector3(0, 1, 0);
    }
    
    // IMPROVED: Method to snap car exactly to planet surface (no gap)
    static snapToSurface(car, planet) {
        if (!car || !planet || !planet.object) return;
        
        try {
            // Get planet center and current position
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            // Use consistent height offset for wheel position
            const heightOffset = 2.2; // Increased from 1.8 to 2.2 to prevent wheels clipping through surface
            
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
            
            // IMPROVED: More aggressive alignment to surface
            this.forceAlignCarToSurface(car, toSurface);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            console.log(`Car snapped to surface at height offset ${heightOffset}`);
        } catch (err) {
            console.error("Error snapping car to surface:", err);
        }
    }
    
    // NEW: Add a method for immediate/forced alignment without smoothing
    static forceAlignCarToSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // CRITICAL FIX: Save the car's forward direction BEFORE alignment
            const originalForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Define local Y axis (up)
            const localUp = new Vector3(0, 1, 0);
            
            // Calculate rotation to align local up with surface normal
            const rotationAxis = new Vector3().crossVectors(localUp, surfaceNormal).normalize();
            
            // Handle case where vectors are parallel
            if (rotationAxis.lengthSq() < 0.001) {
                if (localUp.dot(surfaceNormal) < 0) {
                    // Find any perpendicular axis for rotation
                    const perpAxis = new Vector3(1, 0, 0);
                    if (Math.abs(surfaceNormal.dot(perpAxis)) > 0.9) {
                        perpAxis.set(0, 0, 1);
                    }
                    rotationAxis.copy(perpAxis).cross(surfaceNormal).normalize();
                    const q = new Quaternion().setFromAxisAngle(rotationAxis, Math.PI);
                    car.quaternion.copy(q);
                }
                return;
            }
            
            // Calculate rotation angle
            const angle = Math.acos(Math.max(-1, Math.min(1, localUp.dot(surfaceNormal))));
            
            // Create initial alignment quaternion
            const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
            
            // Apply basic alignment to get car upright on surface
            car.quaternion.copy(alignQuat);
            
            // CRITICAL FIX: Now preserve the original forward direction
            // Project original forward onto the tangent plane of the surface
            const projectedForward = originalForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            if (projectedForward.lengthSq() > 0.001) {
                // Find the current forward direction after basic alignment
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Calculate rotation needed to align current forward with projected original forward
                const forwardRotAxis = new Vector3().crossVectors(currentForward, projectedForward).normalize();
                
                if (forwardRotAxis.lengthSq() > 0.001) {
                    const forwardAngle = Math.acos(Math.max(-1, Math.min(1, currentForward.dot(projectedForward))));
                    const forwardQuat = new Quaternion().setFromAxisAngle(forwardRotAxis, forwardAngle);
                    
                    // Apply forward direction preservation
                    car.quaternion.premultiply(forwardQuat);
                }
            }
            
            // Store car's reference axes for future use
            if (car.userData) {
                const updatedForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const updatedRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
                const updatedUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
                
                car.userData._carUp = updatedUp.clone();
                car.userData._carRight = updatedRight.clone();
                car.userData._carForward = updatedForward.clone();
                car.userData.surfaceNormal = surfaceNormal.clone();
            }
            
            // Update matrices after orientation change
            car.updateMatrix();
            car.updateMatrixWorld(true);
        } catch (err) {
            console.error("Error in force align car to surface:", err);
        }
    }
    
    // ADDED: Implement alignCarToSurface method to fix the missing function error
    static alignCarToSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Get current car up vector (local Y-axis)
            const carUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            
            // Check if alignment is needed
            const upDot = carUp.dot(surfaceNormal);
            if (upDot > 0.9999) return; // Already perfectly aligned
            
            // Create rotation from current up to surface normal
            const alignmentAxis = new Vector3().crossVectors(carUp, surfaceNormal).normalize();
            
            // If axis is too small, cars are either perfectly aligned or opposite
            if (alignmentAxis.lengthSq() < 0.001) {
                // Handle case where vectors are opposite
                if (upDot < 0) {
                    // Find any perpendicular axis to rotate around
                    const perpAxis = new Vector3(1, 0, 0);
                    if (Math.abs(surfaceNormal.dot(perpAxis)) > 0.9) {
                        perpAxis.set(0, 0, 1); // Use Z axis if X is parallel
                    }
                    
                    // Create perpendicular axis
                    alignmentAxis.copy(perpAxis).cross(surfaceNormal).normalize();
                    
                    // Create 180 degree rotation
                    const q = new Quaternion().setFromAxisAngle(alignmentAxis, Math.PI);
                    car.quaternion.premultiply(q);
                }
                return;
            }
            
            // Calculate rotation angle
            const angle = Math.acos(Math.max(-1, Math.min(1, upDot)));
            
            // IMPROVED: Use much stronger alignment strength like FPSController
            // This will make the car stick to the surface better
            const strength = Math.min(1.0, 0.5); // Fixed high value instead of using this.alignmentStrength
            const deltaAngle = angle * strength;
            
            // Apply rotation
            const q = new Quaternion().setFromAxisAngle(alignmentAxis, deltaAngle);
            car.quaternion.premultiply(q);
            
            // IMPROVED: Preserve forward direction after alignment
            if (car.userData._carTrueForward) {
                // Get current forward after alignment
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Get desired forward (projected onto surface plane)
                const desiredForward = car.userData._carTrueForward.clone();
                
                // Calculate rotation to align forward directions on surface plane
                const forwardDot = currentForward.dot(desiredForward);
                
                if (forwardDot < 0.99) {
                    // Calculate rotation axis (should be close to surface normal)
                    const rotAxis = new Vector3().crossVectors(currentForward, desiredForward).normalize();
                    
                    if (rotAxis.lengthSq() > 0.001) {
                        // Calculate rotation angle
                        const rotAngle = Math.acos(Math.max(-1, Math.min(1, forwardDot)));
                        
                        // Apply small adjustment to forward direction
                        const forwardFix = new Quaternion().setFromAxisAngle(rotAxis, rotAngle * 0.5);
                        car.quaternion.premultiply(forwardFix);
                    }
                }
            }
            
            // Update world matrix
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // Store the surface normal
            car.userData.surfaceNormal = surfaceNormal.clone();
            
            // Track alignment
            this.lastUpVector = surfaceNormal.clone();
            
        } catch (err) {
            console.error("Error aligning car to surface:", err);
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
            
            // CRITICAL FIX: Calculate forward vector correctly based on car's visual orientation
            // The car's natural forward is -Z in its local space (standard for Three.js models)
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // CRITICAL FIX: Calculate right vector perpendicular to surface normal and forward
            // This ensures turns happen in the plane tangent to the planet surface
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward vector perpendicular to surface normal and right vector
            // This ensures forward direction always follows the planet's curvature
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // IMPROVED: Store these vectors for later use
            car.userData._carForward = carForward.clone();
            car.userData._carRight = rightVector.clone();
            car.userData._carTrueForward = trueForward.clone();
            
            // Get steering input
            const steeringInput = this.input.movement.x;
            
            // Store current speed for turn radius calculation
            const currentSpeed = Math.abs(car.userData.speed || 0);
            
            // Apply steering to wheels with smoothed input
            if (Math.abs(steeringInput) > 0.1) {
                // Calculate target steering angle for wheels
                const targetSteeringAngle = steeringInput * this.maxSteeringAngle;
                
                // Apply steering smoothing for more natural wheel movement
                this.steeringAngle = this.steeringAngle * this.steeringSmoothFactor + 
                                     targetSteeringAngle * (1 - this.steeringSmoothFactor);
                
                // IMPROVED: Calculate turn rate based on speed and turn radius
                // Slower speed = tighter turning radius
                const turnFactor = Math.min(1.0, currentSpeed / 4);
                const effectiveTurnRate = this.maxSteeringRate * steeringInput * turnFactor;
                
                // Only apply body rotation when car has some forward speed
                if (currentSpeed > 0.5) {
                    // FIXED: Apply gradual body rotation based on speed and steering angle
                    // Create rotation quaternion for gradual steering
                    // Use the correct direction based on whether we're moving forward or backward
                    const directionFactor = car.userData.speed > 0 ? 1 : -1;
                    const turnAngle = effectiveTurnRate * directionFactor;
                    
                    // CRITICAL FIX: Rotate around surface normal to stay on planet surface
                    const steerQuat = new Quaternion().setFromAxisAngle(surfaceNormal, turnAngle);
                    car.quaternion.premultiply(steerQuat);
                    
                    // Track current body yaw for reference
                    this.currentBodyYaw += turnAngle;
                    
                    // CRITICAL FIX: After turning, ensure car is still aligned to surface
                    this.alignCarToSurface(car, surfaceNormal);
                }
            } else {
                // Smoothly return steering to center when no input
                this.steeringAngle *= 0.9;
                
                // Zero out very small steering angles
                if (Math.abs(this.steeringAngle) < 0.01) {
                    this.steeringAngle = 0;
                }
            }
            
            // Store steering angle for wheel visualization
            car.userData.steeringAngle = this.steeringAngle;
            
            // Get acceleration/braking input
            const accelerationInput = this.input.movement.z;
            
            // Apply acceleration/braking with improved physics
            if (Math.abs(accelerationInput) > 0.1) {
                // CRITICAL FIX: Acceleration force should use TRUE forward vector
                // Make sure acceleration happens along the planet surface with proper direction
                const accelerationForce = 0.03; 
                
                // FIXED: Apply acceleration in the true forward direction aligned with car's facing
                // Use the dot product to determine how aligned the car's visual forward is with
                // the calculated surface-aligned forward direction
                const forwardAlignment = Math.max(0.3, trueForward.dot(carForward));
                
                // Always accelerate along the surface using the true forward vector
                const accelerationVector = trueForward.clone().multiplyScalar(
                    accelerationInput * accelerationForce * forwardAlignment
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
            
            // FIXED: Apply velocity to position to make the car move along the surface
            if (car.userData.velocity && car.userData.velocity.lengthSq() > 0.0001) {
                // Get current velocity
                const velocity = car.userData.velocity.clone();
                
                // Project velocity onto the planet surface tangent plane
                const surfaceVelocity = velocity.projectOnPlane(surfaceNormal);
                
                // Apply the projected velocity to car position
                car.position.add(surfaceVelocity);
                
                // IMPROVED: Apply more direct height correction to prevent floating
                const planetCenter = planet.object.position;
                const heightOffset = car.userData.fixedHeightOffset || 2.2;
                const groundLevel = planet.radius + heightOffset;
                
                // Calculate direction from planet center to car
                const toCarDir = car.position.clone().sub(planetCenter).normalize();
                
                // FIXED: More direct height correction to prevent floating
                const correctPosition = planetCenter.clone().addScaledVector(toCarDir, groundLevel);
                
                // Use stronger correction factor to keep car firmly on ground
                car.position.copy(correctPosition);
                
                // Update matrices after position change
                car.updateMatrix();
                car.updateMatrixWorld(true);
            }
            
            // CRITICAL FIX: Enforce proper alignment to surface after all movement
            this.forceAlignCarToSurface(car, surfaceNormal);
            
            // IMPROVED: Update wheel orientation to match steering input
            if (car.userData.wheels) {
                this.updateWheelOrientation(car, this.steeringAngle);
            }
            
            // Mark that car controller is managing this vehicle
            car.userData._controlledByCarController = true;
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
        } catch (err) {
            console.error("Error handling car movement:", err);
        }
    }

    // FIXED: Modified to properly align car to surface without unwanted rotation
    static forceAlignCarToSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // CRITICAL FIX: Save the car's forward direction BEFORE alignment
            const originalForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Define local Y axis (up)
            const localUp = new Vector3(0, 1, 0);
            
            // Calculate rotation to align local up with surface normal
            const rotationAxis = new Vector3().crossVectors(localUp, surfaceNormal).normalize();
            
            // Handle case where vectors are parallel
            if (rotationAxis.lengthSq() < 0.001) {
                if (localUp.dot(surfaceNormal) < 0) {
                    // Find any perpendicular axis for rotation
                    const perpAxis = new Vector3(1, 0, 0);
                    if (Math.abs(surfaceNormal.dot(perpAxis)) > 0.9) {
                        perpAxis.set(0, 0, 1);
                    }
                    rotationAxis.copy(perpAxis).cross(surfaceNormal).normalize();
                    const q = new Quaternion().setFromAxisAngle(rotationAxis, Math.PI);
                    car.quaternion.copy(q);
                }
                return;
            }
            
            // Calculate rotation angle
            const angle = Math.acos(Math.max(-1, Math.min(1, localUp.dot(surfaceNormal))));
            
            // Create initial alignment quaternion
            const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
            
            // Apply basic alignment to get car upright on surface
            car.quaternion.copy(alignQuat);
            
            // CRITICAL FIX: Now preserve the original forward direction
            // Project original forward onto the tangent plane of the surface
            const projectedForward = originalForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            if (projectedForward.lengthSq() > 0.001) {
                // Find the current forward direction after basic alignment
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Calculate rotation needed to align current forward with projected original forward
                const forwardRotAxis = new Vector3().crossVectors(currentForward, projectedForward).normalize();
                
                if (forwardRotAxis.lengthSq() > 0.001) {
                    const forwardAngle = Math.acos(Math.max(-1, Math.min(1, currentForward.dot(projectedForward))));
                    const forwardQuat = new Quaternion().setFromAxisAngle(forwardRotAxis, forwardAngle);
                    
                    // Apply forward direction preservation
                    car.quaternion.premultiply(forwardQuat);
                }
            }
            
            // Store car's reference axes for future use
            if (car.userData) {
                const updatedForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const updatedRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
                const updatedUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
                
                car.userData._carUp = updatedUp.clone();
                car.userData._carRight = updatedRight.clone();
                car.userData._carForward = updatedForward.clone();
                car.userData.surfaceNormal = surfaceNormal.clone();
            }
            
            // Update matrices after orientation change
            car.updateMatrix();
            car.updateMatrixWorld(true);
        } catch (err) {
            console.error("Error in force align car to surface:", err);
        }
    }
    
    // FIXED: Add proper wheel orientation when using reset function
    static reset() {
        console.log('CarController reset');
        
        // Initialize input
        this.input = {
            movement: new Vector3(),
            rotation: new Vector3(),
            action: false,
            exit: false
        };
        
        // Reset steering state
        this.steeringAngle = 0;
        this.currentBodyYaw = 0;
        
        // Get current vehicle
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.warn('No vehicle available for car controller');
            return;
        }
        
        // CRITICAL FIX: Ensure car is properly aligned to surface on entry
        if (car.userData && car.userData.planet) {
            // Get planet and surface normal
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            console.log("Aligning car to surface on controller reset");
            
            // Force immediate alignment to surface
            this.snapToSurface(car, planet);
            
            // Explicitly align car to surface with strong factor
            this.forceAlignCarToSurface(car, toSurface);
            
            // FIXED: Make sure wheels are oriented correctly with zero steering
            if (car.userData.wheels) {
                this.updateWheelOrientation(car, 0);
            }
            
            // Mark car as grounded
            car.userData.falling = false;
            car.userData.onSurface = true;
        }
        
        // Reset camera position
        this.updateFixedCameraPosition(car);
        
        // Mark as controlled by car controller
        if (car.userData) {
            car.userData._controlledByCarController = true;
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
        }
        
        console.log("Car controller reset complete");
    }
    
    // IMPROVED: Update wheel orientation to match steering input
    static updateWheelOrientation(car, steeringAngle) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            Object.entries(car.userData.wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // Get current roll rotation (x-axis)
                const currentRoll = wheel.rotation.x;
                
                if (wheelName.includes('front')) {
                    // Apply steering to front wheels
                    wheel.rotation.set(
                        currentRoll,       // Keep current roll rotation
                        steeringAngle,     // Apply steering angle to y-axis
                        Math.PI/2          // Keep wheels perpendicular (z-axis)
                    );
                } else {
                    // Keep rear wheels straight
                    wheel.rotation.set(
                        currentRoll,       // Keep current roll rotation
                        0,                 // No steering for rear wheels
                        Math.PI/2          // Keep wheels perpendicular
                    );
                }
            });
        } catch (err) {
            console.error("Error updating wheel orientation:", err);
        }
    }
}
