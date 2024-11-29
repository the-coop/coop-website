import ControllerManager from '../controllerManager.mjs';

export default class ComputerInput {
    constructor() {
        this.keys = {};
        this.mouse = {
            movementX: 0,
            movementY: 0
        };
        this.isGameStarted = false;
        this.handlers = {
            keyDown: this.handleKeyDown.bind(this),
            keyUp: this.handleKeyUp.bind(this),
            mouseMove: this.handleMouseMove.bind(this)
        };
    }

    init() {
        console.log('Initializing ComputerInput');
        window.addEventListener('keydown', this.handlers.keyDown);
        window.addEventListener('keyup', this.handlers.keyUp);
        window.addEventListener('mousemove', this.handlers.mouseMove);
    }

    setup() {
        window.addEventListener('keydown', this.handlers.keyDown);
        window.addEventListener('keyup', this.handlers.keyUp);
        window.addEventListener('mousemove', this.handlers.mouseMove);
    }

    cleanup() {
        console.log('Cleaning up ComputerInput');
        this.clearInputs();
        window.removeEventListener('keydown', this.handlers.keyDown);
        window.removeEventListener('keyup', this.handlers.keyUp);
        window.removeEventListener('mousemove', this.handlers.mouseMove);
    }

    handleKeyDown(event) {
        if (this.keys[event.code]) return;
        
        this.keys[event.code] = true;
        console.log('Key down:', event.code);
        
        // Handle ESC press when game is started but not pointer locked
        if (event.code === 'Escape' && this.isGameStarted && !ControllerManager.isPointerLocked) {
            ControllerManager.emit('openSettings');
        }
        
        ControllerManager.setInput('keyboard', event.code, true);
    }

    handleKeyUp(event) {
        if (!this.keys[event.code]) return;
        
        this.keys[event.code] = false;
        console.log('Key up:', event.code);
        
        ControllerManager.setInput('keyboard', event.code, false);
    }

    handleMouseMove(event) {
        if (!ControllerManager.isPointerLocked) return;
        
        console.log('Mouse move:', event.movementX, event.movementY);
        
        ControllerManager.setInput('computer', 'mouseMovement', {
            x: event.movementX,
            y: event.movementY
        });
    }

    clearInputs() {
        Object.keys(this.keys).forEach(key => {
            if (this.keys[key]) {
                this.keys[key] = false;
                ControllerManager.setInput('keyboard', key, false);
            }
        });
    }

    // Add an update method if computer inputs require per-frame updates
    update(delta) {
        // If there are any per-frame updates needed for computer inputs, implement them here
    }

    // Add method to update game state
    setGameStarted(started) {
        this.isGameStarted = started;
    }
}