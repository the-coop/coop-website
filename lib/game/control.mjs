import Engine from './engine.mjs';
import StartMenuController from './controllers/StartMenuController.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';
import Mobile from './controllers/inputs/mobile.mjs';
import PC from './controllers/inputs/pc.mjs';

export default class ControlManager {
    static controller;

    static setup() {
        PC.setup();
        Gamepad.setup();
        this.change(StartMenuController);
    }

    static change(Controller) {
        // Cleanup previous controller before changing
        this.controller?.cleanup?.();
        this.controller = Controller;
        this.controller?.reset?.();
    }

    static cleanup() {
        if (this.controller) {
            this.controller.cleanup();
            this.controller = null;
        }
        PC.cleanup();
        Gamepad.cleanup();
    }
}
