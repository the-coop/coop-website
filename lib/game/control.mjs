import StartMenuController from './controllers/StartMenuController.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';
import Mobile from './controllers/inputs/mobile.mjs';
import PC from './controllers/inputs/pc.mjs';
import Engine from './engine.mjs';
import FPSController from './controllers/FPSController.mjs';
import AirplaneController from './controllers/AirplaneController.mjs';
import CarController from './controllers/CarController.mjs';
import PlayersManager from './players.mjs';
import VehicleManager from './vehicles.mjs';

export default class ControlManager {
    // Active controller
    static controller = FPSController;

    // Initialize all controllers
    static initialize() {
        console.log('Initializing Controllers');
        
        // Set default controller to FPS
        this.change(FPSController);
    }

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
        // Set desired controller for engine loop.
        this.controller = defaultController;

        // Reset handles camera attachment and repositioning for different controllers/vehicles/etc
        this.controller?.reset?.();
    };

    static update() {
        // Always update input devices
        PC.update();
        Gamepad.update();
        if (Engine.mobile) Mobile.update();
        
        // Only perform player-dependent operations if player exists
        if (PlayersManager.self && PlayersManager.self.handle) {
            // Check for 'E' key press to interact with vehicles
            if (Engine.keyStates && (Engine.keyStates['e'] || Engine.keyStates['E'])) {
                // Clear key state immediately to prevent multiple triggers
                Engine.keyStates['e'] = false; 
                Engine.keyStates['E'] = false;
                
                // Store the current controller for comparison
                const previousController = this.controller;
                
                // Handle vehicle interaction
                if (VehicleManager.currentVehicle) {
                    console.log('E key pressed, exiting current vehicle');
                    // Only change controller if exit was successful
                    if (VehicleManager.exitVehicle()) {
                        console.log('Successfully exited vehicle, switching to FPSController');
                        
                        // Only change controller if it actually changed
                        if (this.controller === previousController) {
                            setTimeout(() => this.change(FPSController), 10);
                        }
                    }
                } else {
                    console.log('E key pressed, attempting to enter a vehicle');
                    this.attemptVehicleInteraction();
                }
            }
            
            // Update current controller if it has an update method
            if (this.controller && this.controller.update) {
                const result = this.controller.update();
                
                // Check for controller exit requests
                if (result === 'exit') {
                    console.log('Controller requested exit');
                    if (VehicleManager.exitVehicle()) {
                        console.log('Successfully exited vehicle via controller request');
                        // Use a timeout to ensure clean controller transition
                        setTimeout(() => this.change(FPSController), 10);
                    }
                }
            }
        }
    };

    static cleanup() {
        // Optional cleanup of current controller for proper state transitions
        this.controller?.cleanup?.();
        this.controller = null;
        
        // Clean up input listeners
        PC.cleanup();
        Gamepad.cleanup();
        Mobile.cleanup();
    };

    static change(controller) {
        // Clean up previous controller if needed
        const previousController = this.controller;
        if (previousController && previousController.cleanup) {
            console.log(`Cleaning up controller: ${previousController.constructor.name}`);
            previousController.cleanup();
        }
        
        // Set new controller
        this.controller = controller;
        
        // Reset immediately instead of using setTimeout
        // This ensures camera position is correct right away
        if (controller && controller.reset) {
            console.log(`Resetting controller: ${controller.constructor.name}`);
            controller.reset();
        }
        
        console.log(`Controller changed from ${previousController?.constructor.name} to ${controller?.constructor.name}`);
    }

    static attemptVehicleInteraction() {
        // Only try to interact with vehicles if player exists
        if (PlayersManager.self) {
            // Try to enter a nearby vehicle
            const result = VehicleManager.tryEnterNearbyVehicle();
            
            // If we successfully entered a vehicle, switch to the appropriate controller
            if (result && VehicleManager.currentVehicle) {
                const vehicleType = VehicleManager.currentVehicle.userData.type;
                console.log(`Successfully entered a ${vehicleType}, switching to appropriate controller`);
                
                if (vehicleType === 'airplane') {
                    console.log('Switching to AirplaneController');
                    this.change(AirplaneController);
                    return true;
                } else if (vehicleType === 'car') {
                    console.log('Switching to CarController');
                    this.change(CarController);
                    return true;
                } else {
                    console.log('Unknown vehicle type, using default FPSController');
                    this.change(FPSController);
                }
            } else {
                console.log('No vehicle entered, staying with current controller');
            }
        }
        return false;
    }
}
