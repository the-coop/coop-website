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
    static cameraDistance = 20; // Distance behind car for better visibility
    static cameraHeight = 8;    // Height above car for better overview
    static cameraLookOffset = 2; // Look ahead of car
    
    // Remove animation tracking properties
    
    // ThirdPerson-style reset with IMMEDIATE positioning
    static reset() {
        console.log('Initializing Car Controller (Direct Positioning)');
        
        const car = VehicleManager.currentVehicle;
        if (!car || car.userData.type !== 'car') {
            console.error('CarController initialized without a car vehicle');
            return;
        }
        
        try {
            // Make sure camera is detached from any parent
            if (Engine.camera.parent) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Reset camera orientation
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.quaternion.identity();
            
            // Position camera immediately - no lerping/animation
            this.updateCameraPosition(car, 1.0);
            
            console.log("Car camera set with immediate positioning");
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
            
            // CRITICAL FIX: Ensure input object is passed to VehicleManager
            VehicleManager.input = this.input;
            
            console.log("Car controller initialized with input:", this.input);
        } catch (e) {
            console.error('Error during car controller setup:', e);
        }
    }
    
    // SIMPLIFIED: Direct camera positioning without animation
    static updateCameraPosition(car) {
        if (!car) return;
        
        try {
            // Get car position
            const carPos = car.position.clone();
            
            // Get surface normal (up direction relative to planet)
            const surfaceNormal = car.up.clone();
            
            // Get car's forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Calculate right vector perpendicular to up and forward
            const rightVector = new Vector3().crossVectors(surfaceNormal, carForward).normalize();
            
            // Recalculate true forward direction perpendicular to surface normal and right vector
            const trueForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
            
            // Calculate camera position - behind and above car
            const cameraPosition = carPos.clone();
            
            // Position camera behind car (opposite of forward direction)
            cameraPosition.addScaledVector(trueForward, -this.cameraDistance);
            
            // Position camera above car along surface normal
            cameraPosition.addScaledVector(surfaceNormal, this.cameraHeight);
            
            // Calculate look target slightly ahead of the car for better view
            const lookTarget = carPos.clone();
            lookTarget.addScaledVector(trueForward.clone().negate(), -this.cameraLookOffset);
            
            // Apply camera position DIRECTLY - no lerping
            Engine.camera.position.copy(cameraPosition);
            Engine.camera.up.copy(surfaceNormal);
            Engine.camera.lookAt(lookTarget);
            
        } catch (e) {
            console.error("Error updating car camera:", e);
        }
    }
    
    // Handle driving controls
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
            // CRITICAL FIX: Clear movement BEFORE setting new values
            this.input.movement.set(0, 0, 0);
            
            // Forward/Backward
            if (Engine.keyStates['KeyW'] || Engine.keyStates['ArrowUp'] || Engine.keyStates['Space']) {
                this.input.movement.z = -1; // Forward
                console.log("Car forward input detected");
            }
            else if (Engine.keyStates['KeyS'] || Engine.keyStates['ArrowDown']) {
                this.input.movement.z = 1;  // Backward
                console.log("Car backward input detected");
            }
            
            // Left/Right
            if (Engine.keyStates['KeyA'] || Engine.keyStates['ArrowLeft']) {
                this.input.movement.x = -1; // Left
                console.log("Car left input detected");
            }
            else if (Engine.keyStates['KeyD'] || Engine.keyStates['ArrowRight']) {
                this.input.movement.x = 1;  // Right
                console.log("Car right input detected");
            }
        }
        
        // Update camera position directly - no animation/lerping
        this.updateCameraPosition(car);
        
        // CRITICAL FIX: Create a clean clone of input for vehicle manager
        // and make sure we're actually setting the reference properly
        VehicleManager.input = {
            movement: this.input.movement.clone(),
            rotation: this.input.rotation.clone(),
            action: this.input.action,
            exit: this.input.exit
        };
        
        // Debug log when input is provided
        if (Math.abs(this.input.movement.x) > 0.01 || Math.abs(this.input.movement.z) > 0.01) {
            console.log(`Car input: x=${this.input.movement.x}, z=${this.input.movement.z}`);
            console.log("VehicleManager input set:", VehicleManager.input);
        }
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
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
