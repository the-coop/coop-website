import State from '../state.mjs';
import FPSController from './fps.mjs'; // Ensure it references the correct FPSController
import ComputerInput from './inputs/computer.mjs';
import GamepadInput from './inputs/gamepad.mjs';
import PlayerManager from '../players/playerManager.mjs'; // Updated to reflect removal
import Engine from '../engine.mjs'; // Ensure Engine is imported

export default class ControllerManager {
    static currentController = null;
    static isPointerLocked = false;
    static sensitivity = 1.0;
    static eventListeners = {};
    static inputSystems = {
        computer: ComputerInput,
        gamepad: GamepadInput
    };
    static startGameEmitted = false; // New flag
    static mode = 'detection'; // New property to manage mode
    static boundHandlers = {}; // New property to store bound handlers

    static inputState = {
        keyboard: {},
        mouse: { x: 0, y: 0 },
        gamepad: {
            connected: false,
            type: null,
            initialised: false
        }
    };

    static ready = false;
    static isSetup = false; // New flag to prevent multiple setups

    // Add method to handle input updates
    static setInput(type, input, value) {
        // Forward all inputs to current controller if available and in gameplay mode
        if (this.mode === 'gameplay' && this.currentController && this.currentController.updateInput) {
            this.currentController.updateInput(type, input, value);
        }
    }

    // Initial setup - just register handlers, don't start anything
    static async setup() {
        if (this.isSetup) { // Check setup flag
            console.warn('ControllerManager is already set up.');
            return;
        }

        this.isSetup = true; // Set setup flag
        State.addLog('Setting up controller manager basics...', 'controllerManager.mjs');
        try {
            // Bind the pointer lock change handler
            this.boundHandlers.onPointerLockChange = this.handlePointerLockChange.bind(this);
            document.addEventListener('pointerlockchange', this.boundHandlers.onPointerLockChange);
            
            // Reset state
            this.inputState = {
                keyboard: {},
                mouse: { x: 0, y: 0 },
                gamepad: {
                    connected: false,
                    type: null,
                    initialised: false
                }
            };

            // Setup input systems for detection only
            await Promise.all([
                this.inputSystems.computer.setup(),
                this.inputSystems.gamepad.setup()
            ]);

            // **Add Listener for 'startGame' Event**
            this.on('startGame', this.handleGameStart.bind(this));

            this.ready = true;
            State.addLog('Basic input detection ready', 'controllerManager.mjs');
            return true;
        } catch (err) {
            this.ready = false;
            State.addLog(`Controller setup failed: ${err.message}`, 'controllerManager.mjs');
            this.isSetup = false; // Reset setup flag on failure
            return false;
        }
    }

    // Called when game actually starts
    static async onGameStart() {
        try {
            // Verify protagonist exists before proceeding
            if (!State.protagonist) {
                console.error('Cannot start controllers: no protagonist in State');
                return false;
            }

            this.mode = 'gameplay';
            const controlMode = State.controlMode || 'fps';
            
            switch (controlMode) {
                case 'fps':
                    this.currentController = FPSController;
                    break;
                default:
                    console.error(`Unknown control mode: ${controlMode}`);
                    return false;
            }

            if (this.currentController && typeof this.currentController.setup === 'function') {
                const success = await this.currentController.setup();
                if (!success) {
                    console.error('Controller setup failed');
                    return false;
                }
            }

            return true;
        } catch (err) {
            console.error('Error in onGameStart:', err);
            return false;
        }
    }

    static async switchMode(mode) {
        // Ensure game is started
        if (!State.isGameStarted) {
            console.error('Cannot switch mode: game not started');
            return false;
        }

        // // Remove protagonist check
        // const protagonist = await PlayerManager.getProtagonist();
        // if (!protagonist) {
        //     console.error('Cannot switch mode: no protagonist');
        //     return false;
        // }

        // Clean up existing controller
        if (this.currentController) {
            this.currentController.cleanup();
        }

        try {
            switch(mode.toLowerCase()) {
                case 'fps':
                    this.currentController = FPSController;
                    await this.currentController.setup();
                    break;
                default:
                    throw new Error(`Unknown control mode: ${mode}`);
            }

            State.controlMode = mode;
            this.emit('controlModeChanged', mode);
            return true;
        } catch (err) {
            console.error('Mode switch failed:', err);
            return false;
        }
    }

    static update(delta) {
        if (this.mode === 'gameplay' && this.currentController && State.isGameStarted) {
            this.currentController.update(delta);
        }
    }

    static cleanup() {
        if (!this.isSetup) return; // Ensure cleanup happens only if setup was done

        // Cleanup input systems
        Object.values(this.inputSystems).forEach(system => system.cleanup());
        
        // Cleanup current controller
        if (this.currentController) {
            this.currentController.cleanup();
            this.currentController = null;
        }

        // Remove event listeners
        if (this.boundHandlers.onPointerLockChange) {
            document.removeEventListener('pointerlockchange', this.boundHandlers.onPointerLockChange);
        }

        // Reset input state
        this.inputState = {
            keyboard: {},
            mouse: { x: 0, y: 0 },
            gamepad: {
                connected: false,
                type: null,
                initialised: false
            }
        };
        
        this.isPointerLocked = false;
        this.eventListeners = {};
        this.startGameEmitted = false; // Reset the flag during cleanup
        this.isSetup = false; // Reset setup flag
        this.mode = 'detection'; // Reset mode
        console.log('ControllerManager has been cleaned up.');
    }

    static handlePointerLockChange() {
        this.isPointerLocked = !!document.pointerLockElement;
        console.log(`Pointer lock changed: ${this.isPointerLocked}`);
    }

    static getSensitivity() {
        return this.sensitivity;
    }

    static setSensitivity(value) {
        this.sensitivity = Number(value) || 1.0;
    }

    // Implement event emitter methods
    static on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    static off(event, callback) {
        if (!this.eventListeners[event]) return;
        this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }

    static emit(event, data) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        
        // Add logging for start game events
        if (event === 'startGame') {
            console.log('Emitting startGame event');
        }
        
        this.eventListeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (err) {
                console.error(`Error in ${event} event handler:`, err);
            }
        });
    }

    // Updated handleStartGame to respect the mode
    static handleStartGame(event) {
        if (this.mode === 'detection') { // Only handle start game in detection mode
            if (!State.isGameStarted && !this.startGameEmitted) { // Check the flag
                if (event.code === 'Enter' || event.code === 'Space') {
                    event.preventDefault();
                    this.emit('startGame');
                    this.startGameEmitted = true; // Set the flag
                    setTimeout(() => {
                        this.startGameEmitted = false; // Reset after debounce
                    }, 1000); // Added closing parenthesis and delay
                }
            }
        }
    }

    // **Add the handleGameStart method**
    static async handleGameStart() {
        console.log('ControllerManager: Handling game start.');
        const success = await Engine.setGameStarted(true); // Changed from startGame to setGameStarted
        if (success) {
            console.log('ControllerManager: Game started successfully.');
        } else {
            console.error('ControllerManager: Game failed to start.');
        }
    }
}