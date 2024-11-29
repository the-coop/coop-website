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
        mouseMove: null
    };

    static setup() {
        // Initialize if handlers aren't set up
        if (this.handlers.keyDown) return;
        
        this.handlers.keyDown = this.handleKeyDown.bind(this);
        this.handlers.keyUp = this.handleKeyUp.bind(this);
        this.handlers.mouseMove = this.handleMouseMove.bind(this);
        
        window.addEventListener('keydown', this.handlers.keyDown);
        window.addEventListener('keyup', this.handlers.keyUp);
        window.addEventListener('mousemove', this.handlers.mouseMove);
    }

    static cleanup() {
        // Only cleanup when game is stopping
        if (!State.isGameStarted) {
            this.clearInputs();
            
            if (this.handlers.keyDown) {
                window.removeEventListener('keydown', this.handlers.keyDown);
                this.handlers.keyDown = null;
            }
            if (this.handlers.keyUp) {
                window.removeEventListener('keyup', this.handlers.keyUp);
                this.handlers.keyUp = null;
            }
            if (this.handlers.mouseMove) {
                window.removeEventListener('mousemove', this.handlers.mouseMove);
                this.handlers.mouseMove = null;
            }
        }
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
    }

    static handleKeyUp(event) {
        if (!this.keys[event.code]) return;
        
        this.keys[event.code] = false;
        console.log('Key up:', event.code);
        
        ControllerManager.setInput('keyboard', event.code, false);
    }

    static handleMouseMove(event) {
        if (!ControllerManager.isPointerLocked) return;
        
        console.log('Mouse move:', event.movementX, event.movementY);
        
        ControllerManager.setInput('computer', 'mouseMovement', {
            x: event.movementX,
            y: event.movementY
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