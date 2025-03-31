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
            // Make sure camera is detached from any parent
            if (Engine.camera.parent) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Reset camera orientation
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.quaternion.identity();
            
            // Position camera immediately - no lerping/animation
            this.updateCameraPosition(car, 1.0);
            
            console.log("Car camera set with immediate positioning");
            
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
    
    // SIMPLIFIED: Direct camera positioning without animation
    static updateCameraPosition(car) {
        if (!car) return;
        
        try {
            // Get car position
            const carPos = car.position.clone();
            
            // Get surface normal (up direction relative to planet)
            const surfaceNormal = car.up.clone();
            
            // Get car's forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to up and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward direction perpendicular to surface normal and right vector
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Calculate camera position - behind and above car
            const cameraPosition = carPos.clone();
            
            // Position camera behind car (opposite of forward direction)
            cameraPosition.addScaledVector(trueForward, -this.cameraDistance);
            
            // Position camera above car along surface normal
            cameraPosition.addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Calculate look target slightly ahead of the car for better view
            const lookTarget = carPos.clone();
            lookTarget.addScaledVector(trueForward.clone().negate(), -this.cameraLookOffset);
            
            // Apply camera position DIRECTLY - no lerping
            Engine.camera.position.copy(cameraPosition);
            Engine.camera.up.copy(surfaceNormal);
            Engine.camera.lookAt(lookTarget);
            
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
        
        // Always update camera position
        this.updateCameraPosition(car);
        
        return null;
    }
    
    // CRITICAL FIX: Moved all car movement logic from VehicleManager to here
    static handleCarMovement(car, deltaTime) {
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
        
        // Apply steering when moving
        if (Math.abs(steeringInput) > 0.01 && Math.abs(car.userData.speed) > 0.5) {
            const steeringStrength = 30; // Strong steering
            const speed = Math.abs(car.userData.speed);
            const speedFactor = Math.min(1.0, speed / 10);
            const steeringDirection = Math.sign(car.userData.speed);
            const steeringValue = -car.userData.handling * steeringInput * 
                                 steeringDirection * steeringStrength * speedFactor;
            
            car.rotateY(steeringValue);
            console.log(`🚗 Steering applied: ${steeringValue.toFixed(4)}`);
        }
        
        // Animate wheels if available
        if (car.userData.wheels) {
            const maxWheelTurn = Math.PI / 5;
            const wheelTurnAngle = steeringInput * maxWheelTurn;
            
            // Apply steering angle to front wheels
            if (car.userData.wheels.frontLeft) {
                car.userData.wheels.frontLeft.rotation.y = wheelTurnAngle;
            }
            if (car.userData.wheels.frontRight) {
                car.userData.wheels.frontRight.rotation.y = wheelTurnAngle;
            }
            
            // Apply roll animation to all wheels
            const wheelRollSpeed = car.userData.speed * 0.1;
            Object.values(car.userData.wheels).forEach(wheel => {
                if (wheel) {
                    wheel.rotation.x += wheelRollSpeed;
                }
            });
        }
        
        // Apply movement to position
        if (Math.abs(car.userData.speed) > 0.01) {
            // Calculate velocity vector from speed and orientation
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            car.userData.velocity = forwardDir.multiplyScalar(car.userData.speed);
            
            // Apply position change with higher multiplier for stronger movement
            const positionDelta = car.userData.velocity.clone().multiplyScalar(deltaTime * 2.0);
            car.position.add(positionDelta);
            
            console.log(`🚗 Car moved by: ${positionDelta.length().toFixed(2)} units, pos: ${car.position.toArray().map(v => v.toFixed(2))}`);
        } else {
            car.userData.velocity.set(0, 0, 0);
        }
        
        // CRITICAL FIX: Make sure the planet knows car is on surface
        if (car.userData.planet) {
            const planetCenter = car.userData.planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize();
            VehicleManager.alignVehicleToPlanetSurface(car, surfaceNormal, 0.3);
        }
    }
    
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        // Reset camera orientation
        Engine.camera.rotation.set(0, 0, 0);
        Engine.camera.quaternion.identity();
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
