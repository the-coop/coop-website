import { Quaternion, Vector3 } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    static MOVE_SPEED = 0.5;
    static PLAYER_HEIGHT = 1.8;

    // Track cumulative pitch and yaw
    static pitch = 0;
    static yaw = 0;

    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false // Add jump input
    };

    static reset() {
        const player = PlayersManager.self;
        Engine.camera.position.set(0, 0, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
        this.pitch = 0; // Reset stored pitch
        this.yaw = 0;   // Reset stored yaw
    }

    static update() {
        const player = PlayersManager.self;
        const camera = Engine.camera;

        // Handle movement
        if (this.input.movement.length() > 0) {
            const movement = this.input.movement.clone().multiplyScalar(this.MOVE_SPEED);
            movement.applyQuaternion(player.quaternion);
            
            if (player.falling) {
                player.position.add(movement);
            } else {
                const up = player.position.clone()
                    .sub(player.soi.position)
                    .normalize();
                const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
                const right = forward.cross(up).normalize();
                
                // Project movement onto the tangent plane
                movement.projectOnPlane(up);
                
                player.position.add(movement);
            }
        }

        // Handle rotation (applied to player)
        if (this.input.rotation.length() > 0) {
            const rotX = this.input.rotation.x;
            const rotY = this.input.rotation.y;

            // Update yaw
            if (rotX) {
                this.yaw += rotX;
                const up = player.position.clone()
                    .sub(player.soi.position)
                    .normalize();
                player.rotateOnWorldAxis(up, rotX);
            }

            // Update pitch
            if (rotY) {
                this.pitch += rotY;
                // Clamp pitch to prevent spiral
                this.pitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, this.pitch));
                
                // Calculate pitch delta based on clamped pitch
                const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
                const up = player.position.clone().sub(player.soi.position).normalize();
                const right = forward.cross(up).normalize();

                // Reset rotation to current pitch to prevent accumulation
                player.quaternion.setFromAxisAngle(right, this.pitch);
            }
        }

        // Handle jump input
        if (this.input.jump && !player.falling) {
            // Apply upward velocity (adjust the value as needed)
            player.velocity.y = 10; // Example jump strength
            player.falling = true;
            
            // Reset jump input
            this.input.jump = false;
        }

        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
    }

    // Called from ControlManager on landing
    static onLanding() {
        this.setAimToHorizon();
        this.pitch = 0; 
        this.yaw = 0;
    }

    static setAimToHorizon() {
        const player = PlayersManager.self;
        const camera = Engine.camera;

        const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
        const up = player.position.clone().sub(player.soi.position).normalize();
        const forwardTangent = forward.clone().sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
        const desiredQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), forwardTangent);
        
        player.quaternion.copy(desiredQuaternion.multiply(player.quaternion));

        if (camera.parent === player) {
            camera.rotation.set(0, 0, 0);
        }
    };

};