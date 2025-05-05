// Controller specifically for car vehicle operation - REVAMPED FOR SURFACE ALIGNMENT
import { Vector3, Quaternion, Matrix4 } from 'three';
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
    
    // Camera state
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
    static maxSteeringAngle = 0.4;
    
    // Reset controller state when entering car
    static reset() {
        console.log('Initializing Car Controller with simplified surface alignment');
        
        const car = VehicleManager.currentVehicle;
        if (!car) {
            console.error('No car available for CarController');
            return;
        }
        
        try {
            // Reset camera and steering states
            this.cameraRotation = { yaw: Math.PI, pitch: 0.2 };
            this.cameraState = {
                isSetup: false,
                lastSetupTime: 0,
                setupCount: 0,
                updateInterval: 16,
                lastUpdateTime: 0,
                smoothPosition: null,
                smoothUpVector: null
            };
            this.steeringAngle = 0;
            
            // Reset input
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Mark car as actively controlled by this controller
            car.userData.isActivelyControlled = true;
            car.userData.falling = false;
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = 0;
            car.userData._controlledByCarController = true;
            
            // Clear extra adhesion flags
            car.userData._needsGroundAdhesion = false;
            
            // Get initial surface normal
            this.updateSurfaceNormal(car);
            
            // Setup camera
            this.setupCamera();
            
            console.log('Car Controller initialized successfully');
        } catch (e) {
            console.error('Error in CarController reset:', e);
        }
    }

    // Setup camera behind car
    static setupCamera() {
        const car = VehicleManager.currentVehicle;
        if (!car || !Engine.camera) return false;
        
        try {
            // Get surface normal
            let surfaceNormal = this.getSurfaceNormal(car);
            
            // Detach camera from any parent
            if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            console.log("Setting up car camera - attaching to car body");
            
            // Set camera up vector
            Engine.camera.up.copy(surfaceNormal);
            
            // IMPROVED: Attach camera directly to car as a child with clear parent-child relationship
            Engine.scene.remove(Engine.camera);
            car.add(Engine.camera);
            
            // Position camera relative to the car (in car's local space)
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            
            // Make camera look forward along car's direction
            Engine.camera.rotation.set(0, Math.PI, 0); // Look backward along car's Z axis
            
            // Mark as setup
            this.cameraState.isSetup = true;
            this.cameraState.lastSetupTime = Date.now();
            this.cameraState.setupCount++;
            
            console.log("Camera firmly attached to car body - will move with car automatically");
            return true;
        } catch (e) {
            console.error('Error in setupCamera:', e);
            return false;
        }
    }
    
    // Get the current surface normal for a car
    static getSurfaceNormal(car) {
        if (!car || !car.userData || !car.userData.planet || !car.userData.planet.object) {
            return new Vector3(0, 1, 0); // Default up vector
        }
        
        // Calculate surface normal from planet center to car position
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        return car.position.clone().sub(planetCenter).normalize();
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
            
            // REMOVED: Update camera position call - not needed as camera is attached to car
            // this.updateCameraPosition(car);
            
            // Reset rotation input
            this.input.rotation.set(0, 0, 0);
        } catch (e) {
            console.error('Error in CarController update:', e);
        }
        
        return null;
    }

    // Update surface normal and store it in the car
    static updateSurfaceNormal(car) {
        if (!car || !car.userData || !car.userData.planet || !car.userData.planet.object) return;
        
        const planet = car.userData.planet;
        const planetCenter = planet.object.position;
        
        // Calculate surface normal pointing away from planet center
        const surfaceNormal = car.position.clone().sub(planetCenter).normalize();
        
        // Store for later use
        car.userData.surfaceNormal = surfaceNormal;
        
        // Calculate and store height above surface
        const distance = car.position.distanceTo(planetCenter);
        car.userData.heightAboveSurface = distance - planet.radius;
    }
    
    // Handle car movement with proper surface alignment
    static handleCarMovement(car) {
        if (!car || !car.userData) return;
        
        // Get input
        const moveZ = this.input.movement.z; // Forward/backward
        const moveX = this.input.movement.x; // Left/right turning

        // Process acceleration
        if (moveZ > 0) {
            car.userData.acceleration += 0.025;
        } else if (moveZ < 0) {
            car.userData.acceleration -= 0.05;
        } else {
            car.userData.acceleration *= 0.95;
        }

        // Clamp acceleration
        car.userData.acceleration = Math.max(-0.3, Math.min(0.3, car.userData.acceleration));
        
        // Update speed
        car.userData.speed += car.userData.acceleration;
        car.userData.speed *= (1 - car.userData.drag);
        car.userData.speed = Math.max(-car.userData.maxSpeed/2, Math.min(car.userData.maxSpeed, car.userData.speed));
        
        // Handle steering
        if (moveX !== 0) {
            // Update steering angle with limits
            this.steeringAngle = Math.max(
                -this.maxSteeringAngle,
                Math.min(this.maxSteeringAngle, this.steeringAngle + (moveX * 0.05))
            );
            
            car.userData.steeringInput = moveX;
            car.userData.steeringAngle = this.steeringAngle;
            
            // Turn car when moving
            if (Math.abs(car.userData.speed) > 0.1) {
                this.turnCarOnSurface(car, moveX);
            }
        } else {
            // Return steering to center gradually
            if (Math.abs(this.steeringAngle) > 0.01) {
                this.steeringAngle *= 0.9;
            } else {
                this.steeringAngle = 0;
            }
            
            car.userData.steeringInput = 0;
            car.userData.steeringAngle = this.steeringAngle;
        }
        
        // Update wheel visuals
        this.updateSteeringWheels(car);
        
        // Move car along planet surface
        this.moveCarOnSurface(car);
    }

    // Turn car on planet surface
    static turnCarOnSurface(car, steeringInput) {
        if (!car || !car.userData.surfaceNormal) return;
        
        const surfaceNormal = car.userData.surfaceNormal;
        
        // Calculate turn amount based on speed and steering
        const speed = Math.abs(car.userData.speed);
        const turnFactor = 0.02 * Math.min(1, speed / 8);
        const turnAmount = steeringInput * turnFactor;
        
        // Create rotation around surface normal (planet's "up" direction)
        const rotationQ = new Quaternion().setFromAxisAngle(surfaceNormal, turnAmount);
        
        // Apply to car orientation
        car.quaternion.premultiply(rotationQ);
        
        // IMPROVED: Apply stronger surface alignment after turning
        // This helps maintain proper wheel contact with the surface
        // FIX: Use CarController.alignCarToSurface instead of this.alignCarToSurface
        CarController.alignCarToSurface(car);
        
        // NEW: Check and correct wheel positions after turning
        // FIX: Use CarController.ensureWheelsOnSurface instead of this.ensureWheelsOnSurface
        CarController.ensureWheelsOnSurface(car);
    }
    
    // Move car along planet surface
    static moveCarOnSurface(car) {
        if (!car || !car.userData || Math.abs(car.userData.speed) < 0.01) return;
        
        try {
            // Get planet data
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            const surfaceNormal = car.userData.surfaceNormal;
            if (!surfaceNormal) return;
            
            // Calculate car's forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Project forward onto tangent plane of planet surface
            const surfaceForward = carForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Apply movement along the surface
            const moveVector = surfaceForward.multiplyScalar(car.userData.speed);
            car.position.add(moveVector);
            
            // IMPROVED: More aggressive height maintenance to keep wheels on surface
            const planetCenter = planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const currentDistance = toVehicle.length();
            const targetDistance = planet.radius + (car.userData.fixedHeightOffset || 3.0);
            
            // MODIFIED: Always apply height correction, more strongly when far from target
            const heightDifference = Math.abs(currentDistance - targetDistance);
            // Increase correction factor based on how far we are from target height
            const correctionFactor = heightDifference > 1.0 ? 0.5 : 
                                    heightDifference > 0.5 ? 0.3 : 0.2;
            
            // Apply height correction
            const newPosition = planetCenter.clone().add(
                toVehicle.normalize().multiplyScalar(targetDistance)
            );
            car.position.lerp(newPosition, correctionFactor);
            
            // Update surface normal after moving
            this.updateSurfaceNormal(car);
            
            // NEW: Check all wheels for surface contact
            this.ensureWheelsOnSurface(car);
            
            // Re-align car to the new surface normal - more strongly
            // FIX: Use CarController.alignCarToSurface instead of this.alignCarToSurface
            CarController.alignCarToSurface(car);
            
            // Update matrices
            car.updateMatrix();
            car.updateMatrixWorld(true);
            
            // Store velocity for physics system
            car.userData.velocity.copy(moveVector);
        } catch (e) {
            console.error('Error moving car:', e);
        }
    }

    // NEW: Ensure wheels are properly aligned with surface
    static ensureWheelsOnSurface(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const planet = car.userData.planet;
            if (!planet || !planet.object) return;
            
            const planetCenter = planet.object.position;
            const wheels = car.userData.wheels;
            
            // Track if any wheel is too far from surface
            let needsCorrection = false;
            let averageHeight = 0;
            let wheelCount = 0;
            
            // Check each wheel's distance from planet surface
            Object.values(wheels).forEach(wheel => {
                if (!wheel) return;
                
                // Get wheel's world position
                const wheelPos = new Vector3();
                wheel.getWorldPosition(wheelPos);
                
                // Calculate surface normal and distance for the wheel
                const toWheel = wheelPos.clone().sub(planetCenter);
                const distanceToCenter = toWheel.length();
                const distanceToSurface = distanceToCenter - planet.radius;
                
                // Target height should be very small
                const targetWheelHeight = 0.1;
                
                // Track average height and count wheels
                averageHeight += distanceToSurface;
                wheelCount++;
                
                // If wheel is too far from surface, mark for correction
                if (Math.abs(distanceToSurface - targetWheelHeight) > 0.5) {
                    needsCorrection = true;
                }
            });
            
            // Calculate average wheel height
            if (wheelCount > 0) {
                averageHeight /= wheelCount;
                
                // If average wheel height is too far from ideal, adjust car height
                if (needsCorrection) {
                    // Update fixedHeightOffset based on actual wheel positions
                    // This helps future alignments be more accurate
                    const idealOffset = averageHeight > 0 ? averageHeight : 0.1;
                    car.userData.fixedHeightOffset = idealOffset + 2.9; // Adjust for car body height
                }
            }
        } catch (e) {
            console.error('Error ensuring wheels on surface:', e);
        }
    }
    
    // Update wheel visuals based on steering angle
    static updateSteeringWheels(car) {
        if (!car || !car.userData || !car.userData.wheels) return;
        
        try {
            const wheels = car.userData.wheels;
            const steeringAngle = car.userData.steeringAngle || 0;
            
            // Front wheels turn, rear wheels stay straight
            if (wheels.frontLeft) {
                const currentRoll = wheels.frontLeft.rotation.x;
                wheels.frontLeft.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            if (wheels.frontRight) {
                const currentRoll = wheels.frontRight.rotation.x;
                wheels.frontRight.rotation.set(currentRoll, steeringAngle, Math.PI/2);
            }
            
            if (wheels.rearLeft) {
                const currentRoll = wheels.rearLeft.rotation.x;
                wheels.rearLeft.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            if (wheels.rearRight) {
                const currentRoll = wheels.rearRight.rotation.x;
                wheels.rearRight.rotation.set(currentRoll, 0, Math.PI/2);
            }
            
            // Animate wheel rotation based on speed
            if (Math.abs(car.userData.speed) > 0.01) {
                const rotationAmount = car.userData.speed * 0.05;
                
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
    
    // Clean up when exiting car
    static cleanup() {
        const car = VehicleManager.currentVehicle;
        if (!car) return;
        
        try {
            // Reset camera and controller states
            this.cameraState.isSetup = false;
            this.steeringAngle = 0;
            
            // MODIFIED: Detach camera from car before exit
            if (Engine.camera && Engine.camera.parent === car) {
                const worldPos = new Vector3();
                const worldRot = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldRot);
                
                car.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                
                // Restore world position and rotation
                Engine.camera.position.copy(worldPos);
                Engine.camera.quaternion.copy(worldRot);
            }
            
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
    
    // Missing method: Align car to planet surface
    static alignCarToSurface(car) {
        if (!car || !car.userData || !car.userData.surfaceNormal) return;
        
        try {
            const surfaceNormal = car.userData.surfaceNormal;
            
            // Use VehicleManager's alignment function if available
            if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                // Use a small lerp factor for smooth alignment during driving
                const lerpFactor = 0.05;
                VehicleManager.alignVehicleToPlanetSurface(car, surfaceNormal, lerpFactor);
                return;
            }
            
            // Fallback alignment if VehicleManager method isn't available
            const defaultUp = new Vector3(0, 1, 0);
            const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal);
            
            if (rotationAxis.lengthSq() > 0.001) {
                // Calculate rotation to align with surface
                const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                const alignmentQuaternion = new Quaternion().setFromAxisAngle(rotationAxis.normalize(), angle);
                
                // Apply alignment with smooth interpolation
                car.quaternion.slerp(alignmentQuaternion, 0.05);
            }
        } catch (e) {
            console.error('Error in alignCarToSurface:', e);
        }
    }
}
