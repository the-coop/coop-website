import PC from './inputs/pc.mjs';
import Gamepad from './inputs/gamepad.mjs';

export default class StartMenuController {

    static start;

    static reset() {
        console.log('Resetting start menu controller');
    };

    // Mainly checking for input to start the game.
    static update() {
        // Allow space and gamepad to start the game, start button can be clicked/touched too.
        if (PC.isKeyPressed('Space') || Gamepad.isButtonPressed(0)) 
            this.start();
    };

    static cleanup() {
        console.log('Cleaning up start menu controller');

        this.start = null;
    };

};