import Gamepad from './inputs/gamepad.mjs';

export default class StartMenuController {
    static start;

    static reset() {
        
    };

    static update() {
        // Only check for gamepad input to trigger start
        if (Gamepad.isButtonPressed(0) && this.start)
            this.start();
    };

    static cleanup() {
        this.start = null;
    };
};