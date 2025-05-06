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
    static maxSteeringAngle = 0.6; // INCREASED from 0.4 to 0.6 for wider turning
    static steeringSmoothFactor = 0.75; // DECREASED from 0.85 to 0.75 for more responsive steering
    
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
    static maxSteeringRate = 0.03; // INCREASED from 0.02 to 0.03 for faster turning
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
            
            // Make sure wheels are oriented correctly with zero steering
            if (car.userData.wheels) {
                this.updateWheelOrientation(car, 0);
            }
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
            
            // IMPROVED: Check if car is already close to the correct height before snapping
            const heightOffset = 2.2;
            const groundLevel = planet.radius + heightOffset;
            const currentDistance = car.position.distanceTo(planetCenter);
            const heightDeviation = Math.abs(currentDistance - groundLevel);
            
            // Only apply hard snap if significantly off correct height
            if (heightDeviation > 1.0) {
                // Store the corrected height for other systems
                car.userData.fixedHeightOffset = heightOffset;
                
                // Calculate exact position on surface with correct height offset
                const exactPosition = planetCenter.clone().addScaledVector(
                    toSurface, 
                    groundLevel
                );
                
                // Set car position directly without any interpolation
                car.position.copy(exactPosition);
                
                console.log(`Car snapped to surface at height offset ${heightOffset} (deviation: ${heightDeviation.toFixed(2)})`);
            } else {
                // For smaller corrections, use gentler adjustment
                const exactPosition = planetCenter.clone().addScaledVector(
                    toSurface, 
                    groundLevel
                );
                
                // Apply gentle lerping instead of hard snap
                car.position.lerp(exactPosition, 0.3);
                
                console.log(`Car gently adjusted to surface (deviation: ${heightDeviation.toFixed(2)})`);
            }
            
            // Mark car as firmly on ground
            car.userData.falling = false;
            car.userData.onSurface = true;
            
            // Apply alignment to surface
            this.alignCarToSurface(car, toSurface);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
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
            
            // IMPROVED: Gentler alignment behavior to reduce perception of snapping
            // Use significantly stronger alignment strength
            // Increased from 0.5 to 0.8 for much better surface adherence during turns
            let strength;
            if (upDot > 0.9) {
                // Very small deviation - use gentler correction
                strength = 0.2; // Reduced from 0.8
            } else if (upDot > 0.7) {
                // Medium deviation
                strength = 0.5;
            } else {
                // Large deviation - use stronger correction
                strength = 0.8;
            }
            
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
                        
                        // ENHANCED: Apply stronger forward direction correction
                        // Increased from 0.5 to 0.75 for better direction preservation
                        const forwardFix = new Quaternion().setFromAxisAngle(rotAxis, rotAngle * 0.75);
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
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            // IMPROVED: Store surface normal using actual planet data
            // rather than relying on a potentially outdated stored normal
            const surfaceNormal = toSurface.clone();
            car.userData.surfaceNormal = surfaceNormal.clone();
            
            // Calculate forward vector correctly based on car's visual orientation
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to surface normal and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward vector perpendicular to surface normal and right vector
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Store these vectors for later use
            car.userData._carForward = carForward.clone();
            car.userData._carRight = rightVector.clone();
            car.userData._carTrueForward = trueForward.clone();
            
            // Get steering input
            const steeringInput = this.input.movement.x;
            
            // Store current speed for turn radius calculation
            const currentSpeed = Math.abs(car.userData.speed || 0);
            
            // FIXED: Apply steering to wheels with smoothed input
            if (Math.abs(steeringInput) > 0.05) { // DECREASED threshold from 0.1 to 0.05 for more responsive steering
                // Calculate target steering angle for wheels
                const targetSteeringAngle = steeringInput * this.maxSteeringAngle;
                
                // Apply steering smoothing for more natural wheel movement
                this.steeringAngle = this.steeringAngle * this.steeringSmoothFactor + 
                                   targetSteeringAngle * (1 - this.steeringSmoothFactor);
                
                // IMPROVED: Calculate turn rate based on speed - with better turning at low speeds
                // Slower speed = tighter turning radius
                const turnFactor = Math.min(1.0, currentSpeed / 3.0); // DECREASED from 3.5 to 3.0 for better turning
                
                // ENHANCED: More responsive steering at higher speeds
                const speedAdjustedRate = this.maxSteeringRate * (1.0 + (currentSpeed * 0.05));
                
                // FIXED: Invert steering direction by adding negative sign to make controls intuitive
                const effectiveTurnRate = -speedAdjustedRate * steeringInput * turnFactor;
                
                // IMPROVED: Allow turning at lower speeds
                if (currentSpeed > 0.1) { // DECREASED from 0.5 to 0.1 to allow turning at lower speeds
                    // Apply turning around surface normal
                    const directionFactor = car.userData.speed > 0 ? 1 : -1;
                    const turnAngle = effectiveTurnRate * directionFactor;
                    
                    // Rotate around the planet's surface normal vector
                    const steerQuat = new Quaternion().setFromAxisAngle(surfaceNormal, turnAngle);
                    car.quaternion.premultiply(steerQuat);
                    
                    // Track current body yaw for reference
                    this.currentBodyYaw += turnAngle;
                    
                    // Align car to surface after turning
                    this.alignCarToSurface(car, surfaceNormal);
                }
            } else {
                // Smoothly return steering to center when no input - faster return to center
                this.steeringAngle *= 0.8; // CHANGED from 0.9 to 0.8 for faster return to center
                
                // Zero out very small steering angles
                if (Math.abs(this.steeringAngle) < 0.01) {
                    this.steeringAngle = 0;
                }
            }
            
            // Store steering angle for wheel visualization
            car.userData.steeringAngle = this.steeringAngle;
            
            // Get acceleration/braking input
            const accelerationInput = -this.input.movement.z; // INVERTED to fix car movement direction - negative Z is forward in input space
            
            // Apply acceleration/braking with improved physics
            if (Math.abs(accelerationInput) > 0.1) {
                // CRITICAL DIFFERENCE FROM PREVIOUS VERSION: Use trueForward for acceleration
                // This ensures car always moves along the surface, not in its visual direction
                const accelerationForce = 0.03;
                
                // CRITICAL FROM PREVIOUS VERSION: Get forward alignment factor to adjust speed
                // Makes acceleration feel more natural when car isn't perfectly aligned
                const forwardAlignment = Math.max(0.3, trueForward.dot(carForward));
                
                // KEY FROM PREVIOUS VERSION: Add acceleration using trueForward, not visual forward
                // This is what keeps the car on the curved surface
                const accelerationVector = trueForward.clone().multiplyScalar(
                    accelerationInput * accelerationForce * forwardAlignment
                );
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
            
            // IMPROVED: Apply velocity to position with gentler height correction
            if (car.userData.velocity && car.userData.velocity.lengthSq() > 0.0001) {
                // Get current velocity
                const velocity = car.userData.velocity.clone();
                
                // Project velocity onto the planet surface tangent plane
                const surfaceVelocity = velocity.projectOnPlane(surfaceNormal);
                
                // Apply the projected velocity to car position
                car.position.add(surfaceVelocity);
                
                // IMPROVED: Only apply direct height correction when significantly off-surface
                // to avoid constant small adjustments that cause jitter
                const heightOffset = car.userData.fixedHeightOffset || 2.2;
                const groundLevel = planet.radius + heightOffset;
                
                // Calculate current height deviation
                const distance = car.position.distanceTo(planetCenter);
                const heightDeviation = Math.abs(distance - groundLevel);
                
                // Only apply direct height correction if significantly off surface
                if (heightDeviation > 0.3) { // Increased threshold to reduce frequent corrections
                    const toCarDir = car.position.clone().sub(planetCenter).normalize();
                    
                    // Calculate correction position
                    const correctPosition = planetCenter.clone().addScaledVector(toCarDir, groundLevel);
                    
                    // IMPROVED: Use speed-sensitive correction that's gentler at low speeds
                    // This reduces the feeling of "snapping" during slow movement
                    const speedFactor = Math.min(1.0, (Math.abs(car.userData.speed) / 5.0));
                    const heightCorrectionStrength = 0.4 + (speedFactor * 0.4); // 0.4-0.8 range (reduced)
                    
                    car.position.lerp(correctPosition, heightCorrectionStrength);
                }
                
                // Force immediate matrix update for collision detection
                car.updateMatrix();
                car.updateMatrixWorld(true);
            }
            
            // Apply surface alignment after all position changes
            this.alignCarToSurface(car, surfaceNormal);
            
            // Update wheel orientation to match steering input
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

    // FIXED: Better reset implementation to ensure proper orientation
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
            
            // Make sure wheels are oriented correctly with zero steering
            if (car.userData.wheels) {
                this.updateWheelOrientation(car, 0);
            }
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
                    // FIXED: Apply inverted steering to front wheels to match car body turning
                    wheel.rotation.set(
                        currentRoll,       // Keep current roll rotation
                        -steeringAngle,    // INVERTED sign to match body rotation direction
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
