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
        // Always update input devices, regardless of player state
        // This allows input to work on the Start screen before player is spawned
        PC.update();
        Gamepad.update();
        if (Engine.mobile) Mobile.update();
        
        // Only perform player-dependent operations if player exists
        if (PlayersManager.self && PlayersManager.self.handle) {
            // Update vehicle manager with player position
            VehicleManager.updateVehicles(PlayersManager.self.handle.position);
            
            // Update current controller if it has an update method
            if (this.controller && this.controller.update) {
                const result = this.controller.update();
                
                // Check for controller exit request
                if (result === 'exit') {
                    if (VehicleManager.exitVehicle(PlayersManager.self)) {
                        this.change(FPSController);
                    }
                }
            }
        } else if (this.controller && this.controller.update && 
                  this.controller === StartMenuController) {
            // Special case: Allow StartMenuController to update even without a player
            this.controller.update();
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
            const result = VehicleManager.tryEnterNearbyVehicle();
            
            // If we successfully entered a vehicle, switch to the appropriate controller
            if (result && VehicleManager.currentVehicle) {
                // Select controller based on vehicle type
                const vehicleType = VehicleManager.currentVehicle.userData.type;
                console.log(`Switching to ${vehicleType} controller`);
                
                if (vehicleType === 'airplane') {
                    this.change(AirplaneController);
                } else if (vehicleType === 'car') {
                    this.change(CarController);
                } else {
                    // Default to FPS controller for unknown vehicle types
                    this.change(FPSController);
                }
                
                return true;
            }
        }
        return false;
    }
}
