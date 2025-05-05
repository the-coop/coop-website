// Controller specifically for car vehicle operation - SIMPLIFIED VERSION
import { Vector3, Quaternion, Matrix4 } from 'three';
import VehicleManager from '../vehicles.mjs';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';

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
    
    // Camera state
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
    static maxSteeringAngle = 0.4;

    // Reset controller state when entering car
    static reset() {
        console.log('Initializing Car Controller with proper surface movement');
        
        // Get car from VehicleManager
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
            // Reset camera rotation state
            this.cameraRotation = { yaw: Math.PI, pitch: 0.2 };
            
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
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            // CRITICAL: Update surface normal immediately
            this.updateSurfaceNormal(car);
            
            // Set up camera
            this.setupCamera();
            
            console.log('Car Controller initialized successfully');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // Initial camera setup
    static setupCamera() {
        const car = VehicleManager.currentVehicle;
        if (!car || !Engine.camera) return false;
        
        try {
            // Get surface normal from car or calculate it
            let surfaceNormal;
            if (car.userData?.surfaceNormal) {
                surfaceNormal = car.userData.surfaceNormal;
            } else if (car.userData?.planet) {
                const planet = car.userData.planet;
                surfaceNormal = car.position.clone().sub(planet.object.position).normalize();
                car.userData.surfaceNormal = surfaceNormal.clone();
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
            
            // Calculate backward direction (behind car)
            const carBackward = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            
            // Position camera behind car
            const cameraPos = car.position.clone();
            cameraPos.addScaledVector(carBackward, this.cameraDistance);
            cameraPos.addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Set camera position
            Engine.camera.position.copy(cameraPos);
            
            // Make camera look at car
            Engine.camera.lookAt(car.position);
            
            // Mark as setup
            this.cameraState.isSetup = true;
            this.cameraState.lastSetupTime = Date.now();
            this.cameraState.setupCount++;
            
            return true;
        } catch (e) {
            console.error('Error in setupCamera:', e);
            return false;
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
            // CRITICAL: Update surface normal every frame
            this.updateSurfaceNormal(car);
            
            // Process car movement
            this.handleCarMovement(car);
            
            // Update camera position
            this.updateCameraPosition(car);
            
            // Reset rotation input
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // Update surface normal based on planet position
    static updateSurfaceNormal(car) {
        if (!car || !car.userData || !car.userData.planet || !car.userData.planet.object) return;
        
        try {
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            
            // Calculate new surface normal (points away from planet center)
            const toVehicle = car.position.clone().sub(planetCenter).normalize();
            
            // Update stored surface normal
            car.userData.surfaceNormal = toVehicle.clone();
            
            // Calculate and store height above surface
            const distance = car.position.distanceTo(planetCenter);
            car.userData.heightAboveSurface = distance - planet.radius;
        } catch (e) {
            console.error('Error updating surface normal:', e);
        }
    }
    
    // Handle car movement based on input
    static handleCarMovement(car) {
        if (!car || !car.userData) return;
        
        // Get input from the standardized input object
        const moveZ = this.input.movement.z; // Forward/backward
        const moveX = this.input.movement.x; // Left/right turning

        // Process acceleration/deceleration
        if (moveZ > 0) {
            car.userData.acceleration += 0.025; // Reduced for better control
        } else if (moveZ < 0) {
            car.userData.acceleration -= 0.05; // Brake
        } else {
            car.userData.acceleration *= 0.95; // Gradual deceleration
        }

        // Clamp acceleration
        car.userData.acceleration = Math.max(-0.3, Math.min(0.3, car.userData.acceleration));
        
        // Update speed based on acceleration
        car.userData.speed += car.userData.acceleration;
        
        // Apply drag
        car.userData.speed *= (1 - car.userData.drag);
        
        // Clamp speed
        car.userData.speed = Math.max(-car.userData.maxSpeed/2, 
                                     Math.min(car.userData.maxSpeed, car.userData.speed));
        
        // Handle steering - update steeringAngle
        if (moveX !== 0) {
            // Update steering angle gradually
            this.steeringAngle = Math.max(
                -this.maxSteeringAngle,
                Math.min(this.maxSteeringAngle, this.steeringAngle + (moveX * 0.05))
            );
            
            // Store steering values in car's userData
            car.userData.steeringInput = moveX;
            car.userData.steeringAngle = this.steeringAngle;
            
            // CRITICAL: Only turn car body when moving
            if (Math.abs(car.userData.speed) > 0.1) {
                this.rotateCarOnSurface(car, moveX);
            }
        } else {
            // Return steering to center gradually
            if (Math.abs(this.steeringAngle) > 0.01) {
                this.steeringAngle *= 0.9;
            } else {
                this.steeringAngle = 0;
            }
            
            // Update car userData
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = this.steeringAngle;
        }
        
        // Update wheel visuals based on steering angle
        this.updateSteeringWheels(car);
        
        // CRITICAL: Apply surface-aligned movement
        this.applyMovementOnSurface(car);
    }
    
    // Rotate car on the planet surface
    static rotateCarOnSurface(car, steeringInput) {
        if (!car || !car.userData || !car.userData.surfaceNormal) return;
        
        const surfaceNormal = car.userData.surfaceNormal;
        const speed = Math.abs(car.userData.speed);
        
        // Calculate turn factor based on speed
        const turnFactor = 0.015 * Math.min(1, speed / 10);
        const turnAmount = steeringInput * turnFactor;
        
        // Create rotation quaternion around surface normal
        const rotationQ = new Quaternion().setFromAxisAngle(surfaceNormal, turnAmount);
        
        // Apply rotation to car
        car.quaternion.premultiply(rotationQ);
        
        // Re-align car to surface after turning
        this.alignCarToSurface(car);
    }

    // Align car to planet surface
    static alignCarToSurface(car) {
        if (!car || !car.userData || !car.userData.surfaceNormal) return;
        
        const surfaceNormal = car.userData.surfaceNormal;
        
        try {
            // Get current car up vector
            const carUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            
            // Get car forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project forward onto surface plane
            const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Calculate right vector
            const rightVector = new Vector3().crossVectors(surfaceNormal, surfaceForward).normalize();
            
            // Recalculate forward to ensure orthogonality
            const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Create rotation matrix from these orthogonal vectors
            const rotMatrix = new Matrix4().makeBasis(
                rightVector,
                surfaceNormal,
                correctedForward
            );
            
            // Convert to quaternion
            const targetQuaternion = new Quaternion().setFromRotationMatrix(rotMatrix);
            
            // Apply gentle alignment factor
            car.quaternion.slerp(targetQuaternion, 0.1);
        } catch (e) {
            console.error('Error aligning car to surface:', e);
        }
    }
    
    // Apply movement along the planet surface
    static applyMovementOnSurface(car) {
        if (!car || !car.userData || Math.abs(car.userData.speed) < 0.01) return;
        
        try {
            // Get planet information
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            // Get surface normal
            const surfaceNormal = car.userData.surfaceNormal;
            if (!surfaceNormal) return;
            
            // Calculate car's forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project onto tangent plane of planet surface
            const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Apply movement
            const moveVector = surfaceForward.multiplyScalar(car.userData.speed);
            car.position.add(moveVector);
            
            // Maintain correct height above planet
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            
            // Adjust height if needed
            if (Math.abs(currentDistance - targetDistance) > 0.1) {
                const correctedPosition = planetCenter.clone().add(
                    toVehicle.normalize().multiplyScalar(targetDistance)
                );
                car.position.copy(correctedPosition);
            }
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // Store velocity for physics system
            car.userData.velocity.copy(moveVector);
        } catch (e) {
            console.error('Error applying surface movement:', e);
        }
    }
    
    // Update wheel visuals based on steering angle
    static updateSteeringWheels(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Apply steering only to front wheels
            if (wheels.frontLeft) {
                const currentRoll = wheels.frontLeft.rotation.x;
                wheels.frontLeft.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            if (wheels.frontRight) {
                const currentRoll = wheels.frontRight.rotation.x;
                wheels.frontRight.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            // Keep rear wheels straight
            if (wheels.rearLeft) {
                const currentRoll = wheels.rearLeft.rotation.x;
                wheels.rearLeft.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            if (wheels.rearRight) {
                const currentRoll = wheels.rearRight.rotation.x;
                wheels.rearRight.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            // Animate wheel roll based on speed
            if (Math.abs(car.userData.speed) > 0.01) {
                const rotationAmount = car.userData.speed * 0.05;
                
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
    
    // Update camera position with correct orientation
    static updateCameraPosition(car) {
        if (!car || !Engine.camera) return;
        
        try {
            // Get surface normal from car
            let surfaceNormal = car.userData?.surfaceNormal || new Vector3(0, 1, 0);
            
            // Set camera up vector aligned with surface
            Engine.camera.up.copy(surfaceNormal);
            
            // Calculate position behind car
            const carBackward = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            
            // Calculate target position
            const targetPos = car.position.clone();
            targetPos.addScaledVector(carBackward, this.cameraDistance);
            targetPos.addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Smoothly move camera
            Engine.camera.position.lerp(targetPos, 0.1);
            
            // Look at car
            Engine.camera.lookAt(car.position);
            
            // Update state
            this.cameraState.lastUpdateTime = Date.now();
        } catch (e) {
            console.error('Error updating camera position:', e);
        }
    }
    
    // Cleanup when exiting car
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
