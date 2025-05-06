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
    
    // FIXED: Remove camera rotation variables that allow free rotation
    // Instead we'll use fixed camera positioning relative to car orientation
    static fixedCameraOffset = {
        distance: 15,
        height: 5,
        lookAhead: 3
    };

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
            // FIXED: Remove camera rotation initialization, using fixed camera instead
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
            
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            car.userData._controlledByCarController = true;
            car.userData._controllerStartTime = Date.now();
            car.userData._controlType = 'CarController';
            
            // IMPROVED: Enhanced surface alignment on entry
            car.userData._needsStrongAlignment = true;
            car.userData._strongAlignmentEndTime = Date.now() + 1000;
            
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
            
            console.log('Car Controller initialized with fixed camera');
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
            
            // FIXED: Call updateFixedCameraPosition instead of updateCameraPosition
            this.updateFixedCameraPosition();
            
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

    // NEW: Capture vehicle state for physics calculations
    static captureVehicleState(car) {
        if (!car) return;
        
        try {
            // Store previous position and rotation for calculating deltas
            this.vehicleState.previousPosition = this.vehicleState.previousPosition || car.position.clone();
            this.vehicleState.previousRotation = this.vehicleState.previousRotation || car.quaternion.clone();
            
            // Store current state
            const newPosition = car.position.clone();
            const newRotation = car.quaternion.clone();
            
            // Calculate movement delta
            const posDelta = newPosition.clone().sub(this.vehicleState.previousPosition);
            
            // Check if vehicle is currently stable (on ground)
            this.checkWheelSurfaceContact(car);
            
            // Update previous state with current state for next frame
            this.vehicleState.previousPosition.copy(newPosition);
            this.vehicleState.previousRotation.copy(newRotation);
        } catch (err) {
            console.error("Error capturing vehicle state:", err);
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
            // Process car movement with surface alignment
            this.handleCarMovement(car);
            
            // FIXED: Use the new unified align method
            this.align(car);
            
            // FIXED: Update camera with fixed positioning relative to car
            this.updateFixedCameraPosition();
            
            // Reset rotation input - not used for camera anymore
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // NEW: Implement missing moveCarOnSurface method to fix TypeError
    static moveCarOnSurface(car) {
        if (!car || !car.userData) return;
        
        // Get the essential physics objects we need
        const planet = car.userData.planet;
        if (!planet || !planet.object) return;
        
        try {
            // Get surface normal directly from car's userData
            const surfaceNormal = car.userData.surfaceNormal || 
                new Vector3().subVectors(car.position, planet.object.position).normalize();
                
            // Only apply movement if actually moving
            const isMoving = Math.abs(car.userData.speed) >= 0.01;
            
            if (isMoving) {
                // Calculate car's forward direction
                const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                
                // Project forward direction onto planet surface's tangent plane
                const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
                
                // Apply movement along the surface
                const moveVector = surfaceForward.multiplyScalar(car.userData.speed);
                car.position.add(moveVector);
                
                // Store velocity for physics system
                if (!car.userData.velocity) {
                    car.userData.velocity = new Vector3();
                }
                car.userData.velocity.copy(moveVector);
            } else {
                // Zero out velocity when stopped
                if (car.userData.velocity) {
                    car.userData.velocity.set(0, 0, 0);
                }
            }
            
            // Maintain correct height above surface
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            
            // Only correct height if significantly different from target
            if (Math.abs(currentDistance - targetDistance) > 0.1) {
                // Create new position at correct height
                const newPosition = planetCenter.clone().add(
                    toVehicle.normalize().multiplyScalar(targetDistance)
                );
                
                // Apply with smoothing
                const correctionFactor = car.userData.falling ? 0.1 : 0.3;
                car.position.lerp(newPosition, correctionFactor);
            }
            
            // IMPROVED: Add contact points for landing detection 
            // This replaces functionality from the removed checkWheelSurfaceContact method
            if (!car.userData.falling) {
                // Create a contact point below the car for landing detection
                this.vehicleState.surfaceContactPoints = [
                    car.position.clone().addScaledVector(surfaceNormal, -1.2)
                ];
                this.vehicleState.isStable = true;
                this.vehicleState.airTime = 0;
            } else {
                this.vehicleState.surfaceContactPoints = [];
                this.vehicleState.isStable = false;
                this.vehicleState.airTime += 1/60;
            }
            
            // Apply alignment to surface using ObjectManager's method
            if (window.ObjectManager && typeof window.ObjectManager.alignObjectToSurface === 'function') {
                window.ObjectManager.alignObjectToSurface(car, surfaceNormal, {
                    lerpFactor: 0.05,
                    maintainForwardDirection: true,
                    skipIfFalling: car.userData.falling,
                    alignmentType: 'carMovement'
                });
            }
            
            // Apply wheel visuals
            this.updateWheelVisuals(car);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // Handle landing after being airborne
            if (car.userData.falling && this.vehicleState.surfaceContactPoints && 
                this.vehicleState.surfaceContactPoints.length > 0) {
                this.handleVehicleLanding(car);
            }
            
            // Flag that this controller is managing the vehicle's height
            car.userData._heightManagedByController = true;
            car.userData._lastHeightManagement = Date.now();
            
        } catch (e) {
            console.error('Error moving car on surface:', e);
        }
    }

    // SIMPLIFIED: Update wheel visuals with focus on rotation and steering
    static updateWheelVisuals(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Apply steering angles to wheels
            Object.entries(wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // Get current roll rotation value (X axis)
                const currentRoll = wheel.rotation.x;
                
                // Set appropriate steering based on wheel position
                if (wheelName.includes('front')) {
                    // Front wheels show steering angle
                    wheel.rotation.set(currentRoll, steeringAngle, Math.PI/2);
                } else {
                    // Rear wheels always straight
                    wheel.rotation.set(currentRoll, 0, Math.PI/2);
                }
                
                // Apply wheel roll rotation based on vehicle speed
                if (Math.abs(car.userData.speed) > 0.01) {
                    // Simplified rolling - same speed for all wheels
                    const rotationAmount = car.userData.speed * 0.06;
                    wheel.rotation.x += rotationAmount;
                }
            });
        } catch (e) {
            console.error('Error updating wheel visuals:', e);
        }
    }
    
    // UNIFIED: Combined alignment method that replaces both alignCarToSurface and directAlignToSurface
    static align(car, surfaceNormal = null, forcedLerpFactor = null) {
        if (!car || !car.userData) return;
        
        try {
            // Get surface normal - try multiple sources to ensure we have one
            if (!surfaceNormal) {
                // First try userData.surfaceNormal which is most reliable
                if (car.userData.surfaceNormal) {
                    surfaceNormal = car.userData.surfaceNormal;
                }
                // Then try latest calculated normal from physics
                else if (car.userData.planet) {
                    const planet = car.userData.planet;
                    const planetCenter = planet.object.position;
                    surfaceNormal = car.position.clone().sub(planetCenter).normalize();
                    
                    // Store for future use
                    car.userData.surfaceNormal = surfaceNormal.clone();
                }
                // Fallback to default up vector
                else {
                    surfaceNormal = new Vector3(0, 1, 0);
                }
            }
            
            // ADDED: Mark that we're handling alignment to prevent redundant processing
            car.userData._alignedByCarController = true;
            car.userData._lastAlignmentTime = Date.now();
            
            // IMPROVED: Determine alignment strength based on conditions
            let alignmentFactor = 0.1; // Default stronger than previous 0.05
            
            // Use stronger alignment when indicated
            if (car.userData._needsStrongAlignment) {
                alignmentFactor = 0.3; // Much stronger alignment
                
                // Clear strong alignment flag after timeout
                if (car.userData._strongAlignmentEndTime && 
                    Date.now() > car.userData._strongAlignmentEndTime) {
                    car.userData._needsStrongAlignment = false;
                }
            }
            
            // Override with forced factor if provided
            if (forcedLerpFactor !== null) {
                alignmentFactor = forcedLerpFactor;
            }
            
            // Try to use ObjectManager's method first
            if (window.ObjectManager && typeof window.ObjectManager.alignObjectToSurface === 'function') {
                window.ObjectManager.alignObjectToSurface(car, surfaceNormal, {
                    lerpFactor: alignmentFactor,
                    maintainForwardDirection: true,
                    skipIfFalling: false, // FIXED: Always align, even when falling
                    alignmentType: 'carController'
                });
            } 
            // Otherwise use direct alignment as fallback
            else {
                // Create alignment quaternion
                const defaultUp = new Vector3(0, 1, 0);
                const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal).normalize();
                
                if (rotationAxis.lengthSq() > 0.001) {
                    const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                    const alignmentQuaternion = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                    
                    // Get car's current forward vector
                    const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
                    
                    // Project forward vector onto surface plane
                    const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
                    
                    // Only if projection is valid (not zero)
                    if (projectedForward.lengthSq() > 0.001) {
                        // Find right vector (perpendicular to up and forward)
                        const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
                        
                        // Recalculate forward to ensure it's perpendicular
                        const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
                        
                        // Create matrix from orthogonal vectors
                        const matrix = new Matrix4().makeBasis(rightVector, surfaceNormal, correctedForward);
                        
                        // Extract quaternion from matrix
                        const directionPreservingQuaternion = new Quaternion().setFromRotationMatrix(matrix);
                        
                        // Slerp to this quaternion
                        car.quaternion.slerp(directionPreservingQuaternion, alignmentFactor);
                    } else {
                        // If forward projection is invalid, just align to surface
                        car.quaternion.slerp(alignmentQuaternion, alignmentFactor);
                    }
                    
                    // Update matrices
                    car.updateMatrix();
                    car.updateMatrixWorld(true);
                }
            }
        } catch (e) {
            console.error('Error in align car method:', e);
        }
    }

    // SIMPLIFIED: Handle vehicle landing with focus on car body, not wheels
    static handleVehicleLanding(car) {
        if (!car || !car.userData) return;
        
        console.log("Vehicle landing detected");
        
        try {
            // Calculate impact force based on air time and velocity
            const airTime = this.vehicleState.airTime || 0;
            const verticalVelocity = car.userData.velocity ? 
                car.userData.velocity.dot(car.userData.surfaceNormal) : 0;
            
            // Impact is based on air time and vertical velocity
            const impactForce = Math.abs(verticalVelocity) * (1 + airTime * 2);
            
            // Apply bounce based on impact force
            if (impactForce > 2) {
                // Calculate bounce vector - opposite to surface normal
                const bounceStrength = Math.min(6, impactForce * 0.15);
                
                // Add upward bounce
                if (!car.userData.velocity) car.userData.velocity = new Vector3();
                car.userData.velocity.addScaledVector(car.userData.surfaceNormal, bounceStrength);
                
                // Keep vehicle in falling state for continued bouncing
                car.userData.falling = true;
                this.vehicleState.airTime = 0.1; // Reset but don't zero out air time
                
                console.log(`Applied bounce with strength ${bounceStrength.toFixed(2)}`);
                
                // ADDED: Apply strong alignment immediately upon landing
                this.align(car, null, 0.4); // Higher lerp factor for strong alignment
                
            } else {
                // Small impact - just land normally
                car.userData.falling = false;
                this.vehicleState.airTime = 0;
                
                // ADDED: Apply moderate alignment to stabilize when landing
                this.align(car, null, 0.25);
                
                console.log("Smooth landing completed");
            }
        } catch (err) {
            console.error("Error in handleVehicleLanding:", err);
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
                
                // Get surface normal directly from car
                const surfaceNormal = car.userData.surfaceNormal || new Vector3(0, 1, 0);
                
                // Rotate car around surface normal
                const turnQuat = new Quaternion().setFromAxisAngle(surfaceNormal, -turnAmount);
                car.quaternion.premultiply(turnQuat);
            }
            
            // Move car on surface with physics
            this.moveCarOnSurface(car);
            
        } catch (err) {
            console.error("Error handling car movement:", err);
        }
    }
    
    // FIXED: Replace updateCameraPosition with new fixed camera positioning
    static updateFixedCameraPosition() {
        const car = VehicleManager.currentVehicle;
        const camera = Engine.camera;
        
        if (!car || !camera) return;
        
        try {
            // Get surface normal for orientation
            const surfaceNormal = this.getSurfaceNormal(car);
            
            // Calculate car's backward vector (direction car is pointing)
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carBackward = carForward.clone().negate();
            
            // Calculate car's right vector
            const carRight = new Vector3(1, 0, 0).applyQuaternion(car.quaternion);
            
            // Calculate car's up vector (should be perpendicular to surface)
            const carUp = surfaceNormal.clone();
            
            // Calculate camera position behind and above car:
            // 1. Move backward from car position
            // 2. Move up above car position
            const cameraPosition = car.position.clone()
                .add(carBackward.clone().multiplyScalar(this.fixedCameraOffset.distance))
                .add(carUp.clone().multiplyScalar(this.fixedCameraOffset.height));
            
            // Calculate target position (slightly ahead of car)
            const targetPosition = car.position.clone()
                .add(carForward.clone().multiplyScalar(this.fixedCameraOffset.lookAhead))
                .add(carUp.clone().multiplyScalar(2)); // Look slightly above car
            
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
            
            // Look at target position
            camera.lookAt(targetPosition);
            
        } catch (err) {
            console.error("Error updating fixed camera position:", err);
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
}
