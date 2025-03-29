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
    
    // Added smooth tracking properties
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
            // CRITICAL FIX: First stabilize the car to prevent rotation glitches
            this._stabilizeCarOrientation(car);
            
            // CRITICAL FIX: Use a simple, direct camera setup approach to avoid glitching
            // First ensure camera is detached and in the scene
            if (Engine.camera.parent) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
            }
            
            // Reset camera orientation completely to avoid carrying over problematic rotations
            Engine.camera.rotation.set(0, 0, 0);
            Engine.camera.up.set(0, 1, 0);
            
            // Store initial camera state for use during updates
            this._lastCarPosition = car.position.clone();
            
            // Initialize smoothing variables with current values
            const planetCenter = car.userData.planet?.object?.position;
            if (planetCenter) {
                const toVehicle = car.position.clone().sub(planetCenter);
                this._lastCameraUp = toVehicle.normalize().clone();
            }
            
            // Get initial forward direction - already established by stabilization
            this._smoothedCarForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            
            // Initialize lookAt position
            this._lastLookAtPos = car.position.clone();
            
            // First frame, just set camera directly without interpolation
            // Using a direct approach with 100% strength for immediate placement
            this._updateExternalCamera(car, 1.0);
            
            // Mark setup as complete for the update method to work properly
            this._initialSetupComplete = true;
            
            console.log('Car camera setup using stable external camera mode');
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
        } catch (e) {
            console.error('Error during car camera setup:', e);
        }
    }
    
    // NEW METHOD: Stabilize car orientation before setting up camera
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
    
    // Improved more stable camera update method
    static _updateExternalCamera(car, strength = this.cameraLerpSpeed) {
        if (!car) return;
        
        try {
            // Get planet surface normal for proper up vector alignment
            const planetCenter = car.userData.planet?.object?.position;
            if (!planetCenter) return; // Skip if planet data is missing
            
            const toVehicle = car.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize(); // This is our up vector
            
            // Smooth the up vector to prevent camera jitter
            if (!this._lastCameraUp) this._lastCameraUp = surfaceNormal.clone();
            const smoothedUp = this._lastCameraUp.clone().lerp(surfaceNormal, 0.1);
            this._lastCameraUp = smoothedUp.clone();
            
            // Get forward direction in car's local frame with smoothing
            const carForward = new Vector3(0, 0, -1).applyQuaternion(car.quaternion);
            if (!this._smoothedCarForward) this._smoothedCarForward = carForward.clone();
            this._smoothedCarForward.lerp(carForward, 0.1);
            
            // Project the forward vector onto the tangent plane defined by up vector
            // This ensures the camera always stays level with the ground
            const projectedForward = this._smoothedCarForward.clone()
                .projectOnPlane(smoothedUp)
                .normalize();
            
            // CRITICAL FIX: Ensure projection results in a valid vector
            if (projectedForward.lengthSq() < 0.01) {
                // Use a fallback direction perpendicular to up
                if (Math.abs(smoothedUp.y) < 0.9) {
                    projectedForward.set(0, 1, 0).cross(smoothedUp).normalize();
                } else {
                    projectedForward.set(1, 0, 0).cross(smoothedUp).normalize();
                }
            }
            
            // Calculate offset position behind car with consistent math
            const offsetPosition = new Vector3()
                .copy(car.position)                           // Start at car's position
                .addScaledVector(projectedForward, -this.cameraDistance) // Move backward along forward direction
                .addScaledVector(smoothedUp, this.cameraHeight);    // Move up along smoothed surface normal
            
            // Position camera with proper lerping to smooth movement
            // For the first few frames after initialization, use stronger values
            // This helps with the initial setup but prevents jittering later
            let adaptiveStrength;
            
            // If this is our first frame, use full strength for instant setup
            if (!this._initialSetupComplete) {
                adaptiveStrength = 1.0;
            } else {
                const speed = Math.abs(car.userData.speed || 0);
                adaptiveStrength = Math.max(0.03, Math.min(0.2, strength * (1 + speed * 0.01)));
            }
            
            // Apply camera position with appropriate strength
            Engine.camera.position.lerp(offsetPosition, adaptiveStrength);
            
            // Calculate smooth look target position slightly above car
            const lookAtPosition = car.position.clone().addScaledVector(smoothedUp, 1);
            
            // Smooth the look target position as well
            if (!this._lastLookAtPos) this._lastLookAtPos = lookAtPosition.clone();
            this._lastLookAtPos.lerp(lookAtPosition, adaptiveStrength);
            
            // Look at smoothed target position
            Engine.camera.lookAt(this._lastLookAtPos);
            
            // Force camera's up vector to match smoothed surface normal
            Engine.camera.up.copy(smoothedUp);
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
        
        // Update camera with consistent, smooth lerping
        // Use a fixed, moderate value for stability
        this._updateExternalCamera(car, 0.05);
        
        // CRITICAL FIX: Apply input to cancel stabilization if needed
        if (this.input.movement.lengthSq() > 0.01 && car.userData._stabilizeUntil) {
            car.userData._stabilizeUntil = 0;
            console.log("Car stabilization canceled due to movement input");
        }
        
        // CRITICAL FIX: Ensure inputs are passed to vehicle manager EVERY frame
        VehicleManager.input = this.input;
        
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
        
        // Reset smoothing variables
        this._lastLookAtPos = new Vector3();
        this._lastCameraUp = new Vector3(0, 1, 0);
        this._smoothedCarForward = new Vector3(0, 0, -1);
        this._initialSetupComplete = false;
    }
}
