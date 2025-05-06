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
    
    // SIMPLIFIED: Camera configuration
    static fixedCameraOffset = {
        distance: 15,
        height: 5,
        lookAhead: 3
    };
    
    // Steering state
    static steeringAngle = 0;
    static maxSteeringAngle = 0.4;
    
    // SIMPLIFIED: Vehicle state tracking with only essential properties
    static vehicleState = {
        lastGroundHeight: 0,
        previousPosition: null,
        lastSurfaceNormal: null,
    };
    
    // Add stabilization parameters to handle entry "freak out" issues
    static stabilization = {
        entryTimestamp: 0,
        stabilizationPeriod: 1000, // 1 second stability period on entry
        inputRampupTime: 800, // Gradually accept inputs over this period
        isStabilizing: false,
        initialHeight: 0,
        initialPosition: null,
        initialSurfaceNormal: null
    };
    
    // SIMPLIFIED: Reset controller state when entering car
    static reset() {
        console.log('Initializing Car Controller with planet-aligned movement');
        
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        try {
            this.steeringAngle = 0;
            
            // Simplified reset of vehicle state
            this.vehicleState = {
                lastGroundHeight: 0,
                previousPosition: car.position.clone(),
                lastSurfaceNormal: car.userData.surfaceNormal ? car.userData.surfaceNormal.clone() : new Vector3(0, 1, 0),
            };
            
            // Reset input
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // CRITICAL FIX: Reset velocity and forces completely to prevent launch bug
            if (car.userData.velocity) car.userData.velocity.set(0, 0, 0);
            car.userData.speed = 0;
            car.userData._lastForce = null;
            
            // Setup stabilization to prevent entry freakout
            this.stabilization.entryTimestamp = Date.now();
            this.stabilization.isStabilizing = true;
            this.stabilization.initialPosition = car.position.clone();
            this.stabilization.initialSurfaceNormal = car.userData.surfaceNormal ? 
                car.userData.surfaceNormal.clone() : 
                new Vector3().subVectors(car.position, car.userData.planet.object.position).normalize();
            
            // Calculate and store initial height for reference
            if (car.userData.planet) {
                const planet = car.userData.planet;
                const distanceFromCenter = car.position.distanceTo(planet.object.position);
                this.stabilization.initialHeight = distanceFromCenter - planet.radius;
            }
            
            // Mark car as actively controlled by this controller
            car.userData.isActivelyControlled = true;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            car.userData._controlledByCarController = true;
            car.userData._controllerStartTime = Date.now();
            car.userData._controlType = 'CarController';
            
            // CRITICAL: Override car physics properties to match player-like movement
            car.userData.falling = false;
            car.userData.maxSpeed = 12;
            car.userData.drag = 0.1;
            car.userData.gravityFactor = 0.85; // Same as player
            car.userData.fixedHeightOffset = 2.8; // Keeps car at correct height
            car.userData.surfaceMode = true; // Flag for surface movement
            
            // FIXED: Freeze car initially to prevent bounce bug
            car.userData._frozen = true;
            car.userData._frozenUntil = Date.now() + 800; // Freeze for 800ms
            
            // Ensure collision is disabled between player and vehicle
            if (PlayersManager && PlayersManager.self && PlayersManager.self.handle) {
                // Set bidirectional collision exclusion
                car._ignoreCollisionWith = PlayersManager.self.handle;
                PlayersManager.self.handle._ignoreCollisionWith = car;
                
                // Store player reference in car for collision system to check
                car.userData.currentDriver = PlayersManager.self;
                car.userData.isOccupied = true;
                car.userData.occupiedBy = PlayersManager.self.handle;
                
                // Disable player collisions
                if (PlayersManager.self.collidable) {
                    PlayersManager.self.collidable.active = false;
                }
                
                // Store vehicle reference on player
                PlayersManager.self.currentVehicle = car;
                PlayersManager.self.inVehicle = true;
                
                // Hide player mesh
                PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            }
            
            // SIMPLIFIED: Setup camera directly
            if (Engine.camera) {
                // Make sure camera is attached to scene
                if (Engine.camera.parent !== Engine.scene) {
                    const worldPos = new Vector3();
                    Engine.camera.getWorldPosition(worldPos);
                    
                    if (Engine.camera.parent) {
                        Engine.camera.parent.remove(Engine.camera);
                    }
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                }
                
                // Update camera position immediately
                this.updateFixedCameraPosition();
            }
            
            console.log('Car Controller initialized with planet-aligned movement and stabilization');
        } catch (e) {
            console.error('Error in CarController reset:', e);
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
            // CRITICAL FIX: Check if car is still in frozen state
            const now = Date.now();
            if (car.userData._frozen && car.userData._frozenUntil) {
                if (now < car.userData._frozenUntil) {
                    // Only update camera during frozen state, skip movement
                    this.updateFixedCameraPosition();
                    return null;
                } else {
                    // Unfreeze the car
                    car.userData._frozen = false;
                    console.log("Car unfrozen, resuming normal movement");
                }
            }
            
            // IMPROVED: Check stabilization state for gradual input handling
            const isStabilizing = this.stabilization.isStabilizing && 
                (now - this.stabilization.entryTimestamp < this.stabilization.stabilizationPeriod);
                
            if (isStabilizing) {
                // Calculate stabilization progress (0-1)
                const progress = (now - this.stabilization.entryTimestamp) / this.stabilization.stabilizationPeriod;
                
                // Scale input based on progress - limit inputs during stabilization
                if (progress < 0.5) {
                    // First half of stabilization - minimal input
                    const scaleFactor = progress * 0.5; // Max 25% input
                    this.input.movement.multiplyScalar(scaleFactor);
                    this.input.rotation.multiplyScalar(scaleFactor);
                } else {
                    // Second half - gradually increase to full input
                    const scaleFactor = 0.25 + (progress - 0.5) * 1.5; // 25% to 100%
                    this.input.movement.multiplyScalar(scaleFactor);
                    this.input.rotation.multiplyScalar(scaleFactor);
                }
                
                // Maintain height aggressively during stabilization
                if (car.userData.planet) {
                    this.maintainCarHeightStrict(car, car.userData.planet);
                }
                
                // End stabilization when time is up
                if (progress >= 1.0) {
                    this.stabilization.isStabilizing = false;
                    console.log("Car stabilization complete");
                }
            }
            
            // Process car movement with surface alignment
            this.handleCarMovementOnPlanet(car);
            
            // Update camera position
            this.updateFixedCameraPosition();
            
            // Reset rotation input
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // NEW: Stricter height maintenance during stabilization
    static maintainCarHeightStrict(car, planet) {
        if (!car || !planet) return;
        
        try {
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const heightOffset = car.userData.fixedHeightOffset || 2.8;
            const targetDistance = planet.radius + heightOffset;
            
            // More aggressive correction during stabilization
            if (Math.abs(currentDistance - targetDistance) > 0.05) {
                // Calculate new position at correct height
                const newPosition = planetCenter.clone().add(
                    toVehicle.normalize().multiplyScalar(targetDistance)
                );
                
                // Apply with strong correction
                car.position.lerp(newPosition, 0.5);
                
                // Also zero out any velocity to prevent bouncing
                if (car.userData.velocity) {
                    car.userData.velocity.multiplyScalar(0.5);
                }
            }
        } catch (e) {
            console.error("Error in maintainCarHeightStrict:", e);
        }
    }

    // NEW: Completely overhauled car movement model based on player movement
    static handleCarMovementOnPlanet(car) {
        if (!car || !car.userData || !car.userData.planet) return;
        
        try {
            // Get essential planet data
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            
            // 1. Calculate surface normal at car's position
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            car.userData.surfaceNormal = toSurface.clone();
            
            // 2. Process steering input
            const steeringInput = this.input.rotation.x;
            const targetSteeringAngle = steeringInput * this.maxSteeringAngle;
            
            // IMPROVED: More gradual steering to prevent jerky behavior
            const steeringLerpFactor = this.stabilization.isStabilizing ? 0.05 : 0.15;
            this.steeringAngle = this.steeringAngle * (1-steeringLerpFactor) + targetSteeringAngle * steeringLerpFactor;
            car.userData.steeringAngle = this.steeringAngle;
            
            // 3. Process acceleration/braking
            const accelerationInput = -this.input.movement.z; // Forward is negative Z
            const currentSpeed = car.userData.speed || 0;
            let newSpeed = currentSpeed;
            
            if (accelerationInput !== 0) {
                // IMPROVED: Smoother acceleration curve
                // Slower initial acceleration, faster middle, stable top end
                const accelBase = accelerationInput > 0 ? 0.08 : 0.05;
                const speedFactor = Math.abs(currentSpeed) < 2 ? 0.7 : 
                                   (Math.abs(currentSpeed) < 6 ? 1.2 : 0.9);
                                   
                const accelRate = accelBase * speedFactor;
                newSpeed += accelerationInput * accelRate;
            } else {
                // Apply drag when no input - more gradually
                newSpeed *= 0.98;
            }
            
            // Apply additional drag at higher speeds
            const dragFactor = car.userData.drag || 0.08;
            newSpeed *= (1 - dragFactor * Math.abs(newSpeed) * 0.01);
            
            // Limit max speed
            const maxSpeed = car.userData.maxSpeed || 12;
            newSpeed = Math.max(-maxSpeed * 0.5, Math.min(maxSpeed, newSpeed));
            
            // Stop completely if speed is very low
            if (Math.abs(newSpeed) < 0.01) newSpeed = 0;
            
            // Store speed in car
            car.userData.speed = newSpeed;
            
            // 4. Calculate car's local orientation vectors aligned to planet surface
            const forward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const right = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            
            // Project vectors onto planet surface tangent plane
            const surfaceForward = forward.clone().projectOnPlane(toSurface).normalize();
            const surfaceRight = right.clone().projectOnPlane(toSurface).normalize();
            
            // 5. Apply turning based on speed and steering angle
            if (Math.abs(newSpeed) > 0.1 && Math.abs(this.steeringAngle) > 0.01) {
                // IMPROVED: More stable turning behavior
                // Calculate turn rate based on speed with more intuitive curve
                // Slower speed = more nimble turning, higher speed = more stable
                const baseTurnFactor = 0.008;
                const speedAdjust = Math.min(1.0, Math.abs(newSpeed) / 7);
                const turnFactor = baseTurnFactor * (1.0 - (speedAdjust * 0.5));
                
                const turnAmount = this.steeringAngle * turnFactor * (newSpeed > 0 ? 1 : -1);
                
                // Create rotation quaternion around surface normal
                const turnQuat = new Quaternion().setFromAxisAngle(toSurface, -turnAmount);
                car.quaternion.premultiply(turnQuat);
            }
            
            // 6. Move the car along the surface using projected forward vector
            if (Math.abs(newSpeed) > 0.01) {
                // Get newly calculated forward direction after turning
                const newForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const newSurfaceForward = newForward.clone().projectOnPlane(toSurface).normalize();
                
                // Move car along surface
                const moveVector = newSurfaceForward.multiplyScalar(newSpeed * 0.05);
                car.position.add(moveVector);
                
                // Store velocity for physics reference
                if (!car.userData.velocity) car.userData.velocity = new Vector3();
                car.userData.velocity.copy(moveVector);
            }
            
            // 7. Align car to planet surface
            // IMPROVED: More stable alignment during stabilization period
            const alignmentLerpFactor = this.stabilization.isStabilizing ? 0.25 : 0.15;
            this.alignCarToPlanetSurface(car, toSurface, alignmentLerpFactor);
            
            // 8. Maintain correct height above surface
            // More aggressive height maintenance during stabilization
            if (this.stabilization.isStabilizing) {
                this.maintainCarHeightStrict(car, planet);
            } else {
                this.maintainCarHeight(car, planet);
            }
            
            // 9. Update wheel visuals
            this.updateWheelVisuals(car);
            
            // Ensure matrices are updated
            car.updateMatrix();
            car.updateMatrixWorld(true);
        } catch (err) {
            console.error("Error in handleCarMovementOnPlanet:", err);
        }
    }
    
    // ENHANCED: Planet surface alignment with custom lerp factor
    static alignCarToPlanetSurface(car, surfaceNormal, forcedLerpFactor = null) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Create alignment quaternion
            const defaultUp = new Vector3(0, 1, 0);
            const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal).normalize();
            
            if (rotationAxis.lengthSq() > 0.001) {
                // Calculate angle between default up and surface normal
                const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                const alignmentQuaternion = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                
                // Get car's current forward vector
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Project forward vector onto surface plane
                const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                // If projection is valid
                if (projectedForward.lengthSq() > 0.001) {
                    // Find right vector perpendicular to up and forward
                    const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
                    
                    // Recalculate forward to ensure orthogonality
                    const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
                    
                    // Create matrix from orthogonal vectors
                    const matrix = new Matrix4().makeBasis(rightVector, surfaceNormal, correctedForward);
                    
                    // Extract quaternion from matrix
                    const directionPreservingQuaternion = new Quaternion().setFromRotationMatrix(matrix);
                    
                    // Determine appropriate lerp factor
                    let lerpFactor = forcedLerpFactor !== null ? forcedLerpFactor : 0.15;
                    
                    // Apply slerp with determined factor
                    car.quaternion.slerp(directionPreservingQuaternion, lerpFactor);
                }
            }
        } catch (e) {
            console.error("Error in alignCarToPlanetSurface:", e);
        }
    }
    
    // FIXED: Update camera position with no transition
    static updateFixedCameraPosition() {
        const car = VehicleManager.currentVehicle;
        const camera = Engine.camera;
        
        if (!car || !camera) return;
        
        try {
            // Get surface normal for orientation
            const surfaceNormal = car.userData.surfaceNormal || 
                new Vector3().subVectors(car.position, car.userData.planet.object.position).normalize();
            
            // Calculate car's backward vector
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carBackward = carForward.clone().negate();
            
            // Calculate car's up vector
            const carUp = surfaceNormal.clone();
            
            // Calculate camera position behind and above car
            const cameraPosition = car.position.clone()
                .add(carBackward.clone().multiplyScalar(this.fixedCameraOffset.distance))
                .add(carUp.clone().multiplyScalar(this.fixedCameraOffset.height));
            
            // Calculate target position (slightly ahead of car)
            const targetPosition = car.position.clone()
                .add(carForward.clone().multiplyScalar(this.fixedCameraOffset.lookAhead))
                .add(carUp.clone().multiplyScalar(2));
            
            // Smooth camera movement
            if (!this.smoothPos) {
                this.smoothPos = cameraPosition.clone();
                this.smoothUpVector = surfaceNormal.clone();
            } else {
                // Smooth position and up vector
                this.smoothPos.lerp(cameraPosition, 0.1);
                this.smoothUpVector.lerp(surfaceNormal, 0.05);
            }
            
            // Apply smoothed values
            camera.position.copy(this.smoothPos);
            camera.up.copy(this.smoothUpVector);
            
            // Look at target position
            camera.lookAt(targetPosition);
        } catch (err) {
            console.error("Error updating camera position:", err);
        }
    }

    // SIMPLIFIED: Update wheel visuals with focus on rotation and steering
    static updateWheelVisuals(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            const speed = car.userData.speed || 0;
            
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
                if (Math.abs(speed) > 0.01) {
                    // Simplified rolling - same speed for all wheels
                    const rotationAmount = speed * 0.06;
                    wheel.rotation.x += rotationAmount;
                }
            });
        } catch (e) {
            console.error('Error updating wheel visuals:', e);
        }
    }
    
    // SIMPLIFIED: Clean up when exiting car
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Reset car controller state
            this.steeringAngle = 0;
            this.smoothPos = null;
            this.smoothUpVector = null;
            
            // Make sure camera is properly set as scene child
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
            
            // Clear controller flags
            car.userData._heightManagedByController = false;
            car.userData._alignedByCarController = false;
            car.userData._controlledByCarController = false;
            car.userData.isActivelyControlled = false;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            console.log('CarController cleanup complete');
        } catch (e) {
            console.error('Error in CarController cleanup:', e);
        }
    }
}
