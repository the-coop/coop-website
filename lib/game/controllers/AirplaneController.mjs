import { Vector3, Quaternion, Matrix4 } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';

export default class AirplaneController {
    // Input state for airplane controller
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        exit: false
    };
    
    static reset() {
        // Position camera for airplane view
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle) return;
        
        // Clean up existing camera setup
        if (Engine.camera.parent !== vehicle.mesh) {
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            // Position camera for better cockpit-like view
            Engine.camera.position.set(0, 1, 0); // Higher position
            Engine.camera.rotation.set(0, Math.PI, 0);
            vehicle.mesh.add(Engine.camera);
        }
        
        console.log("Airplane controller reset, camera attached to vehicle");
    }
    
    static cleanup() {
        // Make sure we detach the camera before switching controllers
        if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
            // Get the camera's world position/orientation before detaching
            const worldPos = new Vector3();
            const worldQuat = new Quaternion();
            Engine.camera.getWorldPosition(worldPos);
            Engine.camera.getWorldQuaternion(worldQuat);
            
            // Remove from parent
            Engine.camera.parent.remove(Engine.camera);
            
            // Add to scene and maintain world position
            Engine.scene.add(Engine.camera);
            Engine.camera.position.copy(worldPos);
            Engine.camera.quaternion.copy(worldQuat);
        }
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.exit = false;
        
        console.log("Airplane controller cleanup complete");
    }
    
    static update() {
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle) return;
        
        if (this.input.exit) {
            console.log("Airplane exit requested");
            return 'exit';
        }
        
        // Handle thrust - with increased impact
        const thrust = vehicle.flyingSpeed * this.input.movement.z * -1 * 1.5;
        if (Math.abs(thrust) > 0.01) {
            // Create forward direction vector
            const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
            vehicle.velocity.addScaledVector(direction, thrust);
        }
        
        // Handle roll (x-axis rotation)
        if (Math.abs(this.input.movement.x) > 0.01) {
            const rollRotation = new Quaternion().setFromAxisAngle(
                new Vector3(0, 0, 1),
                vehicle.turnSpeed * this.input.movement.x * 1.5
            );
            vehicle.mesh.quaternion.premultiply(rollRotation);
        }
        
        // Handle pitch (y-axis rotation)
        if (Math.abs(this.input.movement.y) > 0.01) {
            const pitchRotation = new Quaternion().setFromAxisAngle(
                new Vector3(1, 0, 0),
                vehicle.turnSpeed * this.input.movement.y * 1.5
            );
            vehicle.mesh.quaternion.premultiply(pitchRotation);
        }
        
        // Add lift when moving forward - more pronounced effect
        const speed = vehicle.velocity.length();
        if (speed > 0.5) {
            // Apply lift in the "up" direction of the airplane
            // Lift increases with speed
            const liftFactor = Math.min(speed * 0.01, 0.1); 
            const upVector = new Vector3(0, 1, 0).applyQuaternion(vehicle.mesh.quaternion);
            vehicle.velocity.addScaledVector(upVector, vehicle.liftRate + liftFactor);
        }
        
        // Apply some auto-stabilization when not actively being controlled
        if (this.input.movement.length() < 0.1) {
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
        
        // Limit maximum speed
        if (speed > 20) {
            vehicle.velocity.normalize().multiplyScalar(20);
        }
        
        // Apply air resistance - more at higher speeds
        const drag = 0.98 - (speed * 0.0005);
        vehicle.velocity.multiplyScalar(Math.max(0.95, drag));
        
        // Apply planet gravity if within range, but with less effect than on cars
        const planets = Engine.scene.children.filter(obj => obj.userData?.isPlanet);
        for (const planetObj of planets) {
            const planetCenter = planetObj.position;
            const distToPlanet = vehicle.mesh.position.distanceTo(planetCenter);
            const gravityRadius = planetObj.geometry.parameters.radius * 10; // Gravity effect radius
            
            if (distToPlanet < gravityRadius) {
                // Reduced gravity effect for airplanes
                const gravityStrength = 0.03 * (1 - distToPlanet / gravityRadius);
                const gravityDir = new Vector3().subVectors(planetCenter, vehicle.mesh.position).normalize();
                vehicle.velocity.addScaledVector(gravityDir, gravityStrength);
            }
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.exit = false;
    }
}
