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
            
            // Step 3: Position camera above and behind the car in world space
            const carCamPos = new Vector3();
            car.getWorldPosition(carCamPos);
            carCamPos.y += 3; // Above
            carCamPos.z += 5; // Behind
            Engine.camera.position.copy(carCamPos);
            
            // Step 4: Now attach camera to car with proper offset
            console.log('Attaching camera to car');
            car.add(Engine.camera);
            Engine.camera.position.set(0, 3, 2);
            Engine.camera.lookAt(new Vector3(0, 3, -5));
            
            console.log('Camera successfully attached to car');
        } catch (e) {
            console.error('Error during car camera setup:', e);
        }
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
