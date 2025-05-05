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
            if (Engine.keyStates && (Engine.keyStates['e'] || Engine.keyStates['KeyE'])) {  // FIXED: Added 'KeyE' check
                // Clear key state immediately to prevent multiple triggers
                Engine.keyStates['e'] = false; 
                Engine.keyStates['E'] = false;
                Engine.keyStates['KeyE'] = false;  // ADDED: Also clear 'KeyE' state
                
                console.log("E key pressed - checking for vehicle interactions");
                
                // Add player position logging when E is pressed
                console.log(`Player position: ${PlayersManager.self.position.x.toFixed(2)}, ${PlayersManager.self.position.y.toFixed(2)}, ${PlayersManager.self.position.z.toFixed(2)}`);
                console.log(`Current controller: ${this.controller?.constructor?.name || 'none'}`);
                console.log(`Current vehicle: ${VehicleManager.currentVehicle?.userData?.type || 'none'}`);
                
                // Handle vehicle interaction
                if (VehicleManager.currentVehicle) {
                    console.log('Attempting to exit vehicle');
                    
                    // IMPROVED: Use the unified exit method for consistency
                    this.exitVehicleAndChangeController();
                } else {
                    console.log("No current vehicle - attempting to find and enter a vehicle");
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
        // Track our state for debugging
        const wasInVehicle = PlayersManager.self && PlayersManager.self.inVehicle;
        const hadCurrentVehicle = !!VehicleManager.currentVehicle;
        
        // If we're already in a vehicle, exit it
        if (wasInVehicle && hadCurrentVehicle) {
            const exitResult = VehicleManager.exitVehicle();
            console.log(`Vehicle exit result: ${exitResult}`);
            
            // Change to FPS controller if exit was successful
            if (exitResult) {
                this.change(FPSController);
                return true;
            }
            return false;
        }
        
        // Try to enter a nearby vehicle
        const entryResult = VehicleManager.tryEnterNearbyVehicle();
        console.log(`Vehicle entry attempt result: ${entryResult}`);
        console.log(`Current vehicle after entry: ${VehicleManager.currentVehicle ? 
                      VehicleManager.currentVehicle.userData?.type || 'vehicle' : 'none'}`);
        
        // IMPROVED: More detailed debug for understanding vehicle entry failures
        if (!entryResult) {
            console.log("Entry failed. Distance check: " + 
                (VehicleManager.vehicles.length > 0 ? 
                 VehicleManager.vehicles
                     .filter(v => v && v.userData && !v.userData.isOccupied)
                     .map(v => PlayersManager.self.position.distanceTo(v.position).toFixed(2))
                     .join(", ") : 
                 "No vehicles"));
            return false;
        }

        
        // Change controller based on vehicle type
        if (VehicleManager.currentVehicle) {
            const vehicleType = VehicleManager.currentVehicle.userData?.type || 'unknown';
            
            console.log(`Selecting controller for vehicle type: ${vehicleType}`);
            
            // IMPROVED: More robust controller selection with better fallback handling
            let controllerFound = false;
            
            // Choose the appropriate controller for this vehicle type
            if (vehicleType === 'car') {
                // Try to use car controller
                if (typeof CarController !== 'undefined') {
                    this.change(CarController);
                    controllerFound = true;
                } else if (window.CarController) {
                    this.change(window.CarController);
                    controllerFound = true;
                }
            } else if (vehicleType === 'airplane') {
                // Try to use airplane controller
                if (typeof AirplaneController !== 'undefined') {
                    this.change(AirplaneController);
                    controllerFound = true;
                } else if (window.AirplaneController) {
                    this.change(window.AirplaneController);
                    controllerFound = true;
                }
            }
            
            // If no matching controller was found, try to find any vehicle controller
            if (!controllerFound) {
                console.warn(`No specific controller found for vehicle type: ${vehicleType}`);
                
                // Try to find any available vehicle controller as fallback
                if (typeof CarController !== 'undefined') {
                    console.log("Using CarController as fallback");
                    this.change(CarController);
                    controllerFound = true;
                } else if (window.CarController) {
                    console.log("Using window.CarController as fallback");
                    this.change(window.CarController);
                    controllerFound = true;
                } else {
                    // Last resort - use FPS controller
                    console.error(`No vehicle controller found for ${vehicleType} - using FPS controller`);
                    this.change(FPSController);
                }
            }
            
            return true;
        } else {
            console.log("No vehicle entered, staying with current controller");
            return false;
        }
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
                
                // ADDED: Store the vehicle's surface normal for camera transfer
                let surfaceNormal = new Vector3(0, 1, 0);
                if (exitedVehicle && exitedVehicle.userData && exitedVehicle.userData.surfaceNormal) {
                    surfaceNormal = exitedVehicle.userData.surfaceNormal.clone();
                } else if (exitedVehicle && exitedVehicle.userData && exitedVehicle.userData.planet) {
                    // Calculate from planet position as fallback
                    const planetCenter = exitedVehicle.userData.planet.object.position;
                    surfaceNormal = exitedVehicle.position.clone().sub(planetCenter).normalize();
                }
                
                if (Engine.camera.parent) {
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                }
                
                // Reset camera completely to prevent rotation carry-over
                Engine.camera.rotation.set(0, 0, 0);
                Engine.camera.quaternion.identity();
                
                // ADDED: Transfer the surface normal to the camera up vector
                Engine.camera.up.copy(surfaceNormal);
                
                console.log('Camera completely reset: position, rotation, and parent with preserved surface normal');
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
    
    /**
     * Get current vehicle input state
     * @returns {Object} Vehicle input state with properties for vehicle controls
     */
    static getVehicleInput() {
        // Create a vehicle input state object
        const vehicleInput = {
            accelerate: false,
            brake: false,
            turnLeft: false,
            turnRight: false,
            pitchUp: false,
            pitchDown: false,
            rollLeft: false,
            rollRight: false
        };
        
        // Map keyboard keys to vehicle controls
        if (this.keys) {
            // Forward/backward
            vehicleInput.accelerate = this.keys.KeyW || this.keys.ArrowUp;
            vehicleInput.brake = this.keys.KeyS || this.keys.ArrowDown;
            
            // Turning
            vehicleInput.turnLeft = this.keys.KeyA || this.keys.ArrowLeft;
            vehicleInput.turnRight = this.keys.KeyD || this.keys.ArrowRight;
            
            // Pitch controls (for aircraft)
            vehicleInput.pitchUp = this.keys.KeyW || this.keys.ArrowUp;
            vehicleInput.pitchDown = this.keys.KeyS || this.keys.ArrowDown;
            
            // Roll controls (for aircraft)
            vehicleInput.rollLeft = this.keys.KeyQ;
            vehicleInput.rollRight = this.keys.KeyE;
        }
        
        // Handle mobile controls if they exist
        if (this.mobile && this.mobile.vehicleControls) {
            // Override with mobile controls if active
            Object.assign(vehicleInput, this.mobile.vehicleControls);
        }
        
        return vehicleInput;
    }
}
