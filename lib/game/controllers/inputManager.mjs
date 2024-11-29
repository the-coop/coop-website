import PlayerManager from '../players/playerManager.mjs';
import ControllerManager from '../controllers/controllerManager.mjs';

import GamepadInput from './inputs/gamepad.mjs';
import MobileInput from './inputs/mobile.mjs';
import ComputerInput from './inputs/computer.mjs';
import { isInitializing } from '../shared/flags.mjs';

export default class InputManager {
    static computerInput = null;
    static activeInputs = new Set();
    static isInitialized = false;

    static setup() {
        console.log('Initializing InputManager');
        if (this.isInitialized) {
            console.warn('InputManager already initialized');
            return;
        }

        if (!PlayerManager.protagonist) {
            console.error('Cannot initialize inputs: no protagonist available');
            return;
        }

        // Initialize computer input
        this.computerInput = new ComputerInput();
        this.computerInput.setup();
        this.activeInputs.add(this.computerInput);
        
        // Initialize GamepadInput
        GamepadInput.setup();
        this.activeInputs.add(GamepadInput);  // Ensure GamepadInput is tracked in activeInputs
        
        // Bind the handler and store the reference for removal
        this._handleDeadzoneChange = this.handleDeadzoneChange.bind(this);
        ControllerManager.on('deadzoneThresholdChange', this._handleDeadzoneChange);

        // Optionally adjust any input scaling factors here

        this.isInitialized = true;
        console.log('InputManager initialized');
    }

    // Handler for deadzone threshold changes
    static handleDeadzoneChange(newThreshold) {
        console.log(`Deadzone threshold updated to: ${newThreshold}`);
        // You can implement additional logic here if needed
    }

    static update(delta) {
        if (!this.isInitialized) return;
        
        // Update computer input
        if (this.computerInput) {
            this.computerInput.update(delta);
        }

        // Update GamepadInput independently of other inputs
        if (GamepadInput) {
            GamepadInput.update(delta);
        }
    }

    static cleanup() {
        if (isInitializing.value) {
            console.log('Skipping InputManager cleanup during initialization');
            return;
        }

        console.log('Cleaning up InputManager');
        if (this.computerInput) {
            this.computerInput.cleanup();
            this.computerInput = null;
        }
        
        // Cleanup GamepadInput
        GamepadInput.cleanup();
        
        // Remove the bound event listener
        if (this._handleDeadzoneChange) {
            ControllerManager.off('deadzoneThresholdChange', this._handleDeadzoneChange);
            this._handleDeadzoneChange = null;
        }

        this.activeInputs.clear();
        this.isInitialized = false;
    }

    static getAllGamepads() {
        return Array.from(navigator.getGamepads()).filter(gamepad => gamepad !== null);
    }
}