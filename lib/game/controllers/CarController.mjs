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
    
    // FIXED: Camera setup with strict positioning 
    static reset() {
        console.log('Initializing Car Controller with strict camera control');
        
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('CarController initialized without a car vehicle');
            return;
        }
        
        try {
            // CRITICAL FIX: Make absolutely sure the camera is properly handled and attached
            if (Engine.camera) {
                // First, detach from any existing parent
                if (Engine.camera.parent && Engine.camera.parent !== car) {
                    const worldPos = new Vector3();
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                }
                
                // Force a clean slate for camera
                Engine.camera.rotation.set(0, 0, 0);
                Engine.camera.quaternion.identity();
                
                // Mark car as needing camera setup
                car.userData._needsCameraSetup = true;
                car.userData._setupAttempts = 0;
                car.userData._lastCameraSetup = 0;
                
                // Immediately try to set up the camera
                this.setupCarCamera(car);
            }
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Initialize camera state for smooth movement
            if (!this.cameraState) {
                this.cameraState = {
                    position: new Vector3(0, 7, -15), // Default camera position relative to car
                    rotation: new Euler(0.2, Math.PI, 0), // Default camera rotation
                    lastUpdateTime: Date.now()
                };
            }
            
            console.log("Car controller initialized with strict camera control");
        } catch (e) {
            console.error('Error during car controller setup:', e);
        }
    }
    
    // FIXED: Separate camera setup function that can be called multiple times if needed
    static setupCarCamera(car) {
        if (!car || !Engine.camera) return;
        
        try {
            // Keep track of setup attempts
            car.userData._setupAttempts = (car.userData._setupAttempts || 0) + 1;
            car.userData._lastCameraSetup = Date.now();
            
            console.log(`Setting up car camera (attempt ${car.userData._setupAttempts})`);
            
            // If camera is not already attached to car, attach it
            if (Engine.camera.parent !== car) {
                // Remove from current parent
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                }
                
                // Add to car with fixed position and rotation
                car.add(Engine.camera);
                
                // Use consistent fixed position and rotation
                Engine.camera.position.set(0, 7, -15);
                Engine.camera.rotation.set(0.2, Math.PI, 0);
                
                console.log("Camera attached to car with fixed position");
            } else {
                // Just ensure position and rotation are correct
                Engine.camera.position.set(0, 7, -15);
                Engine.camera.rotation.set(0.2, Math.PI, 0);
            }
            
            // Store reference values
            car.userData._cameraPosition = Engine.camera.position.clone();
            car.userData._cameraRotation = Engine.camera.rotation.clone();
            car.userData._cameraQuaternion = Engine.camera.quaternion.clone();
            
            // Mark as set up
            car.userData._needsCameraSetup = false;
            
            return true;
        } catch (e) {
            console.error("Error setting up car camera:", e);
            return false;
        }
    }
    
    // FIXED: Completely simplified update method focusing only on enforcing camera stability
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
        
        // FIXED: Camera verification and repair
        this.verifyCarCamera(car);
        
        return null;
    }
    
    // FIXED: New method to verify and fix camera issues each frame
    static verifyCarCamera(car) {
        if (!car || !Engine.camera) return;
        
        try {
            // If camera needs setup, try again
            if (car.userData._needsCameraSetup) {
                this.setupCarCamera(car);
                return;
            }
            
            // If camera parent is not the car, something's wrong - fix it
            if (Engine.camera.parent !== car) {
                console.log("Camera detached from car - reattaching");
                car.userData._needsCameraSetup = true;
                return;
            }
            
            // If stored reference values exist, verify camera hasn't moved/rotated
            if (car.userData._cameraPosition && car.userData._cameraRotation) {
                const positionOK = Engine.camera.position.distanceTo(car.userData._cameraPosition) < 0.1;
                
                // If position changed significantly, reset it
                if (!positionOK) {
                    console.log("Camera position changed - resetting");
                    Engine.camera.position.copy(car.userData._cameraPosition);
                }
                
                // Always force the rotation to match saved rotation
                Engine.camera.rotation.copy(car.userData._cameraRotation);
            }
            
            // Check if we need periodic reinitialization (every 5 seconds)
            const now = Date.now();
            if (car.userData._lastCameraSetup && now - car.userData._lastCameraSetup > 5000) {
                console.log("Periodic camera verification");
                car.userData._lastCameraSetup = now;
                
                // Just update the reference values without full reset
                car.userData._cameraPosition = Engine.camera.position.clone();
                car.userData._cameraRotation = Engine.camera.rotation.clone();
                car.userData._cameraQuaternion = Engine.camera.quaternion.clone();
            }
        } catch (e) {
            console.error("Error verifying car camera:", e);
        }
    }
    
    // CRITICAL FIX: Fix wheel rotation for proper axis alignment
    // FIXED: Ensure movement is only processed for the current vehicle
    static handleCarMovement(car, deltaTime) {
        // CRITICAL FIX: Triple-check this is the current vehicle
        if (car !== VehicleManager.currentVehicle || !car.userData.isOccupied) {
            console.warn("CarController.handleCarMovement called on non-current or unoccupied vehicle");
            return;
        }
        
        // CRITICAL FIX: Always make sure there are no ghost vehicles receiving input
        VehicleManager.validateVehicles();
        
        // Make sure other vehicles are completely still
        for (const vehicle of VehicleManager.vehicles) {
            if (vehicle && vehicle !== car) {
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                if ('speed' in vehicle.userData) {
                    vehicle.userData.speed = 0;
                }
            }
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
        } else {
            // Reset wheel angle when speed is too low
            if (car.userData.wheelSteerAngle) {
                car.userData.wheelSteerAngle *= 0.9;
            }
        }
        
        // FIXED: Fix wheel animation to use consistent axes for all wheels
        // Apply wheel roll animation - track cumulative rotation angle
        if (car.userData.wheels) {
            // Track wheel rotation across frames
            car.userData.wheelRollAngle = car.userData.wheelRollAngle || 0;
            
            // Update wheel roll angle based on speed
            const wheelRadius = 1.5; // Match the cylinder radius from vehicle creation
            const wheelCircumference = 2 * Math.PI * wheelRadius;
            const distanceTraveled = car.userData.speed * deltaTime;
            const rotationIncrement = (distanceTraveled / wheelCircumference) * 2 * Math.PI;
            car.userData.wheelRollAngle += rotationIncrement;
            
            // Apply steering to front wheels only
            const steeringAngle = car.userData.wheelSteerAngle || 0;
            
            // CRITICAL FIX: Use the correct rotation axes for all wheels
            // The wheels all start with z=Math.PI/2 to be flat - we rotate on x-axis for rolling
            if (car.userData.wheels.frontLeft) {
                car.userData.wheels.frontLeft.rotation.x = car.userData.wheelRollAngle;
                car.userData.wheels.frontLeft.rotation.y = steeringAngle;
                car.userData.wheels.frontLeft.rotation.z = Math.PI/2; // Keep wheels flat
            }
            
            if (car.userData.wheels.frontRight) {
                car.userData.wheels.frontRight.rotation.x = car.userData.wheelRollAngle;
                car.userData.wheels.frontRight.rotation.y = steeringAngle;
                car.userData.wheels.frontRight.rotation.z = Math.PI/2; // Keep wheels flat
            }
            
            // Back wheels should only roll, not steer
            if (car.userData.wheels.rearLeft) {
                car.userData.wheels.rearLeft.rotation.x = car.userData.wheelRollAngle;
                car.userData.wheels.rearLeft.rotation.y = 0; // No steering
                car.userData.wheels.rearLeft.rotation.z = Math.PI/2; // Keep wheels flat
            }
            
            if (car.userData.wheels.rearRight) {
                car.userData.wheels.rearRight.rotation.x = car.userData.wheelRollAngle;
                car.userData.wheels.rearRight.rotation.y = 0; // No steering
                car.userData.wheels.rearRight.rotation.z = Math.PI/2; // Keep wheels flat
            }
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
    
    // FIXED: More thorough cleanup
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        // CRITICAL FIX: Ensure camera is properly reset and attached to scene
        if (Engine.camera) {
            const worldPos = new Vector3();
            
            if (Engine.camera.parent) {
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
            }
            
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
            
            // Reset rotation completely
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.quaternion.identity();
            
            // Reset properties
            Engine.camera.layers.set(0);
            Engine.camera.zoom = 1;
            Engine.camera.fov = 75;
            Engine.camera.updateProjectionMatrix();
        }
        
        // Clear state
        this.cameraState = null;
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        console.log('Car Controller cleanup complete');
    }
}
