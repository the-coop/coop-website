import Engine from './engine.mjs';
import StartMenuController from './controllers/StartMenuController.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';
import Mobile from './controllers/inputs/mobile.mjs';
import PC from './controllers/inputs/pc.mjs';

export default class ControlManager {
    // Default to start menu controller, then FPS when spawned
    static controller;

    // Attach any relevant input listeners.
    static setup() {
        // Setup mobile if detected.
        if (Mobile.detect()) Mobile.setup();
        else PC.setup();

        // Listen for gamepad events.
        Gamepad.setup();
    };

    static change(controller) {
        this.controller?.cleanup();
        this.controller = controller;
        this.controller.reset();
    };

};
