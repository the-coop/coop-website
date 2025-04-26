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
import { Vector3, Quaternion } from 'three';

export default class ControlManager {
    // Active controller
    static controller = FPSController;
    
    // CRITICAL FIX: Initialize the input property to prevent "Cannot set properties of undefined" error
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false,
        exit: false
    };

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
        
        // CRITICAL FIX: Check for and fix any ghost vehicle issues
        VehicleManager.validateVehicles();
        
        // CRITICAL FIX: Ensure input object is initialized before using it
        if (!this.input) {
            this.input = {
                movement: new Vector3(),
                rotation: new Vector3(),
                action: false,
                exit: false
            };
        }
        
        // Ensure WASD input maps to the correct vector components
        let movement = new Vector3();
        
        if (Engine.keyStates['KeyW'] || Engine.keyStates['Space'] || Engine.keyStates['ArrowUp']) {
            movement.z += 1; // W/Space/Up = forward (positive Z)
        }
        if (Engine.keyStates['KeyS'] || Engine.keyStates['ArrowDown']) {
            movement.z -= 1; // S/Down = backward (negative Z)
        }
        if (Engine.keyStates['KeyA'] || Engine.keyStates['ArrowLeft']) {
            movement.x -= 1; // A/Left = left (negative X)
        }
        if (Engine.keyStates['KeyD'] || Engine.keyStates['ArrowRight']) {
            movement.x += 1; // D/Right = right (positive X)
        }
        
        // Normalize movement vector if non-zero
        if (movement.lengthSq() > 0) {
            movement.normalize();
        }
        
        // Set the input movement that will be picked up by the vehicle manager
        this.input.movement.copy(movement);

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
                    
                    // IMPROVED: Use the unified exit method for consistency
                    this.exitVehicleAndChangeController();
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
            
            // CRITICAL FIX: Never skip controller updates - just ensure each controller
            // has exclusive camera handling rights
            if (this.controller) {
                // Standard controller update - FIXED: Pass required parameters
                const result = this.controller.update(PlayersManager.self, Engine.camera);
                
                // Check for controller exit requests
                if (result === 'exit') {
                    console.log('Controller requested exit');
                    this.exitVehicleAndChangeController();
                }
                
                // CRITICAL FIX: Make sure vehicle manager knows about inputs but doesn't process them
                // This is just for reference, actual movement is handled by controller
                if ((this.controller === CarController || this.controller === AirplaneController) 
                     && VehicleManager.currentVehicle) {
                    // ENHANCED: Make sure only the current vehicle gets input
                    VehicleManager.input = this.controller.input;
                    
                    // Force all other vehicles to have no input
                    for (const vehicle of VehicleManager.vehicles) {
                        if (vehicle && vehicle !== VehicleManager.currentVehicle) {
                            vehicle.userData.hasInput = false;
                            vehicle.userData.input = null;
                        }
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
        console.log(`Changing controller from ${this.controller?.constructor?.name || 'none'} to ${controller?.constructor?.name || 'none'}`);
        
        // CRITICAL FIX: Debug any duplicate cameras
        let cameraCount = 0;
        Engine.scene.traverse(object => {
            if (object.isCamera) {
                cameraCount++;
                console.log(`Found camera: ${object.name || object.uuid}, parent=${object.parent?.name || object.parent?.type || 'none'}`);
            }
        });
        console.log(`Total cameras in scene: ${cameraCount} (should be 1)`);
        
        // CRITICAL FIX: Clean up camera and ensure it's in a proper state before changing controllers
        if (Engine.camera) {
            // Make sure camera is attached to scene directly before changing controllers
            if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
                console.log(`Detaching camera from ${Engine.camera.parent.name || 'unnamed parent'}`);
                const worldPos = new Vector3();
                const worldQuat = new Quaternion();
                Engine.camera.getWorldPosition(worldPos);
                Engine.camera.getWorldQuaternion(worldQuat);
                
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                
                // Preserve position
                Engine.camera.position.copy(worldPos);
                
                // CRITICAL FIX: Reset camera rotation completely when switching from CarController
                if (this.controller === CarController) {
                    console.log("Resetting camera rotation completely when exiting car controller");
                    Engine.camera.rotation.set(0, 0, 0);
                    Engine.camera.quaternion.identity();
                } else {
                    Engine.camera.quaternion.copy(worldQuat);
                }
            }
            
            // Reset camera properties 
            Engine.camera.layers.set(0);
            Engine.camera.zoom = 1;
            Engine.camera.fov = 75;
            Engine.camera.updateProjectionMatrix();
        }
        
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
        
        console.log(`Controller changed to ${controller?.constructor?.name || 'none'}`);
    }

    static attemptVehicleInteraction() {
        // CRITICAL FIX: Check for and fix any ghost vehicle issues before entering a vehicle
        VehicleManager.validateVehicles();
        
        // ADDED: Extra validation to ensure player exists
        if (!PlayersManager.self) {
            console.warn("Cannot attempt vehicle interaction - player doesn't exist");
            return false;
        }
        
        // Try to enter a nearby vehicle
        const result = VehicleManager.tryEnterNearbyVehicle();
        
        // ENHANCED: Add debug info after vehicle entry attempt
        console.log(`Vehicle entry attempt result: ${result}`);
        console.log(`Current vehicle after entry: ${VehicleManager.currentVehicle?.userData?.type || 'none'}`);
        
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
            
            // ENHANCED FIX: Completely prevent camera manipulation before controller switch
            if (Engine.camera) {
                // Briefly detach camera from anything it might be attached to
                // to ensure clean controller initialization
                if (Engine.camera.parent && Engine.camera.parent !== Engine.scene) {
                    const worldPos = new Vector3();
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                }
                
                // Clear any rotations or other properties that could cause problems
                if (vehicleType === 'car') {
                    Engine.camera.rotation.set(0, 0, 0);
                    Engine.camera.quaternion.identity();
                }
            }
            
            // Switch to the appropriate controller
            if (vehicleType === 'airplane') {
                console.log('Switching to AirplaneController');
                this.controller = AirplaneController;
                AirplaneController.reset();
                return true;
            } else if (vehicleType === 'car') {
                console.log('Switching to CarController');
                
                // CRITICAL FIX: Ensure car has proper state before switching controller
                if (VehicleManager.currentVehicle) {
                    // Make sure car has all needed properties
                    const car = VehicleManager.currentVehicle;
                    car.userData.isOccupied = true;
                    car.userData.hasPlayerInside = true;
                    car.userData.player = PlayersManager.self;
                    
                    // Set default velocity if missing
                    if (!car.userData.velocity) {
                        car.userData.velocity = new Vector3(0, 0, 0);
                    }
                    
                    // Reset speed to zero
                    car.userData.speed = 0;
                }
                
                this.controller = CarController;
                CarController.reset();
                
                // ENHANCED FIX: Add safety timeout to address any sync issues
                setTimeout(() => {
                    // Verify camera is properly attached after controller initialization
                    if (VehicleManager.currentVehicle && 
                        VehicleManager.currentVehicle.userData._lockCamera &&
                        Engine.camera) {
                        
                        if (Engine.camera.parent !== VehicleManager.currentVehicle) {
                            console.log("Post-controller camera fix: Re-attaching camera to vehicle");
                            
                            const worldPos = new Vector3();
                            if (Engine.camera.parent) {
                                Engine.camera.getWorldPosition(worldPos);
                                Engine.camera.parent.remove(Engine.camera);
                            }
                            
                            VehicleManager.currentVehicle.add(Engine.camera);
                            Engine.camera.position.set(0, 7, -15);
                            Engine.camera.rotation.set(0.2, Math.PI, 0);
                            
                            // Save these for strict enforcement
                            VehicleManager.currentVehicle.userData._cameraRotation = Engine.camera.rotation.clone();
                            VehicleManager.currentVehicle.userData._cameraPosition = Engine.camera.position.clone();
                        }
                    }
                }, 100); // Small delay to ensure controller setup is complete
                
                return true;
            } else {
                console.log('Unknown vehicle type, using default FPSController');
                this.controller = FPSController;
                FPSController.reset();
            }
        } else {
            console.log('No vehicle entered, staying with current controller');
        }
        return false;
    }

    // IMPROVED: Unified vehicle exit with instant controller change
    static exitVehicleAndChangeController() {
        if (VehicleManager.currentVehicle) {
            console.log('Exiting vehicle and changing to FPS controller');
            
            // Store a reference to the current vehicle before exiting
            const exitedVehicle = VehicleManager.currentVehicle;
            
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
            
            // CRITICAL FIX: Force detach camera from vehicle and reset rotation completely
            if (Engine.camera) {
                const worldPos = new Vector3();
                if (Engine.camera.parent) {
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                }
                
                // Reset camera completely to prevent rotation carry-over
                Engine.camera.rotation.set(0, 0, 0);
                Engine.camera.quaternion.identity();
                console.log('Camera completely reset: position, rotation, and parent');
            }
            
            // Process vehicle exit
            if (VehicleManager.exitVehicle()) {
                console.log('Successfully exited vehicle, switching to FPS controller immediately');
                
                // CRITICAL FIX: Switch to FPS controller IMMEDIATELY - no setTimeout
                this.controller = FPSController;
                FPSController.reset();
                
                console.log('Controller changed to FPSController');
                
                // Debug log updated player position for verification
                console.log(`Player position after FPS reset: ${PlayersManager.self.position.x.toFixed(2)}, ${PlayersManager.self.position.y.toFixed(2)}, ${PlayersManager.self.position.z.toFixed(2)}`);
                
                return true;
            } else {
                console.error("Failed to exit vehicle!");
                // Emergency fallback - force switch to FPS anyway
                this.controller = FPSController;
                FPSController.reset();
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
