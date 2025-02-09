import StartMenuController from './controllers/StartMenuController.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';
import PC from './controllers/inputs/pc.mjs';

export default class ControlManager {
    static controller;

    static setup(defaultController = StartMenuController) {
        PC.setup();
        Gamepad.setup();

        this.change(defaultController);
    };

    // Cleanup previous controller before changing, initialise new controller.
    static change(controller) {
        this.controller?.cleanup?.();
        this.controller = controller;
        this.controller?.reset?.();
    };

    static cleanup() {
        if (this.controller) {
            this.controller.cleanup();
            this.controller = null;
        }
        
        PC.cleanup();
        Gamepad.cleanup();
    };

    static update() {
        // Aggregate inputs from both PC and Gamepad
        PC.update();
        Gamepad.update();
        
        // Update controller with aggregated inputs
        this.controller?.update();
    };
};
