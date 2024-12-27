import PC from './inputs/pc.mjs';
import Gamepad from './inputs/gamepad.mjs';
import Engine from '../engine.mjs';

export default class StartMenuController {

    static start;

    static reset() {
        console.log('Resetting start menu controller');
    };

    // Mainly checking for input to start the game.
    static update() {
        // Allow space and gamepad to start the game, start button can be clicked/touched too.
        if (PC.isKeyPressed('Space') || Gamepad.isButtonPressed(0)) {
            // Inform engine and UI of game starting.
            this.start();

            // Initial resize, but wait for fullscreen to finish.
            requestAnimationFrame(() => Engine.resize());
        }
    };

    static cleanup() {
        console.log('Cleaning up start menu controller');

        this.start = null;
    };

};