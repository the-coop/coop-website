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

    // Camera state to track accumulated rotation
    static cameraRotation = {
        yaw: Math.PI,  // FIXED: Always face the back of the car
        pitch: 0.2    // Slight downward tilt
    };
    
    // Camera constraints
    static MIN_PITCH = -0.4;    // Looking down limit
    static MAX_PITCH = 0.7;     // Looking up limit
    static ROTATION_SPEED = 0.003; // Sensitivity for camera movement
    
    // FIXED: Camera setup with forward-facing orientation
    static reset() {
        console.log('Initializing Car Controller with improved camera control');
        
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('CarController initialized without a car vehicle');
            return;
        }
        
        try {
            // CRITICAL FIX: Add diagnostic check for duplicate car controls
            this.performDuplicateControlCheck();
            
            // First fully reset system state to prevent ghosts
            VehicleManager.validateVehicles(); // Clear any ghost vehicles
            
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
                
                // FIXED: Reset camera rotation tracking to ALWAYS face the BACK of the car
                this.cameraRotation.yaw = Math.PI;  // Consistently face the back of the car
                this.cameraRotation.pitch = 0.2;    // Slight downward tilt
                
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
            
            console.log("Car controller initialized with improved camera control");
        } catch (e) {
            console.error('Error during car controller setup:', e);
        }
    }

    // NEW: Diagnostic method to detect duplicate car control issues
    static performDuplicateControlCheck() {
        // Count how many cars appear to be player-controlled
        let playerControlledCount = 0;
        let problematicVehicles = [];
        
        for (const vehicle of VehicleManager.vehicles) {
            if (!vehicle || !vehicle.userData) continue;
            
            // Check for invalid control state
            if (vehicle.userData.isOccupied || vehicle.userData.hasPlayerInside || 
                vehicle.userData.player === PlayersManager.self) {
                
                if (vehicle !== VehicleManager.currentVehicle) {
                    console.warn(`Found vehicle incorrectly marked as player-controlled: ${vehicle.userData.name}`);
                    problematicVehicles.push(vehicle);
                }
                
                playerControlledCount++;
            }
        }
        
        if (playerControlledCount > 1) {
            console.error(`CRITICAL: ${playerControlledCount} vehicles marked as player-controlled (should be 1)`);
            
            // Fix the issue by clearing control flags on all but currentVehicle
            for (const vehicle of problematicVehicles) {
                console.log(`Fixing control state for: ${vehicle.userData.name}`);
                vehicle.userData.isOccupied = false;
                vehicle.userData.hasPlayerInside = false;
                vehicle.userData.player = null;
                vehicle.userData.speed = 0;
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
            }
        }
    }
    
    // FIXED: Camera setup consistent regardless of car movement direction
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
                
                // Create a camera mount point to handle offset but allow rotation
                if (!car.userData.cameraMount) {
                    car.userData.cameraMount = new Object3D();
                    car.userData.cameraMount.name = "CarCameraMount";
                }
                
                // Reset camera mount position
                car.userData.cameraMount.position.set(0, 7, 0);
                
                // Add the mount to the car if not already there
                if (car.userData.cameraMount.parent !== car) {
                    car.add(car.userData.cameraMount);
                }
                
                // Add camera to mount
                car.userData.cameraMount.add(Engine.camera);
                
                // FIXED: Position camera behind car (negative Z) - ALWAYS!
                Engine.camera.position.set(0, 0, -15); // Negative Z = behind car
                
                // Apply fixed rotation facing forward
                Engine.camera.rotation.set(
                    this.cameraRotation.pitch, 
                    this.cameraRotation.yaw,  // Math.PI = face car front
                    0, 
                    'YXZ'
                );
                
                console.log("Camera attached to car with consistent position behind car");
            }
            
            // Store fixed camera values to enforce consistently
            car.userData._cameraPosition = new Vector3(0, 0, -15);
            car.userData._cameraRotation = new Euler(
                this.cameraRotation.pitch, 
                Math.PI,  // Always face forward from behind
                0,
                'YXZ'
            );
            
            // Mark as set up
            car.userData._needsCameraSetup = false;
            
            return true;
        } catch (e) {
            console.error("Error setting up car camera:", e);
            return false;
        }
    }
    
    // IMPROVED: Update method with camera rotation handling
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
        
        // IMPROVED: Update camera rotation from input
        this.updateCameraRotation(car);
        
        // CRITICAL FIX: Car movement is now FULLY handled here, not in VehicleManager
        this.handleCarMovement(car, 1/60);
        
        // FIXED: Camera verification and repair
        this.verifyCarCamera(car);
        
        return null;
    }
    
    // NEW: Handle camera rotation similar to FPS controller
    static updateCameraRotation(car) {
        if (!this.input.rotation || !car) return;
        
        // Update camera rotation based on input (similar to FPS controller)
        this.cameraRotation.yaw += this.input.rotation.x * this.ROTATION_SPEED;
        this.cameraRotation.pitch += this.input.rotation.y * this.ROTATION_SPEED;
        
        // Clamp vertical look to reasonable angles
        this.cameraRotation.pitch = Math.max(
            this.MIN_PITCH, 
            Math.min(this.MAX_PITCH, this.cameraRotation.pitch)
        );
        
        // Apply rotation to camera if properly set up
        if (Engine.camera && Engine.camera.parent) {
            // Apply rotation in YXZ order (same as FPS controller)
            Engine.camera.rotation.set(
                this.cameraRotation.pitch,
                this.cameraRotation.yaw,
                0,
                'YXZ'
            );
        }
    }
    
    // FIXED: Camera verification that maintains consistent orientation
    static verifyCarCamera(car) {
        if (!car || !Engine.camera) return;
        
        try {
            // If camera needs setup, try again
            if (car.userData._needsCameraSetup) {
                this.setupCarCamera(car);
                return;
            }
            
            // Check if camera is properly attached (either to mount or car)
            const validParent = Engine.camera.parent === car.userData.cameraMount || 
                              Engine.camera.parent === car;
                              
            if (!validParent) {
                console.log("Camera detached from car - reattaching");
                car.userData._needsCameraSetup = true;
                return;
            }
            
            // CRITICAL FIX: ALWAYS ensure camera is behind car with correct orientation
            // regardless of car movement direction
            if (Engine.camera.parent === car || Engine.camera.parent === car.userData.cameraMount) {
                // FIXED: Position should be behind car (negative Z)
                const baseZ = -15;  // Negative Z is behind car
                const baseY = 0;
                
                // Force position and rotation for consistency
                Engine.camera.position.set(0, baseY, baseZ);
                Engine.camera.rotation.set(this.cameraRotation.pitch, Math.PI, 0, 'YXZ');
            }
        } catch (e) {
            console.error("Error verifying car camera:", e);
        }
    }
    
    // CRITICAL FIX: Fix wheel rotation for proper axis alignment
    // FIXED: Ensure movement is only processed for the current vehicle
    static handleCarMovement(car, deltaTime) {
        // CRITICAL FIX: Triple-check this is the current vehicle and ONLY vehicle being controlled
        if (car !== VehicleManager.currentVehicle) {
            console.error("Attempted to control a car that isn't the current vehicle!");
            return;
        }
        
        if (!car.userData.isOccupied) {
            console.warn("CarController.handleCarMovement called on unoccupied vehicle");
            return;
        }
        
        // CRITICAL FIX: Check EVERY frame for control conflicts across vehicles
        let controlConflicts = 0;
        for (const vehicle of VehicleManager.vehicles) {
            if (!vehicle || vehicle === car) continue;
            
            if (vehicle.userData && (vehicle.userData.isOccupied || vehicle.userData.hasPlayerInside)) {
                console.error(`Control conflict detected: Vehicle ${vehicle.userData.name} is incorrectly marked as occupied`);
                // Fix the issue
                vehicle.userData.isOccupied = false;
                vehicle.userData.hasPlayerInside = false;
                vehicle.userData.player = null;
                controlConflicts++;
            }
            
            // Check for non-zero speed which would indicate ghost movement
            if (vehicle.userData && vehicle.userData.speed && Math.abs(vehicle.userData.speed) > 0.01) {
                console.warn(`Vehicle ${vehicle.userData.name} has non-zero speed (${vehicle.userData.speed.toFixed(2)}) but shouldn't be moving`);
                vehicle.userData.speed = 0;
            }
        }
        
        if (controlConflicts > 0) {
            console.error(`Fixed ${controlConflicts} vehicle control conflicts`);
        }
        
        // CRITICAL FIX: Always clean up vehicle array each update
        // Using splice inside forEach causes issues, so validate first
        VehicleManager.validateVehicles();
        
        // ENHANCED: Mark this car as the only one being actively controlled
        car.userData.isActivelyControlled = true;
        
        // Make sure other vehicles are completely still and not controlled
        for (const vehicle of VehicleManager.vehicles) {
            if (vehicle && vehicle !== car) {
                // FIXED: Mark as inactive to ensure no cross-vehicle interaction
                vehicle.userData.isActivelyControlled = false;
                
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                if ('speed' in vehicle.userData) {
                    vehicle.userData.speed = 0;
                }
                
                // FIXED: Each vehicle needs its own separate wheel state
                if (vehicle.userData.wheels && vehicle.userData._wheelData !== car.userData._wheelData) {
                    // Don't reset existing wheel rotations, just prevent changes
                    vehicle.userData.wheelSteerAngle = 0;
                }
            }
        }
        
        // Get input values for acceleration and steering
        // FIXED: Fix inverted movement - positive Z is now forward (matches expected behavior)
        const accelerationInput = this.input.movement.z; 
        
        // FIXED: Use direct input.x without negation (D = right/positive, A = left/negative)
        const steeringInput = this.input.movement.x; // Direct mapping for correct left/right control
        
        // FIXED: Store steering input in this car's userData only
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
        
        // CRITICAL FIX: Apply steering with consistent direction regardless of forward/reverse
        if (Math.abs(car.userData.speed) > 0.5) {
            // FIXED: Keep track of current wheel steering angle
            car.userData.wheelSteerAngle = car.userData.wheelSteerAngle || 0;
            
            // Calculate target wheel angle based on current steering input
            const maxWheelTurn = Math.PI / 4; // 45 degrees max turn
            const targetWheelAngle = steeringInput * maxWheelTurn;
            
            // FIXED: Smoothly interpolate to target angle
            const steerSpeed = 5.0 * deltaTime; // Adjust for desired responsiveness
            car.userData.wheelSteerAngle += (targetWheelAngle - car.userData.wheelSteerAngle) * steerSpeed;
            
            // Apply steering to car movement - consistent direction regardless of reverse/forward
            const steeringStrength = 30; // Strong steering for responsive feel
            const reverseFactor = car.userData.speed < 0 ? -1 : 1; // Reverse steering when backing up
            const speedFactor = Math.min(1.0, Math.abs(car.userData.speed) / 10);
            
            // FIXED: Fix steering direction by removing the negation
            // This aligns the steering direction with the WASD input expectations
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
        
        // CRITICAL FIX: Store wheel data uniquely for this car
        if (!car.userData._wheelData) {
            car.userData._wheelData = {
                rollAngle: 0,
                steerAngle: 0,
                lastUpdateTime: Date.now()
            };
        }
        
        // FIXED: Fix wheel animation to use consistent axes for all wheels
        // Apply wheel roll animation - track cumulative rotation angle
        if (car.userData.wheels) {
            // FIXED: Track wheel rotation in car's own userData
            if (!car.userData.wheelRollAngle) {
                car.userData.wheelRollAngle = 0;
            }
            
            // Update wheel roll angle based on speed
            const wheelRadius = 1.5; // Match the cylinder radius from vehicle creation
            const wheelCircumference = 2 * Math.PI * wheelRadius;
            const distanceTraveled = car.userData.speed * deltaTime;
            const rotationIncrement = (distanceTraveled / wheelCircumference) * 2 * Math.PI;
            car.userData.wheelRollAngle += rotationIncrement;
            
            // Apply steering to front wheels only
            const steeringAngle = car.userData.wheelSteerAngle || 0;
            
            // CRITICAL FIX: Use the correct rotation axes for all wheels - FOR THIS CAR ONLY
            this.updateCarWheels(car, car.userData.wheelRollAngle, steeringAngle);
        }
        
        // CRITICAL FIX: No directional-dependent camera changes whatsoever
        // Simply ensure fixed camera with each frame
        this.verifyCarCamera(car);
        
        // Apply movement to position
        if (Math.abs(car.userData.speed) > 0.01) {
            // FIXED: Ensure car moves in the correct direction
            // Negative Z is forward in the car's coordinate system
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
    
    // NEW: Helper method to update only the current car's wheels
    static updateCarWheels(car, rollAngle, steerAngle) {
        if (!car || !car.userData.wheels) return;
        
        // Mark these wheels as actively controlled by this controller
        car.userData.wheelsActive = true;
        
        // The wheels all start with z=Math.PI/2 to be flat - we rotate on x-axis for rolling
        if (car.userData.wheels.frontLeft) {
            car.userData.wheels.frontLeft.rotation.x = rollAngle;
            car.userData.wheels.frontLeft.rotation.y = steerAngle;
            car.userData.wheels.frontLeft.rotation.z = Math.PI/2; // Keep wheels flat
        }
        
        if (car.userData.wheels.frontRight) {
            car.userData.wheels.frontRight.rotation.x = rollAngle;
            car.userData.wheels.frontRight.rotation.y = steerAngle;
            car.userData.wheels.frontRight.rotation.z = Math.PI/2; // Keep wheels flat
        }
        
        // Back wheels should only roll, not steer
        if (car.userData.wheels.rearLeft) {
            car.userData.wheels.rearLeft.rotation.x = rollAngle;
            car.userData.wheels.rearLeft.rotation.y = 0; // No steering
            car.userData.wheels.rearLeft.rotation.z = Math.PI/2; // Keep wheels flat
        }
        
        if (car.userData.wheels.rearRight) {
            car.userData.wheels.rearRight.rotation.x = rollAngle;
            car.userData.wheels.rearRight.rotation.y = 0; // No steering
            car.userData.wheels.rearRight.rotation.z = Math.PI/2; // Keep wheels flat
        }
    }
    
    // IMPROVED: More thorough cleanup that preserves rotation state
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        // Save camera world position before detaching
        const worldPos = new Vector3();
        if (Engine.camera) {
            if (Engine.camera.parent) {
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
            }
            
            // Add to scene at proper world position
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
            
            // Reset camera properties - but don't reset rotation as that will be handled by next controller
            Engine.camera.layers.set(0);
            Engine.camera.zoom = 1;
            Engine.camera.fov = 75;
            Engine.camera.updateProjectionMatrix();
        }
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        console.log('Car Controller cleanup complete');
    }
}
