import { Vector3, Quaternion } from 'three';
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
        Engine.camera.position.set(0, 0.5, -0.5);
        Engine.camera.rotation.set(0, Math.PI, 0);
        vehicle.mesh.add(Engine.camera);
    }
    
    static update() {
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle) return;
        
        if (this.input.exit) {
            return 'exit';
        }
        
        // Handle thrust
        const thrust = vehicle.flyingSpeed * this.input.movement.z * -1;
        if (Math.abs(thrust) > 0.01) {
            // Create forward direction vector
            const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
            vehicle.velocity.addScaledVector(direction, thrust);
        }
        
        // Handle roll (x-axis rotation)
        if (Math.abs(this.input.movement.x) > 0.01) {
            const rollRotation = new Quaternion().setFromAxisAngle(
                new Vector3(0, 0, 1),
                vehicle.turnSpeed * this.input.movement.x
            );
            vehicle.mesh.quaternion.premultiply(rollRotation);
        }
        
        // Handle pitch (y-axis rotation)
        if (Math.abs(this.input.movement.y) > 0.01) {
            const pitchRotation = new Quaternion().setFromAxisAngle(
                new Vector3(1, 0, 0),
                vehicle.turnSpeed * this.input.movement.y
            );
            vehicle.mesh.quaternion.premultiply(pitchRotation);
        }
        
        // Add lift when moving forward
        if (vehicle.velocity.length() > 0.5) {
            // Apply lift in the "up" direction of the airplane
            const upVector = new Vector3(0, 1, 0).applyQuaternion(vehicle.mesh.quaternion);
            vehicle.velocity.addScaledVector(upVector, vehicle.liftRate);
        }
        
        // Apply planet gravity if within range
        const planets = Engine.scene.children.filter(obj => obj.userData?.isPlanet);
        for (const planetObj of planets) {
            const planetCenter = planetObj.position;
            const distToPlanet = vehicle.mesh.position.distanceTo(planetCenter);
            const gravityRadius = planetObj.geometry.parameters.radius * 10; // Gravity effect radius
            
            if (distToPlanet < gravityRadius) {
                const gravityStrength = 0.05 * (1 - distToPlanet / gravityRadius);
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
