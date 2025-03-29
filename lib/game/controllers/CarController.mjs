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
        if (!vehicle) return;
        
        // Clean up existing camera setup
        if (Engine.camera.parent !== vehicle.mesh) {
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            // Position camera higher for better visibility
            Engine.camera.position.set(0, 3, 1); // Higher and slightly behind
            Engine.camera.rotation.set(-0.2, Math.PI, 0); // Slight downward angle
            vehicle.mesh.add(Engine.camera);
        }
        
        console.log("Car controller reset, camera attached to vehicle");
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
        
        console.log("Car controller cleanup complete");
    }
    
    static update() {
        const vehicle = VehicleManager.currentVehicle;
        if (!vehicle) return;
        
        if (this.input.exit) {
            console.log("Car exit requested");
            return 'exit';
        }
        
        // Handle acceleration/brake
        const speed = vehicle.groundSpeed * this.input.movement.z * -1;
        if (Math.abs(speed) > 0.01) {
            // Create forward direction vector
            const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
            vehicle.velocity.addScaledVector(direction, speed);
            
            // Add a small amount of friction to prevent runaway speeds
            if (vehicle.velocity.lengthSq() > 100) {
                vehicle.velocity.normalize().multiplyScalar(10);
            }
        }
        
        // Handle turning - only effective when moving
        if (Math.abs(this.input.movement.x) > 0.01 && vehicle.velocity.lengthSq() > 0.1) {
            // Turn more sharply at lower speeds, less at higher speeds
            const speed = vehicle.velocity.length();
            const speedFactor = 1 / (1 + speed * 0.05); // Higher speeds = smaller factor
            const rotationAngle = vehicle.turnSpeed * this.input.movement.x * -1 * speedFactor * 1.5;
            
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
                
                // Orientate the car to align with surface normal as "up"
                // Direction of travel is more important than input direction for visual feedback
                vehicle.mesh.up.copy(surfaceNormal);
                
                // Point the car in the direction it's moving
                if (speed > 0.5) {
                    const projectedVelocity = vehicle.velocity.clone()
                        .projectOnPlane(surfaceNormal)
                        .normalize();
                    
                    if (projectedVelocity.lengthSq() > 0.5) {
                        const lookTarget = vehicle.mesh.position.clone().add(projectedVelocity);
                        const lookMatrix = new THREE.Matrix4().lookAt(
                            vehicle.mesh.position,
                            lookTarget,
                            surfaceNormal
                        );
                        const lookQuaternion = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);
                        
                        // Blend current rotation with desired rotation for smoother turning
                        vehicle.mesh.quaternion.slerp(lookQuaternion, 0.05);
                    }
                }
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
            const gravityForce = gravityDir.multiplyScalar(0.08); // Slightly increased gravity
            vehicle.velocity.add(gravityForce);
            
            // Apply friction based on planet's coefficient of friction
            const frictionFactor = 0.92 + (vehicle.planet.CoF || 0);
            vehicle.velocity.multiplyScalar(frictionFactor);
            
            // If car is nearly stopped, apply extra friction to prevent perpetual tiny sliding
            if (vehicle.velocity.lengthSq() < 0.01) {
                vehicle.velocity.multiplyScalar(0.8);
            }
        } else {
            // Less friction in space
            vehicle.velocity.multiplyScalar(0.98);
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.exit = false;
    }
}
