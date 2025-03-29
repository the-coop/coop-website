import { Vector3, Quaternion, Euler } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for first-person airplane operation
export default class FirstPersonAirplaneController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false
    };
    
    // First-person camera settings
    static cameraPitch = 0;
    static cameraYaw = 0;

    // Used for initial setup and when switching to this controller
    static reset() {
        console.log('Initializing First Person Airplane Controller');
        
        // Get the current airplane vehicle
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('FirstPersonAirplaneController initialized without an airplane vehicle');
            return;
        }
        
        console.log('Airplane found, preparing first-person camera setup');
        
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
            
            // Step 3: Now attach camera to airplane with first-person offset (in cockpit)
            console.log('Attaching camera to airplane in first-person view');
            airplane.add(Engine.camera);
            Engine.camera.position.set(0, 1.5, 0); // Position in cockpit
            Engine.camera.lookAt(new Vector3(0, 1.5, -10)); // Look forward
            
            console.log('Camera successfully attached to airplane in first-person view');
            
            // Reset input state and camera angles
            this.cameraPitch = 0;
            this.cameraYaw = 0;
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
        } catch (e) {
            console.error('Error during first-person airplane camera setup:', e);
        }
        
        // Prepare the player state for being in a vehicle
        if (PlayersManager.self) {
            PlayersManager.self.falling = false;
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
        if (this.input.action) {
            console.log('Action button detected in FirstPersonAirplaneController.update(), requesting exit');
            this.input.action = false;
            return 'exit';
        }
        
        // Handle camera rotation for looking around cockpit
        this.cameraPitch = Math.max(-Math.PI/3, Math.min(Math.PI/3, this.cameraPitch + this.input.rotation.y));
        this.cameraYaw = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraYaw + this.input.rotation.x));
        
        // Apply camera rotation
        Engine.camera.rotation.set(this.cameraPitch, this.cameraYaw, 0);
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up First Person Airplane Controller');
        
        // Explicitly detach camera from airplane and add to scene
        if (Engine.camera.parent) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            
            console.log('Detaching camera in FirstPersonAirplaneController.cleanup()');
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Reset input and camera state
        this.cameraPitch = 0;
        this.cameraYaw = 0;
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
    }
}
