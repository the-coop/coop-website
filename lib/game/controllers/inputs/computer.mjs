import State from '../../state.mjs';
import ControllerManager from '../controllerManager.mjs';

export default class ComputerInput {
    static keys = {};
    static mouse = {
        movementX: 0,
        movementY: 0
    };

    static handlers = {
        keyDown: null,
        keyUp: null,
        mouseMove: null,
        fullscreenChange: null
    };

    static boundHandlers = {};
    static initialised = false;
    static isSetup = false; // New flag to prevent multiple setups

    static async requestFullscreen(element) {
        if (!element) return false;
        
        try {
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen();
            } else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            }
            return true;
        } catch (err) {
            console.error('Fullscreen request failed:', err);
            return false;
        }
    }

    static async exitFullscreen() {
        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                await document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                await document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                await document.msExitFullscreen();
            }
            return true;
        } catch (err) {
            console.error('Exit fullscreen failed:', err);
            return false;
        }
    }

    static async requestPointerLock(element) {
        if (!element) {
            throw new Error('Element is required to request pointer lock');
        }

        try {
            element.requestPointerLock = element.requestPointerLock ||
                                         element.mozRequestPointerLock ||
                                         element.webkitRequestPointerLock;
            if (element.requestPointerLock) {
                await element.requestPointerLock();
                // Update State with pointer lock support
                State.setPointerLockSupport(true);
            } else {
                // Update State indicating pointer lock is not supported
                State.setPointerLockSupport(false);
                throw new Error('Pointer lock API not supported');
            }
        } catch (err) {
            console.error('Failed to request pointer lock:', err);
            // Ensure State reflects the failure
            State.setPointerLockSupport(false);
        }
    }

    static exitPointerLock() {
        if (document.exitPointerLock) {
            document.exitPointerLock();
            // Update State as pointer lock is exited
            State.setPointerLockSupport(false);
        } else if (document.mozExitPointerLock) {
            document.mozExitPointerLock();
            State.setPointerLockSupport(false);
        }
    }

    static async setup() {
        if (this.isSetup) { // Check setup flag
            console.log('ComputerInput is already set up.');
            return true;
        }

        try {
            // Remove any existing listeners before adding new ones
            this.cleanup();
            
            // Initialize bound handlers
            this.boundHandlers = {
                keyDown: this.handleKeyDown.bind(this),
                keyUp: this.handleKeyUp.bind(this),
                mouseMove: this.handleMouseMove.bind(this)
                // Remove fullscreenChange binding since we handle it elsewhere
            };
            
            // Add event listeners
            window.addEventListener('keydown', this.boundHandlers.keyDown);
            window.addEventListener('keyup', this.boundHandlers.keyUp);
            window.addEventListener('mousemove', this.boundHandlers.mouseMove);
            
            this.isSetup = true;
            console.log('ComputerInput setup complete.');
            return true;
        } catch (err) {
            console.error('ComputerInput setup failed:', err);
            State.addLog(`ComputerInput setup failed: ${err.message}`, 'computer.mjs');
            this.isSetup = false;
            return false;
        }
    }

    static detectSafari() {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        State.setSafari(isSafari);
    }

    static cleanup() {
        if (!this.isSetup) return; // Ensure cleanup happens only if setup was done

        // Remove event listeners
        if (this.boundHandlers?.keyDown) {
            window.removeEventListener('keydown', this.boundHandlers.keyDown);
        }
        if (this.boundHandlers?.keyUp) {
            window.removeEventListener('keyup', this.boundHandlers.keyUp);
        }
        if (this.boundHandlers?.mouseMove) {
            window.removeEventListener('mousemove', this.boundHandlers.mouseMove);
        }

        // Reset state
        this.isSetup = false;
        this.boundHandlers = {};
        this.initialised = false;

        // Clear inputs
        this.clearInputs();
        
        // Update State for pointer lock support
        State.setPointerLockSupport(false);
        
        console.log('ComputerInput has been cleaned up.');
    }

    static handleKeyDown(event) {
        if (this.keys[event.code]) return;
        
        this.keys[event.code] = true;
        console.log('Key down:', event.code);
        
        // Handle ESC press when game is started but not pointer locked
        if (event.code === 'Escape' && this.isGameStarted && !ControllerManager.isPointerLocked) {
            ControllerManager.emit('openSettings');
        }
        
        ControllerManager.setInput('keyboard', event.code, true);

        // Map key events to movement controls
        const keyMappings = {
            'KeyW': 'forward',
            'KeyA': 'left',
            'KeyS': 'back',
            'KeyD': 'right',
            'ShiftLeft': 'sprint',
            'Space': 'jump',
            'KeyC': 'crouch'
        };

        const action = keyMappings[event.code];
        if (action) {
            ControllerManager.setInput('computer', 'movement', { 
                input: action, 
                value: true 
            });
        }
    }

    static handleKeyUp(event) {
        if (!this.keys[event.code]) return;
        
        this.keys[event.code] = false;
        console.log('Key up:', event.code);
        
        ControllerManager.setInput('keyboard', event.code, false);

        const keyMappings = {
            'KeyW': 'forward',
            'KeyA': 'left',
            'KeyS': 'back',
            'KeyD': 'right',
            'ShiftLeft': 'sprint',
            'Space': 'jump',
            'KeyC': 'crouch'
        };

        const action = keyMappings[event.code];
        if (action) {
            ControllerManager.setInput('computer', 'movement', { 
                input: action, 
                value: false 
            });
        }
    }

    static handleMouseMove(event) {
        if (!ControllerManager.isPointerLocked) return;
        
        console.log('Mouse move:', event.movementX, event.movementY);
        
        ControllerManager.setInput('computer', 'mouseMovement', {
            x: event.movementX,
            y: event.movementY
        });

        // Send mouse movement to controller
        ControllerManager.setInput('computer', 'mouseMovement', {
            x: event.movementX || event.mozMovementX || event.webkitMovementX || 0,
            y: event.movementY || event.mozMovementY || event.webkitMovementY || 0
        });
    }

    static handleResize() {
        // Reset mouse state on resize
        this.mouse = {
            movementX: 0,
            movementY: 0
        };
    }

    static clearInputs() {
        Object.keys(this.keys).forEach(key => {
            if (this.keys[key]) {
                this.keys[key] = false;
                ControllerManager.setInput('keyboard', key, false);
            }
        });
    }

    static update(delta) {
        // If there are any per-frame updates needed for computer inputs, implement them here
    }

    static setGameStarted(started) {
        if (started) {
            this.setup();
        } else {
            this.cleanup();
        }
    }
}