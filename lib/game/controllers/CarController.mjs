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
    static cameraLerpSpeed = 0.05; // How quickly the camera follows the car

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
            // CRITICAL FIX: Completely detach camera first and add directly to scene
            if (Engine.camera.parent) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
                console.log("Camera detached and added to scene directly");
            }
            
            // Reset camera rotation and wait for matrix updates
            Engine.camera.rotation.set(0, 0, 0);
            
            // CRITICAL FIX: Instead of parenting, use external camera that follows the car
            // This avoids inheriting any problematic transformations
            this._lastCarPosition = car.position.clone();
            this._lastCarQuaternion = car.quaternion.clone();
            
            // Position camera behind car manually
            this._updateExternalCamera(car, 1.0); // Full strength for initial position
            
            console.log('Car camera setup using external camera mode');
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
        } catch (e) {
            console.error('Error during car camera setup:', e);
        }
    }
    
    // CRITICAL FIX: New method to update camera position externally (not as child)
    static _updateExternalCamera(car, strength = this.cameraLerpSpeed) {
        if (!car) return;
        
        try {
            // Calculate ideal camera position in world space
            const camIdealPos = new Vector3();
            const camLookAt = new Vector3();
            
            // CRITICAL FIX: Get planet surface normal for proper up vector
            let surfaceNormal = new Vector3(0, 1, 0); // Default up
            if (car.userData.planet) {
                // Get accurate surface normal from planet
                const planetCenter = car.userData.planet.object.position;
                const toVehicle = car.position.clone().sub(planetCenter);
                surfaceNormal = toVehicle.normalize();
                
                // Set car's up vector to surface normal if not already done
                if (!car.up.equals(surfaceNormal)) {
                    car.up.copy(surfaceNormal);
                }
            }
            
            // Get car's forward and up vectors
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const carUp = surfaceNormal.clone(); // CRITICAL FIX: Use surface normal directly
            const carRight = new Vector3().crossVectors(carUp, carForward).normalize();
            const correctedForward = new Vector3().crossVectors(carRight, carUp).normalize();
            
            // Calculate camera position: behind and above car
            camIdealPos.copy(car.position)
                .addScaledVector(correctedForward, this.cameraDistance) // Move backward
                .addScaledVector(carUp, this.cameraHeight); // Move up
                
            // Calculate where camera should look
            camLookAt.copy(car.position)
                .addScaledVector(carUp, this.cameraLookOffset); // Look at car's position plus offset
            
            // Smoothly move camera toward ideal position
            Engine.camera.position.lerp(camIdealPos, strength);
            
            // CRITICAL FIX: Always look at vehicle first, then adjust up vector
            Engine.camera.lookAt(camLookAt);
            
            // CRITICAL FIX: Force camera's up vector to match surface normal
            Engine.camera.up.copy(carUp);
            
            // Debug output to verify up vector is set correctly
            console.log(`Camera up: ${Engine.camera.up.x.toFixed(2)}, ${Engine.camera.up.y.toFixed(2)}, ${Engine.camera.up.z.toFixed(2)}`);
            console.log(`Surface normal: ${surfaceNormal.x.toFixed(2)}, ${surfaceNormal.y.toFixed(2)}, ${surfaceNormal.z.toFixed(2)}`);
            
            // Store car's current state for next frame
            this._lastCarPosition = car.position.clone();
            this._lastCarQuaternion = car.quaternion.clone();
        } catch (e) {
            console.error('Error updating car camera:', e);
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
        
        // CRITICAL FIX: Keep camera detached from car but update its position
        this._updateExternalCamera(car);
        
        // CRITICAL FIX: Always ensure input is passed to vehicle manager
        VehicleManager.input = this.input;
        
        // CRITICAL FIX: Force vehicle speed logging to debug movement
        if (Math.abs(car.userData.speed) > 0.01 || 
            (this.input.movement && (Math.abs(this.input.movement.z) > 0.01))) {
            console.log(`Car speed: ${car.userData.speed.toFixed(2)}, Input Z: ${this.input.movement.z.toFixed(2)}`);
        }
        
        // Store input state then reset for next frame
        const inputSnapshot = {
            movement: this.input.movement.clone(),
            rotation: this.input.rotation.clone()
        };
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        // Camera should already be a direct child of scene
        // Just make sure rotation is reset to avoid issues with next controller
        Engine.camera.rotation.set(0, 0, 0);
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
