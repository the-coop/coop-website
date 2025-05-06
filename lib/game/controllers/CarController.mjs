// Controller specifically for car vehicle operation - REVAMPED FOR SURFACE ALIGNMENT
import { Vector3, Quaternion, Euler, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';
import PlayersManager from '../players.mjs'; // CRITICAL FIX: Add missing PlayersManager import

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
    
    // SIMPLIFIED: Camera state with minimal needed properties
    static cameraState = {
        lastPosition: new Vector3(),
        smoothPosition: null,
        smoothUpVector: null,
    };
    
    // Steering state
    static steeringAngle = 0;
    static maxSteeringAngle = 0.4;
    
    // ADDED: Track vehicle state for better physics
    static vehicleState = {
        lastGroundHeight: 0,
        wheelPositions: [],
        previousPosition: null,
        previousRotation: null,
        airTime: 0,
        surfaceContactPoints: [],
        lastSurfaceNormal: null,
        isStable: false,
        bounceCount: 0
    };
    
    // SIMPLIFIED: Reset controller state when entering car
    static reset() {
        console.log('Initializing Car Controller with simplified camera');
        
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        try {
            // Reset camera and steering states
            this.cameraRotation = { yaw: Math.PI, pitch: 0.2 };
            this.cameraState = {
                lastPosition: new Vector3(),
                smoothPosition: null,
                smoothUpVector: null,
            };
            this.steeringAngle = 0;
            
            // Reset vehicle state tracking
            this.vehicleState = {
                lastGroundHeight: 0,
                wheelPositions: [],
                previousPosition: car.position.clone(),
                previousRotation: car.quaternion.clone(),
                airTime: 0,
                surfaceContactPoints: [],
                lastSurfaceNormal: car.userData.surfaceNormal ? car.userData.surfaceNormal.clone() : new Vector3(0, 1, 0),
                isStable: false,
                bounceCount: 0
            };
            
            // Reset input
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Mark car as actively controlled by this controller
            car.userData.isActivelyControlled = true;
            
            // IMPROVED: Don't override falling state - let physics system manage it
            // car.userData.falling = false; // REMOVED: Don't force falling state
            
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            car.userData._controlledByCarController = true;
            car.userData._controllerStartTime = Date.now();
            car.userData._controlType = 'CarController';
            
            // ENHANCED: Grace period for both falling state and collision prevention
            car.userData._entryGracePeriod = true;
            car.userData._entryGraceEndTime = Date.now() + 2000; // Extended to 2 seconds
            
            // CRITICAL FIX: Ensure collision is disabled between player and vehicle
            if (PlayersManager && PlayersManager.self && PlayersManager.self.handle) {
                // Set bidirectional collision exclusion
                car._ignoreCollisionWith = PlayersManager.self.handle;
                PlayersManager.self.handle._ignoreCollisionWith = car;
                
                // Store player reference in car for collision system to check
                car.userData.currentDriver = PlayersManager.self;
                car.userData.isOccupied = true;
                car.userData.occupiedBy = PlayersManager.self.handle;
                
                console.log('Set explicit collision exclusion between vehicle and player');
                
                // Disable player collisions more aggressively
                if (PlayersManager.self.collidable) {
                    PlayersManager.self.collidable.active = false;
                    console.log('Disabled player collision processing');
                }
                
                // Also store vehicle reference on player to mark relationship
                PlayersManager.self.currentVehicle = car;
                PlayersManager.self.inVehicle = true;
                
                // Hide player mesh
                PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            } else {
                console.warn("PlayersManager not defined or player not available for collision setup");
            }
            
            // Clear extra adhesion flags
            car.userData._needsGroundAdhesion = false;
            
            // Store initial wheel positions for stability checking
            this.storeWheelPositions(car);
            
            // Get initial surface normal
            this.updateSurfaceNormal(car);
            
            // SIMPLIFIED: Setup camera as scene child (not attached to car)
            this.setupCamera();
            
            console.log('Car Controller initialized with simplified camera');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // FURTHER SIMPLIFIED: Store minimal wheel references for visuals only
    static storeWheelPositions(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        // We only need references to the wheel objects for visual updates
        // No need to track positions or other data since they're just for display
        this.vehicleState.wheelPositions = [];
        Object.values(car.userData.wheels).forEach(wheel => {
            if (wheel) this.vehicleState.wheelPositions.push({ wheel });
        });
    }

    // SIMPLIFIED: Camera setup like ThirdPersonController
    static setupCamera() {
        const car = VehicleManager.currentVehicle;
        if (!car || !Engine.camera) return false;
        
        try {
            // Get surface normal for proper orientation
            const surfaceNormal = this.getSurfaceNormal(car);
            
            // IMPORTANT: Always ensure camera is a direct child of scene
            if (Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                }
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
                Engine.camera.quaternion.copy(worldQuat);
            }
            
            console.log("Setting up car camera with simplified orbital positioning");
            
            // Calculate initial camera position behind the car
            this.updateCameraPosition();
            
            // Set camera up vector based on planet surface
            Engine.camera.up.copy(surfaceNormal);
            
            console.log("Camera configured as scene child with orbital positioning");
            return true;
        } catch (e) {
            console.error('Error in setupCamera:', e);
            return false;
        }
    }
    
    // SIMPLIFIED: Get surface normal from object's userData instead of recalculating
    static getSurfaceNormal(car) {
        if (!car) return new Vector3(0, 1, 0);
        
        // First try to get the pre-calculated surface normal from the object
        if (car.userData && car.userData.surfaceNormal) {
            return car.userData.surfaceNormal;
        }
        
        // Fall back to calculating it if not available
        if (car.userData && car.userData.planet && car.userData.planet.object) {
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            return car.position.clone().sub(planetCenter).normalize();
        }
        
        // Default if no planet data is available
        return new Vector3(0, 1, 0);
    }
    
    // SIMPLIFIED: Update local reference to surface normal without recalculating
    static updateSurfaceNormal(car) {
        if (!car) return;
        
        // Just use the existing surface normal from the object
        const surfaceNormal = this.getSurfaceNormal(car);
        
        // Store in controller state for reference
        this.vehicleState.lastSurfaceNormal = surfaceNormal.clone();
        
        // Store height data if available
        if (car.userData && car.userData.heightAboveSurface !== undefined) {
            this.vehicleState.lastGroundHeight = car.userData.heightAboveSurface;
        } else if (car.userData && car.userData.planet) {
            // Calculate height only if not already available
            const planet = car.userData.planet;
            const distance = car.position.distanceTo(planet.object.position);
            this.vehicleState.lastGroundHeight = distance - planet.radius;
        }
    }

    // Main update loop
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car) return null;
        
        // Check for exit request
        if (this.input.exit || this.input.action) {
            this.input.exit = false;
            this.input.action = false;
            return 'exit';
        }
        
        try {

            
            // Update surface normal
            this.updateSurfaceNormal(car);
            
            // Process car movement with surface alignment
            this.handleCarMovement(car);
            
            // CRITICAL FIX: Explicitly maintain height when stationary
            if (Math.abs(car.userData.speed) < 0.01) {
                this.maintainStationaryHeight(car);
            }
            
            // SIMPLIFIED: Update camera position like ThirdPersonController
            this.updateCameraPosition();
            
            // Reset rotation input
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // NEW: Add method to maintain height when vehicle is stationary
    static maintainStationaryHeight(car) {
        if (!car || !car.userData || !car.userData.planet) return;
        
        try {
            // Get planet data
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            const surfaceNormal = car.userData.surfaceNormal;
            if (!surfaceNormal) return;
            
            // IMPROVED: Just track stability locally, don't override physics system
            // Mark vehicle as stable and not falling when stationary
            // car.userData.falling = false; // REMOVED
            
            this.vehicleState.isStable = true;
            this.vehicleState.airTime = 0;
            
            // IMPROVED: Correct height if needed without using moveCarOnSurface
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            const heightDifference = currentDistance - targetDistance;
            
            // Only correct if significantly different from target
            if (Math.abs(heightDifference) > 0.1) {
                const correctionFactor = heightDifference < 0 ? 0.3 : 0.15;
                
                // Apply height correction
                const newPosition = planetCenter.clone().add(
                    surfaceNormal.clone().multiplyScalar(targetDistance)
                );
                car.position.lerp(newPosition, correctionFactor);
                
                // Make sure matrices are updated
                car.updateMatrix();
                car.updateMatrixWorld(true);
            }
            
            // Add flags to prevent physics system adjustment
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
            // CRITICAL: Add a contact point for alignment even when stationary
            const contactPoint = car.position.clone().add(
                surfaceNormal.clone().multiplyScalar(-1.2)
            );
            this.vehicleState.surfaceContactPoints = [contactPoint];
            
        } catch (e) {
            console.error('Error maintaining stationary height:', e);
        }
    }

    // NEW: Simplified car stability check - no wheel physics needed
    static checkWheelSurfaceContact(car) {
        if (!car || !car.userData || !car.userData.planet) return;
        
        // Use a simpler distance check for the entire car
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        const planetRadius = planet.radius;
        
        // Calculate distance to planet center
        const distToCenter = car.position.distanceTo(planetCenter);
        const heightAboveSurface = distToCenter - planetRadius;
        
        // Clear contact points as we're not tracking individual wheels
        this.vehicleState.surfaceContactPoints = [];
        
        // IMPROVED: Check for grace period after player entry
        const now = Date.now();
        const inGracePeriod = car.userData._entryGracePeriod && 
                              car.userData._entryGraceEndTime && 
                              now < car.userData._entryGraceEndTime;
        
        if (inGracePeriod) {
            // During grace period, force the car to be considered on ground
            this.vehicleState.isStable = true;
            this.vehicleState.airTime = 0;
            
            // IMPROVED: Don't directly set the falling state, just track locally
            // car.userData.falling = false; // REMOVED
            
            this.vehicleState.bounceCount = 0;
            
            // Store this height as a reference
            this.vehicleState.lastGroundHeight = heightAboveSurface;
            
            // Add a fake contact point for landing logic to work properly
            const contactPoint = car.position.clone().add(
                new Vector3(0, -1, 0).applyQuaternion(car.quaternion)
            );
            this.vehicleState.surfaceContactPoints = [contactPoint];
            
            return;
        }
        
        // Clear grace period flag if it's expired
        if (car.userData._entryGracePeriod && now >= car.userData._entryGraceEndTime) {
            car.userData._entryGracePeriod = false;
            car.userData._entryGraceEndTime = 0;
        }
        
        // CRITICAL FIX: Get surface normal explicitly - previously this was undefined
        const surfaceNormal = car.userData.surfaceNormal || 
                             car.position.clone().sub(planetCenter).normalize();
        
        // CRITICAL FIX: Use a greater height threshold to prevent frequent state changes
        // This will help prevent the constant landing/snapping cycle observed in logs
        const groundThreshold = 1.2; // Increased from 0.8
        const isOnGround = heightAboveSurface < groundThreshold;
        
        // IMPROVED: Add hysteresis to ground detection to prevent oscillation
        // If we were stable before, require a bigger threshold to become unstable
        if (this.vehicleState.isStable && !isOnGround) {
            // Only transition to unstable if significantly above threshold
            this.vehicleState.isStable = heightAboveSurface < (groundThreshold * 1.5);
        } else {
            this.vehicleState.isStable = isOnGround;
        }
        
        // CRITICAL FIX: Special case for stationary vehicles - always consider them stable
        if (Math.abs(car.userData.speed) < 0.01) {
            this.vehicleState.isStable = true;
        }
        
        // Update vehicle state
        if (!this.vehicleState.isStable) {
            this.vehicleState.airTime += 1/60;
            
            // UPDATED: Only track falling in local state, don't override physics system
            // car.userData.falling = true; // REMOVED
        } else {
            this.vehicleState.airTime = 0;
            
            // UPDATED: Only track falling in local state, don't override physics system
            // car.userData.falling = false; // REMOVED
            
            this.vehicleState.bounceCount = 0;
            
            // FIXED: Explicitly use the surface normal we calculated above
            const contactPoint = car.position.clone().add(
                surfaceNormal.clone().multiplyScalar(-groundThreshold)
            );
            this.vehicleState.surfaceContactPoints = [contactPoint];
        }
    }

    // NEW: Add missing method to handle car movement
    static handleCarMovement(car) {
        if (!car || !car.userData) return;
        
        try {
            // Process steering input
            const steeringInput = this.input.rotation.x;
            
            // Update car steering angle with smooth interpolation
            const targetSteeringAngle = steeringInput * this.maxSteeringAngle;
            this.steeringAngle = this.steeringAngle * 0.8 + targetSteeringAngle * 0.2;
            
            // Store steering angle in car for wheel visuals
            car.userData.steeringAngle = this.steeringAngle;
            
            // Process acceleration/braking
            const accelerationInput = -this.input.movement.z; // Forward is negative Z
            
            // Calculate new speed with acceleration
            const currentSpeed = car.userData.speed || 0;
            let newSpeed = currentSpeed;
            
            if (accelerationInput !== 0) {
                // Apply acceleration based on input
                const accelRate = accelerationInput > 0 ? 0.1 : 0.07; // Faster acceleration than braking
                newSpeed += accelerationInput * accelRate;
            } else {
                // Apply drag when no input
                newSpeed *= 0.97;
            }
            
            // Apply additional drag at higher speeds
            const dragFactor = car.userData.drag || 0.08;
            newSpeed *= (1 - dragFactor * Math.abs(newSpeed) * 0.01);
            
            // Limit max speed
            const maxSpeed = car.userData.maxSpeed || 12;
            newSpeed = Math.max(-maxSpeed * 0.5, Math.min(maxSpeed, newSpeed)); // Reverse is slower
            
            // Stop completely if speed is very low
            if (Math.abs(newSpeed) < 0.01) newSpeed = 0;
            
            // Store speed in car
            car.userData.speed = newSpeed;
            
            // Turn the car based on steering input and speed
            if (Math.abs(newSpeed) > 0.1 && Math.abs(this.steeringAngle) > 0.01) {
                // Calculate turn rate based on speed and steering angle
                // Slower speed = tighter turning
                const turnFactor = (Math.abs(newSpeed) > 5) ? 0.007 : 0.01;
                const turnAmount = this.steeringAngle * turnFactor * (newSpeed > 0 ? 1 : -1);
                
                // Rotate car around surface normal
                const surfaceNormal = car.userData.surfaceNormal || new Vector3(0, 1, 0);
                const turnQuat = new Quaternion().setFromAxisAngle(surfaceNormal, -turnAmount);
                car.quaternion.premultiply(turnQuat);
            }
            
            // Move car on surface with physics
            this.moveCarOnSurface(car);
            
        } catch (err) {
            console.error("Error handling car movement:", err);
        }
    }

    // NEW: Add missing method to update camera position
    static updateCameraPosition() {
        const car = VehicleManager.currentVehicle;
        const camera = Engine.camera;
        
        if (!car || !camera) return;
        
        try {
            // Get surface normal for orientation
            const surfaceNormal = this.getSurfaceNormal(car);
            
            // Update camera rotation based on input
            this.cameraRotation.yaw += this.input.rotation.x * 0.3;
            this.cameraRotation.pitch += this.input.rotation.y * 0.3;
            
            // Constrain pitch to prevent flipping
            this.cameraRotation.pitch = Math.max(
                this.MIN_PITCH, 
                Math.min(this.MAX_PITCH, this.cameraRotation.pitch)
            );
            
            // Calculate camera target (focus on point slightly above car)
            const cameraTarget = car.position.clone().add(
                new Vector3(0, 1.5, 0).applyQuaternion(car.quaternion)
            );
            
            // Calculate camera position - distance behind car
            const cameraOffset = new Vector3(
                -Math.sin(this.cameraRotation.yaw) * this.cameraDistance * Math.cos(this.cameraRotation.pitch),
                this.cameraDistance * Math.sin(this.cameraRotation.pitch) + this.cameraHeight,
                -Math.cos(this.cameraRotation.yaw) * this.cameraDistance * Math.cos(this.cameraRotation.pitch)
            );
            
            // Add offset to car position
            const cameraPosition = car.position.clone().add(cameraOffset);
            
            // Apply camera smoothing
            if (!this.cameraState.smoothPosition) {
                this.cameraState.smoothPosition = cameraPosition.clone();
                this.cameraState.smoothUpVector = surfaceNormal.clone();
            } else {
                // Smooth position and up vector
                this.cameraState.smoothPosition.lerp(cameraPosition, 0.1);
                this.cameraState.smoothUpVector.lerp(surfaceNormal, 0.05);
            }
            
            // Apply smoothed values
            camera.position.copy(this.cameraState.smoothPosition);
            camera.up.copy(this.cameraState.smoothUpVector);
            
            // Make camera look at target
            camera.lookAt(cameraTarget);
            
        } catch (err) {
            console.error("Error updating camera position:", err);
        }
    }
    
    // IMPROVED: Clean up when exiting car
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Reset camera and controller states
            this.steeringAngle = 0;
            
            // SIMPLIFIED: Just ensure camera is properly set as scene child
            if (Engine.camera && Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                
                // Preserve world position and orientation
                Engine.camera.position.copy(worldPos);
                Engine.camera.quaternion.copy(worldQuat);
            }
            
            // Set camera up vector to match planet surface
            if (car.userData?.surfaceNormal && Engine.camera) {
                Engine.camera.up.copy(car.userData.surfaceNormal);
            }
            
            console.log('Camera properly detached from vehicle');
            
            // Clear controller flags
            car.userData._heightManagedByController = false;
            car.userData._alignedByCarController = false;
            
            // Store surface normal for next controller
            if (car.userData?.surfaceNormal) {
                window.lastSurfaceNormal = car.userData.surfaceNormal.clone();
            }
            
            // Reset car state
            car.userData.isActivelyControlled = false;
            car.userData._controlledByCarController = false;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            console.log('CarController cleanup complete');
        } catch (e) {
            console.error('Error in CarController cleanup:', e);
        }
    }
    
    // IMPROVED: Align car to planet surface using ObjectManager's method
    static alignCarToSurface(car, forcedLerpFactor = null) {
        if (!car || !car.userData || !car.userData.surfaceNormal) return;
        
        try {
            // ADDED: Mark that we're handling alignment to prevent redundant processing
            car.userData._alignedByCarController = true;
            car.userData._lastAlignmentTime = Date.now();
            
            const surfaceNormal = car.userData.surfaceNormal;
            
            // Use ObjectManager's alignObjectToSurface method
            if (window.ObjectManager && typeof window.ObjectManager.alignObjectToSurface === 'function') {
                window.ObjectManager.alignObjectToSurface(car, surfaceNormal, {
                    lerpFactor: forcedLerpFactor !== null ? forcedLerpFactor : 0.05,
                    maintainForwardDirection: true,
                    skipIfFalling: car.userData.falling,
                    alignmentType: 'carController'
                });
            }
        } catch (e) {
            console.error('Error in alignCarToSurface:', e);
        }
    }
}
