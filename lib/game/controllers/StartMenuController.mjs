import Gamepad from './inputs/gamepad.mjs';

export default class StartMenuController {
    static start = null;

    static reset() {

    }

    static update() {       
        if (Gamepad.isButtonPressed(0)) {
            this.start();
        }
    }

    static cleanup() {

    }
}