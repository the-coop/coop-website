import ControllerManager from '../controllers/controllerManager.mjs';
import GamepadInput from './inputs/gamepad.mjs';
import ComputerInput from './inputs/computer.mjs';
import State from '../state.mjs'; 

export default class InputManager {
    static computerInput = null;
    static activeInputs = new Set();
    static isInitialized = false;
    static isGameRunning = false;

    static async setup() {
        if (this.isInitialized) return true;

        try {
            if (State.protagonist) {
                // Setup input for protagonist
            }
            if (!this.computerInput) {
                this.computerInput = ComputerInput;
                await this.computerInput.setup();
                this.activeInputs.add(this.computerInput);
            }
            
            if (!this.activeInputs.has(GamepadInput)) {
                await GamepadInput.setup();
                this.activeInputs.add(GamepadInput);
            }

            this.isInitialized = true;
            console.log('InputManager setup complete');
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
        this.isGameRunning = running;
        if (running) {
            this.setup();
            State.setControllersInitialized(true); // Ensure state is updated
        } else {
            this.cleanup();
            State.setControllersInitialized(false); // Update state on cleanup
        }
    }

    static update(delta) {
        if (!this.isGameRunning) return;
        if (!this.isInitialized || !State.isGameStarted) return;
        
        this.computerInput?.update(delta);
        GamepadInput.update?.(delta);

        // Optionally, update FPS settings if needed
    }

    static getAllGamepads() {
        return Array.from(navigator.getGamepads()).filter(Boolean);
    }
}