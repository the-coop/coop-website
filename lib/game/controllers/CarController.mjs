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
    
    // Camera setup state tracking to prevent redundant setups
    static cameraState = {
        isSetup: false,
        lastSetupTime: 0,
        setupCount: 0,
        verifyCount: 0,
        lastVerifyTime: 0,
        exclusiveControl: true,
        updateInterval: 16,
        lastUpdateTime: 0,
        smoothPosition: null,
        smoothUpVector: null,
        transitionSpeed: 0.05,
        referenceFrame: null,
        lastCarPosition: null,
        // Add fields to track steering
        steeringAngle: 0,
        maxSteeringAngle: 0.4  // About 23 degrees
    };

    // IMPROVED: Reset with better handling for camera stability
    static reset() {
        console.log('Initializing Car Controller with improved camera control');
        
        // CRITICAL FIX: Use VehicleManager.currentVehicle to get the car
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
            // CRITICAL FIX: Reset camera rotation state to prevent carry-over issues
            this.cameraRotation = {
                yaw: Math.PI,  // Reset to default position behind car
                pitch: 0.2     // Slight downward tilt
            };
            
            // CRITICAL FIX: Reset camera setup state
            this.cameraState.isSetup = false;
            this.cameraState.lastSetupTime = 0;
            this.cameraState.setupCount = 0;
            this.cameraState.smoothPosition = null;
            this.cameraState.smoothUpVector = null;
            this.cameraState.lastUpdateTime = 0;
            this.cameraState.lastCarPosition = null;
            // Reset steering state
            this.cameraState.steeringAngle = 0;
            
            // NEW: Check if this is a vehicle transition
            const isVehicleTransition = this.input && this.input._isVehicleTransition;
            if (isVehicleTransition) {
                console.log('Detected vehicle transition - using smooth camera setup');
                // Clear the flag
                this.input._isVehicleTransition = false;
            }
            
            // Setup the camera with proper planet surface alignment - ONLY ONCE
            this.setupCarCamera(car, true);  // Force initial setup
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // CRITICAL FIX: Store that this car is actively controlled
            car.userData.isActivelyControlled = true;
            
            // CRITICAL FIX: Initialize steering in userData
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            console.log('Car Controller initialized successfully');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // IMPROVED: Camera setup with better stability and surface normal handling
    static setupCarCamera(car, forceSetup = false) {
        if (!car || !Engine.camera) {
            console.error('Missing car or camera for setupCarCamera');
            return false;
        }
        
        try {
            // CRITICAL FIX: Implement strict rate limiting to prevent infinite setups
            const now = Date.now();
            
            // Reset counter if a second has passed
            if (now - this.cameraState.setupCounterResetTime >= 1000) {
                this.cameraState.setupsThisSecond = 0;
                this.cameraState.setupCounterResetTime = now;
            }
            
            // Check if we're exceeding the maximum setup frequency
            if (!forceSetup && this.cameraState.isSetup && 
                this.cameraState.setupsThisSecond >= this.cameraState.maxSetupFrequency) {
                // Too many setups - skip this one
                return true;
            }
            
            // Check for minimum time between setups
            if (!forceSetup && this.cameraState.isSetup && 
                now - this.cameraState.lastSetupTime < 300) { // 300ms minimum between setups
                return true;
            }
            
            // Get surface normal from the car
            let surfaceNormal;
            if (car.userData?.surfaceNormal) {
                surfaceNormal = car.userData.surfaceNormal;
            } else if (car.userData?.planet) {
                // Calculate surface normal based on planet position
                const planet = car.userData.planet;
                surfaceNormal = car.position.clone().sub(planet.object.position).normalize();
                car.userData.surfaceNormal = surfaceNormal; // Store for future use
            } else {
                // Default to world up if no planet info available
                surfaceNormal = new Vector3(0, 1, 0);
            }
            
            // CRITICAL FIX: Use the surface normal for camera UP vector
            Engine.camera.up.copy(surfaceNormal);
            
            // CRITICAL FIX: Detach camera properly
            if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // IMPROVED: Create a fixed reference frame for stable camera behavior
            this.cameraState.referenceFrame = {
                position: car.position.clone(),
                quaternion: car.quaternion.clone(),
                up: surfaceNormal.clone()
            };
            
            // Calculate camera position using the reference frame
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const backwardDir = forwardDir.clone().negate();
            const upDir = surfaceNormal.clone();
            
            // Create stable camera position
            const cameraPos = car.position.clone();
            cameraPos.addScaledVector(backwardDir, this.cameraDistance); // Move back
            cameraPos.addScaledVector(upDir, this.cameraHeight);         // Move up
            
            // Initialize smooth tracking parameters
            this.cameraState.smoothPosition = cameraPos.clone();
            this.cameraState.smoothUpVector = surfaceNormal.clone();
            this.cameraState.lastCarPosition = car.position.clone();
            
            // Set camera position - direct position on first setup
            if (forceSetup || !this.cameraState.isSetup) {
                Engine.camera.position.copy(cameraPos);
            } else {
                // Use smooth transition for subsequent updates
                Engine.camera.position.lerp(cameraPos, 0.2);
            }
            
            // Make camera look at position ahead of car
            const lookTarget = car.position.clone().addScaledVector(
                forwardDir, // Look ahead
                this.cameraLookOffset
            );
            
            Engine.camera.lookAt(lookTarget);
            
            // Store setup state
            this.cameraState.isSetup = true;
            this.cameraState.lastSetupTime = now;
            this.cameraState.setupCount++;
            this.cameraState.setupsThisSecond++;
            
            // Log only the first setup to prevent console spam
            if (this.cameraState.setupCount === 1) {
                console.log('Car camera setup complete with surface normal alignment');
            }
            
            return true;
        } catch (e) {
            console.error('Error in setupCarCamera:', e);
            return false;
        }
    }
    
    // ENHANCED: Update method with improved camera stability and exit handling
    static update() {
        // CRITICAL FIX: Always get the car from VehicleManager.currentVehicle
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available in update');
            return null;
        }
        
        // CRITICAL FIX: More responsive exit detection
        if (this.input.exit || this.input.action) {
            console.log("Exit requested from CarController - action:", this.input.action, "exit:", this.input.exit);
            // Reset flags immediately to prevent accidental re-triggering
            this.input.exit = false;
            this.input.action = false;
            
            // Signal exit to ControlManager
            return 'exit';
        }
        
        // Check for 'E' key directly for redundant exit path
        if (Engine && Engine.keyStates && (Engine.keyStates['KeyE'] || Engine.keyStates['e'])) {
            console.log("E key pressed directly in CarController");
            // Clear the key state immediately
            Engine.keyStates['KeyE'] = false;
            Engine.keyStates['e'] = false;
            return 'exit';
        }
        
        try {
            // Process camera rotation from input
            this.updateCameraRotation(car);
            
            // Rate-limited camera updates to prevent jitter
            const now = Date.now();
            const timeSinceLastUpdate = now - this.cameraState.lastUpdateTime;
            
            if (timeSinceLastUpdate >= this.cameraState.updateInterval) {
                this.updateCameraPosition(car);
                this.cameraState.lastUpdateTime = now;
            }
            
            // Process movement
            const deltaTime = 1/60;
            this.handleCarMovement(car, deltaTime);
            
            // Reset input for next frame - ONLY RESET ROTATION, NOT MOVEMENT
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // IMPROVED: Handle car movement with separate wheel steering and body rotation
    static handleCarMovement(car, deltaTime) {
        // Get input from the standardized input object
        const moveZ = this.input.movement.z; // Forward/backward
        const moveX = this.input.movement.x; // Left/right turning

        // Update car steering and acceleration
        if (moveZ > 0) {
            // Accelerate forward
            car.userData.acceleration += 0.05;
        } else if (moveZ < 0) {
            // Brake/reverse
            car.userData.acceleration -= 0.1;
        } else {
            // Gradual deceleration when no input
            car.userData.acceleration *= 0.95;
        }

        // Clamp acceleration to reasonable values
        car.userData.acceleration = Math.max(-0.5, Math.min(0.5, car.userData.acceleration));
        
        // Update speed based on acceleration
        car.userData.speed += car.userData.acceleration;
        
        // Apply drag
        car.userData.speed *= (1 - car.userData.drag);
        
        // Clamp speed
        car.userData.speed = Math.max(-car.userData.maxSpeed/2, 
                                     Math.min(car.userData.maxSpeed, car.userData.speed));
        
        // CRITICAL FIX: Handle steering input separately from car body rotation
        if (moveX !== 0) {
            // Update steering angle gradually
            const steeringRate = 0.05; // How quickly steering responds
            this.cameraState.steeringAngle += moveX * steeringRate;
            
            // Clamp steering angle to maximum
            this.cameraState.steeringAngle = Math.max(
                -this.cameraState.maxSteeringAngle,
                Math.min(this.cameraState.maxSteeringAngle, this.cameraState.steeringAngle)
            );
            
            // Store steering input for wheel animation
            car.userData.steeringInput = moveX;
            car.userData.steeringAngle = this.cameraState.steeringAngle;
        } else {
            // Return steering to center gradually when no input
            if (Math.abs(this.cameraState.steeringAngle) > 0.01) {
                this.cameraState.steeringAngle *= 0.9; // Gradual return to center
            } else {
                this.cameraState.steeringAngle = 0;
            }
            
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = this.cameraState.steeringAngle;
        }
        
        // Only rotate car body when actually moving
        if (Math.abs(car.userData.speed) > 0.1) {
            // Convert steering angle to body rotation based on speed
            const turnFactor = 0.015 * Math.min(1, Math.abs(car.userData.speed) / 10);
            car.rotation.y += this.cameraState.steeringAngle * turnFactor;
        }
        
        // Apply wheel rotations for visual effect - call VehicleManager helper
        if (window.VehicleManager && typeof window.VehicleManager.resetWheelsBaseOrientation === 'function') {
            window.VehicleManager.resetWheelsBaseOrientation(car);
        }
        
        // Calculate velocity vector from speed and orientation
        const direction = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
        car.userData.velocity.copy(direction.multiplyScalar(car.userData.speed));
    }
    
    // ENHANCED: More thorough cleanup
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Release exclusive camera control
            this.cameraState.exclusiveControl = false;
            
            // Clear camera smoothing state
            this.cameraState.smoothPosition = null;
            this.cameraState.smoothUpVector = null;
            this.cameraState.referenceFrame = null;
            this.cameraState.lastCarPosition = null;
            
            // Save the surface normal for the next controller
            if (car.userData?.surfaceNormal) {
                window.lastSurfaceNormal = car.userData.surfaceNormal.clone();
                console.log("Stored surface normal for next controller");
            }
            
            // CRITICAL FIX: Reset steering state
            this.cameraState.steeringAngle = 0;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            // CRITICAL FIX: Mark the car as no longer actively controlled
            car.userData.isActivelyControlled = false;
            
            console.log('CarController cleanup complete');
        } catch (e) {
            console.error('Error in CarController cleanup:', e);
        }
    }
    
    // IMPROVED: Handle camera rotation with less jitter
    static updateCameraRotation(car) {
        // Apply mouse/joystick input with dampening
        const rotationDampening = 0.5;
        
        this.cameraRotation.yaw += this.input.rotation.x * rotationDampening;
        this.cameraRotation.pitch = Math.max(
            this.MIN_PITCH,
            Math.min(this.MAX_PITCH, this.cameraRotation.pitch + this.input.rotation.y * rotationDampening)
        );
    }
    
    // IMPROVED: Camera positioning with double-smoothing for stability
    static updateCameraPosition(car, forceUpdate = false) {
        if (!car || !Engine.camera) return;
        
        try {
            // Skip camera updates for falling vehicles
            if (car.userData?.falling && !forceUpdate) return;
            
            // Get surface normal
            let surfaceNormal;
            if (car.userData?.surfaceNormal) {
                surfaceNormal = car.userData.surfaceNormal;
            } else if (car.userData?.planet) {
                const planet = car.userData.planet;
                surfaceNormal = car.position.clone().sub(planet.object.position).normalize();
                car.userData.surfaceNormal = surfaceNormal;
            } else {
                surfaceNormal = new Vector3(0, 1, 0);
            }
            
            // Set camera up vector to surface normal
            Engine.camera.up.copy(surfaceNormal);
            
            // SIMPLIFIED: Calculate desired camera position directly behind car
            // This simplified logic reduces the chance of conflicting transformations
            const carBackward = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            
            // Apply camera yaw rotation around surface normal
            const yawQuat = new Quaternion().setFromAxisAngle(surfaceNormal, this.cameraRotation.yaw);
            const rotatedOffset = carBackward.clone().applyQuaternion(yawQuat).multiplyScalar(this.cameraDistance);
            
            // Calculate final camera position with height offset
            const targetPosition = car.position.clone()
                .add(rotatedOffset)
                .addScaledVector(surfaceNormal, this.cameraHeight);
            
            // CRITICAL FIX: Use consistent, slow lerping for stability
            const lerpFactor = forceUpdate ? 1.0 : 0.05;  // Much slower lerp for stability
            Engine.camera.position.lerp(targetPosition, lerpFactor);
            
            // SIMPLIFIED: Calculate look target with minimal complexity
            const lookTarget = car.position.clone().addScaledVector(
                carBackward.clone().negate(), // Look ahead of car
                this.cameraLookOffset
            );
            
            // Looking at target using Three.js built-in method
            Engine.camera.lookAt(lookTarget);
        } catch (e) {
            console.error('Error in updateCameraPosition:', e);
        }
    }
    
    // SIMPLIFIED: Update camera orientation with minimal logic for stability
    static updateCameraOrientation(car) {
        if (!car || !Engine.camera) return;
        
        // Get surface normal
        const surfaceNormal = car.userData?.surfaceNormal || new Vector3(0, 1, 0);
        
        // Ensure camera up vector is aligned with surface normal
        Engine.camera.up.copy(surfaceNormal);
    }
    
    // Handle car movement logic
    static handleCarMovement(car, deltaTime) {
        // CRITICAL FIX: Triple-check this is the current vehicle and ONLY vehicle being controlled
        if (car !== VehicleManager.currentVehicle) {
            console.warn("Car is not the current vehicle - skipping movement handling");
            return;
        }
        
        if (!car.userData.isOccupied) {
            console.warn("Car is not occupied - skipping movement handling");
            return;
        }
        
        // CRITICAL FIX: Check EVERY frame for control conflicts across vehicles
        let controlConflicts = 0;
        for (const vehicle of VehicleManager.vehicles) {
            if (vehicle !== car && vehicle.userData.isActivelyControlled) {
                controlConflicts++;
            }
        }
        
        if (controlConflicts > 0) {
            console.warn(`Found ${controlConflicts} other vehicles with active control - resolving conflicts`);
            
            // Clear control flags on all other vehicles
            for (const vehicle of VehicleManager.vehicles) {
                if (vehicle !== car) {
                    vehicle.userData.isActivelyControlled = false;
                }
            }
        }
        
        // CRITICAL FIX: Always clean up vehicle array each update
        VehicleManager.validateVehicles();
        
        // ENHANCED: Mark this car as the only one being actively controlled
        car.userData.isActivelyControlled = true;
        
        // ADDED: Ensure car is fully grounded after landing
        if (car.userData.justLanded || car.userData._needsGroundAdhesion) {
            this.ensureCarIsGrounded(car);
        }
        
        // Make sure other vehicles are completely still and not controlled
        for (const vehicle of VehicleManager.vehicles) {
            if (vehicle !== car && vehicle.userData) {
                vehicle.userData.isActivelyControlled = false;
            }
        }
        
        // Get input values for acceleration and steering
        const accelerationInput = this.input.movement.z; 
        
        // FIX: Negate the steering input to correct direction (A = left, D = right)
        const steeringInput = -this.input.movement.x;
        
        // Store steering input in car's userData
        car.userData.steeringInput = steeringInput;
        
        // ADDED: Apply steering to wheels for visual feedback
        this.updateSteeringWheels(car, steeringInput);
        
        // CRITICAL FIX: Disable collision with player while driving
        if (PlayersManager.self && PlayersManager.self.handle) {
            car._ignoreCollisionWith = PlayersManager.self.handle;
            PlayersManager.self.handle._ignoreCollisionWith = car;
        }
        
        // FIXED: Check if camera needs repositioning (much less frequently)
        if (!this.cameraState.isSetup || 
            !Engine.camera.parent || 
            Engine.camera.parent !== car) {
            this.setupCarCamera(car);
        }
        
        // ADDED: Apply rolling friction when car is grounded
        if (!car.userData.falling && car.userData.speed) {
            // Apply slightly stronger rolling friction when not accelerating/braking
            if (Math.abs(accelerationInput) < 0.1) {
                car.userData.speed *= 0.97; // Stronger deceleration when coasting
            }
        }
    }
    
    // NEW: Helper method to ensure car is fully grounded after landing
    static ensureCarIsGrounded(car) {
        if (!car || !car.userData || !car.userData.planet) return;
        
        try {
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            // Get current distance from planet center
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            
            // Calculate ideal distance (planet radius + vehicle height offset)
            const idealDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            
            // If car is too far from surface, pull it down
            if (currentDistance > idealDistance + 0.1) {
                const correctionFactor = 0.3; // More aggressive correction for player-driven car
                const newDistance = idealDistance + 
                                   (currentDistance - idealDistance) * (1 - correctionFactor);
                
                const newPosition = toVehicle.normalize().multiplyScalar(newDistance);
                car.position.copy(planetCenter).add(newPosition);
                
                // 3. Apply smoothing to camera position
                if (!this.cameraState.smoothPosition) {
                    this.cameraState.smoothPosition = targetPosition.clone();
                } else {
                    const distance = this.cameraState.smoothPosition.distanceTo(targetPosition);
                    const smoothFactor = Math.min(0.05 + (distance * 0.01), 0.25);
                    this.cameraState.smoothPosition.lerp(targetPosition, forceUpdate ? 1.0 : smoothFactor);
                }
                
                // 4. Apply smooth up vector transition
                if (!this.cameraState.smoothUpVector) {
                    this.cameraState.smoothUpVector = refUp.clone();
                } else {
                    this.cameraState.smoothUpVector.lerp(refUp, forceUpdate ? 1.0 : 0.05);
                }
                
                // 5. Set camera position and up vector
                Engine.camera.position.copy(this.cameraState.smoothPosition);
                Engine.camera.up.copy(this.cameraState.smoothUpVector);
                
                // 6. Calculate look target
                const lookOffset = refForward.clone().negate().multiplyScalar(this.cameraLookOffset);
                const lookTarget = car.position.clone().add(lookOffset);
                
                // Look at target
                Engine.camera.lookAt(lookTarget);
            }
        } catch (e) {
            console.error('Error in updateCameraPosition:', e);
        }
    }
}
