import Gamepad from './inputs/gamepad.mjs';
import SceneManager from '../scene.mjs';

export default class FPSController {
    static reset() {
        console.log('Resetting FPS controller');
    };

    static update() {
        // Get gamepad input
        const horizontalAxis = Gamepad.getAxisValue(0);
        const verticalAxis = Gamepad.getAxisValue(1);

        // Apply rotation based on gamepad input
        if (Math.abs(horizontalAxis) > 0.1) {
            SceneManager.cube.rotation.y += horizontalAxis * 0.05;
        }
        if (Math.abs(verticalAxis) > 0.1) {
            SceneManager.cube.rotation.x += verticalAxis * 0.05;
        }
    };

    static cleanup() {
        console.log('Cleaning up FPS controller');
    };
};