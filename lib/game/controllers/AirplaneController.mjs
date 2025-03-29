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
            
            // Step 2: Reset camera orientation to avoid any issues
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.up.set(0, 1, 0); // Reset up vector
            
            // Step 3: Now attach camera to airplane with proper orientation
            console.log('Attaching camera to airplane');
            airplane.add(Engine.camera);
            
            // Position the camera behind and slightly above the airplane in local space
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            
            // Create lookAt target in the airplane's local coordinate system
            // This makes the camera look forward along the airplane's path
            const targetPoint = new Vector3(0, 0, -this.cameraLookAhead);
            Engine.camera.lookAt(targetPoint);
            
            // Explicitly align camera's up with airplane's up
            Engine.camera.up.set(0, 1, 0);
            
            console.log('Camera successfully attached to airplane');
            
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
        
        // Pass movement inputs to VehicleManager for consistent handling
        VehicleManager.input = this.input;
        
        // Make sure camera stays attached to the airplane
        if (Engine.camera.parent !== airplane) {
            console.log('Re-attaching camera to airplane');
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            airplane.add(Engine.camera);
            
            // Reset camera position and orientation
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            Engine.camera.lookAt(new Vector3(0, 0, -this.cameraLookAhead));
            Engine.camera.up.set(0, 1, 0);
        }
        
        // Smoothly adjust camera position and orientation to handle airplane movement
        const idealPosition = new Vector3(0, this.cameraHeight, this.cameraDistance);
        Engine.camera.position.lerp(idealPosition, 0.1);
        
        // Update camera lookAt to maintain proper orientation
        const lookTarget = new Vector3(0, 0, -this.cameraLookAhead);
        Engine.camera.lookAt(lookTarget);
        
        // Keep camera aligned with airplane's up direction
        Engine.camera.up.set(0, 1, 0);
        
        // Reset input for next frame
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
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
