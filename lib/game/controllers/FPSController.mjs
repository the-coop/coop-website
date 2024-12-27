import { Quaternion, Vector3, Matrix4 } from 'three';
import Gamepad from './inputs/gamepad.mjs';
import PC from './inputs/pc.mjs';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    static MOVE_SPEED = 0.5;
    static JUMP_FORCE = 0.3;
    static MAX_ANGLE = Math.PI * 0.45; // 45 degrees up/down limit
    static MOUSE_SENSITIVITY = 0.005; // Add sensitivity control
    static rotation = new Quaternion();
    static movement = new Vector3();
    static lastUpVector = new Vector3(0, 1, 0);
    static PLAYER_HEIGHT = 1.8;  // Add player height constant

    static onGrounded(player) {
        const up = player.position.clone()
            .sub(player.soi.position)
            .normalize();
            
        if (!this.lastUpVector.equals(up)) {
            // Create rotation to align with surface and look at horizon
            const matrix = new Matrix4();
            
            // Calculate right vector (perpendicular to up)
            const right = new Vector3(1, 0, 0)
                .cross(up)
                .normalize();
                
            // Calculate forward vector (perpendicular to up and right)
            const forward = up.clone()
                .cross(right)
                .normalize();
            
            // Build rotation matrix looking along horizon
            matrix.makeBasis(right, up, forward);
            
            this.lastUpVector.copy(up);
            
            // Snap to horizon-aligned orientation
            const targetQuat = new Quaternion().setFromRotationMatrix(matrix);
            player.quaternion.copy(targetQuat);
        }
    }

    static alignToSurface(player) {
        const up = player.position.clone()
            .sub(player.soi.position)
            .normalize();
            
        // Calculate right vector (perpendicular to current forward and up)
        const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
        const right = forward.clone().cross(up).normalize();
        
        // Recalculate forward to be perpendicular to right and up
        forward.crossVectors(up, right).normalize();
        
        // Build and apply rotation matrix
        const matrix = new Matrix4();
        matrix.makeBasis(right, up, forward);
        
        // Update orientation
        this.lastUpVector.copy(up);
        player.quaternion.setFromRotationMatrix(matrix);
    }

    static reset() {
        console.log('Resetting FPS controller');
        // Remove camera from scene if it's already attached somewhere
        Engine.camera.parent?.remove(Engine.camera);
        
        // Position camera at the player's position
        Engine.camera.position.set(0, 1, 0);
        Engine.camera.rotation.set(0, 0, 0);
        
        // Add camera directly to player
        PlayersManager.self.add(Engine.camera);
        
        // Reset player rotation
        PlayersManager.self.rotation.set(0, 0, 0);
        this.rotation.identity();
    };

    static handleMovement() {
        const moveSpeed = this.MOVE_SPEED;
        this.movement.set(0, 0, 0);
        const player = PlayersManager.self;

        // Handle jump - only when grounded
        if (player.grounded && (PC.isKeyPressed('Space') || Gamepad.isButtonPressed(0))) {
            player.velocity.add(player.position.clone()
                .sub(player.soi.position)
                .normalize()
                .multiplyScalar(this.JUMP_FORCE));
            player.jumping = true;
            player.grounded = false;
            player.falling = false;
        }

        // WASD Movement
        if (PC.isKeyPressed('KeyW')) this.movement.z -= moveSpeed;
        if (PC.isKeyPressed('KeyS')) this.movement.z += moveSpeed;
        if (PC.isKeyPressed('KeyA')) this.movement.x -= moveSpeed;
        if (PC.isKeyPressed('KeyD')) this.movement.x += moveSpeed;

        // Gamepad left stick movement
        const gamepadX = Gamepad.getAxisValue(0);
        const gamepadY = Gamepad.getAxisValue(1);
        if (Math.abs(gamepadX) > 0.1) this.movement.x += gamepadX * moveSpeed;
        if (Math.abs(gamepadY) > 0.1) this.movement.z += gamepadY * moveSpeed;

        // Apply movement relative to player's rotation
        if (this.movement.length() > 0) {
            this.movement.applyQuaternion(player.quaternion);
            
            if (player.grounded) {
                // Get current up vector from planet center
                const up = player.position.clone()
                    .sub(player.soi.position)
                    .normalize();
                
                // Project movement onto surface plane
                const dot = this.movement.dot(up);
                if (dot !== 0) {
                    this.movement.addScaledVector(up, -dot);
                }
                
                // Move player
                player.position.add(this.movement);
                
                // Realign with surface after movement
                this.alignToSurface(player);
            } else {
                player.position.add(this.movement);
            }
        }
    }

    static handleRotation() {
        const player = PlayersManager.self;
        if (!player.velocity) player.velocity = new Vector3();
        
        // Get inputs with proper scaling
        const gamepadRightY = -Gamepad.getAxisValue(3) * 0.05;
        const mouseMovement = PC.getMouseMovement();
        const mouseY = -mouseMovement.y * this.MOUSE_SENSITIVITY;

        // Only handle pitch rotation when grounded
        let xRotation = 0;
        
        if (Math.abs(gamepadRightY) > 0.001) 
            xRotation = gamepadRightY;
        else if (mouseY !== 0) 
            xRotation = mouseY * 100;

        if (player.grounded) {
            if (player.needsGroundAlign) {
                this.alignToSurface(player);
                player.needsGroundAlign = false;
            }
            
            // Only apply pitch rotation
            if (Math.abs(xRotation) > 0.001) {
                const up = this.lastUpVector;
                const right = new Vector3(1, 0, 0).cross(up).normalize();
                
                // Calculate current look angle
                const forward = new Vector3(0, 0, -1).applyQuaternion(player.quaternion);
                const angle = forward.angleTo(up) - Math.PI/2;
                
                // Clamp vertical rotation
                if (xRotation < 0 && angle < -this.MAX_ANGLE) xRotation = 0;
                if (xRotation > 0 && angle > this.MAX_ANGLE) xRotation = 0;
                
                if (xRotation) player.rotateOnWorldAxis(right, xRotation);
            }
        } else {
            // Handle full rotation only when in air
            const gamepadRightX = -Gamepad.getAxisValue(2) * 0.05;
            const mouseX = -mouseMovement.x * this.MOUSE_SENSITIVITY * 100;
            
            if (gamepadRightX && Math.abs(gamepadRightX) > 0.001) player.rotateY(gamepadRightX);
            if (mouseX) player.rotateY(mouseX);
            if (xRotation) player.rotateX(xRotation);
        }
    }

    static update() {
        this.handleRotation();
        this.handleMovement();
    }

    static cleanup() {
        console.log('Cleaning up FPS controller');
        Engine.camera.parent?.remove(Engine.camera);

        // What is this doing?
        this.rotation.identity();
    };
};