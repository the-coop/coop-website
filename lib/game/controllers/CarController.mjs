import { Vector3, Quaternion, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';
import PlayersManager from '../players.mjs';

export default class CarController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        exit: false
    };
    
    static reset() {
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle) return;
        
        console.log("Car controller reset");
        
        // Clean up existing camera setup
        if (Engine.camera.parent) {
            Engine.camera.parent.remove(Engine.camera);
        }
        
        // Position camera for car view
        Engine.camera.position.set(0, 3, 1);
        Engine.camera.rotation.set(-0.2, Math.PI, 0);
        
        // Attach camera to vehicle
        vehicle.mesh.add(Engine.camera);
    }
    
    static cleanup() {
        // Cleanup is now handled by VehicleManager.exitVehicle
        // Just reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.exit = false;
    }
    
    static update() {
        if (this.input.exit) {
            console.log("Car exit requested");
            return 'exit';
        }
        
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle || !vehicle.player) return;
        
        const player = vehicle.player;
        
        // Handle movement - similar to FPS controller but with car-specific values
        if (this.input.movement.lengthSq() > 0) {
            // Forward/backward movement (acceleration)
            if (Math.abs(this.input.movement.z) > 0.01) {
                const speed = vehicle.groundSpeed * this.input.movement.z * -1;
                const forwardDir = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
                player.velocity.addScaledVector(forwardDir, speed);
            }
            
            // Turning (left/right)
            if (Math.abs(this.input.movement.x) > 0.01) {
                // Calculate how fast we're moving
                const speed = player.velocity.length();
                const speedFactor = 1 / (1 + speed * 0.05);
                const turnAmount = vehicle.turnSpeed * this.input.movement.x * -1 * speedFactor;
                
                // If on a planet, rotate around the surface normal
                if (player.surfaceNormal) {
                    const rotation = new Quaternion().setFromAxisAngle(
                        player.surfaceNormal,
                        turnAmount
                    );
                    
                    vehicle.mesh.quaternion.premultiply(rotation);
                } else {
                    // Standard turning in space
                    const rotation = new Quaternion().setFromAxisAngle(
                        new Vector3(0, 1, 0),
                        turnAmount
                    );
                    vehicle.mesh.quaternion.premultiply(rotation);
                }
            }
        }
        
        // Apply car-specific physics
        if (player.surfaceNormal) {
            // Keep car aligned with ground surface
            vehicle.mesh.up.copy(player.surfaceNormal);
            
            // Apply additional friction for cars
            player.velocity.multiplyScalar(0.95);
        } else {
            // Space physics - less friction
            player.velocity.multiplyScalar(0.98);
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
    }
}
