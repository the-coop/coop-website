import { Quaternion, Vector3 } from 'three';
import Gamepad from './inputs/gamepad.mjs';
import PC from './inputs/pc.mjs';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    static rotationQuaternion = new Quaternion();
    static xAxis = new Vector3(1, 0, 0);
    static yAxis = new Vector3(0, 1, 0);

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
        this.rotationQuaternion.identity();
    };

    static update() {
        // Get gamepad input (negate for correct direction)
        const gamepadX = -Gamepad.getAxisValue(0);
        const gamepadY = -Gamepad.getAxisValue(1);

        // Get mouse input
        const mouseMovement = PC.getMouseMovement();

        let xRotation = 0;
        let yRotation = 0;

        // Calculate rotation amounts
        if (Math.abs(gamepadX) > .1) {
            yRotation = gamepadX * 0.05;
        } else if (mouseMovement.x !== 0) {
            yRotation = -mouseMovement.x * 2;
        }
    
        if (Math.abs(gamepadY) > .1) {
            xRotation = gamepadY * 0.05;
        } else if (mouseMovement.y !== 0) {
            xRotation = -mouseMovement.y * 2;
        }

        // Apply rotations directly to the player
        PlayersManager.self.rotateY(yRotation);
        PlayersManager.self.rotateX(xRotation);
    };

    static cleanup() {
        console.log('Cleaning up FPS controller');
        Engine.camera.parent?.remove(Engine.camera);
        this.rotationQuaternion.identity();
    };
};