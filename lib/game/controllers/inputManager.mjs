import State from '../state.mjs';
import ControllerManager from './controllerManager.mjs';

export default class InputManager {
    static inputs = {
        keyboard: {},
        mouse: { x: 0, y: 0 },
        gamepad: null
    };

    static handlers = new Map();
    static isGameRunning = false;
    static debounceTimeout = null;
    static isSetup = false; // New flag to prevent multiple setups

    static async setup() {
        if (!process.client) return;
        
        if (this.isSetup) { // Check setup flag
            console.warn('InputManager is already set up.');
            return;
        }

        this.isSetup = true; // Set setup flag

        // Bind handlers explicitly
        this.onKeyDown = this.handleKeyDown.bind(this);
        this.onKeyUp = this.handleKeyUp.bind(this);
        this.onMouseMove = this.handleMouseMove.bind(this);
        this.onGamepadConnected = this.handleGamepadConnected.bind(this);
        this.onStartGame = this.handleStartGame.bind(this);

        // Add handlers using bound methods
        this.addHandler('keydown', this.onKeyDown);
        this.addHandler('keyup', this.onKeyUp);
        this.addHandler('mousemove', this.onMouseMove);
        this.addHandler('gamepadconnected', this.onGamepadConnected);
        this.addHandler('keydown', this.onStartGame);
    }

    static addHandler(event, handler) {
        window.addEventListener(event, handler);
        this.handlers.set(event, handler);
    }

    static cleanup() {
        if (!this.isSetup) return; // Ensure cleanup happens only if setup was done
        
        this.handlers.forEach((handler, event) => {
            window.removeEventListener(event, handler);
        });
        this.handlers.clear();
        this.inputs = { keyboard: {}, mouse: { x: 0, y: 0 }, gamepad: null };
        this.isSetup = false; // Reset setup flag
    }

    static handleKeyDown(event) {
        this.inputs.keyboard[event.code] = true;
        if (State.mode === 'detection' && !State.isGameStarted) { // Only handle start game in detection mode
            this.handleStartGame(event);
        }
    }

    static handleKeyUp(event) {
        this.inputs.keyboard[event.code] = false;
    }

    static handleMouseMove(event) {
        if (State.isGameStarted && document.pointerLockElement) {
            this.inputs.mouse.x = event.movementX;
            this.inputs.mouse.y = event.movementY;
        }
    }

    static handleGamepadConnected(event) {
        this.inputs.gamepad = event.gamepad;
        // Optionally, update State or emit events about connected gamepads
    }

    static handleStartGame(event) {
        if (State.mode === 'detection' && !State.isGameStarted) { // Only handle start game in detection mode
            if (event.code === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                if (!this.debounceTimeout) {
                    ControllerManager.emit('startGame');
                    this.debounceTimeout = setTimeout(() => {
                        this.debounceTimeout = null;
                    }, 1000); // 1 second debounce
                }
            }
        }
    }

    static update(delta) {
        if (!this.isGameRunning) return;
        // Update input states or handle gameplay-specific inputs if needed
    }

    static handleResize() {
        // Handle any input-related resizing logic
    }

    static setGameRunning(running) {
        this.isGameRunning = running;
    }
}