import StartMenuController from './controllers/StartMenuController.mjs';
import Gamepad from './controllers/inputs/gamepad.mjs';
import Mobile from './controllers/inputs/mobile.mjs';
import PC from './controllers/inputs/pc.mjs';
import Engine from './engine.mjs';
import FPSController from './controllers/FPSController.mjs';
import ThirdPersonController from './controllers/ThirdPersonController.mjs';
import AirplaneController from './controllers/AirplaneController.mjs';
import CarController from './controllers/CarController.mjs';
import PlayersManager from './players.mjs';
import VehicleManager from './vehicles.mjs';
import { Vector3 } from 'three';

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
                
                // Add player position logging when E is pressed
                console.log(`E key detected - Player position: ${PlayersManager.self.position.x.toFixed(2)}, ${PlayersManager.self.position.y.toFixed(2)}, ${PlayersManager.self.position.z.toFixed(2)}`);
                console.log(`Current vehicle: ${VehicleManager.currentVehicle?.userData?.type || 'none'}`);
                
                // Handle vehicle interaction
                if (VehicleManager.currentVehicle) {
                    console.log('Attempting to exit vehicle');
                    
                    // Force detach camera from vehicle first
                    if (Engine.camera.parent === VehicleManager.currentVehicle) {
                        const worldPos = new Vector3();
                        Engine.camera.getWorldPosition(worldPos);
                        VehicleManager.currentVehicle.remove(Engine.camera);
                        Engine.scene.add(Engine.camera);
                        Engine.camera.position.copy(worldPos);
                        console.log('Forcibly detached camera from vehicle');
                    }
                    
                    // Then try to exit vehicle
                    if (VehicleManager.exitVehicle()) {
                        console.log('Vehicle exit successful, forcibly switching to FPS controller');
                        
                        // Critical change: Force immediate controller switch
                        if (this.controller !== FPSController) {
                            // First null out current controller
                            const prevController = this.controller;
                            this.controller = null;
                            
                            if (prevController && prevController.cleanup) {
                                prevController.cleanup();
                            }
                            
                            // Then immediately switch to FPS controller
                            this.controller = FPSController;
                            FPSController.reset();
                            
                            console.log('Controller forced to FPSController');
                            
                            // Add additional debugging - log player position again after reset
                            console.log(`Player position after reset: ${PlayersManager.self.position.x.toFixed(2)}, ${PlayersManager.self.position.y.toFixed(2)}, ${PlayersManager.self.position.z.toFixed(2)}`);
                        }
                    }
                } else {
                    this.attemptVehicleInteraction();
                }
            }
            
            // Set the action input for current controller (for consistent vehicle exit)
            if (Engine.keyStates && (Engine.keyStates['e'] || Engine.keyStates['E'])) {
                if (this.controller && this.controller.input) {
                    this.controller.input.action = true;
                }
            }
            
            // Update current controller if it has an update method
            if (this.controller && this.controller.update) {
                const result = this.controller.update();
                
                // Check for controller exit requests
                if (result === 'exit') {
                    console.log('Controller requested exit');
                    this.exitVehicleAndChangeController();
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
        console.log(`Changing controller from ${this.controller?.constructor?.name || 'none'} to ${controller?.constructor?.name || 'none'}`);
        
        // Clean up previous controller if needed
        if (this.controller && this.controller.cleanup) {
            try {
                console.log(`Cleaning up controller: ${this.controller.constructor.name}`);
                this.controller.cleanup();
            } catch (e) {
                console.error('Error during controller cleanup:', e);
            }
        }
        
        // Set new controller
        this.controller = controller;
        
        // Reset the new controller
        if (controller && controller.reset) {
            try {
                console.log(`Resetting controller: ${controller.constructor.name}`);
                controller.reset();
            } catch (e) {
                console.error('Error during controller reset:', e);
            }
        }
        
        console.log(`Controller changed from ${this.controller?.constructor.name} to ${controller?.constructor.name}`);
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
                
                // CRITICAL FIX: Force a full controller cleanup before switching
                if (this.controller && this.controller.cleanup) {
                    try {
                        this.controller.cleanup();
                    } catch (e) {
                        console.error("Error during controller cleanup:", e);
                    }
                }
                
                if (vehicleType === 'airplane') {
                    console.log('Switching to AirplaneController');
                    this.controller = AirplaneController;
                    AirplaneController.reset();
                    return true;
                } else if (vehicleType === 'car') {
                    console.log('Switching to CarController');
                    this.controller = CarController;
                    CarController.reset();
                    return true;
                } else {
                    console.log('Unknown vehicle type, using default FPSController');
                    this.controller = FPSController;
                    FPSController.reset();
                }
            } else {
                console.log('No vehicle entered, staying with current controller');
            }
        }
        return false;
    }
    
    // Handle vehicle exit more consistently
    static exitVehicleAndChangeController() {
        if (VehicleManager.currentVehicle) {
            console.log('Exiting vehicle and changing to FPS controller');
            
            // CRITICAL FIX: Complete controller cleanup before vehicle exit
            const prevController = this.controller;
            this.controller = null;
            
            if (prevController && prevController.cleanup) {
                try {
                    prevController.cleanup();
                } catch (e) {
                    console.error('Error during controller cleanup:', e);
                }
            }
            
            // Force detach camera from vehicle first
            if (Engine.camera.parent === VehicleManager.currentVehicle) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                VehicleManager.currentVehicle.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
                console.log('Detached camera from vehicle');
            }
            
            // Then try to exit vehicle
            if (VehicleManager.exitVehicle()) {
                console.log('Successfully exited vehicle, switching to FPS controller');
                
                // Apply slight delay to avoid physics glitches
                setTimeout(() => {
                    // Switch to FPS controller
                    this.controller = FPSController;
                    FPSController.reset();
                }, 50);
                
                return true;
            }
        }
        return false;
    }
    
    // Get the current view mode for notifications
    static getCurrentViewMode() {
        if (this.controller === FPSController) {
            return 'First Person';
        } else if (this.controller === ThirdPersonController) {
            return 'Third Person';
        } else if (this.controller === CarController) {
            return 'Car';
        } else if (this.controller === AirplaneController) {
            return 'Airplane';
        } else {
            return 'Unknown';
        }
    }
    
    // Get the controller to switch to based on the current one - only for player controllers
    static getViewToggleController() {
        // Only toggle between FPS and ThirdPerson when on foot
        if (this.controller === FPSController) return ThirdPersonController;
        if (this.controller === ThirdPersonController) return FPSController;
        
        // No view toggling for vehicles
        return null;
    }
}
