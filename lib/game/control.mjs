import StartMenuController from './controllers/StartMenuController.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';
import Mobile from './controllers/inputs/mobile.mjs';
import PC from './controllers/inputs/pc.mjs';
import Engine from './engine.mjs';

export default class ControlManager {
    static controller;

    // Sets up both PC and Gamepad controls simultaneously.
    // This dual input support primarily allows players to start the game
    // using either keyboard/mouse or gamepad controls interchangeably.
    static setup(defaultController = StartMenuController) {
        // Initialize keyboard and mouse controls
        PC.setup();

        // Initialize gamepad controls
        Gamepad.setup();

        // TODO: Initial mobile inputs if appropriate screen size.
        // Mobile.setup();

        // Set the initial controller (usually the start menu)
        // this.change(defaultController);
        // Set desired controller for engine loop.
        this.controller = defaultController;

        // Reset handles camera attachment and repositioning for different controllers/vehicles/etc
        this.controller?.reset?.();
    };

    // Cleanup previous controller before changing, initialise new controller.
    static change(controller) {
        // Clean up previous controller before changing.
        this.controller?.cleanup?.();

        // Set desired controller for engine loop.
        this.controller = controller;

        // Reset handles camera attachment and repositioning for different controllers/vehicles/etc
        this.controller?.reset?.();
    };

    static cleanup() {
        // Optional cleanup of current controller for proper state transitionsic cleanup() {
        // (e.g., removing event listeners, stopping animations, etc.)
        this.controller?.cleanup();
        this.controller = null;
        
        // Clean up input listeners.nput listeners.
        PC.cleanup();
        Gamepad.cleanup();
        Mobile.cleanup();
    }; 

    static update() {
        // Aggregate inputs from both PC and Gamepad inputs from both PC and Gamepad
        PC.update();

        // TODO: Only update gamepad if there is one connected.
        Gamepad.update();

        // Only update mobile if game is in that mode.
        if (Engine.mobile) Mobile.update();
        
        // Update controller with aggregated inputsaggregated inputs
        this.controller?.update();
    };
    
};
