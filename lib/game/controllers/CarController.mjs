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
    static steeringSmoothFactor = 0.85; // Higher = smoother steering
    
    // Reset controller and setup car
    static reset() {
        console.log('Initializing Car Controller');
        
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        try {
            // Reset state
            this.steeringAngle = 0;
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Reset velocity and forces
            if (car.userData.velocity) car.userData.velocity.set(0, 0, 0);
            car.userData.speed = 0;
            
            // Set car properties
            car.userData.isActivelyControlled = true;
            car.userData._controlledByCarController = true;
            car.userData.falling = false;
            car.userData.maxSpeed = 12;
            car.userData.drag = 0.1;
            car.userData.fixedHeightOffset = 2.8;
            
            // Brief freeze for stability on entry
            car.userData._frozen = true;
            car.userData._frozenUntil = Date.now() + 300;
            
            // Setup collision exclusion with player
            if (PlayersManager?.self?.handle) {
                car._ignoreCollisionWith = PlayersManager.self.handle;
                PlayersManager.self.handle._ignoreCollisionWith = car;
                car.userData.currentDriver = PlayersManager.self;
                car.userData.isOccupied = true;
                car.userData.occupiedBy = PlayersManager.self.handle;
                
                if (PlayersManager.self.collidable) {
                    PlayersManager.self.collidable.active = false;
                }
                
                PlayersManager.self.currentVehicle = car;
                PlayersManager.self.inVehicle = true;
                PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            }
            
            // FIXED: Completely revamped camera setup for proper alignment
            if (Engine.camera) {
                // First detach camera from any parent
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                }
                
                // Get surface normal directly from car
                const surfaceNormal = car.userData.surfaceNormal || 
                    new Vector3().subVectors(car.position, car.userData.planet.object.position).normalize();
                
                // Store for reference
                this._lastSurfaceNormal = surfaceNormal.clone();
                
                // IMPORTANT: Create a local space camera container at car origin
                const cameraContainer = car;
                
                // Add camera to car directly
                cameraContainer.add(Engine.camera);
                
                // Position camera behind and above car in local space
                Engine.camera.position.set(0, this.fixedCameraOffset.height, this.fixedCameraOffset.distance);
                
                // CRITICAL FIX: Set camera's up vector to match surface normal
                Engine.camera.up.copy(surfaceNormal);
                
                // FIXED: Look at a point that's slightly above the car's rear
                const lookAtPoint = new Vector3(0, 2, 0);
                Engine.camera.lookAt(lookAtPoint);
                
                console.log("Camera positioned to view car from behind");
                
                // Force an immediate update to ensure proper positioning
                this.updateFixedCameraPosition(car);
            }
            
            console.log('Car Controller initialized');
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
        
        // Handle initial freeze period
        if (car.userData._frozen && car.userData._frozenUntil && Date.now() < car.userData._frozenUntil) {
            return null;
        } else if (car.userData._frozen) {
            car.userData._frozen = false;
        }
        
        // Process car movement
        this.handleCarMovementOnPlanet(car);
        
        // Reset rotation input
        this.input.rotation.set(0, 0, 0);
        
        return null;
    }
    
    // Helper to get surface normal
    static getSurfaceNormal(car) {
        if (!car) return new Vector3(0, 1, 0);
        
        if (car.userData?.surfaceNormal) {
            return car.userData.surfaceNormal;
        }
        
        if (car.userData?.planet?.object) {
            const planetCenter = car.userData.planet.object.position;
            return car.position.clone().sub(planetCenter).normalize();
        }
        
        return new Vector3(0, 1, 0);
    }
    
    // IMPROVED: Fixed camera positioning with better surface normal handling
    static updateFixedCameraPosition(car = null) {
        // Get car reference if not provided
        car = car || VehicleManager.currentVehicle;
        
        // Skip if no car or camera, or if camera isn't attached to car
        if (!car || !Engine.camera || Engine.camera.parent !== car) return;
        
        try {
            // Get surface normal - first try car's userData
            const surfaceNormal = car.userData.surfaceNormal || 
                new Vector3().subVectors(car.position, car.userData.planet.object.position).normalize();
            
            // Store for reference
            this._lastSurfaceNormal = surfaceNormal.clone();
            
            // CRITICAL: Set camera's up vector to match surface normal
            Engine.camera.up.copy(surfaceNormal);
            
            // Get car's local axes for reference
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            const carUp = surfaceNormal.clone();
            
            // IMPROVEMENT: Calculate a better lookAt point that accounts for car's orientation
            // Look at a point slightly above the car's rear
            const lookTarget = new Vector3();
            
            // Adjust look target when steering
            if (Math.abs(this.steeringAngle) > 0.05) {
                // Add side offset based on steering
                const steerOffset = this.steeringAngle * 2;
                lookTarget.set(steerOffset, 2, 0);
            } else {
                // Standard center target
                lookTarget.set(0, 2, 0);
            }
            
            // Apply the look target
            Engine.camera.lookAt(lookTarget);
        } catch (err) {
            console.error("Error updating fixed camera position:", err);
        }
    }
    
    // IMPROVED: Car movement with better turning and stability
    static handleCarMovementOnPlanet(car) {
        if (!car || !car.userData || !car.userData.planet) return;
        
        try {
            // Get planet and surface normal
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            const toSurface = car.position.clone().sub(planetCenter).normalize();
            
            // CRITICAL FIX: Store surface normal in car's userData
            car.userData.surfaceNormal = toSurface.clone();
            
            // IMPROVED: Process steering with better smoothing
            const steeringInput = this.input.rotation.x;
            const targetSteeringAngle = steeringInput * this.maxSteeringAngle;
            this.steeringAngle = this.steeringAngle * this.steeringSmoothFactor + 
                                 targetSteeringAngle * (1 - this.steeringSmoothFactor);
            car.userData.steeringAngle = this.steeringAngle;
            
            // Process acceleration with improved response
            const accelerationInput = -this.input.movement.z;
            const currentSpeed = car.userData.speed || 0;
            let newSpeed = currentSpeed;
            
            if (accelerationInput !== 0) {
                // IMPROVED: Variable acceleration rate based on current speed
                const baseAccelRate = accelerationInput > 0 ? 0.08 : 0.05;
                const speedFactor = Math.abs(currentSpeed) < 3 ? 1.2 : 
                                   (Math.abs(currentSpeed) > 8 ? 0.8 : 1.0);
                const accelRate = baseAccelRate * speedFactor;
                
                newSpeed += accelerationInput * accelRate;
            } else {
                // Gradual deceleration when no input
                newSpeed *= 0.98;
            }
            
            // Apply drag and speed limits
            const dragFactor = car.userData.drag || 0.08;
            newSpeed *= (1 - dragFactor * Math.abs(newSpeed) * 0.01);
            const maxSpeed = car.userData.maxSpeed || 12;
            newSpeed = Math.max(-maxSpeed * 0.5, Math.min(maxSpeed, newSpeed));
            if (Math.abs(newSpeed) < 0.01) newSpeed = 0;
            car.userData.speed = newSpeed;
            
            // IMPROVED: Better turning mechanics with speed-based adjustment
            if (Math.abs(newSpeed) > 0.1 && Math.abs(this.steeringAngle) > 0.01) {
                // Calculate turn rate - tighter turning at lower speeds
                const baseTurnFactor = 0.008;
                const speedAdjust = Math.min(1.0, Math.abs(newSpeed) / 7);
                const turnFactor = baseTurnFactor * (1.0 - (speedAdjust * 0.5));
                
                const turnAmount = this.steeringAngle * turnFactor * (newSpeed > 0 ? 1 : -1);
                const turnQuat = new Quaternion().setFromAxisAngle(toSurface, -turnAmount);
                car.quaternion.premultiply(turnQuat);
            }
            
            // Move car with improved movement vector
            if (Math.abs(newSpeed) > 0.01) {
                const forward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const surfaceForward = forward.clone().projectOnPlane(toSurface).normalize();
                
                // IMPROVED: Adjust movement speed based on surface orientation
                const moveVector = surfaceForward.multiplyScalar(newSpeed * 0.05);
                car.position.add(moveVector);
                
                // Update velocity vector for physics and other systems
                if (!car.userData.velocity) car.userData.velocity = new Vector3();
                car.userData.velocity.copy(moveVector);
            }
            
            // IMPROVED: Strong surface alignment for stability
            this.alignCarToPlanetSurface(car, toSurface);
            
            // Maintain height with improved lerp factor
            this.maintainCarHeight(car, planet);
            
            // Update wheel visuals
            this.updateWheelVisuals(car);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // FIXED: Ensure camera's up vector stays aligned with the planet surface
            // This prevents camera roll issues during turns
            if (Engine.camera && Engine.camera.parent === car) {
                Engine.camera.up.copy(toSurface);
                
                // ADDED: Slight camera look adjustment based on steering for more dynamic feel
                if (Math.abs(this.steeringAngle) > 0.05) {
                    // Calculate a look target that shifts slightly in steering direction
                    const steerOffset = this.steeringAngle * 2;
                    const lookTarget = new Vector3(steerOffset, 2, -this.fixedCameraOffset.lookAhead * 0.5);
                    Engine.camera.lookAt(lookTarget);
                } else {
                    // Reset to standard look target when not turning
                    Engine.camera.lookAt(new Vector3(0, 2, -this.fixedCameraOffset.lookAhead * 0.5));
                }
            }
        } catch (err) {
            console.error("Error in handleCarMovementOnPlanet:", err);
        }
    }
    
    // Align car to planet surface
    static alignCarToPlanetSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            const defaultUp = new Vector3(0, 1, 0);
            const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal).normalize();
            
            if (rotationAxis.lengthSq() > 0.001) {
                // Get car's current forward vector
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                if (projectedForward.lengthSq() > 0.001) {
                    // Create orthogonal basis
                    const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
                    const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
                    
                    // Create and apply rotation matrix
                    const matrix = new Matrix4().makeBasis(rightVector, surfaceNormal, correctedForward);
                    const targetQuaternion = new Quaternion().setFromRotationMatrix(matrix);
                    
                    // IMPROVED: Use stronger alignment factor for better stability
                    car.quaternion.slerp(targetQuaternion, 0.2);
                }
            }
        } catch (e) {
            console.error("Error in alignCarToPlanetSurface:", e);
        }
    }
    
    // Keep car at correct height with improved stability
    static maintainCarHeight(car, planet) {
        if (!car || !planet) return;
        
        try {
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const heightOffset = car.userData.fixedHeightOffset || 2.8;
            const targetDistance = planet.radius + heightOffset;
            
            if (Math.abs(currentDistance - targetDistance) > 0.1) {
                const newPosition = planetCenter.clone().add(
                    toVehicle.normalize().multiplyScalar(targetDistance)
                );
                
                // IMPROVED: Use stronger correction factor for better terrain following
                const correctionFactor = 0.4; // Increased from 0.3
                car.position.lerp(newPosition, correctionFactor);
            }
        } catch (e) {
            console.error("Error in maintainCarHeight:", e);
        }
    }
    
    // Update wheel visuals - unchanged as it works well
    static updateWheelVisuals(car) {
        if (!car?.userData?.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            const speed = car.userData.speed || 0;
            
            Object.entries(wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // Keep current roll rotation
                const currentRoll = wheel.rotation.x;
                
                // Apply steering to front wheels only
                if (wheelName.includes('front')) {
                    wheel.rotation.set(currentRoll, steeringAngle, Math.PI/2);
                } else {
                    wheel.rotation.set(currentRoll, 0, Math.PI/2);
                }
                
                // Rotate wheels based on speed
                if (Math.abs(speed) > 0.01) {
                    wheel.rotation.x += speed * 0.06;
                }
            });
        } catch (e) {
            console.error('Error updating wheel visuals:', e);
        }
    }
    
    // Improved cleanup when exiting car
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Reset controller state
            this.steeringAngle = 0;
            
            // IMPROVED: More reliable camera detachment
            if (Engine.camera && Engine.camera.parent === car) {
                // Get world position and orientation
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                
                // Remove from car
                car.remove(Engine.camera);
                
                // Add to scene with preserved position and orientation
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
                Engine.camera.quaternion.copy(worldQuat);
                
                // Ensure camera up vector stays aligned with planet surface
                const surfaceNormal = car.userData?.surfaceNormal || new Vector3(0, 1, 0);
                Engine.camera.up.copy(surfaceNormal);
                
                console.log("Camera successfully detached from car with preserved orientation");
            }
            
            // Reset car flags
            car.userData._controlledByCarController = false;
            car.userData.isActivelyControlled = false;
        } catch (e) {
            console.error('Error in CarController cleanup:', e);
        }
    }
}
