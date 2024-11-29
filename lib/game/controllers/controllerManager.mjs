import PlayerManager from '../players/playerManager.mjs';
import FPSController from './fps.mjs';
import ThirdPersonController from './thirdperson.mjs';
import OrbitController from './orbit.mjs';
import GamepadInput from './inputs/gamepad.mjs'; // Import GamepadInput

export default class ControllerManager {
    static currentController = null;
    static controlMode = 'fps';
    static isMobile = false;
    static isPointerLocked = false;
    static wasPointerLocked = false;

    static inputState = {
        gamepad: {
            connected: false,
            type: null // Will be set from GamepadInput.type
        },
        mobile: {
            enabled: false,
            inputs: {
                forward: false,
                back: false,
                left: false,
                right: false,
                jump: false,
                sprint: false
            },
            touch: {
                x: 0,
                y: 0
            },
            mouse: {
                movementX: 0,
                movementY: 0
            }
        },
        keyboard: {},
        mouse: {}
    };

    static events = {};

    static on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    static off(event, listener) {
        if (!this.events[event]) return;
        const index = this.events[event].indexOf(listener);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }

    static emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => listener(...args));
    }

    static setup() {
        if (!PlayerManager.protagonist || !PlayerManager.protagonist.mesh || !PlayerManager.protagonist.cameraPivot) {
            console.error('Cannot setup controller: invalid player or missing components');
            return;
        }

        this.isMobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

        this.currentController = FPSController;
        this.controlMode = 'fps';

        if (this.currentController?.setup) {
            this.currentController.setup();  // No need to pass player anymore
        }

        // Initialize GamepadInput through InputManager if not already initialized
        GamepadInput.setup();
        // Ensure GamepadInput remains active regardless of control mode

        // Store the bound handler to remove it later
        this._boundPointerLockChange = this.handlePointerLockChange.bind(this);
        document.addEventListener('pointerlockchange', this._boundPointerLockChange);

        // Listen for controller state changes
        this.on('controllerStateChange', this.handleControllerStateChange.bind(this));
    }

    static handlePointerLockChange() {
        this.wasPointerLocked = this.isPointerLocked;
        this.isPointerLocked = document.pointerLockElement !== null;

        // If exiting pointer lock and game is active, open settings
        if (this.wasPointerLocked && !this.isPointerLocked) {
            this.emit('openSettings');
        }
    }

    static handleControllerStateChange(type, state) {
        this.setControllerState(type, state);
    }

    static requestPointerLock() {
        document.body.requestPointerLock();
    }

    static exitPointerLock() {
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    static switchMode(mode) {
        try {
            if (!PlayerManager.protagonist) {
                console.error('Cannot switch mode: no protagonist available');
                return;
            }

            const prevController = this.currentController;
            if (prevController && prevController.disconnect) {
                prevController.disconnect();
            }

            switch(mode.toLowerCase()) {
                case 'fps':
                    this.currentController = FPSController;
                    break;
                case 'thirdperson':
                    this.currentController = ThirdPersonController;
                    break;
                case 'orbit':
                    this.currentController = OrbitController;
                    break;
                default:
                    console.warn('Unknown controller mode:', mode);
                    return;
            }

            if (this.currentController && this.currentController.setup) {
                this.currentController.setup();  // No need to pass player anymore
            }

            this.controlMode = mode.toLowerCase();
        } catch (e) {
            console.error('Error switching controller mode:', e);
            // Attempt recovery by switching to FPS mode
            if (this.controlMode !== 'fps') {
                this.switchMode('fps');
            }
        } finally {
            this.isExplicitModeSwitch = false;
        }
    }

    static cleanupCurrentController() {
        if (this.currentController) {
            console.log('Cleaning up controller:', this.currentController.name);
            try {
                this.currentController.disconnect();
            } catch (e) {
                console.warn('Error during controller cleanup:', e);
            }
            this.currentController = null;
        }
    }

    static update(delta) {
        if (this.currentController?.update) {
            this.currentController.update(delta);
        }

        // You can add additional updates related to inputState if necessary
    }

    static cleanup() {
        if (this.currentController && this.currentController.disconnect) {
            this.currentController.disconnect();
        }
        this.currentController = null;
        this.controlMode = 'fps';
        this.events = {};
        document.removeEventListener('pointerlockchange', this._boundPointerLockChange);
        this._boundPointerLockChange = null;
        this.exitPointerLock();
        this.isPointerLocked = false;
        this.wasPointerLocked = false;

        // Cleanup GamepadInput
        GamepadInput.cleanup();
    }

    // Consolidate controller state methods
    static setControllerState(type, state) {
        switch(type) {
            case 'gamepad':
                this.inputState.gamepad.connected = state.connected;
                this.inputState.gamepad.type = state.type; // Now using static type from GamepadInput
                break;
            case 'mobile':
                this.inputState.mobile.enabled = state.enabled;
                break;
            case 'keyboard':
                // Handle keyboard state if necessary
                this.inputState.keyboard[state.input] = state.value;
                break;
            case 'mouse':
                // Handle mouse movement
                this.inputState.mouse.movementX = state.movement.x;
                this.inputState.mouse.movementY = state.movement.y;
                break;
        }
        this.emit('controllerStateChange', type, state);
    }

    // New method to handle explicit mode switches from UI
    static explicitModeSwitch(mode) {
        this.isExplicitModeSwitch = true;
        this.switchMode(mode);
    }

    // New method to get current mode
    static getCurrentMode() {
        return this.controlMode;
    }

    // Consolidate input handling
    static setInput(source, type, value) {
        if (!this.currentController) {
            console.warn('No active controller to handle input:', { source, type, value });
            return;
        }

        // Add debug logging
        console.log('Input received:', { source, type, value });

        switch(source) {
            case 'keyboard':
                // Map keyboard codes to movement inputs
                switch(type) {
                    case 'KeyW':
                        this.currentController.updateInput('movement', 'forward', value);
                        break;
                    case 'KeyS':
                        this.currentController.updateInput('movement', 'back', value);
                        break;
                    case 'KeyA':
                        this.currentController.updateInput('movement', 'left', value);
                        break;
                    case 'KeyD':
                        this.currentController.updateInput('movement', 'right', value);
                        break;
                    case 'Space':
                        this.currentController.updateInput('movement', 'jump', value);
                        break;
                    case 'ShiftLeft':
                    case 'ShiftRight':
                        this.currentController.updateInput('movement', 'sprint', value);
                        break;
                    case 'KeyC':
                        this.currentController.updateInput('movement', 'crouch', value);
                        break;
                }
                break;

            case 'computer':
                if (type === 'mouseMovement') {
                    // Apply sensitivity to mouse movement
                    const adjustedValue = {
                        x: value.x * this.sensitivity,
                        y: value.y * this.sensitivity
                    };
                    this.currentController.updateInput('mouseMovement', null, adjustedValue);
                }
                break;

            case 'gamepad':
                // Handle gamepad inputs using static type from GamepadInput
                if (type === 'movement') {
                    // Handle structured movement inputs
                    switch(value.type) {
                        case 'jump':
                            console.log('Gamepad jump input received:', value.value);
                            this.currentController.updateInput('movement', 'jump', value.value);
                            break;
                    }
                } else if (type === 'rightStick') {
                    // Apply sensitivity to gamepad aim
                    const adjustedValue = {
                        x: value.x * this.sensitivity,
                        y: value.y * this.sensitivity
                    };
                    this.currentController.updateInput('movement', 'rightStick', adjustedValue);
                } else {
                    // Handle other gamepad inputs
                    switch(type) {
                        case 'leftStick':
                            this.currentController.updateInput('movement', 'leftStick', value);
                            break;
                        case 'rightStick':
                            this.currentController.updateInput('movement', 'rightStick', value);
                            break;
                    }
                }
                break;
        }
    }

    // Add deadzoneThreshold with a default value
    static deadzoneThreshold = 0.1; // Default deadzone

    // Method to update deadzoneThreshold
    static setDeadzoneThreshold(value) {
        this.deadzoneThreshold = value;
        console.log(`Deadzone threshold set to: ${value}`);
        this.emit('deadzoneThresholdChange', value);
    }

    static getGamepadType(gamepad) {
        if (gamepad.id.toLowerCase().includes('xbox')) return 'xbox';
        if (gamepad.id.toLowerCase().includes('playstation') || gamepad.id.toLowerCase().includes('ps4') || gamepad.id.toLowerCase().includes('ps5')) return 'playstation';
        return 'generic';
    }

    static sensitivity = 1.0; // Default sensitivity

    static setSensitivity(value) {
        this.sensitivity = value;
        this.emit('sensitivityChange', value);
    }

    static getSensitivity() {
        return this.sensitivity;
    }
}