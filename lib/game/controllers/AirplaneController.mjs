import { Vector3, Quaternion, Euler, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import PlayersManager from '../players.mjs';
import VehicleManager from '../vehicles.mjs';

// Controller specifically for airplane vehicle operation
export default class AirplaneController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };
    
    // Camera configuration for airplane
    static cameraDistance = 20;  // Distance behind airplane
    static cameraHeight = 5;     // Height above airplane
    static cameraLookAhead = 10; // How far ahead to look
    
    // Used for initial setup and when switching to this controller
    static reset() {
        console.log('Initializing Airplane Controller');
        
        // Get the current airplane vehicle
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('AirplaneController initialized without an airplane vehicle');
            return;
        }
        
        console.log('Airplane found, preparing camera transition');
        
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
            
            // Step 3: Now attach camera to airplane
            console.log('Attaching camera to airplane');
            airplane.add(Engine.camera);
            
            // Position the camera behind and slightly above the airplane in local space
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
            
            // CRITICAL FIX: Get the correct surface normal from the vehicle's planet
            const planet = airplane.userData.planet;
            if (planet) {
                const planetCenter = planet.object.position;
                const toVehicle = airplane.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                
                // Check if we're grounded or in flight
                if (airplane.userData.altitude <= 0) {
                    // When on ground, camera should use planet's surface normal as up
                    const targetPoint = new Vector3(0, 0, -this.cameraLookAhead);
                    Engine.camera.lookAt(targetPoint);
                    Engine.camera.up.copy(surfaceNormal);
                } else {
                    // In flight, we can use airplane's local up as the camera up
                    // This creates a more natural flight experience
                    const targetPoint = new Vector3(0, 0, -this.cameraLookAhead);
                    Engine.camera.lookAt(targetPoint);
                    
                    // During flight, match the airplane's orientation but adjust slightly
                    // toward planet's surface normal to prevent disorientation
                    const upVector = new Vector3(0, 1, 0);
                    upVector.lerp(surfaceNormal, 0.3);
                    Engine.camera.up.copy(upVector);
                }
            } else {
                // Fallback if planet data isn't available
                Engine.camera.lookAt(new Vector3(0, 0, -this.cameraLookAhead));
                Engine.camera.up.set(0, 1, 0);
            }
            
            console.log('Camera successfully attached to airplane');
            
            // Reset input state
            this.input.movement.set(0, 0, 0);
            this.input.rotation.set(0, 0, 0);
            this.input.action = false;
            this.input.exit = false;
        } catch (e) {
            console.error('Error during airplane camera setup:', e);
        }
        
        // Prepare the player state for being in a vehicle
        if (PlayersManager.self) {
            console.log('Setting player state for airplane control');
            PlayersManager.self.falling = false;
        }
        
        console.log('Camera attached to airplane, setup complete');
    }
    
    // Handle in-flight controls
    static update() {
        const airplane = VehicleManager.currentVehicle;
        if (!airplane || airplane.userData.type !== 'airplane') {
            console.error('No valid airplane found for controller');
            return null;
        }
        
        // Check for exit request
        if (this.input.exit) {
            this.input.exit = false;
            return 'exit';
        }
        
        // Pass movement inputs to VehicleManager for consistent handling
        VehicleManager.input = this.input;
        
        // Make sure camera stays attached to the airplane
        if (Engine.camera.parent !== airplane) {
            console.log('Re-attaching camera to airplane');
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            airplane.add(Engine.camera);
            
            // Reset camera position
            Engine.camera.position.set(0, this.cameraHeight, this.cameraDistance);
        }
        
        // CRITICAL FIX: Update camera orientation based on airplane state
        if (airplane.userData.planet) {
            const planetCenter = airplane.userData.planet.object.position;
            const toVehicle = airplane.position.clone().sub(planetCenter).normalize();
            
            // Smoothly adjust camera position
            const idealPosition = new Vector3(0, this.cameraHeight, this.cameraDistance);
            Engine.camera.position.lerp(idealPosition, 0.1);
            
            // Look target remains forward
            const lookTarget = new Vector3(0, 0, -this.cameraLookAhead);
            
            // Adjust camera orientation based on flight state
            if (airplane.userData.altitude <= 0) {
                // On ground - use surface normal directly
                Engine.camera.up.copy(toVehicle);
            } else {
                // In flight - blend between airplane's up vector and planet's surface normal
                // This creates a more stable view during aerobatics
                const upVector = new Vector3(0, 1, 0).applyQuaternion(airplane.quaternion);
                upVector.lerp(toVehicle, 0.2); // 20% influence from planet
                Engine.camera.up.copy(upVector);
            }
            
            Engine.camera.lookAt(lookTarget);
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
        
        return null;
    }
    
    static cleanup() {
        console.log('Cleaning up Airplane Controller');
        
        // Explicitly detach camera from airplane and add to scene
        if (Engine.camera.parent) {
            const worldPos = new Vector3();
            Engine.camera.getWorldPosition(worldPos);
            
            console.log('Detaching camera in AirplaneController.cleanup()');
            Engine.camera.parent.remove(Engine.camera);
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
        }
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
        this.input.exit = false;
    }
}
