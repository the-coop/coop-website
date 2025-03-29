import { Vector3, Quaternion } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for car vehicle operation
export default class CarController {
    // Used for initial setup and when switching to this controller
    static reset() {
        console.log('Initializing Car Controller');
        
        // Get the current car
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('CarController initialized without a car vehicle');
            return;
        }
        
        // Position camera for driving view (slightly above and behind driver position)
        const cameraOffset = new Vector3(0, 3, 2);
        
        // Remove the camera from any current parent
        if (Engine.camera.parent) {
            const worldPosition = new Vector3();
            Engine.camera.getWorldPosition(worldPosition);
            
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            
            Engine.camera.position.copy(worldPosition);
        }
        
        // Add camera to the car with offset
        car.add(Engine.camera);
        Engine.camera.position.copy(cameraOffset);
        Engine.camera.lookAt(new Vector3(0, 3, -5)); // Look forward
    }
    
    // Handle driving controls
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') return;
        
        // Check for exit request ('E' key)
        if (Engine.keyStates?.['e'] || Engine.keyStates?.['E']) {
            Engine.keyStates['e'] = false; // Clear the key state
            Engine.keyStates['E'] = false;
            return 'exit'; // Signal to control manager that we want to exit
        }
        
        // Keep camera positioned correctly (in case it gets moved)
        const idealPosition = new Vector3(0, 3, 2);
        Engine.camera.position.lerp(idealPosition, 0.1);
        Engine.camera.lookAt(new Vector3(0, 3, -5));
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        // Ensure camera is removed from car before controller switch
        if (Engine.camera.parent) {
            const worldPosition = new Vector3();
            Engine.camera.getWorldPosition(worldPosition);
            
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            
            Engine.camera.position.copy(worldPosition);
        }
    }
}
