import { Vector3, Quaternion } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for airplane vehicle operation
export default class AirplaneController {
    // Used for initial setup and when switching to this controller
    static reset() {
        console.log('Initializing Airplane Controller');
        
        // Get the current airplane
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('AirplaneController initialized without an airplane vehicle');
            return;
        }
        
        // Position camera behind the airplane
        const cameraOffset = new Vector3(0, 5, 20); // Position above and behind
        
        // Remove the camera from any current parent
        if (Engine.camera.parent) {
            const worldPosition = new Vector3();
            Engine.camera.getWorldPosition(worldPosition);
            
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            
            Engine.camera.position.copy(worldPosition);
        }
        
        // Add camera to the airplane with offset
        airplane.add(Engine.camera);
        Engine.camera.position.copy(cameraOffset);
        Engine.camera.lookAt(new Vector3(0, 0, -10)); // Look forward
    }
    
    // Handle in-flight controls
    static update() {
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') return;
        
        // Check for exit request ('E' key)
        if (Engine.keyStates?.['e'] || Engine.keyStates?.['E']) {
            Engine.keyStates['e'] = false; // Clear the key state
            Engine.keyStates['E'] = false;
            return 'exit'; // Signal to control manager that we want to exit
        }
        
        // Keep camera positioned correctly (in case it gets moved)
        const idealPosition = new Vector3(0, 5, 20);
        Engine.camera.position.lerp(idealPosition, 0.1);
        Engine.camera.lookAt(new Vector3(0, 0, -10));
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up Airplane Controller');
        
        // Ensure camera is removed from airplane before controller switch
        if (Engine.camera.parent) {
            const worldPosition = new Vector3();
            Engine.camera.getWorldPosition(worldPosition);
            
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            
            Engine.camera.position.copy(worldPosition);
        }
    }
}
