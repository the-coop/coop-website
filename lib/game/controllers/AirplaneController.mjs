import { Vector3, Quaternion, Euler } from 'three';
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
        viewSwitch: false,
        exit: false
    };
    
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
            
            // Step 2: Reset camera orientation to avoid upside-down issues
            Engine.camera.rotation.set(0, 0, 0); // Reset rotation before attaching
            
            // Step 3: Position camera behind the airplane in world space
            const behindPlane = new Vector3();
            airplane.getWorldPosition(behindPlane);
            behindPlane.y += 5; // Above
            behindPlane.z += 20; // Behind
            Engine.camera.position.copy(behindPlane);
            
            // Step 4: Now attach camera to airplane with proper offset
            console.log('Attaching camera to airplane');
            airplane.add(Engine.camera);
            Engine.camera.position.set(0, 5, 20);
            Engine.camera.lookAt(new Vector3(0, 0, -10));
            
            console.log('Camera successfully attached to airplane');
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.viewSwitch = false;
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
    
    // Handle in-flight controls - update camera position/rotation every frame
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
        
        // Check for view switch request
        if (this.input.viewSwitch) {
            this.input.viewSwitch = false;
            return 'switch:firstpersonairplane';
        }
        
        // Check for action button press (exit vehicle)
        if (this.input.action) {
            console.log('Action button detected in AirplaneController.update(), requesting exit');
            this.input.action = false; // Clear the action state
            return 'exit';
        }
        
        // Make sure camera stays attached to the airplane
        if (Engine.camera.parent !== airplane) {
            console.log('Re-attaching camera to airplane');
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            airplane.add(Engine.camera);
            Engine.camera.position.set(0, 5, 20);
            Engine.camera.lookAt(new Vector3(0, 0, -10));
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.viewSwitch = false;
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
        this.input.viewSwitch = false;
        this.input.exit = false;
    }
}
