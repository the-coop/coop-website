// Controller specifically for car vehicle operation - SIMPLIFIED VERSION
import { Vector3, Quaternion } from 'three';
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
    
    // Fixed tracking state to prevent redundant setup
    static cameraSetup = false;
    
    // IMPROVED: Unified reset method that directly positions camera
    static reset() {
        console.log('Initializing Car Controller with improved camera control');
        
        // CRITICAL FIX: Always get car from VehicleManager
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        // Check if we have a car vehicle type
        if (car.userData?.type !== 'car') {
            console.warn(`Vehicle is not a car, it's a ${car.userData?.type}`);
        }
        
        try {
            // Reset camera rotation state to default
            this.cameraRotation = {
                yaw: Math.PI,  // Behind car
                pitch: 0.2     // Slight downward tilt
            };
            
            // Reset steering state
            this.steeringAngle = 0;
            this.maxSteeringAngle = 0.4; // About 23 degrees
            
            // Reset camera setup flag
            this.cameraSetup = false;
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Mark car as actively controlled
            car.userData.isActivelyControlled = true;
            
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
                car.userData.surfaceNormal = surfaceNormal; // Store for future use
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
            this.cameraSetup = true;
            
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

    // IMPROVED: Handle car movement with proper wheel steering
    static handleCarMovement(car) {
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
        
        // CRITICAL FIX: Handle steering - update both steeringInput and steeringAngle
        if (moveX !== 0) {
            // Update steering angle gradually
            this.steeringAngle = Math.max(
                -this.maxSteeringAngle,
                Math.min(this.maxSteeringAngle, this.steeringAngle + (moveX * 0.05))
            );
            
            // Store steering values in car's userData for wheel animation
            car.userData.steeringInput = moveX;
            car.userData.steeringAngle = this.steeringAngle;
            
            // Only rotate car body when actually moving to simulate real car steering
            if (Math.abs(car.userData.speed) > 0.1) {
                const turnFactor = 0.015 * Math.min(1, Math.abs(car.userData.speed) / 10);
                car.rotation.y += this.steeringAngle * turnFactor;
            }
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
        
        // Apply wheel rotations based on stored steering angle
        if (VehicleManager.resetWheelsBaseOrientation) {
            VehicleManager.resetWheelsBaseOrientation(car);
        }
        
        // Calculate velocity vector from speed and orientation
        const direction = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
        car.userData.velocity.copy(direction.multiplyScalar(car.userData.speed));
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
            targetPos.addScaledVector(backwardDir, this.cameraDistance);
            targetPos.addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Smoothly move camera to target position
            Engine.camera.position.lerp(targetPos, 0.1);
            
            // Make camera look at car
            const lookTarget = car.position.clone().addScaledVector(
                forwardDir,
                this.cameraLookOffset
            );
            
            Engine.camera.lookAt(lookTarget);
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
            this.cameraSetup = false;
            
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
