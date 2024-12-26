import PC from './inputs/pc.mjs';

export default class StartMenuController {

    static reset() {
        console.log('Resetting start menu controller');
    };

    static update() {
        PC.isKeyPressed('Space') && console.log('Space pressed');

        // TODO: Check if gamepad presse A etc.
    };

    static cleanup() {
        console.log('Cleaning up start menu controller');
    };

};