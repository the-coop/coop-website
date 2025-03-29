import { Vector3, Quaternion } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for airplane vehicle operation
export default class AirplaneController {
    // Used for initial setup and when switching to this controller
    static reset() {
        console.log('Initializing Airplane Controller');
        
        // Get the current airplane vehicle
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('AirplaneController initialized without an airplane vehicle');
            return;
        }
        
        console.log('Airplane found, attaching camera');
        
        // Force detach camera from whatever it's currently attached to
        if (Engine.camera.parent) {
            console.log('Detaching camera from', Engine.camera.parent.type || Engine.camera.parent.uuid);
            Engine.camera.parent.remove(Engine.camera);
        }
        
        // Add to scene first to reset any transforms
        Engine.scene.add(Engine.camera);
        
        // Set initial world position to be behind the airplane
        const behindPlane = new Vector3();
        behindPlane.copy(airplane.position);
        behindPlane.y += 5; // Above
        behindPlane.z += 20; // Behind
        Engine.camera.position.copy(behindPlane);
        
        // Now attach the camera directly to the airplane
        console.log('Attaching camera to airplane');
        airplane.add(Engine.camera);
        
        // Set local position relative to airplane
        Engine.camera.position.set(0, 5, 20);
        Engine.camera.lookAt(new Vector3(0, 0, -10));
        
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
        
        return null; // Don't exit automatically
    }
    
    static cleanup() {
        console.log('Cleaning up Airplane Controller');
        
        // Don't detach camera here, leave that to the next controller's reset
    }
}
