import ControllerManager from '../controllerManager.mjs';

export default class MouseInput {
    constructor() {
        this.mouse = {
            movementX: 0,
            movementY: 0
        };
        this.handlers = {
            mouseMove: this.handleMouseMove.bind(this)
        };
    }

    init() {
        window.addEventListener('mousemove', this.handlers.mouseMove);
    }

    cleanup() {
        window.removeEventListener('mousemove', this.handlers.mouseMove);
    }

    handleMouseMove(event) {
        // Only process mouse movement if pointer is locked
        if (document.pointerLockElement) {
            // Send movement directly to controller
            ControllerManager.setInput('mouse', 'movement', {
                x: event.movementX,
                y: event.movementY
            });
        }
    }

    // If using the update method for batched updates
    update(delta) {
        // Nothing needed here if we're handling movement directly in handleMouseMove
    }
}
