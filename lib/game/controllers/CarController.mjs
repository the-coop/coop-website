// Controller specifically for car vehicle operation - SIMPLIFIED VERSION
import { Vector3, Quaternion } from 'three';
import VehicleManager from '../vehicles.mjs';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import Physics from '../physics.mjs';

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
    
    // CRITICAL FIX: Initialize cameraState properly as an object
    static cameraState = {
        isSetup: false,
        lastSetupTime: 0,
        setupCount: 0,
        updateInterval: 16,
        lastUpdateTime: 0,
        smoothPosition: null,
        smoothUpVector: null,
    };
    
    // Steering state
    static steeringAngle = 0;
    static maxSteeringAngle = 0.4; // About 23 degrees
    
    // IMPROVED: Unified reset method that directly positions camera
    static reset() {
        console.log('Initializing Car Controller with improved camera control');
        
        // CRITICAL FIX: Get the car from VehicleManager.currentVehicle
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        // Verify we have a car vehicle type
        if (car.userData?.type !== 'car') {
            console.warn(`Vehicle is not a car, it's a ${car.userData?.type}`);
        }
        
        try {
            // Reset camera rotation state to default
            this.cameraRotation = {
                yaw: Math.PI,  // Behind car
                pitch: 0.2     // Slight downward tilt
            };
            
            // Reset camera state
            this.cameraState = {
                isSetup: false,
                lastSetupTime: 0,
                setupCount: 0,
                updateInterval: 16,
                lastUpdateTime: 0,
                smoothPosition: null,
                smoothUpVector: null
            };
            
            // Reset steering state
            this.steeringAngle = 0;
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Mark car as actively controlled
            car.userData.isActivelyControlled = true;
            car.userData.falling = false; // Ensure car is grounded
            
            // Reset steering state in car userData
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            // Set up camera immediately at correct position
            this.setupCamera();
            
            console.log('Car Controller initialized successfully');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // IMPROVED: Camera setup that immediately positions the camera
    static setupCamera() {
        const car = VehicleManager.currentVehicle;
        if (!car || !Engine.camera) {
            console.error('Missing car or camera for setupCamera');
            return false;
        }
        
        try {
            // Get surface normal from the car or calculate from planet
            let surfaceNormal;
            if (car.userData?.surfaceNormal) {
                surfaceNormal = car.userData.surfaceNormal;
            } else if (car.userData?.planet) {
                const planet = car.userData.planet;
                surfaceNormal = car.position.clone().sub(planet.object.position).normalize();
                car.userData.surfaceNormal = surfaceNormal.clone(); // Store for future use
            } else {
                surfaceNormal = new Vector3(0, 1, 0);
            }
            
            // Detach camera from any parent
            if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Use surface normal for camera UP vector
            Engine.camera.up.copy(surfaceNormal);
            
            // Calculate camera position behind car
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const backwardDir = forwardDir.clone().negate();
            
            // Place camera directly at desired position
            const cameraPos = car.position.clone();
            cameraPos.addScaledVector(backwardDir, this.cameraDistance); // Behind car
            cameraPos.addScaledVector(surfaceNormal, this.cameraHeight); // Above car
            
            // Set camera position immediately
            Engine.camera.position.copy(cameraPos);
            
            // Make camera look at position ahead of car
            const lookTarget = car.position.clone().addScaledVector(
                forwardDir, // Look ahead of car
                this.cameraLookOffset
            );
            
            Engine.camera.lookAt(lookTarget);
            
            // Mark as setup to prevent redundant setups
            this.cameraState.isSetup = true;
            this.cameraState.lastSetupTime = Date.now();
            this.cameraState.setupCount++;
            
            console.log('Car camera positioned behind vehicle');
            return true;
        } catch (e) {
            console.error('Error in setupCamera:', e);
            return false;
        }
    }
    
    // IMPROVED: Update method with better exit detection
    static update() {
        // Always get car from VehicleManager
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available in update');
            return null;
        }
        
        // Check for exit request via input flags
        if (this.input.exit || this.input.action) {
            console.log("Exit requested from CarController via input flags");
            this.input.exit = false;
            this.input.action = false;
            return 'exit';
        }
        
        // Also check for E key directly (redundant safety check)
        if (Engine && Engine.keyStates && (Engine.keyStates['KeyE'] || Engine.keyStates['e'])) {
            console.log("E key pressed directly in CarController");
            Engine.keyStates['KeyE'] = false;
            Engine.keyStates['e'] = false;
            return 'exit';
        }
        
        try {
            // Process car movement
            this.handleCarMovement(car);
            
            // Update camera position every frame
            this.updateCameraPosition(car);
            
            // Reset rotation input for next frame (but keep movement)
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // CRITICAL FIX: Implement proper surface-aligned car movement
    static handleCarMovement(car) {
        if (!car || !car.userData) return;
        
        // Get input from the standardized input object
        const moveZ = this.input.movement.z; // Forward/backward
        const moveX = this.input.movement.x; // Left/right turning

        // Process acceleration/deceleration
        if (moveZ > 0) {
            car.userData.acceleration += 0.05; // Accelerate
        } else if (moveZ < 0) {
            car.userData.acceleration -= 0.1; // Brake/reverse
        } else {
            car.userData.acceleration *= 0.95; // Gradual deceleration
        }

        // Clamp acceleration
        car.userData.acceleration = Math.max(-0.5, Math.min(0.5, car.userData.acceleration));
        
        // Update speed based on acceleration
        car.userData.speed += car.userData.acceleration;
        
        // Apply drag
        car.userData.speed *= (1 - car.userData.drag);
        
        // Clamp speed
        car.userData.speed = Math.max(-car.userData.maxSpeed/2, 
                                     Math.min(car.userData.maxSpeed, car.userData.speed));
        
        // CRITICAL FIX: Handle steering - only update wheel angles first
        if (moveX !== 0) {
            // Update steering angle gradually
            this.steeringAngle = Math.max(
                -this.maxSteeringAngle,
                Math.min(this.maxSteeringAngle, this.steeringAngle + (moveX * 0.05))
            );
            
            // Store steering values in car's userData for wheel animation
            car.userData.steeringInput = moveX;
            car.userData.steeringAngle = this.steeringAngle;
        } else {
            // Return steering to center gradually when no input
            if (Math.abs(this.steeringAngle) > 0.01) {
                this.steeringAngle *= 0.9; // Gradual return to center
            } else {
                this.steeringAngle = 0;
            }
            
            // Update car userData
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = this.steeringAngle;
        }
        
        // Update wheel visuals based on steering angle
        this.updateSteeringWheels(car);
        
        // CRITICAL FIX: Apply surface-aligned movement
        this.applySurfaceMovement(car);
    }
    
    // NEW: Apply surface-aligned movement for cars
    static applySurfaceMovement(car) {
        if (!car || !car.userData || Math.abs(car.userData.speed) < 0.01) return;
        
        try {
            // Get planet information
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            // Get surface normal at car's position
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // CRITICAL FIX: Store surface normal for wheel and camera alignment
            car.userData.surfaceNormal = surfaceNormal.clone();
            
            // Calculate forward direction based on car orientation
            const carForwardWorld = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project forward vector onto the surface tangent plane
            const surfaceForward = carForwardWorld.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Calculate movement direction based on forward vector and steering
            let moveDirection = surfaceForward.clone();
            
            // CRITICAL FIX: Apply steering to the movement direction when actually moving
            if (Math.abs(car.userData.speed) > 0.1 && Math.abs(this.steeringAngle) > 0.01) {
                // Gradually rotate the car body based on steering angle and speed
                const turnFactor = 0.015 * Math.min(1, Math.abs(car.userData.speed) / 10);
                const turnAmount = this.steeringAngle * turnFactor;
                
                // Rotate car body around the surface normal
                const turnQuat = new Quaternion().setFromAxisAngle(surfaceNormal, turnAmount);
                car.quaternion.premultiply(turnQuat);
                
                // Recalculate forward direction after turning
                moveDirection = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                moveDirection = moveDirection.projectOnPlane(surfaceNormal).normalize();
            }
            
            // Calculate movement velocity (speed * direction)
            const velocity = moveDirection.multiplyScalar(car.userData.speed);
            
            // Apply movement
            car.position.add(velocity);
            
            // CRITICAL FIX: Maintain correct height above planet
            const newDistance = car.position.distanceTo(planetCenter);
            const heightOffset = car.userData.fixedHeightOffset || 3.0;
            const targetDistance = planet.radius + heightOffset;
            
            // Adjust height if needed
            if (Math.abs(newDistance - targetDistance) > 0.1) {
                const correctedPosition = planetCenter.clone().add(
                    car.position.clone().sub(planetCenter).normalize().multiplyScalar(targetDistance)
                );
                car.position.copy(correctedPosition);
            }
            
            // CRITICAL FIX: Align car to planet surface
            this.alignCarToSurface(car, surfaceNormal);
            
            // Store the final calculated velocity for physics
            car.userData.velocity.copy(velocity);
            
            // Update car's matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // Update collision bounds
            if (car.collidable && typeof ObjectManager?.updateCollidableBounds === 'function') {
                ObjectManager.updateCollidableBounds(car);
            }
        } catch (e) {
            console.error('Error in applySurfaceMovement:', e);
        }
    }
    
    // NEW: Align car to planet surface
    static alignCarToSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Create rotation matrix that aligns car's up axis with surface normal
            // while preserving car's forward direction as much as possible
            const carUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project car's forward direction onto the surface plane
            const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Calculate right vector as cross product of surface normal and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, surfaceForward).normalize();
            
            // Recalculate forward to ensure perfect orthogonality
            const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Apply gentle alignment factor to avoid jerky movement
            const alignFactor = 0.1;
            const targetUp = car.userData.lastSurfaceNormal ? 
                             new Vector3().copy(car.userData.lastSurfaceNormal).lerp(surfaceNormal, alignFactor) : 
                             surfaceNormal;
            
            // Calculate current up alignment
            const currentUpAlignment = carUp.dot(targetUp);
            
            // Only apply alignment if car is significantly misaligned
            if (currentUpAlignment < 0.99) {
                // Calculate alignment quaternion
                const m = new Quaternion().setFromUnitVectors(carUp, targetUp);
                
                // Apply alignment with gentle smoothing
                car.quaternion.multiply(m);
                
                // Preserve forward direction by calculating correction
                const newForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                const forwardDot = newForward.dot(surfaceForward);
                
                // If forward direction has changed significantly, correct it
                if (forwardDot < 0.99) {
                    const forwardCorrection = new Quaternion().setFromUnitVectors(
                        newForward.projectOnPlane(targetUp).normalize(),
                        surfaceForward
                    );
                    car.quaternion.multiply(forwardCorrection);
                }
            }
            
            // Store surface normal for next frame
            car.userData.lastSurfaceNormal = surfaceNormal.clone();
        } catch (e) {
            console.error('Error aligning car to surface:', e);
        }
    }
    
    // FIXED: Implement updateSteeringWheels method
    static updateSteeringWheels(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Apply steering only to front wheels
            if (wheels.frontLeft) {
                // Preserve roll rotation (x-axis) but set steering angle (y-axis)
                const currentRoll = wheels.frontLeft.rotation.x;
                wheels.frontLeft.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            if (wheels.frontRight) {
                const currentRoll = wheels.frontRight.rotation.x;
                wheels.frontRight.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            // Keep rear wheels straight but maintain roll
            if (wheels.rearLeft) {
                const currentRoll = wheels.rearLeft.rotation.x;
                wheels.rearLeft.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            if (wheels.rearRight) {
                const currentRoll = wheels.rearRight.rotation.x;
                wheels.rearRight.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            // Animate wheel roll based on car speed
            if (Math.abs(car.userData.speed) > 0.01) {
                const rotationAmount = car.userData.speed * 0.05;
                
                // Apply rotation to all wheels around their local X-axis (roll axis)
                Object.values(wheels).forEach(wheel => {
                    if (wheel) {
                        wheel.rotation.x += rotationAmount;
                    }
                });
            }
        } catch (e) {
            console.error('Error updating steering wheels:', e);
        }
    }
    
    // IMPROVED: Update camera position with better stability
    static updateCameraPosition(car) {
        if (!car || !Engine.camera) return;
        
        try {
            // Get surface normal from car
            let surfaceNormal = car.userData?.surfaceNormal || new Vector3(0, 1, 0);
            
            // Set camera up vector aligned with planet surface
            Engine.camera.up.copy(surfaceNormal);
            
            // Calculate desired camera position behind car
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const backwardDir = forwardDir.clone().negate();
            
            // Calculate target position behind car
            const targetPos = car.position.clone();
            targetPos.addScaledVector(backwardDir, this.cameraDistance); // Behind car
            targetPos.addScaledVector(surfaceNormal, this.cameraHeight); // Above car
            
            // Smoothly move camera to target position
            Engine.camera.position.lerp(targetPos, 0.1);
            
            // Make camera look at car
            const lookTarget = car.position.clone().addScaledVector(
                forwardDir,
                this.cameraLookOffset
            );
            
            Engine.camera.lookAt(lookTarget);
            
            // Update camera state
            this.cameraState.lastUpdateTime = Date.now();
        } catch (e) {
            console.error('Error updating camera position:', e);
        }
    }
    
    // ENHANCED: More thorough cleanup
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Reset camera setup flag
            this.cameraState.isSetup = false;
            
            // Clear steering state
            this.steeringAngle = 0;
            
            // Store surface normal for next controller
            if (car.userData?.surfaceNormal) {
                window.lastSurfaceNormal = car.userData.surfaceNormal.clone();
            }
            
            // Reset car userData
            car.userData.isActivelyControlled = false;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            console.log('CarController cleanup complete');
        } catch (e) {
            console.error('Error in CarController cleanup:', e);
        }
    }
}
