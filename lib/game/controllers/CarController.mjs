import { Vector3, Quaternion, Euler, Matrix4, Object3D } from 'three';
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
    static cameraHeight = 3;    // Reduced from 4 to 3 for better view
    
    // Simplified tracking properties
    static _lastLookAtPos = new Vector3();
    static _lastCameraUp = new Vector3(0, 1, 0);
    static _smoothedCarForward = new Vector3(0, 0, -1);
    static _initialSetupComplete = false;

    // Much simpler camera reset - directly attach to car
    static reset() {
        console.log('Initializing Car Controller');
        
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('CarController initialized without a car vehicle');
            return;
        }
        
        try {
            // Ensure camera is properly detached first
            if (Engine.camera.parent) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // CRITICAL FIX: Set camera properties to neutral values
            Engine.camera.quaternion.identity();
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.up.set(0, 1, 0);
            Engine.camera.scale.set(1, 1, 1); // Ensure scale is default
            
            console.log("Creating car camera container");
            
            // Create a fresh camera container each time to avoid corrupted transforms
            if (car.userData.cameraContainer) {
                // Remove old container if it exists
                if (car.userData.cameraContainer.parent) {
                    car.userData.cameraContainer.parent.remove(car.userData.cameraContainer);
                }
                car.userData.cameraContainer = null;
            }
            
            // Create new container with clean transforms
            car.userData.cameraContainer = new Object3D();
            car.userData.cameraContainer.name = "CarCameraContainer";
            car.userData.cameraContainer.matrixAutoUpdate = true;
            car.add(car.userData.cameraContainer);
            
            // Reset container transforms
            car.userData.cameraContainer.position.set(0, this.cameraHeight, this.cameraDistance);
            car.userData.cameraContainer.rotation.set(0, Math.PI, 0); // Look backward (toward car front)
            car.userData.cameraContainer.updateMatrix();
            
            // Attach camera to container with clean state
            car.userData.cameraContainer.add(Engine.camera);
            Engine.camera.position.set(0, 0, 0);
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.updateMatrix();
            
            console.log("Camera attached to car successfully");
            
            // Reset controller input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Ensure VehicleManager has input reference
            VehicleManager.input = this.input;
            
            // CRITICAL FIX: Force disable FPSController input processing
            // Store a flag that can be checked by the control manager
            car.userData._cameraFixed = true;
            
            this._initialSetupComplete = true;
        } catch (e) {
            console.error('Error during car controller setup:', e);
        }
    }
    
    // CRITICAL ADDITION: Method to fix camera if it becomes distorted
    static fixCamera() {
        const car = VehicleManager.currentVehicle;
        if (!car || !car.userData.cameraContainer) return;
        
        console.log("Fixing distorted car camera");
        
        try {
            // Get current camera world position to maintain it
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            
            // Detach camera
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            
            // Reset container transform
            car.userData.cameraContainer.position.set(0, this.cameraHeight, this.cameraDistance);
            car.userData.cameraContainer.rotation.set(0, Math.PI, 0);
            car.userData.cameraContainer.updateMatrix();
            
            // Reattach camera with clean state
            car.userData.cameraContainer.add(Engine.camera);
            Engine.camera.position.set(0, 0, 0);
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.up.set(0, 1, 0);
            
            console.log("Camera fixed");
        } catch (e) {
            console.error("Error fixing camera:", e);
        }
    }
    
    // Handle driving controls
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') return null;
        
        // Check for exit request ('E' key)
        if (this.input.exit) {
            this.input.exit = false;
            return 'exit';
        }
        
        // Process keyboard inputs directly
        if (Engine.keyStates) {
            // Forward/Backward
            if (Engine.keyStates['KeyW'] || Engine.keyStates['ArrowUp'] || Engine.keyStates['Space']) {
                this.input.movement.z = -1; // Forward
            }
            else if (Engine.keyStates['KeyS'] || Engine.keyStates['ArrowDown']) {
                this.input.movement.z = 1;  // Backward
            }
            
            // Left/Right
            if (Engine.keyStates['KeyA'] || Engine.keyStates['ArrowLeft']) {
                this.input.movement.x = -1; // Left
            }
            else if (Engine.keyStates['KeyD'] || Engine.keyStates['ArrowRight']) {
                this.input.movement.x = 1;  // Right
            }
        }
        
        // CRITICAL FIX: Check if camera needs fixing
        if (!Engine.camera.parent || Engine.camera.parent !== car.userData.cameraContainer) {
            console.log("Detected camera detachment, fixing...");
            this.fixCamera();
        }
        
        // CRITICAL FIX: Also fix if rotations are off
        if (Math.abs(Engine.camera.rotation.x) > 0.01 || 
            Math.abs(Engine.camera.rotation.y) > 0.01 || 
            Math.abs(Engine.camera.rotation.z) > 0.01) {
            console.log("Detected camera rotation, resetting...");
            Engine.camera.rotation.set(0, 0, 0);
        }
        
        // CRITICAL FIX: Create cloned input for vehicle manager
        VehicleManager.input = {
            movement: this.input.movement.clone(),
            rotation: this.input.rotation.clone(),
            action: this.input.action,
            exit: this.input.exit
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
        
        const car = VehicleManager.currentVehicle;
        
        // Detach camera from car container and reset
        if (Engine.camera.parent) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Clean up the camera container if it exists
        if (car && car.userData.cameraContainer) {
            car.remove(car.userData.cameraContainer);
            car.userData.cameraContainer = null;
        }
        
        // Reset camera orientation
        Engine.camera.rotation.set(0, 0, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1); // Identity quaternion
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        // Reset tracking variables
        this._lastLookAtPos = new Vector3();
        this._lastCameraUp = new Vector3(0, 1, 0);
        this._smoothedCarForward = new Vector3(0, 0, -1);
        this._initialSetupComplete = false;
    }
}
