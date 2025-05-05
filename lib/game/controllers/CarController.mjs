// Controller specifically for car vehicle operation - SIMPLIFIED VERSION
import { Vector3, Quaternion, Matrix4 } from 'three';
import VehicleManager from '../vehicles.mjs';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import Physics from '../physics.mjs';

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
    
    // CRITICAL FIX: Initialize cameraState properly as an object
    static cameraState = {
        isSetup: false,
        lastSetupTime: 0,
        setupCount: 0,
        updateInterval: 16,
        lastUpdateTime: 0,
        smoothPosition: null,
        smoothUpVector: null,
    };
    
    // Steering state
    static steeringAngle = 0;
    static maxSteeringAngle = 0.4; // About 23 degrees

    // IMPROVED: Unified reset method that directly positions camera
    static reset() {
        console.log('Initializing Car Controller with improved camera control');
        
        // Get the car from VehicleManager.currentVehicle
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
            // Reset camera rotation state to default
            this.cameraRotation = {
                yaw: Math.PI,  // Behind car
                pitch: 0.2     // Slight downward tilt
            };
            
            // Reset camera state
            this.cameraState = {
                isSetup: false,
                lastSetupTime: 0,
                setupCount: 0,
                updateInterval: 16,
                lastUpdateTime: 0,
                smoothPosition: null,
                smoothUpVector: null
            };
            
            // Reset steering state
            this.steeringAngle = 0;
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Mark car as actively controlled
            car.userData.isActivelyControlled = true;
            car.userData.falling = false; // Ensure car is grounded
            
            // Reset steering state in car userData
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            
            // IMPORTANT: Update surface normal immediately for correct alignment
            if (car.userData.planet && car.userData.planet.object) {
                const planetCenter = car.userData.planet.object.position;
                const toVehicle = car.position.clone().sub(planetCenter).normalize();
                car.userData.surfaceNormal = toVehicle.clone();
            }
            
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
                car.userData.surfaceNormal = surfaceNormal.clone(); // Store for future use
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
            const carBackward = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            
            // Place camera directly at desired position
            const cameraPos = car.position.clone();
            cameraPos.addScaledVector(carBackward, this.cameraDistance); // Behind car
            cameraPos.addScaledVector(surfaceNormal, this.cameraHeight); // Above car
            
            // Set camera position immediately
            Engine.camera.position.copy(cameraPos);
            
            // Make camera look at car
            Engine.camera.lookAt(car.position);
            
            // Mark as setup to prevent redundant setups
            this.cameraState.isSetup = true;
            this.cameraState.lastSetupTime = Date.now();
            this.cameraState.setupCount++;
            
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

    // IMPROVED: Handle car movement with proper surface-aligned movement
    static handleCarMovement(car) {
        if (!car || !car.userData) return;
        
        // Get input from the standardized input object
        const moveZ = this.input.movement.z; // Forward/backward
        const moveX = this.input.movement.x; // Left/right turning

        // FIXED: Process acceleration with reduced rates for better control
        if (moveZ > 0) {
            car.userData.acceleration += 0.025; // Reduced from 0.05
        } else if (moveZ < 0) {
            car.userData.acceleration -= 0.05; // Reduced from 0.1
        } else {
            car.userData.acceleration *= 0.95; // Gradual deceleration
        }

        // Clamp acceleration
        car.userData.acceleration = Math.max(-0.3, Math.min(0.3, car.userData.acceleration));
        
        // Update speed based on acceleration
        car.userData.speed += car.userData.acceleration;
        
        // Apply drag for better speed control
        car.userData.drag = 0.08; // Increased drag for better handling
        car.userData.speed *= (1 - car.userData.drag);
        
        // Clamp speed to lower max for better control
        const maxSpeed = 12; // Reduced from 20
        car.userData.speed = Math.max(-maxSpeed/2, Math.min(maxSpeed, car.userData.speed));
        
        // CRITICAL FIX: Update surface normal from planet for accurate surface following
        this.updateSurfaceNormal(car);
        
        // Handle steering - update both steeringInput and steeringAngle
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
                // Get the surface normal for rotation axis
                const surfaceNormal = car.userData.surfaceNormal || new Vector3(0, 1, 0);
                
                // Calculate turn factor based on speed
                const turnFactor = 0.015 * Math.min(1, Math.abs(car.userData.speed) / 10);
                
                // Create rotation quaternion around surface normal axis
                const turnAngle = this.steeringAngle * turnFactor;
                const rotationQ = new Quaternion().setFromAxisAngle(surfaceNormal, turnAngle);
                
                // Apply rotation to car
                car.quaternion.premultiply(rotationQ);
                
                // Realign car to surface after turning
                this.alignToSurface(car, surfaceNormal);
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
        
        // Update wheel rotations based on stored steering angle
        this.updateSteeringWheels(car);
        
        // Apply surface-aligned movement - CRITICAL for proper movement on curved planets
        this.applySurfaceMovement(car);
    }
    
    // NEW: Update surface normal based on planet position
    static updateSurfaceNormal(car) {
        if (!car || !car.userData || !car.userData.planet || !car.userData.planet.object) return;
        
        try {
            const planet = car.userData.planet;
            const planetCenter = planet.object.position;
            
            // Calculate new surface normal (points away from planet center)
            const toVehicle = car.position.clone().sub(planetCenter).normalize();
            
            // Update stored surface normal
            car.userData.surfaceNormal = toVehicle;
            
            // Calculate and store height above surface for physics
            const distance = car.position.distanceTo(planetCenter);
            car.userData.heightAboveSurface = distance - planet.radius;
        } catch (e) {
            console.error('Error updating surface normal:', e);
        }
    }
    
    // NEW: Align car orientation to surface
    static alignToSurface(car, surfaceNormal) {
        if (!car || !surfaceNormal) return;
        
        try {
            // Get current car up vector in world space
            const carUp = new Vector3(0, 1, 0).applyQuaternion(car.quaternion);
            
            // Get car forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project car forward onto surface plane to maintain direction
            const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Calculate right vector as cross product of surface normal and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, surfaceForward).normalize();
            
            // Recalculate forward to ensure perfect orthogonality
            const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Build rotation matrix from these orthogonal vectors
            const m = new Matrix4();
            m.makeBasis(rightVector, surfaceNormal, correctedForward);
            
            // Convert to quaternion
            const alignQuat = new Quaternion().setFromRotationMatrix(m);
            
            // Apply alignment with smoothing for gentle correction
            const alignFactor = 0.1;
            car.quaternion.slerp(alignQuat, alignFactor);
        } catch (e) {
            console.error('Error aligning to surface:', e);
        }
    }
    
    // NEW: Apply movement that follows planet surface
    static applySurfaceMovement(car) {
        if (!car || !car.userData || Math.abs(car.userData.speed) < 0.01) return;
        
        try {
            // Get planet information
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            // Get updated surface normal
            const surfaceNormal = car.userData.surfaceNormal;
            if (!surfaceNormal) return;
            
            // Calculate car's forward direction in world space
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project forward direction onto tangent plane of planet surface
            // This is the key to surface-aligned movement!
            const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Calculate movement vector based on speed
            const moveVector = surfaceForward.multiplyScalar(car.userData.speed);
            
            // Apply movement to position
            car.position.add(moveVector);
            
            // Maintain correct height above planet
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            
            // Adjust position to maintain correct height
            if (Math.abs(currentDistance - targetDistance) > 0.1) {
                const correctedPosition = planetCenter.clone().add(
                    toVehicle.normalize().multiplyScalar(targetDistance)
                );
                car.position.copy(correctedPosition);
            }
            
            // Keep car aligned to planet surface
            this.alignToSurface(car, surfaceNormal);
            
            // Update car's matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // Store velocity for physics system
            car.userData.velocity.copy(moveVector);
        } catch (e) {
            console.error('Error applying surface movement:', e);
        }
    }
    
    // FIXED: Function to update wheel steering
    static updateSteeringWheels(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Apply steering only to front wheels
            if (wheels.frontLeft) {
                // Preserve roll rotation (x-axis) but set steering angle (y-axis)
                const currentRoll = wheels.frontLeft.rotation.x;
                wheels.frontLeft.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            if (wheels.frontRight) {
                const currentRoll = wheels.frontRight.rotation.x;
                wheels.frontRight.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            // Keep rear wheels straight but maintain roll
            if (wheels.rearLeft) {
                const currentRoll = wheels.rearLeft.rotation.x;
                wheels.rearLeft.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            if (wheels.rearRight) {
                const currentRoll = wheels.rearRight.rotation.x;
                wheels.rearRight.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            // Animate wheel roll based on car speed
            if (Math.abs(car.userData.speed) > 0.01) {
                const rotationAmount = car.userData.speed * 0.05;
                
                // Apply rotation to all wheels around their local X-axis (roll axis)
                Object.values(wheels).forEach(wheel => {
                    if (wheel) {
                        wheel.rotation.x += rotationAmount;
                    }
                });
            }
        } catch (e) {
            console.error('Error updating steering wheels:', e);
        }
    }
    
    // FIXED: Update camera position with better surface alignment
    static updateCameraPosition(car) {
        if (!car || !Engine.camera) return;
        
        try {
            // Get surface normal from car - use latest calculated value
            let surfaceNormal = car.userData?.surfaceNormal || new Vector3(0, 1, 0);
            
            // Set camera up vector aligned with planet surface
            Engine.camera.up.copy(surfaceNormal);
            
            // FIXED: Calculate backward direction (camera looks TOWARD car's back)
            const carBackward = new Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            
            // Calculate target position behind car
            const targetPos = car.position.clone();
            targetPos.addScaledVector(carBackward, this.cameraDistance); // Behind car
            targetPos.addScaledVector(surfaceNormal, this.cameraHeight); // Above car
            
            // Smoothly move camera to target position
            Engine.camera.position.lerp(targetPos, 0.1);
            
            // Make camera look at car
            Engine.camera.lookAt(car.position);
            
            // Update camera state
            this.cameraState.lastUpdateTime = Date.now();
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
            this.cameraState.isSetup = false;
            
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
}
