import ControlManager from '../../control.mjs';
import StartMenuController from '../StartMenuController.mjs';
import CarController from '../CarController.mjs';
import AirplaneController from '../AirplaneController.mjs';
import FPSController from '../FPSController.mjs';
import ThirdPersonController from '../ThirdPersonController.mjs';

const MOUSE_SENSITIVITY = 0.0008;

export default class PC {
    static active = {};
    static mouse = { x: 0, y: 0 };
    static interactPressed = false;
    static viewSwitchPressed = false;

    static setup() {
        console.log('setting up PC controls');
        
        // Setup key detection listeners.
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        
        // Lock pointer for FPS controls
        // document.addEventListener('click', () => document.body.requestPointerLock());
    };

    static cleanup() {
        // Cleanup key detection listeners.
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);

        // Exit pointer lock if it's applied.
        if (document.pointerLockElement) document.exitPointerLock();

        // Reset input state.
        this.active = {};
        this.mouse = { x: 0, y: 0 };
        this.interactPressed = false;
        this.viewSwitchPressed = false;
    };

    static update() {
        // Handle start menu inputs differently
        if (ControlManager.controller === StartMenuController) {
            // Any key/space/enter will trigger start
            if (this.active['Space'] || this.active['Enter'] || this.active['NumpadEnter']) {
                StartMenuController.input.action = true;
            }
            return;
        }

        // Do not attempt to calculate with controllers that have no movement/aim.
        if (!ControlManager.controller) return;

        // Handle view switching (O key) - only for FPS and ThirdPerson controllers 
        if (this.active['KeyO'] && !this.viewSwitchPressed) {
            this.viewSwitchPressed = true;
            
            // O key only works for player controllers (FPS/ThirdPerson), not vehicles
            const nextController = ControlManager.getViewToggleController();
            
            if (nextController) {
                // Switch between FPS and ThirdPerson
                console.log(`Switching view: ${ControlManager.controller.constructor.name} -> ${nextController.name}`);
                ControlManager.change(nextController);
                
                // Show notification about view change
                if (typeof window !== 'undefined' && window.gameNotify) {
                    window.gameNotify(`Switched to ${ControlManager.getCurrentViewMode()} View`);
                }
            }
        } else if (!this.active['KeyO']) {
            this.viewSwitchPressed = false;
        }

        // Handle vehicle interaction (E key)
        if (this.active['KeyE'] && !this.interactPressed) {
            this.interactPressed = true;
            
            // Check if we're in a vehicle
            const inVehicle = ControlManager.controller === CarController || 
                              ControlManager.controller === AirplaneController;
            
            if (inVehicle) {
                // Request exit from vehicle
                if (ControlManager.controller.input && ControlManager.controller.input.hasOwnProperty('exit')) {
                    ControlManager.controller.input.exit = true;
                }
            } else {
                // Attempt to enter a vehicle
                ControlManager.attemptVehicleInteraction();
            }
        } else if (!this.active['KeyE']) {
            this.interactPressed = false;
        }

        // Process input based on current controller
        this.processInputForController();

        // Reset mouse movement.
        this.mouse.x = 0;
        this.mouse.y = 0;
    };
    
    static processInputForController() {
        // Make sure controller exists and has an input object
        if (!ControlManager.controller || !ControlManager.controller.input) return;
        
        // Update common inputs first
        this.updateCommonInputs();

        // Let the controller handle its specific input processing
        if (ControlManager.controller.processInputs) {
            ControlManager.controller.processInputs(this);
        } else {
            // Fallback to FPS controls if controller doesn't implement processInputs
            this.updateFPSControls();
        }
    }
    
    static updateCommonInputs() {        
        // Make sure the controller and input exists
        if (!ControlManager.controller || !ControlManager.controller.input || !ControlManager.controller.input.movement) return;

        // Process inputs that are common to all controller types
        if (this.active['KeyW']) ControlManager.controller.input.movement.z -= 1;
        if (this.active['KeyS']) ControlManager.controller.input.movement.z += 1;
        if (this.active['KeyA']) ControlManager.controller.input.movement.x -= 1;
        if (this.active['KeyD']) ControlManager.controller.input.movement.x += 1;
        
        // Add support for arrow keys for vehicle controls
        if (this.active['ArrowUp']) ControlManager.controller.input.movement.z -= 1;
        if (this.active['ArrowDown']) ControlManager.controller.input.movement.z += 1;
        if (this.active['ArrowLeft']) ControlManager.controller.input.movement.x -= 1;
        if (this.active['ArrowRight']) ControlManager.controller.input.movement.x += 1;
    }
    
    static updateFPSControls() {
        // Make sure controller exists and has an input object with rotation
        if (!ControlManager.controller || !ControlManager.controller.input || !ControlManager.controller.input.rotation) return;

        // Only process mouse input if pointer is locked
        if (document.pointerLockElement) {
            const dx = Math.abs(this.mouse.x) < 0.05 ? 0 : this.mouse.x;
            const dy = Math.abs(this.mouse.y) < 0.05 ? 0 : this.mouse.y;

            ControlManager.controller.input.rotation.x = -dx * MOUSE_SENSITIVITY;
            ControlManager.controller.input.rotation.y = -dy * MOUSE_SENSITIVITY;
        }

        // Update jump directly from active state if it exists
        if (ControlManager.controller.input.hasOwnProperty('jump')) {
            ControlManager.controller.input.jump |= this.active['Space'];
        }
    }
    
    // Keep these methods for backward compatibility until you update all controllers
    static updateCarControls() {
        // This is now handled in updateCommonInputs
    }
    
    static updateAirplaneControls() {
        // Make sure controller exists and has an input object
        if (!ControlManager.controller || !ControlManager.controller.input || !ControlManager.controller.input.movement) return;
        
        // Handle pitch with up/down arrows
        if (this.active['ArrowUp']) ControlManager.controller.input.movement.y -= 1;
        if (this.active['ArrowDown']) ControlManager.controller.input.movement.y += 1;
        
        // Also support IJKL keys for airplane controls
        if (this.active['KeyI']) ControlManager.controller.input.movement.y -= 1;
        if (this.active['KeyK']) ControlManager.controller.input.movement.y += 1;
        if (this.active['KeyJ']) ControlManager.controller.input.movement.x -= 1;
        if (this.active['KeyL']) ControlManager.controller.input.movement.x += 1;
        
        // Only process mouse input for yaw if pointer is locked and rotation exists
        if (ControlManager.controller.input.rotation) {
            const dx = Math.abs(this.mouse.x) < 0.05 ? 0 : this.mouse.x;
            ControlManager.controller.input.rotation.y = -dx * MOUSE_SENSITIVITY;
        }
    }

    static onKeyDown = ev => this.active[ev.code] = true;
    static onKeyUp = ev => this.active[ev.code] = false;

    static onMouseMove = ev => {
        // Scale movement by screen size for consistent feel
        this.mouse.x = ev.movementX;
        this.mouse.y = ev.movementY;
    };
};
