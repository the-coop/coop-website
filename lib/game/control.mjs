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
            // CRITICAL FIX: Improved key handling for vehicle exit with better console logs
            // Check for 'E' key press to interact with vehicles
            if (Engine.keyStates && (Engine.keyStates['e'] || Engine.keyStates['KeyE'])) {
                // Clear key state immediately to prevent multiple triggers
                Engine.keyStates['e'] = false;
                Engine.keyStates['E'] = false;
                Engine.keyStates['KeyE'] = false;
                
                console.log("E key pressed - checking for vehicle interactions");
                
                // Handle vehicle interaction
                if (VehicleManager.currentVehicle) {
                    console.log('E key detected - attempting to exit vehicle');
                    
                    // CRITICAL FIX: Set exit flag in controller if it exists
                    if (this.controller && this.controller.input) {
                        this.controller.input.exit = true;
                        this.controller.input.action = true;
                        console.log("Set exit flags in controller input:", this.controller.constructor?.name);
                    }
                    
                    // Always call exit method directly to ensure it works
                    this.exitVehicleAndChangeController();
                } else {
                    console.log("No current vehicle - attempting to find and enter a vehicle");
                    this.attemptVehicleInteraction();
                }
            }
            
            // CRITICAL FIX: Never skip controller updates - just ensure each controller
            // has exclusive camera handling rights
            if (this.controller) {
                // Standard controller update - FIXED: Pass required parameters
                const result = this.controller.update(PlayersManager.self, Engine.camera);
                
                // Check for controller exit requests
                if (result === 'exit') {
                    console.log('Controller requested exit - processing immediately');
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

    static change(controller, isVehicleTransition = false) {
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
            // Clean up camera state only if not a vehicle transition
            // For vehicle transitions, let the vehicle controller handle camera positioning
            if (!isVehicleTransition) {
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
            } else {
                // For vehicle transitions, we preserve camera state for smooth transition
                console.log("Preserving camera state for vehicle transition");
            }
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
                
                // Flag this as a vehicle transition for the controller's reset method
                if (isVehicleTransition && controller.input) {
                    controller.input._isVehicleTransition = true;
                }
                
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
            // ...existing code...
            return false;
        }
        
        // Try to enter a nearby vehicle
        const entryResult = VehicleManager.tryEnterNearbyVehicle();
        console.log(`Vehicle entry attempt result: ${entryResult}`);
        console.log(`Current vehicle after entry: ${VehicleManager.currentVehicle ? 
                  VehicleManager.currentVehicle.userData?.type || 'vehicle' : 'none'}`);
        
        // IMPROVED: More detailed debug for understanding vehicle entry failures
        if (!entryResult) {
            // ...existing code...
            return false;
        }

        // CRITICAL FIX: Hide player and disable collisions immediately after entering vehicle
        if (PlayersManager.self && VehicleManager.currentVehicle) {
            // Make player invisible and disable collisions
            PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            console.log("Player visibility and collisions disabled for vehicle entry");
            
            // CRITICAL FIX: Make sure vehicle is snapped to surface before entering
            if (VehicleManager.currentVehicle.userData && 
                VehicleManager.currentVehicle.userData.planet) {
                    
                console.log("Ensuring vehicle is properly snapped to surface on entry");
                
                // Explicitly align vehicle to surface
                const planet = VehicleManager.currentVehicle.userData.planet;
                const planetCenter = planet.object.position;
                const toSurface = VehicleManager.currentVehicle.position.clone()
                    .sub(planetCenter).normalize();
                    
                // Immediately align vehicle to surface
                // FIXED: Check if CarController exists before accessing its methods
                if (VehicleManager.currentVehicle.userData.type === 'car' && 
                    typeof CarController !== 'undefined' && 
                    typeof CarController.snapToSurface === 'function') {
                    CarController.snapToSurface(VehicleManager.currentVehicle, planet);
                } else {
                    // Generic alignment for other vehicle types
                    VehicleManager.alignVehicleToPlanetSurface(
                        VehicleManager.currentVehicle, 
                        toSurface, 
                        0.8,  // Strong alignment factor
                        true  // Force full alignment
                    );
                }
            }
            
            // Double-check collision ignore flags are set
            VehicleManager.currentVehicle._ignoreCollisionWith = PlayersManager.self.handle;
            if (PlayersManager.self.handle) {
                PlayersManager.self.handle._ignoreCollisionWith = VehicleManager.currentVehicle;
                
                // Explicitly disable handle collision processing
                if (PlayersManager.self.handle.userData && PlayersManager.self.handle.userData.collidable) {
                    PlayersManager.self.handle.userData.collidable.active = false;
                }
                if (PlayersManager.self.collidable) {
                    PlayersManager.self.collidable.active = false;
                }
            }
        }

        // CRITICAL IMPROVEMENT: Handle controller change in a single, clean transition
        if (VehicleManager.currentVehicle) {
            const vehicleType = VehicleManager.currentVehicle.userData?.type || 'unknown';
            
            console.log(`Switching controller for vehicle type: ${vehicleType}`);
            
            // Track controller change state
            const startTime = Date.now();
            let controllerToUse = null;
            
            // Choose the appropriate controller based on vehicle type
            if (vehicleType === 'car') {
                controllerToUse = CarController;
            } else if (vehicleType === 'airplane') {
                controllerToUse = AirplaneController;
            } else {
                // Fallback to car controller for unknown types
                console.warn(`Unknown vehicle type: ${vehicleType} - using CarController as fallback`);
                controllerToUse = CarController;
            }
            
            // Clean transition to new controller with transition flag
            if (controllerToUse) {
                console.log(`Changing controller to ${controllerToUse.name} for vehicle entry`);
                
                // CRITICAL FIX: Ensure camera is properly prepared for vehicle transition
                if (Engine.camera) {
                    // First make sure camera is attached to scene as intermediate step
                    if (Engine.camera.parent !== Engine.scene) {
                        const worldPos = new Vector3();
                        const worldQuat = new Quaternion();
                        Engine.camera.getWorldPosition(worldPos);
                        Engine.camera.getWorldQuaternion(worldQuat);
                        
                        Engine.camera.parent.remove(Engine.camera);
                        Engine.scene.add(Engine.camera);
                        
                        Engine.camera.position.copy(worldPos);
                        Engine.camera.quaternion.copy(worldQuat);
                        
                        // Log camera state
                        console.log("Camera prepared for vehicle transition");
                        console.log(`Camera position: ${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}`);
                    }
                    
                    // Reset any camera properties that might cause rendering issues
                    Engine.camera.layers.set(0);
                    Engine.camera.zoom = 1;
                    Engine.camera.updateProjectionMatrix();
                }
                
                // Flag this as a vehicle transition
                this.input._isVehicleTransition = true;
                if (controllerToUse.input) {
                    controllerToUse.input._isVehicleTransition = true;
                }
                
                // Change to the vehicle controller - this will call its reset method
                this.change(controllerToUse, true); // true = isVehicleTransition
                
                // Track performance
                const duration = Date.now() - startTime;
                console.log(`Controller change completed in ${duration}ms`);
                return true;
            } else {
                console.error("No suitable controller found for vehicle!");
                return false;
            }
        } else {
            console.log("No vehicle entered, staying with current controller");
            return false;
        }
    }

    // IMPROVED: Unified vehicle exit with consistent controller change
    static exitVehicleAndChangeController() {
        if (!VehicleManager.currentVehicle) {
            console.log("No current vehicle to exit from");
            return false;
        }
        
        console.log('Exiting vehicle and changing to FPS controller');
        
        try {
            // Store reference to the current vehicle before exiting
            const exitedVehicle = VehicleManager.currentVehicle;
            const vehicleType = exitedVehicle.userData?.type || 'unknown';
            
            console.log(`Exiting ${vehicleType} vehicle: ${exitedVehicle.name || 'unnamed'}`);
            
            // CRITICAL FIX: Complete controller cleanup before vehicle exit
            const prevController = this.controller;
            
            // Set controller to null during transition
            this.controller = null;
            
            // Clean up previous controller
            if (prevController && prevController.cleanup) {
                try {
                    console.log(`Cleaning up ${prevController.constructor?.name || 'controller'}`);
                    prevController.cleanup();
                } catch (e) {
                    console.error('Error during controller cleanup:', e);
                }
            }

            // Get surface normal from vehicle
            let surfaceNormal = new Vector3(0, 1, 0);
            
            // IMPROVED: Carefully preserve camera state during transition
            if (Engine.camera) {
                // Get surface normal from vehicle if possible
                if (exitedVehicle && exitedVehicle.userData) {
                    if (exitedVehicle.userData.surfaceNormal) {
                        surfaceNormal = exitedVehicle.userData.surfaceNormal.clone();
                    } else if (exitedVehicle.userData.planet) {
                        const planetCenter = exitedVehicle.userData.planet.object.position;
                        surfaceNormal = exitedVehicle.position.clone().sub(planetCenter).normalize();
                    }
                } else if (window.lastSurfaceNormal) {
                    // Use stored surface normal if available
                    surfaceNormal = window.lastSurfaceNormal;
                }
                
                // Save camera world position before detaching
                const worldPos = new Vector3();
                if (Engine.camera.parent) {
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                }
                
                // CRITICAL FIX: Complete reset of camera rotation
                Engine.camera.rotation.set(0, 0, 0);
                Engine.camera.quaternion.identity();
                
                // Set camera up vector to surface normal
                Engine.camera.up.copy(surfaceNormal);
                
                console.log('Camera reset complete');
            }
            
            // Ensure player is visible before exiting vehicle
            PlayersManager.setPlayerVisibility(PlayersManager.self, true);
            console.log("Player visibility restored");
            
            // Process vehicle exit
            // IMPORTANT: This must happen after controller cleanup but before new controller setup
            const exitResult = VehicleManager.exitVehicle();
            if (!exitResult) {
                console.error("Failed to exit vehicle! Forcing player exit state.");
                
                // Force player state update even if vehicle exit failed
                if (PlayersManager.self) {
                    PlayersManager.self.inVehicle = false;
                    PlayersManager.self.currentVehicle = null;
                }
            } else {
                console.log('Successfully exited vehicle');
            }
            
            // CRITICAL FIX: Switch to FPS controller IMMEDIATELY
            console.log('Switching to FPS controller');
            this.controller = FPSController;
            
            // Reset the FPS controller
            try {
                FPSController.reset();
                console.log('FPSController reset complete');
            } catch (e) {
                console.error('Error resetting FPS controller:', e);
            }
            
            return true;
        } catch (e) {
            console.error('Error during vehicle exit:', e);
            
            // Emergency recovery - force switch to FPS
            this.controller = FPSController;
            try {
                FPSController.reset();
                console.log("Emergency FPS controller reset complete");
            } catch (err) {
                console.error('Error in emergency FPS controller reset:', err);
            }
            
            // ADDED: Force player state in case of error
            if (PlayersManager.self) {
                PlayersManager.self.inVehicle = false;
                PlayersManager.self.currentVehicle = null;
                PlayersManager.setPlayerVisibility(PlayersManager.self, true);
            }
            
            return true; // Return true so caller knows we tried
        }
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
