import { Quaternion, Vector3, Matrix4 } from 'three';
import Gamepad from './inputs/gamepad.mjs';
import PC from './inputs/pc.mjs';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    static MOVE_SPEED = 0.5;
    static MOUSE_SENSITIVITY = 0.002;
    static PLAYER_HEIGHT = 1.8;

    static input = {
        movement: new Vector3(),
        rotation: new Vector3()
    };

    static reset() {
        const player = PlayersManager.self;
        // Camera as child of player, only set its local position
        Engine.camera.position.set(0, this.PLAYER_HEIGHT, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
    }

    static update() {
        const player = PlayersManager.self;

        // Apply movement to player mesh
        if (this.input.movement.length() > 0) {
            const movement = this.input.movement.clone().multiplyScalar(this.MOVE_SPEED);
            movement.applyQuaternion(player.quaternion);
            
            if (player.falling) {
                // Free movement in space
                player.position.add(movement);
            } else {
                // Project movement onto surface plane
                const up = player.position.clone()
                    .sub(player.soi.position)
                    .normalize();
                const dot = movement.dot(up);
                movement.addScaledVector(up, -dot);
                player.position.add(movement);
            }
        }

        // All rotation applies to player mesh
        if (this.input.rotation.length() > 0) {
            if (player.falling) {
                // Free rotation in space
                player.rotateY(this.input.rotation.x);
                player.rotateX(this.input.rotation.y);
            } else {
                // Surface-aligned rotation
                const up = player.position.clone()
                    .sub(player.soi.position)
                    .normalize();
                    
                if (this.input.rotation.x) {
                    player.rotateOnWorldAxis(up, this.input.rotation.x);
                }
                if (this.input.rotation.y) {
                    const right = player.quaternion.clone()
                        .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0))
                        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0));
                    player.rotateOnWorldAxis(right, this.input.rotation.y);
                }
            }
        }

        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
    }
}