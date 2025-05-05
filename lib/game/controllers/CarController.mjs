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
    static cameraDistance = 15; // Distance behind car for better visibility
    static cameraHeight = 5;    // Height above car for better perspective
    static cameraLookOffset = 3; // Look ahead of car
    
    // Camera state to track accumulated rotation
    static cameraRotation = {
        yaw: Math.PI,  // Default facing the back of the car
        pitch: 0.2     // Slight downward tilt
    };
    
    // Camera constraints
    static MIN_PITCH = -0.4;    // Looking down limit
    static MAX_PITCH = 0.7;     // Looking up limit
    static ROTATION_SPEED = 0.003; // Sensitivity for camera movement
    
    // Camera setup state tracking to prevent redundant setups
    static cameraState = {
        isSetup: false,
        lastSetupTime: 0,
        setupCount: 0,
        verifyCount: 0,
        lastVerifyTime: 0,
        exclusiveControl: true  // ADDED: Flag to prevent other systems from updating camera
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
            
            // CRITICAL FIX: Set exclusive camera control flag
            this.cameraState.exclusiveControl = true;
            this.cameraState.isSetup = false; // Force camera setup
            
            // Setup the camera with proper planet surface alignment
            this.setupCarCamera(car);
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // CRITICAL FIX: Store that this car is actively controlled
            car.userData.isActivelyControlled = true;
            
            console.log('Car Controller initialized successfully');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // IMPROVED: Camera setup with better stability and surface normal handling
    static setupCarCamera(car) {
        if (!car || !Engine.camera) {
            console.error('Missing car or camera for setupCarCamera');
            return false;
        }
        
        try {
            // CRITICAL FIX: Track camera setup to prevent redundant operations
            const now = Date.now();
            if (now - this.cameraState.lastSetupTime < 100 && this.cameraState.isSetup) {
                return true; // Skip if we just set up the camera recently
            }
            
            // Get surface normal from the car - critical for proper orientation
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
            
            // Detach camera from any parent - CRITICAL for preventing conflicts
            if (Engine.camera.parent) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Calculate initial camera position behind the car - SIMPLIFIED for stability
            const backDirection = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            const cameraPos = car.position.clone()
                .addScaledVector(backDirection, this.cameraDistance)
                .addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Set camera position directly to avoid sudden jumps
            Engine.camera.position.copy(cameraPos);
            
            // Make camera look at position ahead of car
            const lookTarget = car.position.clone().addScaledVector(
                backDirection.clone().negate(), // Look ahead of car
                this.cameraLookOffset
            );
            
            Engine.camera.lookAt(lookTarget);
            
            // Store setup state
            this.cameraState.isSetup = true;
            this.cameraState.lastSetupTime = now;
            this.cameraState.setupCount++;
            
            console.log('Car camera setup complete with surface normal alignment');
            return true;
        } catch (e) {
            console.error('Error in setupCarCamera:', e);
            return false;
        }
    }
    
    // ENHANCED: Update method with improved camera stability
    static update() {
        // CRITICAL FIX: Always get the car from VehicleManager.currentVehicle
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available in update');
            return null;
        }
        
        // Detect exit request
        if (this.input.exit || this.input.action) {
            console.log("Exit requested from CarController");
            this.input.exit = false;
            this.input.action = false;
            return 'exit'; // Signal to ControlManager to handle exit
        }
        
        try {
            // Process camera rotation from input
            this.updateCameraRotation(car);
            
            // Update camera position with smoothing
            this.updateCameraPosition(car);
            
            // Update camera orientation to maintain alignment with planet
            this.updateCameraOrientation(car);
            
            // Process car movement
            const deltaTime = 1/60; // Use fixed timestep for consistency
            this.handleCarMovement(car, deltaTime);
            
            // Reset input for next frame
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // IMPROVED: Handle camera rotation with less jitter
    static updateCameraRotation(car) {
        // Apply mouse/joystick input with dampening
        const rotationDampening = 0.7; // Reduce sensitivity for stability
        
        this.cameraRotation.yaw += this.input.rotation.x * rotationDampening;
        this.cameraRotation.pitch = Math.max(
            this.MIN_PITCH,
            Math.min(this.MAX_PITCH, this.cameraRotation.pitch + this.input.rotation.y * rotationDampening)
        );
    }
    
    // COMPLETELY REWORKED: Simplified camera positioning with strong stability focus
    static updateCameraPosition(car, forceUpdate = false) {
        if (!car || !Engine.camera) return;
        
        try {
            // Skip if vehicle is falling unless forced
            if (car.userData?.falling && !forceUpdate) return;
            
            // Get surface normal from the car
            let surfaceNormal;
            if (car.userData?.surfaceNormal) {
                surfaceNormal = car.userData.surfaceNormal;
            } else if (car.userData?.planet) {
                const planet = car.userData.planet;
                surfaceNormal = car.position.clone().sub(planet.object.position).normalize();
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
                
                // Update matrix to ensure proper physics
                car.updateMatrix();
                car.updateMatrixWorld(true);
                
                if (typeof ObjectManager !== 'undefined' && ObjectManager.updateCollidableBounds) {
                    ObjectManager.updateCollidableBounds(car);
                }
                
                // Store that we applied ground correction
                car.userData._lastGroundCorrection = Date.now();
            }
            
            // ADDED: Ensure surface normal is calculated properly
            const surfaceNormal = toVehicle.normalize();
            car.userData.surfaceNormal = surfaceNormal;
            
            // Apply strong alignment to ensure car is properly oriented
            VehicleManager.alignVehicleToPlanetSurface(car, surfaceNormal, 0.2);
            
            // Always ensure wheels are properly aligned to surface
            VehicleManager.resetWheelsBaseOrientation(car);
            
            // Dampen any upward velocity to prevent bouncing
            if (car.userData.velocity) {
                const normalComponent = car.userData.velocity.dot(toVehicle.normalize());
                if (normalComponent > 0) { // If moving away from planet
                    // Heavily reduce upward component for smoother landings
                    car.userData.velocity.multiplyScalar(0.8);
                }
            }
        } catch (err) {
            console.error("Error ensuring car is grounded:", err);
        }
    }

    // IMPROVED: More thorough cleanup that preserves rotation state
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Release exclusive camera control
            this.cameraState.exclusiveControl = false;
            
            // Store camera state for later recovery if needed
            this._lastCameraUp = Engine.camera?.up.clone();
            this._lastCameraPosition = Engine.camera?.position.clone();
            
            // Store surface normal to pass on to next controller
            if (car.userData?.surfaceNormal) {
                window.surfaceNormal = car.userData.surfaceNormal.clone();
                console.log("Stored surface normal for next controller");
            }
            
            // Mark that car is no longer being actively controlled
            car.userData.isActivelyControlled = false;
            
            console.log('CarController cleanup complete');
        } catch (e) {
            console.error('Error in CarController cleanup:', e);
        }
    }
    
    // Helper methods for vehicle functionality
    static updateSteeringWheels(car, steeringInput) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const maxSteerAngle = 0.4; // About 23 degrees max steering angle
            
            // Apply steering to front wheels
            if (wheels.frontLeft) {
                wheels.frontLeft.rotation.y = steeringInput * maxSteerAngle;
            }
            if (wheels.frontRight) {
                wheels.frontRight.rotation.y = steeringInput * maxSteerAngle;
            }
        } catch (err) {
            console.error("Error updating steering wheels:", err);
        }
    }
}
