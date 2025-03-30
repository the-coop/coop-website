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
    static cameraLookOffset = 0; // Forward offset for where camera looks
    static cameraLerpSpeed = 0.05; // How quickly the camera follows the car
    
    // Simplified tracking properties
    static _lastLookAtPos = new Vector3();
    static _lastCameraUp = new Vector3(0, 1, 0);
    static _smoothedCarForward = new Vector3(0, 0, -1);
    static _initialSetupComplete = false;

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
            // SIMPLIFIED: Complete camera reset with no transition
            this._resetCameraCompletely();
            
            // Stabilize the car orientation
            this._stabilizeCarOrientation(car);
            
            // Get planet and surface normal
            const planetCenter = car.userData.planet?.object?.position;
            if (!planetCenter) {
                console.error('No planet data for camera setup');
                return;
            }
            
            const toVehicle = car.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize();
            
            // Initialize tracking variables for stable camera
            this._lastCameraUp = surfaceNormal.clone();
            this._smoothedCarForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // SIMPLIFIED: Direct camera placement with no interpolation
            // 1. Get forward direction
            const forward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // 2. Calculate desired camera position behind car
            const cameraPos = new Vector3()
                .copy(car.position)
                .addScaledVector(forward, -this.cameraDistance) // Move backward
                .addScaledVector(surfaceNormal, this.cameraHeight); // Move up
            
            // 3. Position camera directly
            Engine.camera.position.copy(cameraPos);
            
            // 4. Calculate look target
            const lookAtPos = car.position.clone();
            this._lastLookAtPos = lookAtPos.clone();
            
            // 5. Orient camera
            Engine.camera.up.copy(surfaceNormal);
            Engine.camera.lookAt(lookAtPos);

            // Skip first frame transition
            this._initialSetupComplete = true;
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
        } catch (e) {
            console.error('Error during car camera setup:', e);
        }
    }
    
    // Helper method for complete camera reset
    static _resetCameraCompletely() {
        if (Engine.camera.parent) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Reset all camera properties
        Engine.camera.rotation.set(0, 0, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1); // Identity quaternion
        Engine.camera.up.set(0, 1, 0);
        Engine.camera.scale.set(1, 1, 1);
        Engine.camera.updateMatrix();
        Engine.camera.updateMatrixWorld(true);
    }
    
    // Stabilize car orientation before setting up camera
    static _stabilizeCarOrientation(car) {
        if (!car || !car.userData.planet) return;
        
        try {
            // Get planet surface normal for proper alignment
            const planetCenter = car.userData.planet.object.position;
            const toVehicle = car.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize();
            
            // First ensure car is exactly at right height
            const targetHeight = car.userData.planet.radius + 3; // Consistent height offset
            car.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
            
            // Get current forward vector and project onto surface plane
            const currentForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            const projectedForward = currentForward.projectOnPlane(surfaceNormal).normalize();
            
            // If projection fails, use a reliable alternative
            if (projectedForward.lengthSq() < 0.01) {
                // Find a vector perpendicular to up
                if (Math.abs(surfaceNormal.y) < 0.9) {
                    projectedForward.set(0, 1, 0).cross(surfaceNormal).normalize();
                } else {
                    projectedForward.set(1, 0, 0).cross(surfaceNormal).normalize();
                }
            }
            
            // Direct alignment to avoid any interpolation issues
            car.up.copy(surfaceNormal);
            const lookTarget = car.position.clone().add(projectedForward);
            car.lookAt(lookTarget);
            
            // Force exact quaternion to avoid any further adjustments
            car.updateMatrixWorld(true);
            
            // Zero out all velocities
            car.userData.velocity = new Vector3(0, 0, 0);
            car.userData.speed = 0;
            
            // Set stabilization flag for physics to respect
            car.userData._stabilizeUntil = Date.now() + 1000; // 1 second stabilization period
            
            console.log('Car orientation stabilized for camera setup');
        } catch (e) {
            console.error('Error stabilizing car orientation:', e);
        }
    }
    
    // SIMPLIFIED camera update method - more stable and predictable
    static _updateExternalCamera(car, strength = this.cameraLerpSpeed) {
        if (!car) return;
        
        try {
            // Get planet and surface normal
            const planetCenter = car.userData.planet?.object?.position;
            if (!planetCenter) return;
            
            const toVehicle = car.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize();
            
            // Use minimal smoothing for the up vector
            if (!this._lastCameraUp) this._lastCameraUp = surfaceNormal.clone();
            const smoothedUp = this._lastCameraUp.clone().lerp(surfaceNormal, 0.1);
            this._lastCameraUp = smoothedUp.clone();
            
            // Get the car's forward direction
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Create a right vector perpendicular to up and forward
            const rightVector = new Vector3().crossVectors(smoothedUp, carForward).normalize();
            
            // Re-calculate forward for perfect orthogonality with surface
            const projectedForward = new Vector3().crossVectors(rightVector, smoothedUp).normalize();
            
            // Calculate the desired camera position behind the car
            const offsetPosition = new Vector3()
                .copy(car.position)
                .addScaledVector(projectedForward, -this.cameraDistance)
                .addScaledVector(smoothedUp, this.cameraHeight);
            
            // Smooth camera position movement with appropriate strength
            Engine.camera.position.lerp(offsetPosition, strength);
            
            // Calculate look target at car position
            const lookAtPosition = car.position.clone();
            
            // Smooth the look target with same strength for consistent movement
            if (!this._lastLookAtPos) this._lastLookAtPos = lookAtPosition.clone();
            this._lastLookAtPos.lerp(lookAtPosition, strength);
            
            // Apply camera orientation - look at target with surface-aligned up vector
            Engine.camera.up.copy(smoothedUp);
            Engine.camera.lookAt(this._lastLookAtPos);
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
        
        // Apply a constant moderate camera smoothing value
        this._updateExternalCamera(car, 0.04);
        
        // Cancel stabilization if input provided
        if (this.input.movement.lengthSq() > 0.01 && car.userData._stabilizeUntil) {
            car.userData._stabilizeUntil = 0;
        }
        
        // IMPROVED: Apply progressive easing to steering for smoother car control
        if (Math.abs(this.input.movement.x) > 0.01) {
            // Apply steering with gradual increase
            this.input.movement.x = Math.sign(this.input.movement.x) * Math.pow(Math.abs(this.input.movement.x), 0.8);
        }
        
        // IMPROVED: Apply non-linear response to acceleration for better control
        if (Math.abs(this.input.movement.z) > 0.01) {
            // Apply acceleration with gradual increase
            this.input.movement.z = Math.sign(this.input.movement.z) * Math.pow(Math.abs(this.input.movement.z), 0.7);
        }
        
        // Ensure inputs are passed to vehicle manager EVERY frame
        VehicleManager.input = this.input;
        
        // Reset input for next frame
        const oldInput = {
            movement: this.input.movement.clone(),
            rotation: this.input.rotation.clone()
        };
        
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up Car Controller');
        
        // Just make sure rotation is reset to avoid issues with next controller
        Engine.camera.rotation.set(0, 0, 0);
        
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
