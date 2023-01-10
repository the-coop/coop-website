import ComputerInput from "./inputs/computer";
import ConsoleInput from "./inputs/console";
import MobileInput from "./inputs/mobile";

export default class InputManager {

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

        // Initialise the new controls and camera scheme.
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