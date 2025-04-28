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
        
        // CRITICAL FIX: Use VehicleManager.currentVehicle to get the car
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('CarController initialized with no current vehicle');
            return;
        }
        
        // Verify we have a car vehicle type
        if (car.userData?.type !== 'car') {
            console.error(`CarController initialized with non-car vehicle: ${car.userData?.type || 'unknown'}`);
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
    
    // ENHANCED: Update method with vehicle type validation and auto-recovery
    static update() {
        // CRITICAL FIX: Always get the car from VehicleManager.currentVehicle
        const car = VehicleManager.currentVehicle;
        
        // Enhanced validation with recovery options
        if (!car) {
            console.warn("Car controller update called with no currentVehicle in VehicleManager");
            return null;
        }
        
        // CRITICAL FIX: Check if it's actually a car type
        if (car.userData?.type !== 'car') {
            console.warn(`Car controller update called with non-car vehicle: ${car.userData?.type || 'unknown'}`);
            
            // Try to recover by finding a car vehicle
            let carVehicle = VehicleManager.vehicles.find(v => 
                v && v.userData && v.userData.type === 'car' && v.userData.isOccupied
            );
            
            if (carVehicle) {
                console.log("Found car vehicle - updating currentVehicle reference");
                VehicleManager.currentVehicle = carVehicle;
                return this.update(); // Try again with new reference
            }
            
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
    
    // FIXED: Handle car movement properly aligned to planet surface
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
        const steeringInput = -this.input.movement.x;
        
        // Store steering input in car's userData
        car.userData.steeringInput = steeringInput;
        
        // Debug active inputs
        if (Math.abs(accelerationInput) > 0.01 || Math.abs(steeringInput) > 0.01) {
            console.log(`🚗 Car inputs: accel=${accelerationInput.toFixed(2)}, steer=${steeringInput.toFixed(2)}`);
        }
        
        // CRITICAL FIX: Get planet information for planet-aligned movement
        if (!car.userData.planet) {
            // Try to find planet if missing
            car.userData.planet = Physics.calculateSOI(car.position);
            if (!car.userData.planet) {
                console.error("Car is missing planet reference - cannot drive properly");
                return;
            }
        }
        
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        
        // Get the surface normal at the car's position
        const toVehicle = car.position.clone().sub(planetCenter);
        const distanceToPlanet = toVehicle.length();
        const surfaceNormal = toVehicle.normalize();
        
        // Store the surface normal for other calculations
        car.userData.surfaceNormal = surfaceNormal;
        
        // Apply acceleration based on input
        if (Math.abs(accelerationInput) > 0.01) {
            // FIXED: Much more responsive acceleration
            const accelerationStrength = 200; // Reduced for better control
            const acceleration = accelerationInput * deltaTime * accelerationStrength;
            car.userData.speed += acceleration;
        } else {
            // Apply drag when no input - ENHANCED to include steering drag
            const baseDrag = 0.95; // Less aggressive drag (was 0.99)
            
            // Calculate additional drag from steering when not accelerating
            const steeringMagnitude = Math.abs(steeringInput);
            const steeringDrag = steeringMagnitude * 0.02; // Reduced steering drag
            
            // Apply combined drag factors - more drag when turning
            car.userData.speed *= baseDrag - steeringDrag;
            
            // Stop car when very slow
            if (Math.abs(car.userData.speed) < 0.05) {
                car.userData.speed = 0;
            }
        }
        
        // Apply speed limits
        const maxForwardSpeed = car.userData.maxSpeed || 20; // Reduced max speed
        const maxReverseSpeed = car.userData.maxSpeedReverse || 10;
        
        if (car.userData.speed > 0) {
            car.userData.speed = Math.min(maxForwardSpeed, car.userData.speed);
        } else {
            car.userData.speed = Math.max(-maxReverseSpeed, car.userData.speed);
        }
        
        // IMPROVED: Realistic car steering with much wider turning radius
        // Always update the visual wheel steering regardless of car movement
        car.userData.wheelSteerAngle = car.userData.wheelSteerAngle || 0;
        
        // IMPROVED: More responsive steering with reasonable turning radius
        const maxWheelTurn = Math.PI / 8; // 22.5 degrees max turn
        const targetWheelAngle = steeringInput * maxWheelTurn;
        
        // IMPROVED: Much smoother steering interpolation for natural feeling
        const steerSpeed = 5.0 * deltaTime; // Faster interpolation for responsive steering
        car.userData.wheelSteerAngle += (targetWheelAngle - car.userData.wheelSteerAngle) * steerSpeed;
        
        // Only turn the car when it's actually moving
        if (Math.abs(car.userData.speed) > 0.2) { // Lower threshold for turning
            // CRITICAL FIX: Apply rotation using planetary alignment
            // Calculate the up vector using the planet surface normal
            const upVector = surfaceNormal.clone();
            
            // Create a rotation axis perpendicular to up and forward vectors
            // This ensures we rotate around the surface normal
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const turnAxis = upVector.clone();
            
            // Calculate turning strength based on speed
            const turnStrength = 0.02; // Base turn rate
            const speedFactor = Math.min(1.0, Math.abs(car.userData.speed) / 10); // Cap at 1.0
            
            // Calculate turn amount based on steering, speed, and direction
            const direction = car.userData.speed > 0 ? 1 : -1;
            const turnAmount = -steeringInput * turnStrength * speedFactor * direction;
            
            if (Math.abs(turnAmount) > 0.001) {
                // Create rotation quaternion around the surface normal
                const rotateQuat = new Quaternion().setFromAxisAngle(turnAxis, turnAmount);
                
                // Apply the rotation
                car.quaternion.premultiply(rotateQuat);
                
                // CRITICAL FIX: Re-align car to planet surface after turning
                VehicleManager.alignVehicleToPlanetSurface(car, surfaceNormal, 0.1);
            }
            
            // NEW: Apply additional speed loss when turning sharply
            if (Math.abs(steeringInput) > 0.5) {
                const turnFriction = 1.0 - (Math.abs(steeringInput) * 0.1);
                car.userData.speed *= turnFriction;
            }
        }

        // FIXED: Update wheel animation properly
        if (car.userData.wheels) {
            // Update wheel roll angle based on speed
            if (!car.userData.wheelRollAngle) {
                car.userData.wheelRollAngle = 0;
            }
            
            // Calculate wheel rotation based on distance traveled
            const wheelRadius = 0.6; // Match the cylinder radius from creation
            const wheelCircumference = 2 * Math.PI * wheelRadius;
            const distanceTraveled = car.userData.speed * deltaTime;
            const rotationIncrement = (distanceTraveled / wheelCircumference) * 2 * Math.PI;
            car.userData.wheelRollAngle += rotationIncrement;
            
            // Apply steering to front wheels only
            const steeringAngle = car.userData.wheelSteerAngle || 0;
            
            this.updateCarWheels(car, car.userData.wheelRollAngle, steeringAngle);
        }
        
        // Apply movement to position tangent to planet surface
        if (Math.abs(car.userData.speed) > 0.01) {
            // Get forward direction vector tangential to planet surface
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project forward vector onto planet surface (tangent plane)
            const tangentForward = forwardDir.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Set velocity based on tangential direction and speed
            car.userData.velocity = tangentForward.multiplyScalar(car.userData.speed);
            
            // Move the car along the tangent plane
            const positionDelta = car.userData.velocity.clone().multiplyScalar(deltaTime);
            car.position.add(positionDelta);
            
            // CRITICAL FIX: Re-project position onto the planet surface
            // Ensure car stays at correct height above planet
            const newDistanceToPlanet = car.position.distanceTo(planetCenter);
            const correctDistance = planet.radius + (car.userData.fixedHeightOffset || 2.8);
            
            if (Math.abs(newDistanceToPlanet - correctDistance) > 0.1) {
                const newToVehicle = car.position.clone().sub(planetCenter).normalize();
                car.position.copy(planetCenter).addScaledVector(newToVehicle, correctDistance);
            }
        } else {
            car.userData.velocity.set(0, 0, 0);
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
        
        // FIXED: Negate steering angle to correct wheel turning direction
        // This ensures when turning right, wheels visually turn right
        const correctedSteerAngle = -clampedSteerAngle;
        
        // The wheels all start with z=Math.PI/2 to be flat - we rotate on x-axis for rolling
        if (car.userData.wheels.frontLeft) {
            car.userData.wheels.frontLeft.rotation.x = rollAngle;
            car.userData.wheels.frontLeft.rotation.y = correctedSteerAngle;
            car.userData.wheels.frontLeft.rotation.z = Math.PI/2; // Keep wheels flat
        }
        
        if (car.userData.wheels.frontRight) {
            car.userData.wheels.frontRight.rotation.x = rollAngle;
            car.userData.wheels.frontRight.rotation.y = correctedSteerAngle;
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
