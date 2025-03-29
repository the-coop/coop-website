import { Vector3, Quaternion } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';

export default class AirplaneController {
    // Input adapter that standardizes different input methods
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        exit: false
    };
    
    static reset() {
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle) return;
        
        console.log("Airplane controller reset");
        
        // Clean up existing camera setup
        if (Engine.camera.parent) {
            Engine.camera.parent.remove(Engine.camera);
        }
        
        // Position camera for airplane view
        Engine.camera.position.set(0, 1, 0);
        Engine.camera.rotation.set(0, Math.PI, 0);
        
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
            console.log("Airplane exit requested");
            return 'exit';
        }
        
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle || !vehicle.player) return;
        
        const player = vehicle.player;
        
        // Handle movement
        if (this.input.movement.lengthSq() > 0 || this.input.rotation.lengthSq() > 0) {
            // Forward/backward thrust
            if (Math.abs(this.input.movement.z) > 0.01) {
                const thrust = vehicle.flyingSpeed * this.input.movement.z * -1;
                const forwardDir = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
                player.velocity.addScaledVector(forwardDir, thrust);
            }
            
            // Roll (x-axis rotation)
            if (Math.abs(this.input.movement.x) > 0.01) {
                const rollRotation = new Quaternion().setFromAxisAngle(
                    new Vector3(0, 0, 1),
                    vehicle.turnSpeed * this.input.movement.x
                );
                vehicle.mesh.quaternion.premultiply(rollRotation);
            }
            
            // Pitch (y-axis rotation)
            if (Math.abs(this.input.movement.y) > 0.01) {
                const pitchRotation = new Quaternion().setFromAxisAngle(
                    new Vector3(1, 0, 0),
                    vehicle.turnSpeed * this.input.movement.y
                );
                vehicle.mesh.quaternion.premultiply(pitchRotation);
            }
        }
        
        // Apply airplane-specific physics
        
        // Add lift when moving forward
        const speed = player.velocity.length();
        if (speed > 0.5) {
            // Apply lift in the "up" direction of the airplane
            const upVector = new Vector3(0, 1, 0).applyQuaternion(vehicle.mesh.quaternion);
            player.velocity.addScaledVector(upVector, vehicle.liftRate * Math.min(speed * 0.02, 0.15));
        }
        
        // Apply some auto-stabilization when not actively being controlled
        if (this.input.movement.length() < 0.1 && !player.surfaceNormal) {
            // Get the current up vector of the airplane
            const currentUp = new Vector3(0, 1, 0).applyQuaternion(vehicle.mesh.quaternion);
            const worldUp = new Vector3(0, 1, 0);
            
            // Calculate how much the plane is banked
            const bankAngle = worldUp.angleTo(currentUp);
            if (bankAngle > 0.1) {
                // Apply a gentle corrective force to level out
                const correction = new Quaternion().setFromUnitVectors(currentUp, worldUp);
                // Apply only a small amount of the correction for smooth transition
                const smoothCorrection = new Quaternion().slerp(correction, 0.01);
                vehicle.mesh.quaternion.premultiply(smoothCorrection);
            }
        }
        
        // Apply air resistance - less than car
        player.velocity.multiplyScalar(0.98);
        
        // Cap speed
        if (speed > 25) {
            player.velocity.normalize().multiplyScalar(25);
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
    }
}
