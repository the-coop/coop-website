import State from '../state.mjs';
import ComputerInput from './inputs/computer.mjs';
import GamepadInput from './inputs/gamepad.mjs';

export default class InputManager {
    static isSetup = false; // New flag to prevent multiple setups

    static async setup() {
        if (this.isSetup) { // Check setup flag
            console.log('InputManager is already set up.');
            return true;
        }

        try {
            // Remove any existing listeners or states before setting up
            this.cleanup();
            
            // Initialize input systems
            await ComputerInput.setup();
            await GamepadInput.setup();
            this.isSetup = true; // Set setup flag
            console.log('InputManager setup complete.');
            return true;
        } catch (err) {
            console.error('InputManager setup failed:', err);
            State.addLog(`InputManager setup failed: ${err.message}`, 'inputManager.mjs');
            this.isSetup = false; // Reset setup flag on failure
            return false;
        }
    }

    static handleKeyDown(event) {
        // Handle key down events
        // Update state or forward to controller
        console.log(`InputManager: Key down - ${event.code}`);
    }

    static handleKeyUp(event) {
        // Handle key up events
        console.log(`InputManager: Key up - ${event.code}`);
    }

    static handleMouseMove(event) {
        // Handle mouse movement
        console.log(`InputManager: Mouse move - X: ${event.clientX}, Y: ${event.clientY}`);
    }

    static update(delta) {
        if (State.isGameStarted) { // Use State instead of this.isGameRunning
            ComputerInput.update(delta);
            GamepadInput.update(delta);
            // Additional input updates if necessary
        }
    }

    static handleResize() {
        // Handle resize events if necessary
        console.log('InputManager: Handle resize.');
    }

    static getAllGamepads() {
        return navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
    }

    static cleanup() {
        if (!this.isSetup) return; // Ensure cleanup happens only if setup was done

        // Cleanup input systems
        ComputerInput.cleanup();
        GamepadInput.cleanup();
        this.isSetup = false;
        console.log('InputManager has been cleaned up.');

        // Remove input event listeners
        window.removeEventListener('keydown', InputManager.handleKeyDown);
        window.removeEventListener('keyup', InputManager.handleKeyUp);
        window.removeEventListener('mousemove', InputManager.handleMouseMove);
        console.log('InputManager: Cleaned up inputs.');
    }
}