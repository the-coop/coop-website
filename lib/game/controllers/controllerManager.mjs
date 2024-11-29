import PlayerManager from '../players/playerManager.mjs';
import FPSController from './fps.mjs';
import ThirdPersonController from './thirdperson.mjs';
import OrbitController from './orbit.mjs';

export default class ControllerManager {
    static currentController = null;
    static controlMode = 'fps';
    static isMobile = false;

    static inputState = {
        gamepad: {
            connected: false,
            type: null
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
    }

    static detectGamepadType(gamepad) {
        if (!gamepad) return null;
        const id = gamepad.id.toLowerCase();
        if (id.includes('xbox')) return 'xbox';
        if (id.includes('054c') || id.includes('playstation') || id.includes('ps4') || id.includes('ps5')) {
            return 'playstation';
        }
        return null;
    }

    // Consolidate controller state methods
    static setControllerState(type, state) {
        switch(type) {
            case 'gamepad':
                this.inputState.gamepad.connected = state.connected;
                this.inputState.gamepad.type = state.type;
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
                }
                break;

            case 'computer':
                if (type === 'mouseMovement') {
                    this.currentController.updateInput('mouseMovement', null, value);
                }
                break;
        }
    }
}