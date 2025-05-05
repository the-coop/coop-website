import { Vector3, Quaternion, Euler, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for airplane vehicle operation
export default class AirplaneController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };
    
    // Camera configuration for airplane
    static cameraDistance = 20;  // Distance behind airplane
    static cameraHeight = 5;     // Height above airplane
    static cameraLookAhead = 10; // How far ahead to look
    
    // Simplified reset with immediate camera attachment
    static reset() {
        console.log('Initializing Airplane Controller');
        
        // FIXED: Set initial camera to face forward
        if (Engine.camera) {
            // Reset camera completely
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.quaternion.identity();
        }
        
        // If you have a camera rotation tracker similar to car controller:
        if (this.cameraRotation) {
            this.cameraRotation.yaw = 0;  // 0 = forward facing
            this.cameraRotation.pitch = 0.2;
        }
        
        // Get the current airplane vehicle
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('AirplaneController initialized without an airplane vehicle');
            return;
        }
        
        try {
            // Immediate camera detachment and reset
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
            }
            
            // Reset camera orientation
            Engine.camera.rotation.set(0, 0, 0);
            
            // Directly attach camera to airplane
            airplane.add(Engine.camera);
            
            // Set camera position immediately
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            
            // Set up vector based on planet
            if (airplane.userData.planet) {
                const planetCenter = airplane.userData.planet.object.position;
                const toVehicle = airplane.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                
                // Set up vector
                airplane.up.copy(surfaceNormal);
                Engine.camera.up.copy(surfaceNormal);
            } else {
                // Default if no planet data
                Engine.camera.up.set(0, 1, 0);
            }
            
            // Set look target
            Engine.camera.lookAt(new Vector3(0, 0, -this.cameraLookAhead));
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
        } catch (e) {
            console.error('Error during airplane camera setup:', e);
        }
    }
    
    // Handle in-flight controls
    static update() {
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('No valid airplane found for controller');
            return null;
        }
        
        // Check for exit request
        if (this.input.exit) {
            this.input.exit = false;
            return 'exit';
        }
        
        // CRITICAL FIX: Airplane movement is now FULLY handled here, not in VehicleManager
        this.handleAirplaneMovement(airplane, 1/60);
        
        // IMPROVED: Verify collision relationship is maintained
        // This ensures the player and vehicle don't collide with each other
        if (PlayersManager.self && PlayersManager.self.handle) {
            // Keep player's collision flags consistent
            PlayersManager.self.inVehicle = true;
            if (PlayersManager.self.handle.userData) {
                PlayersManager.self.handle.userData.inVehicle = true;
                PlayersManager.self.handle.userData.currentVehicle = airplane;
            }
            
            // Keep player position synchronized with airplane position
            PlayersManager.self.position.copy(airplane.position);
            if (PlayersManager.self._originalHandle) {
                PlayersManager.self._originalHandle.position.copy(airplane.position);
            }
        }
        
        // Make sure camera stays attached to the airplane
        if (Engine.camera.parent !== airplane) {
            console.log('Re-attaching camera to airplane');
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            airplane.add(Engine.camera);
            
            // Reset camera position
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
        }
        
        // CRITICAL FIX: Always update camera up vector based on flight state
        if (airplane.userData.planet) {
            const planetCenter = airplane.userData.planet.object.position;
            const toVehicle = airplane.position.clone().sub(planetCenter).normalize();
            
            // Update camera up vector differently based on altitude
            if (airplane.userData.altitude <= 0) {
                // On ground - use surface normal directly
                Engine.camera.up.copy(toVehicle);
            } else {
                // In flight - blend between airplane's up vector and planet's surface normal
                const upVector = new Vector3(0, 1, 0).applyQuaternion(airplane.quaternion);
                upVector.lerp(toVehicle, 0.3); // 30% influence from planet
                Engine.camera.up.copy(upVector.normalize());
            }
            
            // Smoothly adjust camera position
            const idealPosition = new Vector3(0, this.cameraHeight, this.cameraDistance);
            Engine.camera.position.lerp(idealPosition, 0.1);
            
            // Look target remains forward
            const lookTarget = new Vector3(0, 0, -this.cameraLookAhead);
            Engine.camera.lookAt(lookTarget);
        }
        
        return null;
    }
    
    // Comprehensive airplane movement handler
    static handleAirplaneMovement(airplane, deltaTime) {
        // Get input values for thrust, roll, and pitch
        const thrustInput = -this.input.movement.z; // Negative Z is forward (throttle)
        const rollInput = this.input.movement.x;    // X is roll (left/right banking)
        const pitchInput = this.input.movement.y;   // Y is pitch (up/down)
        
        // Debug active inputs
        if (Math.abs(thrustInput) > 0.01 || Math.abs(rollInput) > 0.01 || Math.abs(pitchInput) > 0.01) {
            console.log(`✈️ Airplane inputs: thrust=${thrustInput.toFixed(2)}, roll=${rollInput.toFixed(2)}, pitch=${pitchInput.toFixed(2)}`);
        }
        
        // Apply thrust based on input
        if (Math.abs(thrustInput) > 0.01) {
            const thrustStrength = 300; // Strong acceleration for responsive feel
            const thrust = airplane.userData.acceleration * thrustInput * deltaTime * thrustStrength;
            airplane.userData.speed += thrust;
            console.log(`✈️ Thrust applied: ${thrust.toFixed(2)}, new speed: ${airplane.userData.speed.toFixed(2)}`);
        } else {
            // Apply drag when no input
            airplane.userData.speed *= 0.995; // Less drag than car for smoother flight
        }
        
        // Apply speed limits
        const maxSpeed = airplane.userData.maxSpeed || 80;
        
        if (airplane.userData.speed > 0) {
            airplane.userData.speed = Math.min(maxSpeed, airplane.userData.speed);
        } else {
            airplane.userData.speed = Math.max(-maxSpeed/4, airplane.userData.speed); // Limited reverse speed
        }
        
        // Check if we have enough speed to generate lift
        const stallSpeed = airplane.userData.stallSpeed || 15;
        const canGenerateLift = Math.abs(airplane.userData.speed) > stallSpeed;
        
        // Calculate current altitude above planet surface
        let altitude = 0;
        let surfaceNormal;
        if (airplane.userData.planet) {
            const planet = airplane.userData.planet;
            const toAirplane = airplane.position.clone().sub(planet.object.position);
            const distanceFromCenter = toAirplane.length();
            surfaceNormal = toAirplane.clone().normalize();
            
            // Altitude = distance from center - planet radius
            altitude = distanceFromCenter - planet.radius;
            airplane.userData.altitude = altitude;
        }
        
        // Apply roll and pitch controls (more responsive at higher speeds)
        const controlEffectiveness = Math.min(1.0, Math.abs(airplane.userData.speed) / 20);
        
        // Apply roll (banking) - strong effect for obvious feedback
        if (Math.abs(rollInput) > 0.01) {
            const rollStrength = 2.5 * controlEffectiveness; // Strong roll rate
            airplane.rotateZ(-rollInput * rollStrength * deltaTime);
        }
        
        // Apply pitch (nose up/down) - strong effect for obvious feedback
        if (Math.abs(pitchInput) > 0.01) {
            const pitchStrength = 2.0 * controlEffectiveness; // Strong pitch rate
            airplane.rotateX(pitchInput * pitchStrength * deltaTime);
        }
        
        // Apply automatic yaw based on roll (coordinated turn)
        if (Math.abs(rollInput) > 0.01 && canGenerateLift) {
            const yawStrength = 0.8 * rollInput * controlEffectiveness;
            airplane.rotateY(yawStrength * deltaTime);
        }
        
        // Calculate lift force based on speed, pitch, and roll
        if (canGenerateLift) {
            // Get airplane's up direction (for lift)
            const airplaneUp = new Vector3(0, 1, 0).applyQuaternion(airplane.quaternion);
            
            // Lift is reduced when banking (rolling)
            const bankAngle = Math.acos(Math.abs(airplaneUp.dot(new Vector3(0, 1, 0))));
            const liftFactor = Math.cos(bankAngle) * airplane.userData.liftFactor;
            
            // Apply lift force - stronger at higher speeds
            const liftStrength = liftFactor * (airplane.userData.speed / stallSpeed) * deltaTime * 10;
            
            // Only apply lift if we're flying (not on the ground)
            if (altitude > 1 || airplane.userData.speed > airplane.userData.takeoffSpeed) {
                airplane.userData.velocity = airplane.userData.velocity || new Vector3();
                airplane.userData.velocity.addScaledVector(airplaneUp, liftStrength);
                
                // Mark as flying
                airplane.userData.onSurface = false;
                airplane.userData.falling = false;
                
                console.log(`✈️ Lift applied: ${liftStrength.toFixed(2)}, altitude: ${altitude.toFixed(1)}`);
            }
        }
        
        // Apply movement to position
        if (Math.abs(airplane.userData.speed) > 0.01) {
            // Calculate velocity vector from speed and orientation
            const forwardDir = new Vector3(0, 0, -1).applyQuaternion(airplane.quaternion);
            airplane.userData.velocity = forwardDir.multiplyScalar(airplane.userData.speed);
            
            // Apply position change with higher multiplier for stronger movement
            const positionDelta = airplane.userData.velocity.clone().multiplyScalar(deltaTime * 1.5);
            airplane.position.add(positionDelta);
            
            console.log(`✈️ Airplane moved by: ${positionDelta.length().toFixed(2)} units, pos: ${airplane.position.toArray().map(v => v.toFixed(0))}`);
        }
        
        // Apply gravity if we're not generating enough lift
        if (airplane.userData.planet && (!canGenerateLift || altitude < 1)) {
            // Get planet data
            const planet = airplane.userData.planet;
            const planetCenter = planet.object.position;
            const toAirplane = airplane.position.clone().sub(planetCenter);
            const distanceFromCenter = toAirplane.length();
            const surfaceNormal = toAirplane.normalize();
            
            // Calculate gravity
            const gravity = 0.4 / Math.pow(distanceFromCenter / planet.radius, 2);
            
            // Apply gravity force pulling toward planet center
            if (!airplane.userData.velocity) airplane.userData.velocity = new Vector3();
            airplane.userData.velocity.addScaledVector(surfaceNormal, -gravity * deltaTime);
            
            // Check for ground contact (landing)
            const heightOffset = 2; // Higher than car for proper clearance
            const onGround = distanceFromCenter <= (planet.radius + heightOffset);
            
            if (onGround) {
                // Snap to ground
                airplane.position.copy(planetCenter).addScaledVector(surfaceNormal, planet.radius + heightOffset);
                
                // Cancel vertical velocity component
                if (airplane.userData.velocity) {
                    const downVelocity = airplane.userData.velocity.dot(surfaceNormal);
                    if (downVelocity < 0) {
                        airplane.userData.velocity.addScaledVector(surfaceNormal, -downVelocity);
                    }
                }
                
                // Update status flags
                airplane.userData.onSurface = true;
                airplane.userData.falling = false;
                
                // Apply surface alignment
                VehicleManager.alignVehicleToPlanetSurface(airplane, surfaceNormal, 0.3);
            } else {
                airplane.userData.onSurface = false;
            }
        }
        
        // Make sure we handle ALL airplane input processing here
        // and not rely on any VehicleManager input handling
        
        // Mark the airplane as actively controlled by this controller
        airplane.userData.isActivelyControlled = true;
        // This flag helps other systems know input is handled by the controller
        airplane.userData._controlledByAirplaneController = true;
    }
    
    static cleanup() {
        console.log('Cleaning up Airplane Controller');
        
        // Explicitly detach camera from airplane and add to scene
        if (Engine.camera.parent) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            
            console.log('Detaching camera in AirplaneController.cleanup()');
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
