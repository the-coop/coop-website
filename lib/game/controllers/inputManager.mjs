import PlayerManager from '../players/playerManager.mjs';
import ControllerManager from '../controllers/controllerManager.mjs';
import KeyboardInput from './inputs/keyboard.mjs';
import MouseInput from './inputs/mouse.mjs';
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
        
        this.isInitialized = true;
        console.log('InputManager initialized');
    }

    static update(delta) {
        if (!this.isInitialized) return;
        
        // Update computer input
        if (this.computerInput) {
            this.computerInput.update(delta);
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
        this.activeInputs.clear();
        this.isInitialized = false;
    }

    static getAllGamepads() {
        return Array.from(navigator.getGamepads()).filter(gamepad => gamepad !== null);
    }
}