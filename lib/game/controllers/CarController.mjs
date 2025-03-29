import { Vector3, Quaternion, Euler, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for car vehicle operation
export default class CarController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };

    // Third-person camera configuration for car
    static cameraDistance = 10; // Distance behind car
    static cameraHeight = 4;   // Height above car
    static cameraLookOffset = 0; // Forward offset for where camera looks

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
            
            // Step 2: Reset camera orientation
            Engine.camera.rotation.set(0, 0, 0);
            
            // Step 3: Now attach camera to car
            console.log('Attaching camera to car');
            car.add(Engine.camera);
            
            // Position camera behind and above car in car's local space
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            
            // Create a camera orientation matrix that matches the car's orientation
            // This ensures the camera's "up" direction is the same as the car's
            const carForward = new Vector3(0, 0, -1); // Car's local forward direction
            const carUp = new Vector3(0, 1, 0); // Car's local up direction
            const carRight = new Vector3(1, 0, 0); // Car's local right direction
            
            // Create lookAt target in the car's local coordinate system
            // Use the car's forward direction as reference
            const targetPoint = new Vector3(0, 1, -10); // Aim slightly forward and up
            
            // Set camera to look at this target
            Engine.camera.lookAt(targetPoint);
            
            // Explicitly align camera's up direction with car's up direction
            Engine.camera.up.copy(carUp);
            
            console.log('Camera successfully attached to car');
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
        } catch (e) {
            console.error('Error during car camera setup:', e);
        }
    }
    
    // Handle driving controls
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') return;
        
        // Check for exit request ('E' key)
        if (this.input.exit) {
            this.input.exit = false; // Clear the exit state
            return 'exit'; // Signal to control manager that we want to exit
        }
        
        // Keep camera positioned correctly - smoothly adjust if needed
        const idealPosition = new Vector3(0, this.cameraHeight, this.cameraDistance);
        Engine.camera.position.lerp(idealPosition, 0.1);
        
        // Ensure camera maintains the right orientation relative to the car
        // This corrects any drift that might occur
        const targetPoint = new Vector3(0, 1, -10); // Look slightly forward and up
        Engine.camera.lookAt(targetPoint);
        Engine.camera.up.set(0, 1, 0); // Keep using car's local up vector
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
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
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
