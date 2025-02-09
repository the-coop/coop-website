import Gamepad from './inputs/gamepad.mjs';

// Mainly used to supprt gamepad game starting.
// PC can trigger start by click event handler on start button.
export default class StartMenuController {
    static start = null;

    static update() {       
        if (Gamepad.isButtonPressed(0)) this.start();

        // TODO: Check if enter/space presses
    };

    static reset() {};
    static cleanup() {};
};