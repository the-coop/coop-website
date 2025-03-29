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
            
            // CRITICAL FIX: Force surface normal-aligned camera
            if (car.userData.planet) {
                const planetCenter = car.userData.planet.object.position;
                const toVehicle = car.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                
                // Important: Set car's up vector to match surface normal
                car.up.copy(surfaceNormal);
                
                // Attach camera to car with proper orientation
                console.log('Attaching camera to car with surface orientation');
                car.add(Engine.camera);
                
                // Position camera behind and above car in car's local space
                Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
                
                // Look forward relative to car orientation
                const targetPoint = new Vector3(0, 0, -10);
                Engine.camera.lookAt(targetPoint);
                
                // Ensure camera's up vector matches the planet's surface normal
                Engine.camera.up.copy(surfaceNormal);
            } else {
                // Fallback if planet data isn't available
                Engine.camera.lookAt(new Vector3(0, 0, -10));
                Engine.camera.up.set(0, 1, 0);
            }
            
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
        
        // CRITICAL FIX: Pass input to VehicleManager AND log it for debugging
        VehicleManager.input = this.input;
        
        // Debug logging to verify input values
        if (Math.abs(this.input.movement.x) > 0.01 || Math.abs(this.input.movement.z) > 0.01) {
            console.log(`Car input: x=${this.input.movement.x.toFixed(2)}, z=${this.input.movement.z.toFixed(2)}`);
        }
        
        // CRITICAL FIX: Update the camera's up vector constantly
        if (car.userData.planet) {
            const planetCenter = car.userData.planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter).normalize();
            
            // Update car's and camera's up vector to match surface normal
            car.up.copy(toVehicle);
            Engine.camera.up.copy(toVehicle);
            
            // Ensure camera stays in the right position
            const idealPosition = new Vector3(0, this.cameraHeight, this.cameraDistance);
            if (Engine.camera.position.distanceToSquared(idealPosition) > 0.1) {
                Engine.camera.position.lerp(idealPosition, 0.2);
            }
            
            // Keep camera looking in the right direction
            const targetPoint = new Vector3(0, this.cameraLookOffset, -10);
            Engine.camera.lookAt(targetPoint);
        }
        
        // Reset input for next frame - after we've used it
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
