import ComputerInput from "./inputs/computer";
import ConsoleInput from "./inputs/console";
import MobileInput from "./inputs/mobile";
// Adjusted import path for ControllerManager
import ControllerManager from '../../../lib/game/controllers/controllerManager.mjs'; 

export default class ConquestInputManager {
    constructor() {
        // Initialize controller handling
        this.handleButtonPress = this.handleButtonPress.bind(this);
        this.initUserInteraction();
    }

    // Method to activate gamepad connection on user interaction
    activateGamepad() {
        // Implement activation logic specific to conquest gameplay
        // For example, hide conquest-specific gamepad prompts
        localStorage.setItem('conquest-shown-gamepad-prompt', 'false');
    }

    // Handle button presses without switching control modes
    handleButtonPress(e) {
        if (!ControllerManager.hasController) {
            this.activateGamepad();
            // Only activate gamepad without changing control modes
        }
    }

    // Initialize additional event listeners for user interaction
    initUserInteraction() {
        window.addEventListener('keydown', this.handleButtonPress);
        window.addEventListener('gamepadbuttondown', this.handleButtonPress);
    }

    // Cleanup Method to Remove All Event Listeners
    cleanup() {
        window.removeEventListener('keydown', this.handleButtonPress);
        window.removeEventListener('gamepadbuttondown', this.handleButtonPress);
    }

    static INPUTS = {
        'COMPUTER': ComputerInput,
        'MOBILE': MobileInput,
        'CONSOLE': ConsoleInput
    };

    static change(inputKey) {
        const prevInput = WORLD.input;
    
        // Change camera and preference key.
        WORLD.input = this.INPUTS[inputKey];
        WORLD.settings.view.CURRENT_INPUT_KEY = inputKey;
        
        // Stop conflicts with the previous inputs.
        if (prevInput)
            prevInput.destroy();

        // Initialize the new controls and camera scheme.
        WORLD.input.reset();
    }

    static update(delta) {
        // Handle input changes.
        const { DESIRED_INPUT_KEY, CURRENT_INPUT_KEY } = WORLD.settings.view;
        if (DESIRED_INPUT_KEY !== CURRENT_INPUT_KEY)
            InputManager.change(DESIRED_INPUT_KEY);

        // Update the inputs/allow input intercept.
        WORLD.input.track(delta);
    }

}