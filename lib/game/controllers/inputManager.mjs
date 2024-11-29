import ControllerManager from '../controllers/controllerManager.mjs';
import GamepadInput from './inputs/gamepad.mjs';
import ComputerInput from './inputs/computer.mjs';
import State from '../state.mjs'; 

export default class InputManager {
    static computerInput = null;
    static activeInputs = new Set();

    static async setup() {
        try {
            if (!this.computerInput) {
                this.computerInput = ComputerInput;
                await this.computerInput.setup();
                this.activeInputs.add(this.computerInput);
            }
            
            if (!this.activeInputs.has(GamepadInput)) {
                await GamepadInput.setup();
                this.activeInputs.add(GamepadInput);
            }

            return true;
        } catch (err) {
            console.error('InputManager setup failed:', err);
            this.cleanup();
            throw err;
        }
    }

    static cleanup() {
        if (!State.isGameStarted) {
            if (this.computerInput) {
                this.computerInput.cleanup();
                this.computerInput = null;
            }
            GamepadInput.cleanup();
            this.activeInputs.clear();
        }
    }

    static setGameRunning(running) {
        // Always update input states first
        if (this.computerInput) {
            this.computerInput.setGameStarted(running);
        }
        
        // Only cleanup when explicitly stopping
        if (!running) {
            this.cleanup();
        }
    }

    static update(delta) {
        if (!this.loaded || !State.isGameStarted) return;
        
        this.computerInput?.update(delta);
        GamepadInput.update?.(delta);
    }

    static getAllGamepads() {
        return Array.from(navigator.getGamepads()).filter(Boolean);
    }
}