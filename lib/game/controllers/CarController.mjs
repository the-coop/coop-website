import { Vector3, Quaternion } from 'three';
import Engine from '../engine.mjs';
import VehicleManager from '../vehicles.mjs';

export default class CarController {
    // Input state for car controller
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        exit: false
    };
    
    static reset() {
        // Position camera for car view
        const vehicle = VehicleManager.currentVehicle;
        Engine.camera.position.set(0, 1.5, -0.5);
        Engine.camera.rotation.set(0, Math.PI, 0);
        vehicle.mesh.add(Engine.camera);
    }
    
    static update() {
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle) return;
        
        if (this.input.exit) {
            return 'exit';
        }
        
        // Handle acceleration/brake
        const speed = vehicle.groundSpeed * this.input.movement.z * -1;
        if (Math.abs(speed) > 0.01) {
            // Create forward direction vector
            const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
            vehicle.velocity.addScaledVector(direction, speed);
        }
        
        // Handle turning
        if (Math.abs(this.input.movement.x) > 0.01) {
            const rotationAngle = vehicle.turnSpeed * this.input.movement.x * -1;
            
            // If on a planet, rotate around the planet's normal axis
            if (vehicle.planet) {
                const planetCenter = vehicle.planet.object.position;
                const surfaceNormal = new Vector3()
                    .subVectors(vehicle.mesh.position, planetCenter)
                    .normalize();
                
                const rotation = new Quaternion().setFromAxisAngle(
                    surfaceNormal,
                    rotationAngle
                );
                
                vehicle.mesh.quaternion.premultiply(rotation);
                
                // Make sure the vehicle stays aligned with the planet surface
                const forwardVec = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
                const rightVec = new Vector3().crossVectors(surfaceNormal, forwardVec).normalize();
                const adjustedForward = new Vector3().crossVectors(rightVec, surfaceNormal).normalize();
                
                // Re-orient vehicle to align with surface normal as "up"
                vehicle.mesh.up.copy(surfaceNormal);
                
                // Ensure forward direction is tangent to planet surface
                const targetPos = new Vector3().addVectors(
                    vehicle.mesh.position,
                    adjustedForward
                );
                vehicle.mesh.lookAt(targetPos);
            } else {
                // Standard turning in space
                const rotation = new Quaternion().setFromAxisAngle(
                    new Vector3(0, 1, 0),
                    rotationAngle
                );
                vehicle.mesh.quaternion.premultiply(rotation);
            }
        }
        
        // Apply gravity if on a planet
        if (vehicle.planet) {
            const planetCenter = vehicle.planet.object.position;
            const gravityDir = new Vector3().subVectors(planetCenter, vehicle.mesh.position).normalize();
            const gravityForce = gravityDir.multiplyScalar(0.05); // Adjust gravity strength
            vehicle.velocity.add(gravityForce);
            
            // Keep car aligned with planet surface
            vehicle.mesh.up.copy(gravityDir.clone().negate());
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.exit = false;
    }
}
