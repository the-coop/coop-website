import ControllerManager from '../controllerManager.mjs';

export default class KeyboardInput {
    constructor() {
        this.keys = {};
        this.handlers = {
            keyDown: this.handleKeyDown.bind(this),
            keyUp: this.handleKeyUp.bind(this)
        };
    }

    init() {
        window.addEventListener('keydown', this.handlers.keyDown);
        window.addEventListener('keyup', this.handlers.keyUp);
    }

    cleanup() {
        window.removeEventListener('keydown', this.handlers.keyDown);
        window.removeEventListener('keyup', this.handlers.keyUp);
    }

    handleKeyDown(event) {
        if (!this.keys[event.code]) {
            this.keys[event.code] = true;
            ControllerManager.setInput('keyboard', event.code, true);
        }
    }

    handleKeyUp(event) {
        if (this.keys[event.code]) {
            this.keys[event.code] = false;
            ControllerManager.setInput('keyboard', event.code, false);
        }
    }

    // Add an update method if needed
    update(delta) {
        // Implement any per-frame updates for keyboard inputs here
    }
}
