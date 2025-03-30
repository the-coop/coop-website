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
    
    // Used for initial setup and when switching to this controller
    static reset() {
        console.log('Initializing Airplane Controller');
        
        // Get the current airplane vehicle
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('AirplaneController initialized without an airplane vehicle');
            return;
        }
        
        console.log('Airplane found, preparing camera transition');
        
        try {
            // Step 1: Detach camera from any current parent
            if (Engine.camera.parent) {
                console.log('Detaching camera from', Engine.camera.parent.type || Engine.camera.parent.uuid);
                
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Step 2: Reset camera orientation
            Engine.camera.rotation.set(0, 0, 0);
            
            // Step 3: Now attach camera to airplane
            console.log('Attaching camera to airplane');
            airplane.add(Engine.camera);
            
            // Position the camera behind and slightly above the airplane in local space
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            
            // CRITICAL FIX: Always make sure we get the surface normal for camera up
            const planet = airplane.userData.planet;
            if (planet) {
                const planetCenter = planet.object.position;
                const toVehicle = airplane.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                
                // Force vehicle's up vector to match surface normal
                airplane.up.copy(surfaceNormal);
                
                // For camera, use a blend based on flight state
                if (airplane.userData.altitude <= 0) {
                    // When on ground, use planet's surface normal directly
                    Engine.camera.up.copy(surfaceNormal);
                } else {
                    // In flight, use a blend for smoother transitions
                    const upVector = new Vector3(0, 1, 0);
                    upVector.lerp(surfaceNormal, 0.5);
                    Engine.camera.up.copy(upVector.normalize());
                }
                
                console.log(`Camera up set to: ${Engine.camera.up.x.toFixed(2)}, ${Engine.camera.up.y.toFixed(2)}, ${Engine.camera.up.z.toFixed(2)}`);
            } else {
                // Fallback if planet data isn't available
                Engine.camera.lookAt(new Vector3(0, 0, -this.cameraLookAhead));
                Engine.camera.up.set(0, 1, 0);
            }
            
            console.log('Camera successfully attached to airplane');
            
            // IMPROVED: Ensure player-vehicle relationship is properly marked for collision handling
            if (PlayersManager.self && airplane) {
                // Store original handle if not already saved
                if (!PlayersManager.self._originalHandle) {
                    PlayersManager.self._originalHandle = PlayersManager.self.handle;
                }
                
                // Ensure collision flags are properly set
                PlayersManager.self.inVehicle = true;
                if (PlayersManager.self.handle && PlayersManager.self.handle.userData) {
                    PlayersManager.self.handle.userData.inVehicle = true;
                    PlayersManager.self.handle.userData.currentVehicle = airplane;
                }
                
                // Make sure vehicle knows about player
                airplane.userData.hasPlayerInside = true;
                airplane.userData.player = PlayersManager.self;
            }
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
        } catch (e) {
            console.error('Error during airplane camera setup:', e);
        }
        
        // Prepare the player state for being in a vehicle
        if (PlayersManager.self) {
            console.log('Setting player state for airplane control');
            PlayersManager.self.falling = false;
        }
        
        console.log('Camera attached to airplane, setup complete');
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
        
        // CRITICAL FIX: More robust input passing to VehicleManager 
        // Keep a reference for clarity and speed
        VehicleManager.input = this.input;
        
        // CRITICAL FIX: Enhanced input logging for debugging
        if (Math.abs(this.input.movement.x) > 0.01 || Math.abs(this.input.movement.z) > 0.01 || Math.abs(this.input.movement.y) > 0.01) {
            console.log(`Airplane input passed to VehicleManager: x=${this.input.movement.x.toFixed(2)}, y=${this.input.movement.y.toFixed(2)}, z=${this.input.movement.z.toFixed(2)}`);
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
        
        // IMPROVED: Apply gradual input easing for smoother aircraft control
        if (Math.abs(this.input.movement.x) > 0.01 || 
            Math.abs(this.input.movement.y) > 0.01 || 
            Math.abs(this.input.movement.z) > 0.01) {
            
            // Apply exponential easing for roll/yaw inputs
            if (Math.abs(this.input.movement.x) > 0.01) {
                this.input.movement.x = Math.sign(this.input.movement.x) * 
                    Math.pow(Math.abs(this.input.movement.x), 0.8);
            }
            
            // Apply exponential easing for throttle
            if (Math.abs(this.input.movement.z) > 0.01) {
                this.input.movement.z = Math.sign(this.input.movement.z) * 
                    Math.pow(Math.abs(this.input.movement.z), 0.7);
            }
        }
        
        // CRITICAL FIX: Don't reset input until after VehicleManager has used it
        const inputSnapshot = {
            movement: this.input.movement.clone(),
            rotation: this.input.rotation.clone()
        };
        
        // Now reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        return null;
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
        
        // IMPROVED: Don't disrupt vehicle-player relationship here
        // Relationship cleanup should happen only in VehicleManager.exitVehicle()
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
