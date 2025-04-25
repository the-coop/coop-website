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
    static cameraHeight = 4;    // Lowered height above car for better perspective (was 8)
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
                
                // Reset camera mount position - LOWERED from 7 to 3
                car.userData.cameraMount.position.set(0, 3, 0);
                
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
        const accelerationInput = this.input.movement.z; 
        
        // FIX: Negate the steering input to correct direction (A = left, D = right)
        const steeringInput = -this.input.movement.x;  // Add negative sign
        
        // Store steering input in car's userData
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
            // Apply drag when no input - ENHANCED to include steering drag
            const baseDrag = 0.99;
            
            // ENHANCED: Calculate additional drag from steering when not accelerating
            const steeringMagnitude = Math.abs(steeringInput);
            const steeringDrag = steeringMagnitude * 0.04; // Lose up to 4% additional speed per frame when turning
            
            // Apply combined drag factors - more drag when turning
            car.userData.speed *= baseDrag - steeringDrag;
            
            // Stop car when very slow
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
        
        // IMPROVED: Realistic car steering with much wider turning radius
        // Always update the visual wheel steering regardless of car movement
        car.userData.wheelSteerAngle = car.userData.wheelSteerAngle || 0;
        
        // IMPROVED: Significantly reduce maximum wheel angle for more realistic turning radius
        const maxWheelTurn = Math.PI / 12; // 15 degrees max turn (down from 45 degrees)
        const targetWheelAngle = steeringInput * maxWheelTurn;
        
        // IMPROVED: Much smoother steering interpolation for natural feeling
        const steerSpeed = 2.5 * deltaTime; // Slower interpolation for smoother steering
        car.userData.wheelSteerAngle += (targetWheelAngle - car.userData.wheelSteerAngle) * steerSpeed;
        
        // Only turn the car when it's actually moving
        if (Math.abs(car.userData.speed) > 0.5) {
            // IMPROVED: Calculate proper turning radius based on modified wheel geometry
            // Car dimensions (approximated based on typical sedan proportions)
            const wheelBase = 10; // Increased from 6 for much wider turning radius
            const track = 6;     // Distance between left and right wheels
            
            // Calculate turning radius based on wheel angle (Ackermann steering principle)
            const steeringAngle = car.userData.wheelSteerAngle;
            const minTurningRadius = (wheelBase / Math.tan(Math.abs(steeringAngle) + 0.001)) * 2.0; // Double the radius
            
            // IMPROVED: Enhanced understeer at higher speeds for more stable driving
            const speedRatio = Math.abs(car.userData.speed) / car.userData.maxSpeed;
            const understeerFactor = 1.0 + (speedRatio * speedRatio * 2.0); // Stronger quadratic understeer
            const effectiveTurningRadius = minTurningRadius * understeerFactor;
            
            // Calculate angular velocity based on speed and turning radius
            const angularVelocity = (Math.abs(car.userData.speed) / effectiveTurningRadius) * Math.sign(steeringAngle);
            
            // Keep consistent reverse steering behavior 
            const reverseFactor = car.userData.speed < 0 ? -1 : 1;
            
            // IMPROVED: Smoother turn amount calculation
            const turnAmount = angularVelocity * reverseFactor * deltaTime * 0.8; // Reduced turn rate
            
            // Apply the rotation to the car
            if (car.userData.planet) {
                const planetCenter = car.userData.planet.object.position;
                const toVehicle = car.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                
                const rotationMatrix = new Matrix4().makeRotationAxis(surfaceNormal, turnAmount);
                car.quaternion.premultiply(new Quaternion().setFromRotationMatrix(rotationMatrix));
                
                // IMPROVED: Very gradual surface alignment for smoother movement
                VehicleManager.alignVehicleToPlanetSurface(car, surfaceNormal, 0.15);
            } else {
                car.rotateY(turnAmount);
            }
            
            // NEW: Apply additional speed loss when turning sharply
            if (Math.abs(steeringAngle) > 0.05) {
                const turnFriction = 0.98 + (Math.abs(steeringAngle) * 0.05); // More steering = more friction
                car.userData.speed *= (1.0 - (1.0 - turnFriction) * deltaTime * 4.0);
            }
        } else {
            // Car isn't moving fast enough to turn, but we still show wheel turning
            if (Math.abs(car.userData.wheelSteerAngle) > 0.01) {
                console.log(`🚗 Car too slow to turn, but wheels visually turned to ${car.userData.wheelSteerAngle.toFixed(2)}`);
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
        
        // Apply movement to position - adjusted for turning radius
        if (Math.abs(car.userData.speed) > 0.01) {
            // Get forward direction vector
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Set velocity based on current direction and speed
            car.userData.velocity = forwardDir.multiplyScalar(car.userData.speed);
            
            // Move the car along its current direction
            const positionDelta = car.userData.velocity.clone().multiplyScalar(deltaTime * 2.0);
            car.position.add(positionDelta);
            
            console.log(`🚗 Car moved by: ${positionDelta.length().toFixed(2)} units`);
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
        
        // IMPROVED: Limit visual wheel angle to prevent extreme angles
        const maxVisualAngle = Math.PI/6; // 30 degrees maximum visual turning
        const clampedSteerAngle = Math.max(-maxVisualAngle, Math.min(maxVisualAngle, steerAngle));
        
        // The wheels all start with z=Math.PI/2 to be flat - we rotate on x-axis for rolling
        if (car.userData.wheels.frontLeft) {
            car.userData.wheels.frontLeft.rotation.x = rollAngle;
            car.userData.wheels.frontLeft.rotation.y = clampedSteerAngle;
            car.userData.wheels.frontLeft.rotation.z = Math.PI/2; // Keep wheels flat
        }
        
        if (car.userData.wheels.frontRight) {
            car.userData.wheels.frontRight.rotation.x = rollAngle;
            car.userData.wheels.frontRight.rotation.y = clampedSteerAngle;
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
