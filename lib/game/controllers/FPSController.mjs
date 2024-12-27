import Gamepad from './inputs/gamepad.mjs';
import SceneManager from '../scene.mjs';

export default class FPSController {

    static reset() {
        console.log('Resetting FPS controller');
    };

    static update() {
        // Get gamepad input
        const x = Gamepad.getAxisValue(0);
        const y = Gamepad.getAxisValue(1);

        // Apply rotation based on gamepad input
        if (Math.abs(x) > .1)
            SceneManager.cube.rotation.y += x * 0.05;
    
        if (Math.abs(y) > .1)
            SceneManager.cube.rotation.x += y * 0.05;
    };

    static cleanup() {
        console.log('Cleaning up FPS controller');
    };

};