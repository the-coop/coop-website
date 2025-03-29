import { Vector3, Quaternion, Euler } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for first-person car operation
export default class FirstPersonCarController {
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
        console.log('Initializing First Person Car Controller');
        
        // Get the current car
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('FirstPersonCarController initialized without a car vehicle');
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
            Engine.camera.rotation.set(0, 0, 0);
            
            // Step 3: Now attach camera to car with first-person offset (in driver's seat)
            console.log('Attaching camera to car in first-person view');
            car.add(Engine.camera);
            Engine.camera.position.set(0, 2.3, -1); // Position at driver's seat
            Engine.camera.lookAt(new Vector3(0, 2.3, -10)); // Look forward
            
            console.log('Camera successfully attached to car in first-person view');
            
            // Reset input state and camera angles
            this.cameraPitch = 0;
            this.cameraYaw = 0;
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
        } catch (e) {
            console.error('Error during first-person car camera setup:', e);
        }
    }
    
    // Handle driving controls
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') return;
        
        // Check for exit request
        if (this.input.action) {
            this.input.action = false;
            return 'exit';
        }
        
        // Handle camera rotation for looking around
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
        console.log('Cleaning up First Person Car Controller');
        
        // Ensure camera is removed from car before controller switch
        if (Engine.camera.parent) {
            const worldPosition = new Vector3();
            Engine.camera.getWorldPosition(worldPosition);
            
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            
            Engine.camera.position.copy(worldPosition);
        }
        
        // Reset input and camera state
        this.cameraPitch = 0;
        this.cameraYaw = 0;
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
    }
}
