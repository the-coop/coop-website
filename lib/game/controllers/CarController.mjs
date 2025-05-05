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
    
    // FIXED: Camera setup state tracking to prevent redundant setups
    static cameraState = {
        isSetup: false,
        lastSetupTime: 0,
        setupCount: 0,
        verifyCount: 0,
        lastVerifyTime: 0
    };

    // FIXED: Camera setup with forward-facing orientation
    static reset() {
        console.log('Initializing Car Controller with improved camera control');
        
        // CRITICAL FIX: Use VehicleManager.currentVehicle to get the car
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error("Car controller reset failed: No current vehicle in VehicleManager");
            return;
        }
        
        // Verify we have a car vehicle type
        if (car.userData?.type !== 'car') {
            console.error("Car controller reset failed: Current vehicle is not a car");
            return;
        }
        
        try {
            console.log("Car controller reset: Setting up camera for car:", car.name || "unnamed");
            
            // Reset camera state tracking
            this.cameraState = {
                isSetup: false,
                lastSetupTime: 0,
                setupCount: 0,
                verifyCount: 0,
                lastVerifyTime: 0
            };
            
            // CRITICAL FIX: Make sure player reference is correctly associated with vehicle
            if (!car.userData.player && PlayersManager.self) {
                car.userData.player = PlayersManager.self;
                car.userData.isOccupied = true;
                car.userData.hasPlayerInside = true;
                
                // Ensure player knows it's in a vehicle
                PlayersManager.self.inVehicle = true;
                PlayersManager.self.currentVehicle = car;
                
                console.log("Fixed missing player reference in car userData");
            }
            
            // CRITICAL FIX: Explicitly prevent collisions between car and player
            if (car.userData.player && car.userData.player.handle) {
                car._ignoreCollisionWith = car.userData.player.handle;
                
                if (car.userData.player.handle._ignoreCollisionWith !== car) {
                    car.userData.player.handle._ignoreCollisionWith = car;
                    console.log("Set reciprocal collision ignoring between car and player");
                }
            }
            
            // IMPROVED: Set up camera with proper orientation and positioning
            this.setupCarCamera(car);
            
            // Reset input states
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Reset camera rotation to default behind car
            this.cameraRotation.yaw = Math.PI;
            this.cameraRotation.pitch = 0.2;
            
            // ADDED: Force vehicle to align properly with surface
            if (car.userData.planet && car.userData.planet.object) {
                // Get surface normal for current position
                const toSurface = car.position.clone().sub(car.userData.planet.object.position).normalize();
                
                // Apply strong alignment to ensure vehicle starts in correct orientation
                VehicleManager.alignVehicleToPlanetSurface(car, toSurface, 0.95, true);
                
                // Make sure wheels are properly aligned
                VehicleManager.resetWheelsBaseOrientation(car);
                
                console.log("Applied strong alignment to car with surface normal");
            }
            
            // ENHANCED: Force-enable ground adhesion for the first few seconds
            car.userData._needsGroundAdhesion = true;
            car.userData._groundAdhesionTime = Date.now();
            car.userData.falling = false;
            
            console.log("Car controller reset complete");
        } catch (e) {
            console.error("Error in Car Controller reset:", e);
        }
    }

    // FIXED: Camera setup consistent regardless of car movement direction with redundancy protection
    static setupCarCamera(car) {
        if (!car || !Engine.camera) {
            console.error("Cannot set up car camera - missing car or camera");
            return;
        }
        
        try {
            // ADDED: Check if camera was recently set up to avoid redundant operations
            const now = Date.now();
            if (this.cameraState.isSetup && now - this.cameraState.lastSetupTime < 500) {
                // Skip redundant setup if it was done recently (within 500ms)
                return;
            }
            
            this.cameraState.setupCount++;
            this.cameraState.lastSetupTime = now;
            
            console.log("Setting up car camera");
            
            // CRITICAL FIX: Camera needs to be re-parented to the car for proper positioning
            if (Engine.camera.parent !== car) {
                // Remove camera from its current parent (if any)
                if (Engine.camera.parent) {
                    const cameraWorldPosition = new Vector3();
                    Engine.camera.getWorldPosition(cameraWorldPosition);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(cameraWorldPosition);
                }
                
                // Add camera to car
                car.add(Engine.camera);
                console.log("Camera parented to car");
            }
            
            // FIXED: Position camera behind and above the car
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            
            // FIXED: Make camera look at a point slightly ahead of the car
            Engine.camera.lookAt(0, 0, -this.cameraLookOffset);
            
            // CRITICAL FIX: Use planet surface normal for camera up vector
            if (car.userData && car.userData.planet && car.userData.planet.object) {
                // Get the planet surface normal
                const planetCenter = car.userData.planet.object.position;
                const surfaceNormal = car.position.clone().sub(planetCenter).normalize();
                
                // Set camera up to match planet surface normal
                Engine.camera.up.copy(surfaceNormal);
                console.log("Camera up vector set to planet surface normal:", surfaceNormal);
            } else {
                // Fallback to car's local Y if planet data isn't available
                Engine.camera.up.set(0, 1, 0);
            }
            
            // Set flag indicating camera setup is complete
            this.cameraState.isSetup = true;
            car.userData._cameraSetup = true;
            
            console.log("Car camera setup complete. Camera position:", Engine.camera.position.toArray());
        } catch (e) {
            console.error("Error setting up car camera:", e);
            this.cameraState.isSetup = false;
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
        
        // ADDED: Update camera orientation to match planet surface
        this.updateCameraOrientation(car);
        
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
    
    // IMPROVED: Verify camera setup with rate limiting to avoid unnecessary processing 
    static verifyCarCamera(car) {
        // Rate limit verification to avoid spam
        const now = Date.now();
        if (now - this.cameraState.lastVerifyTime < 300) { // Only verify every 300ms max
            return;
        }
        
        this.cameraState.lastVerifyTime = now;
        this.cameraState.verifyCount++;
        
        // Check if camera is properly set up
        if (!Engine.camera) {
            console.error("Cannot verify camera - Engine.camera is missing");
            return;
        }
        
        const needsFixing = !this.cameraState.isSetup || 
                            Engine.camera.parent !== car || 
                            !car.userData._cameraSetup;
        
        // Only log and fix if there's a problem or this is the first verification
        if (needsFixing || this.cameraState.verifyCount === 1) {
            if (needsFixing) {
                console.log(`Camera verification failed: isSetup=${this.cameraState.isSetup}, parent=${Engine.camera.parent === car}, _cameraSetup=${car.userData._cameraSetup}`);
                // Fix the camera setup
                this.setupCarCamera(car);
            } else if (this.cameraState.verifyCount === 1) {
                console.log("Camera verification passed on first check");
            }
        }
    }

    // FIXED: Handle car movement properly aligned to planet surface
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
        console.log("Cleaning up CarController");
        
        // Reset camera state tracking
        this.cameraState = {
            isSetup: false,
            lastSetupTime: 0,
            setupCount: 0,
            verifyCount: 0,
            lastVerifyTime: 0
        };
        
        // CRITICAL FIX: Store current camera state before cleanup
        let cameraPosition = null;
        let cameraQuaternion = null;
        
        if (Engine.camera) {
            cameraPosition = Engine.camera.position.clone();
            cameraQuaternion = Engine.camera.quaternion.clone();
        }
        
        // Get reference to current vehicle for cleanup
        const car = VehicleManager.currentVehicle;
        
        if (car && car.userData) {
            // Remove active control flag
            car.userData.isActivelyControlled = false;
            
            // Remove camera from car if it's parented to it
            if (Engine.camera && Engine.camera.parent === car) {
                // Get world position before removing
                const worldPosition = new Vector3();
                Engine.camera.getWorldPosition(worldPosition);
                
                car.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                
                // Restore position in world space
                Engine.camera.position.copy(worldPosition);
            }
            
            // Clear references to player
            car.userData.player = null;
            car.userData.isOccupied = false;
            car.userData._cameraSetup = false;
            
            // Clear collision ignoring
            car._ignoreCollisionWith = null;
            
            console.log("Car references cleaned up");
        }
        
        // Clear controller references
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        // Restore camera settings if we have them
        if (Engine.camera) {
            if (cameraPosition) {
                Engine.camera.position.copy(cameraPosition);
            }
            
            if (cameraQuaternion) {
                Engine.camera.quaternion.copy(cameraQuaternion);
            }
            
            // Reset camera up direction
            Engine.camera.up.set(0, 1, 0);
        }
        
        console.log("CarController cleanup complete");
    }
    
    // NEW: Helper method to update steering wheels based on input
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
    
    // NEW: Keep camera oriented to planet surface during movement
    static updateCameraOrientation(car) {
        if (!car || !Engine.camera || !car.userData || !car.userData.planet || !car.userData.planet.object) {
            return;
        }
        
        try {
            // Skip if vehicle is falling
            if (car.userData.falling) {
                return;
            }
            
            // Get the current planet surface normal
            const planetCenter = car.userData.planet.object.position;
            const surfaceNormal = car.position.clone().sub(planetCenter).normalize();
            
            // Store for reference
            car.userData.surfaceNormal = surfaceNormal;
            
            // Set camera up to match planet surface normal
            Engine.camera.up.copy(surfaceNormal);
        } catch (err) {
            console.error("Error updating camera orientation:", err);
        }
    }
}
