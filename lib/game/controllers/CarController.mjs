import { Vector3, Quaternion, Euler, Matrix4, Object3D } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for car vehicle operation - SIMPLIFIED VERSION
export default class CarController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };

    // Third-person camera configuration for car
    static cameraDistance = 15; // Distance behind car (increased for better view)
    static cameraHeight = 5;   // Height above car (increased for better view)
    
    // Revised reset method for consistent camera positioning
    static reset() {
        console.log('Initializing Car Controller (CONSISTENT CAMERA POSITION)');
        
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('CarController initialized without a car vehicle');
            return;
        }
        
        try {
            // Make sure camera is detached from any parent
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
            }
            
            // CRITICAL FIX: Get the car's current up vector and forward direction
            const surfaceNormal = car.up.clone();
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector that's perpendicular to up and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate surface-aligned forward direction for consistency
            // This ensures we have a perfectly orthogonal basis
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Create camera mount as a new object
            const cameraMount = new Object3D();
            cameraMount.name = "CarCameraMount";
            
            // CRITICAL FIX: Position camera mount in world space first, then attach to car
            // This ensures consistent positioning regardless of car's current orientation
            cameraMount.position.copy(car.position);
            
            // Move backward from car along true forward direction
            cameraMount.position.addScaledVector(trueForward, this.cameraDistance);
            
            // Move upward along surface normal
            cameraMount.position.addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Make sure camera mount's up is aligned with surface normal
            cameraMount.up.copy(surfaceNormal);
            
            // Make camera mount look at the car's position
            cameraMount.lookAt(car.position);
            
            // CRITICAL FIX: Add camera mount to the scene temporarily for correct world positioning
            Engine.scene.add(cameraMount);
            
            // Attach camera to the mount with reset orientation
            cameraMount.add(Engine.camera);
            Engine.camera.position.set(0, 0, 0);
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.up.copy(surfaceNormal);
            
            // CRITICAL FIX: Remove camera mount from scene and attach to car
            // This maintains the world position while making it follow the car
            Engine.scene.remove(cameraMount);
            car.add(cameraMount);
            
            // Store reference for later use
            car.userData.cameraMount = cameraMount;
            
            console.log("Camera positioned consistently behind car");
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // Pass input reference to vehicle manager
            VehicleManager.input = this.input;
        } catch (e) {
            console.error('Error during car controller setup:', e);
        }
    }
    
    // Extremely simplified update method - just handle input and update camera orientation
    static update() {
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') return null;
        
        // Check for exit request
        if (this.input.exit) {
            this.input.exit = false;
            return 'exit';
        }
        
        // Process keyboard inputs directly
        if (Engine.keyStates) {
            this.input.movement.set(0, 0, 0); // Clear previous input
            
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
        
        // Ensure camera is still attached correctly
        if (car.userData.cameraMount && Engine.camera.parent !== car.userData.cameraMount) {
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            car.userData.cameraMount.add(Engine.camera);
            Engine.camera.position.set(0, 0, 0);
            Engine.camera.rotation.set(0, 0, 0);
        }
        
        // CRITICAL FIX: Update camera mount's up vector to match the car's
        if (car.userData.cameraMount) {
            // Get the car's current up vector (which should be the planet's surface normal)
            const currentSurfaceNormal = car.up.clone();
            
            // Update camera mount's up vector
            car.userData.cameraMount.up.copy(currentSurfaceNormal);
            
            // Also update camera's up vector directly for extra certainty
            Engine.camera.up.copy(currentSurfaceNormal);
        }
        
        // Clone input for vehicle manager
        VehicleManager.input = {
            movement: this.input.movement.clone(),
            rotation: this.input.rotation.clone(),
            action: this.input.action,
            exit: this.input.exit
        };
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        const car = VehicleManager.currentVehicle;
        
        // Detach camera from car and reset
        if (Engine.camera.parent) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Clean up the camera mount if it exists
        if (car && car.userData.cameraMount) {
            car.remove(car.userData.cameraMount);
            car.userData.cameraMount = null;
        }
        
        // Reset camera orientation
        Engine.camera.rotation.set(0, 0, 0);
        Engine.camera.quaternion.identity();
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
