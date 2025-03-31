import { Vector3, Quaternion, Euler, Matrix4, Object3D } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for car vehicle operation - SIMPLIFIED VERSION
export default class CarController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };

    // Third-person camera configuration for car
    static cameraDistance = 20; // Distance behind car for better visibility
    static cameraHeight = 8;    // Height above car for better overview
    static cameraLookOffset = 2; // Look ahead of car
    
    // ThirdPerson-style reset with IMMEDIATE positioning
    static reset() {
        console.log('Initializing Car Controller (Direct Positioning)');
        
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('CarController initialized without a car vehicle');
            return;
        }
        
        try {
            // CRITICAL FIX: First, verify we're using the main camera
            if (Engine.camera !== Engine.scene.getObjectByName('MainCamera')) {
                console.error('Main camera reference is incorrect - fixing it');
                // Find the original camera and restore it
                const mainCamera = Engine.scene.getObjectByName('MainCamera');
                if (mainCamera) {
                    Engine.camera = mainCamera;
                }
            }
            
            // CRITICAL FIX: Remove any duplicate cameras
            Engine.scene.traverse(object => {
                if (object.isCamera && object !== Engine.camera) {
                    console.log(`Removing duplicate camera: ${object.name || object.uuid}`);
                    if (object.parent) {
                        object.parent.remove(object);
                    }
                }
            });
            
            // CRITICAL FIX: Make sure the camera is properly detached
            if (Engine.camera.parent) {
                console.log(`Detaching camera from ${Engine.camera.parent.name || 'unnamed parent'}`);
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
            }
            
            // FIX: REVERT to direct positioning - remove camera mount approach
            // Remove reference to cameraMount if it exists
            if (car.userData.cameraMount) {
                if (car.userData.cameraMount.parent === car) {
                    car.remove(car.userData.cameraMount);
                }
                delete car.userData.cameraMount;
            }
            
            // Reset camera properties
            Engine.camera.layers.set(0);
            Engine.camera.zoom = 1;
            Engine.camera.fov = 75;
            Engine.camera.near = 0.1;
            Engine.camera.far = 50000;
            Engine.camera.updateProjectionMatrix();
            
            // FIX: Use direct positioning - position camera immediately without parenting
            this.updateCameraPosition(car);
            
            console.log("Car camera set with direct positioning");
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            console.log("Car controller initialized with input:", this.input);
        } catch (e) {
            console.error('Error during car controller setup:', e);
        }
    }
    
    // FIXED: Return to direct camera positioning without parenting with better smoothing
    static updateCameraPosition(car) {
        if (!car) return;
        
        try {
            // FIXED: Add camera smoothing state if it doesn't exist
            if (!this.cameraState) {
                this.cameraState = {
                    position: new Vector3(),
                    target: new Vector3(),
                    up: new Vector3(0, 1, 0),
                    smoothingFactor: 0.1 // Lower = smoother but more delay
                };
            }
            
            // Get car position
            const carPos = car.position.clone();
            
            // Get surface normal (up direction relative to planet)
            let surfaceNormal;
            
            if (car.userData.planet) {
                const planetCenter = car.userData.planet.object.position;
                const toVehicle = car.position.clone().sub(planetCenter);
                surfaceNormal = toVehicle.normalize();
            } else {
                surfaceNormal = new Vector3(0, 1, 0);
            }
            
            // Get car's forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to up and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward direction perpendicular to surface normal and right vector
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Calculate ideal camera position - behind and above car
            const idealCameraPosition = carPos.clone();
            idealCameraPosition.addScaledVector(trueForward, -this.cameraDistance);
            idealCameraPosition.addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Ensure camera is not below planet surface
            if (car.userData.planet) {
                const planetCenter = car.userData.planet.object.position;
                const distanceFromCenter = idealCameraPosition.distanceTo(planetCenter);
                const minDistance = car.userData.planet.radius + 1.0;
                
                if (distanceFromCenter < minDistance) {
                    const direction = idealCameraPosition.clone().sub(planetCenter).normalize();
                    idealCameraPosition.copy(planetCenter).addScaledVector(direction, minDistance);
                }
            }
            
            // Calculate ideal look target slightly ahead of the car
            const idealLookTarget = carPos.clone();
            idealLookTarget.addScaledVector(trueForward.clone().negate(), -this.cameraLookOffset);
            
            // FIXED: Smoothly interpolate camera position instead of immediate jumps
            this.cameraState.position.lerp(idealCameraPosition, this.cameraState.smoothingFactor);
            this.cameraState.target.lerp(idealLookTarget, this.cameraState.smoothingFactor);
            this.cameraState.up.lerp(surfaceNormal, this.cameraState.smoothingFactor);
            
            // Apply smoothed camera position and orientation
            Engine.camera.position.copy(this.cameraState.position);
            Engine.camera.up.copy(this.cameraState.up);
            Engine.camera.lookAt(this.cameraState.target);
            
            // Make sure the camera view is properly set
            Engine.camera.layers.set(0);
            Engine.camera.updateProjectionMatrix();
            
        } catch (e) {
            console.error("Error updating car camera:", e);
        }
    }
    
    // Handle driving controls
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.warn("Car controller update called with no car available");
            return null;
        }
        
        // Check for exit request
        if (this.input.exit) {
            this.input.exit = false;
            return 'exit';
        }
        
        // CRITICAL FIX: Car movement is now FULLY handled here, not in VehicleManager
        this.handleCarMovement(car, 1/60);
        
        // FIXED: Use direct camera positioning - update every frame
        this.updateCameraPosition(car);
        
        return null;
    }
    
    // CRITICAL FIX: Moved all car movement logic from VehicleManager to here
    static handleCarMovement(car, deltaTime) {
        // CRITICAL FIX: Ensure this car is the current vehicle to prevent moving other cars
        if (car !== VehicleManager.currentVehicle || !car.userData.isOccupied) {
            console.warn("CarController.handleCarMovement called on non-current or unoccupied vehicle");
            return;
        }
        
        // Get input values for acceleration and steering
        const accelerationInput = -this.input.movement.z; // Negative Z is forward
        const steeringInput = this.input.movement.x;
        
        // Store steering input for wheel animation
        car.userData.steeringInput = steeringInput;
        
        // Debug active inputs
        if (Math.abs(accelerationInput) > 0.01 || Math.abs(steeringInput) > 0.01) {
            console.log(`🚗 Car inputs: accel=${accelerationInput.toFixed(2)}, steer=${steeringInput.toFixed(2)}`);
        }
        
        // Apply acceleration based on input
        if (Math.abs(accelerationInput) > 0.01) {
            const accelerationStrength = 400; // Strong acceleration for responsive feel
            const acceleration = car.userData.acceleration * accelerationInput * deltaTime * accelerationStrength;
            car.userData.speed += acceleration;
            console.log(`🚗 Acceleration applied: ${acceleration.toFixed(2)}, new speed: ${car.userData.speed.toFixed(2)}`);
        } else {
            // Apply drag when no input
            car.userData.speed *= 0.99;
            if (Math.abs(car.userData.speed) < 0.05) {
                car.userData.speed = 0;
            }
        }
        
        // Apply speed limits
        const maxForwardSpeed = car.userData.maxSpeed || 40;
        const maxReverseSpeed = car.userData.maxSpeedReverse || 15;
        
        if (car.userData.speed > 0) {
            car.userData.speed = Math.min(maxForwardSpeed, car.userData.speed);
        } else {
            car.userData.speed = Math.max(-maxReverseSpeed, car.userData.speed);
        }
        
        // CRITICAL FIX: Apply steering when moving - with corrected direction
        if (Math.abs(car.userData.speed) > 0.5) {
            // FIXED: Keep track of current wheel steering angle
            car.userData.wheelSteerAngle = car.userData.wheelSteerAngle || 0;
            
            // Calculate target wheel angle based on current steering input
            const maxWheelTurn = Math.PI / 4; // 45 degrees max turn
            const targetWheelAngle = steeringInput * maxWheelTurn;
            
            // FIXED: Smoothly interpolate to target angle
            const steerSpeed = 5.0 * deltaTime; // Adjust for desired responsiveness
            car.userData.wheelSteerAngle += (targetWheelAngle - car.userData.wheelSteerAngle) * steerSpeed;
            
            // Apply steering to car movement
            const steeringStrength = 30; // Strong steering for responsive feel
            const reverseFactor = car.userData.speed < 0 ? -1 : 1;
            const speedFactor = Math.min(1.0, Math.abs(car.userData.speed) / 10);
            const steeringValue = car.userData.handling * steeringInput * 
                               reverseFactor * steeringStrength * speedFactor * deltaTime;
            
            if (car.userData.planet) {
                const planetCenter = car.userData.planet.object.position;
                const toVehicle = car.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                
                const rotationMatrix = new Matrix4().makeRotationAxis(surfaceNormal, steeringValue);
                car.quaternion.premultiply(new Quaternion().setFromRotationMatrix(rotationMatrix));
                
                VehicleManager.alignVehicleToPlanetSurface(car, surfaceNormal, 0.3);
            } else {
                car.rotateY(steeringValue);
            }
            
            console.log(`🚗 Steering applied: ${steeringValue.toFixed(4)}`);
            
            // FIXED: Only apply steering rotation to front wheels - back wheels never turn
            if (car.userData.wheels) {
                if (car.userData.wheels.frontLeft) {
                    car.userData.wheels.frontLeft.rotation.set(car.userData.wheelSteerAngle, 0, Math.PI / 2);
                }
                if (car.userData.wheels.frontRight) {
                    car.userData.wheels.frontRight.rotation.set(car.userData.wheelSteerAngle, 0, Math.PI / 2);
                }
                if (car.userData.wheels.rearLeft) {
                    car.userData.wheels.rearLeft.rotation.x = 0;
                }
                if (car.userData.wheels.rearRight) {
                    car.userData.wheels.rearRight.rotation.x = 0;
                }
            }
        } else {
            // Reset wheel angle when speed is too low
            if (car.userData.wheelSteerAngle) {
                car.userData.wheelSteerAngle *= 0.9;
                
                // Apply diminishing steering angle to wheels
                if (car.userData.wheels) {
                    if (car.userData.wheels.frontLeft) {
                        car.userData.wheels.frontLeft.rotation.x = car.userData.wheelSteerAngle;
                    }
                    if (car.userData.wheels.frontRight) {
                        car.userData.wheels.frontRight.rotation.x = car.userData.wheelSteerAngle;
                    }
                }
            }
        }
        
        // CRITICAL FIX: Apply wheel roll animation with correct axis
        if (Math.abs(car.userData.speed) > 0.01 && car.userData.wheels) {
            // FIXED: Track wheel rotation across frames for smoother rotation
            car.userData.wheelRotation = car.userData.wheelRotation || 0;
            const wheelRotationSpeed = car.userData.speed * deltaTime * 0.3;
            car.userData.wheelRotation += wheelRotationSpeed;
            
            // Apply rolling animation to all wheels, maintaining their steering angles
            Object.values(car.userData.wheels).forEach(wheel => {
                if (wheel) {
                    const steerAngle = wheel.rotation.x;
                    wheel.rotation.y = car.userData.wheelRotation;
                    
                    if (wheel === car.userData.wheels.frontLeft || wheel === car.userData.wheels.frontRight) {
                        wheel.rotation.x = steerAngle;
                    }
                }
            });
        }
        
        // Apply movement to position
        if (Math.abs(car.userData.speed) > 0.01) {
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            car.userData.velocity = forwardDir.multiplyScalar(car.userData.speed);
            
            const positionDelta = car.userData.velocity.clone().multiplyScalar(deltaTime * 2.0);
            car.position.add(positionDelta);
            
            console.log(`🚗 Car moved by: ${positionDelta.length().toFixed(2)} units, pos: ${car.position.toArray().map(v => v.toFixed(2))}`);
        } else {
            car.userData.velocity.set(0, 0, 0);
        }
        
        // CRITICAL FIX: Re-align car to planet surface after movement
        if (car.userData.planet) {
            const planetCenter = car.userData.planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize();
            
            VehicleManager.alignVehicleToPlanetSurface(car, surfaceNormal, 0.5);
            
            const distance = car.position.distanceTo(planetCenter);
            const targetDistance = car.userData.planet.radius + 1.5;
            
            if (Math.abs(distance - targetDistance) > 0.5) {
                car.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
            }
        }
    }
    
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        // CRITICAL FIX: Ensure camera is properly reset and attached to scene
        if (Engine.camera) {
            const worldPos = new Vector3();
            const worldQuat = new Quaternion();
            
            if (Engine.camera.parent) {
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                Engine.camera.parent.remove(Engine.camera);
            }
            
            Engine.scene.add(Engine.camera);
            
            Engine.camera.position.copy(worldPos);
            Engine.camera.quaternion.copy(worldQuat);
        }
        
        // Reset camera orientation
        Engine.camera.rotation.set(0, 0, 0);
        Engine.camera.quaternion.identity();
        Engine.camera.layers.set(0);
        Engine.camera.zoom = 1;
        Engine.camera.fov = 75;
        Engine.camera.updateProjectionMatrix();
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
