import Engine from './engine.mjs';
import StartMenuController from './controllers/StartMenuController.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';
import Mobile from './controllers/inputs/mobile.mjs';
import PC from './controllers/inputs/pc.mjs';
import PlayersManager from './players.mjs';

export default class ControlManager {
    static controller;
    static horizonSet = false;

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

    static update() {
        // Aggregate inputs from both PC and Gamepad
        PC.update();
        Gamepad.update();
        
        // Update controller with aggregated inputs
        this.controller?.update();
        
        // Check if player just landed to set aim towards horizon
        const player = PlayersManager.self;
        if (player) {
            if (!player.falling && !this.horizonSet) {
                if (this.controller && typeof this.controller.onLanding === 'function') {
                    this.controller.onLanding();
                    this.horizonSet = true;
                }
            } else if (player.falling) {
                this.horizonSet = false;
            }
        }
    }
}
