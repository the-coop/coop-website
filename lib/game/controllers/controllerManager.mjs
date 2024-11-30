import State from '../state.mjs';
import FPSController from './fps.mjs';
import ThirdPersonController from './thirdperson.mjs';
import OrbitController from './orbit.mjs';

import GamepadInput from './inputs/gamepad.mjs';

export default class ControllerManager {
    static protagonist = null;
    static pendingMode = null;
    static events = {};
    static ready = false;

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

    static async setup(protagonist = null) {
        // Set protagonist (can be null)
        this.protagonist = protagonist;

        // Return early if already ready
        if (this.ready) {
            return true;
        }

        try {
            // Set device capabilities
            this.isMobile = State.mobile;

            // Set up gamepad input only - don't initialize controller yet
            if (!this.inputState.gamepad.initialized) {
                await GamepadInput.setup(this);
                this.inputState.gamepad.initialized = true;
            }

            this.ready = true;
            State.setControllersInitialized(true);

            return true;
        } catch (err) {
            console.error('ControllerManager setup failed:', err);
            this.ready = false;
            throw err;
        }
    }

    static isHandlingLock = false;
    static lockAttemptTimeout = null;
    static stateChangeTimeout = null;

    static handlePointerLockChange() {
        if (this.stateChangeTimeout) {
            clearTimeout(this.stateChangeTimeout);
        }

        // Debounce state changes
        this.stateChangeTimeout = setTimeout(() => {
            const wasLocked = this.isPointerLocked;
            const gameCanvas = document.getElementById('gameCanvas');
            const isLocked = document.pointerLockElement === gameCanvas ||
                            document.webkitPointerLockElement === gameCanvas ||
                            document.mozPointerLockElement === gameCanvas;

            // Only update if state actually changed
            if (wasLocked !== isLocked) {
                this.isPointerLocked = isLocked;
                
                console.log('Pointer lock state changed:', { 
                    was: wasLocked, 
                    is: this.isPointerLocked 
                });

                if (isLocked && !wasLocked) {
                    this.emit('pointerLocked');
                } else if (!isLocked && wasLocked) {
                    this.emit('pointerUnlocked');
                    // Only emit openSettings if not in the middle of a lock attempt
                    if (!this.isHandlingLock) {
                        this.emit('openSettings');
                    }
                }
            }
        }, 50); // Short debounce
    }

    static async requestPointerLock() {
        if (this.inputState.gamepad.connected || this.isHandlingLock) {
            return false;
        }

        try {
            this.isHandlingLock = true;
            const canvas = document.getElementById('gameCanvas');
            
            if (!canvas) {
                throw new Error('No canvas element found for pointer lock');
            }

            if (document.pointerLockElement === canvas) {
                this.isHandlingLock = false;
                return true;
            }

            // Request pointer lock with simple retry
            return new Promise((resolve) => {
                let attempts = 0;
                const maxAttempts = 2;
                
                const cleanup = () => {
                    document.removeEventListener('pointerlockchange', onLockChange);
                    document.removeEventListener('pointerlockerror', onLockError);
                    this.isHandlingLock = false;
                };

                const onLockChange = () => {
                    if (document.pointerLockElement === canvas) {
                        cleanup();
                        resolve(true);
                    }
                };

                const onLockError = () => {
                    attempts++;
                    if (attempts < maxAttempts) {
                        // Wait briefly and try again
                        setTimeout(() => tryLock(), 500);
                    } else {
                        cleanup();
                        resolve(false);
                    }
                };

                const tryLock = () => {
                    document.addEventListener('pointerlockchange', onLockChange);
                    document.addEventListener('pointerlockerror', onLockError);
                    
                    try {
                        canvas.requestPointerLock();
                    } catch (e) {
                        onLockError();
                    }
                };

                tryLock();
            });

        } catch (err) {
            console.warn('Pointer lock request failed:', err);
            this.isHandlingLock = false;
            return false;
        }
    }

    static exitPointerLock() {
        this.isHandlingLock = false;
        if (this.lockAttemptTimeout) {
            clearTimeout(this.lockAttemptTimeout);
            this.lockAttemptTimeout = null;
        }
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
    }

    static handleControllerStateChange(type, state) {
        this.setControllerState(type, state);
    }

    static async switchMode(mode) {
        // Don't switch modes if game hasn't started yet
        if (!State.isGameStarted) {
            this.pendingMode = mode;
            console.log('Deferring mode switch until game starts');
            return;
        }

        // Store current mode for recovery
        const prevMode = this.controlMode;
        const prevController = this.currentController;

        try {
            // Disconnect previous controller if it exists
            if (prevController?.disconnect) {
                prevController.disconnect();
            }

            // Set new controller based on mode
            const newMode = mode.toLowerCase();
            
            switch(newMode) {
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
                    throw new Error('Unknown controller mode: ' + mode);
            }

            // Only setup controller if game is running
            if (State.isGameStarted && this.protagonist) {
                await this.currentController.setup(this.protagonist);
            }

            State.setControlMode(newMode);
            console.log('Controller mode switched to:', newMode);
        } catch (err) {
            // Attempt to recover to previous controller
            console.error('Error switching controller mode:', err);
            this.currentController = prevController;
            this.controlMode = prevMode;
            if (prevController?.setup) {
                await prevController.setup(this.protagonist);
            }
            throw err;
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
        // Check if protagonist is available before updating controller
        if (this.protagonist && this.currentController?.update) {
            this.currentController.update(delta);
        }

        // Example of using protagonist
        const protagonist = State.protagonist;
        if (protagonist) {
            // Update protagonist based on controller input
        } else {
            console.warn('Protagonist not found in ControllerManager update');
        }

        // You can add additional updates related to inputState if necessary
    }

    static cleanup() {
        this.protagonist = null;
        this.ready = false;

        // Only perform cleanup if we're not in a game session
        if (!State.gameStarted) {
            // Clear controllers and state BEFORE cleaning up player references
            if (this.currentController?.disconnect) {
                this.currentController.disconnect();
            }
            
            this.currentController = null;
            this.events = {};

            // Remove event listeners
            document.removeEventListener('pointerlockchange', this._boundPointerLockChange);
            this._boundPointerLockChange = null;

            // Exit pointer lock
            this.exitPointerLock();
            this.isPointerLocked = false;

            // Cleanup GamepadInput last
            GamepadInput.cleanup();

            this.ready = false; // Update ready flag instead of isInitialized
            this.loaded = false;

            this.isHandlingLock = false;
            if (this.lockAttemptTimeout) {
                clearTimeout(this.lockAttemptTimeout);
                this.lockAttemptTimeout = null;
            }
            if (this.stateChangeTimeout) {
                clearTimeout(this.stateChangeTimeout);
                this.stateChangeTimeout = null;
            }
        }
    }

    // Consolidate controller state methods
    static setControllerState(type, state) {
        switch(type) {
            case 'gamepad':
                this.inputState.gamepad.connected = state.connected;
                // Handle multiple gamepads
                if (state.connected) {
                    this.inputState.gamepad.type = state.type;
                } else {
                    this.inputState.gamepad.type = null;
                }
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

    // New method to get current mode
    static getCurrentMode() {
        return State.controlMode; // Use getter
    }

    // Consolidate input handling
    static setInput(source, type, value) {
        // Allow certain inputs even without active controller
        const allowedWithoutController = ['MetaLeft', 'MetaRight', 'Escape'];
        if (!this.currentController && !allowedWithoutController.includes(type)) {
            return;
        }

        // Handle system keys separately
        if (source === 'keyboard' && allowedWithoutController.includes(type)) {
            // Handle system keys without requiring controller
            return;
        }

        // Regular input handling
        switch(source) {
            case 'keyboard':
                if (this.currentController?.updateInput) {
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
        if (typeof value !== 'number' || isNaN(value)) {
            console.warn('Invalid deadzone value:', value);
            return;
        }
        
        // Clamp value between 0 and 1
        this.deadzoneThreshold = Math.max(0, Math.min(1, value));
        
        // Emit the event
        this.emit('deadzoneThresholdChange', this.deadzoneThreshold);
        
        console.log(`Deadzone threshold set to: ${this.deadzoneThreshold}`);
    }

    static getGamepadType(gamepad) {
        const id = gamepad.id.toLowerCase();
        if (id.includes('xbox')) {
            return 'xbox';
        } else if (id.includes('playstation') || id.includes('sony')) {
            return 'playstation';
        }
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

    static setGameRunning(running) {
        if (running) {
            // Only initialize controller when game starts
            const mode = this.pendingMode || State.controlMode;
            if (this.protagonist) {
                this.switchMode(mode);
                this.pendingMode = null;
            } else {
                console.log('Deferring controller setup until protagonist is available');
            }
        } else {
            this.cleanup();
        }
    }

    // Method to set the protagonist when it becomes available
    static setProtagonist(protagonist) {
        this.protagonist = protagonist;

        // If there is a pending mode switch, complete it now
        if (this.pendingMode) {
            this.switchMode(this.pendingMode);
            this.pendingMode = null;
        } else if (this.currentController?.setProtagonist) {
            // Otherwise, set protagonist in the current controller
            this.currentController.setProtagonist(protagonist);
        }
    }
}

// Initialize static properties outside the class
ControllerManager.currentController = null;
ControllerManager.isMobile = false;
ControllerManager.isPointerLocked = false;
ControllerManager.ready = false; // Initialize 'ready' properly
ControllerManager.loaded = false;

ControllerManager.inputState = {
    gamepad: {
        connected: false,
        type: null,
        initialized: false
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

ControllerManager.events = {};

ControllerManager.isHandlingLock = false;
ControllerManager.lockAttemptTimeout = null;
ControllerManager.stateChangeTimeout = null;

ControllerManager.deadzoneThreshold = 0.1; // Default deadzone
ControllerManager.sensitivity = 1.0; // Default sensitivity
ControllerManager.pendingMode = null;