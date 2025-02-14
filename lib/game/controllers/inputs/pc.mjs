import ControlManager from '../../control.mjs';
import StartMenuController from '../StartMenuController.mjs';

const MOUSE_SENSITIVITY = 0.0008;

export default class PC {
    static active = {};
    static mouse = { x: 0, y: 0 };

    static setup() {
        console.log('setting up PC controls');
        
        // Setup key detection listeners.
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        
        // Lock pointer for FPS controls
        // document.addEventListener('click', () => document.body.requestPointerLock());
    };

    static cleanup() {
        // Cleanup key detection listeners.
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);

        // Exit pointer lock if it's applied.
        if (document.pointerLockElement) document.exitPointerLock();

        // Reset input state.
        this.active = {};
        this.mouse = { x: 0, y: 0 };
    };

    static update() {
        // Do not attempt to calculate with controllers that have no movement/aim.
        if (ControlManager.controller === StartMenuController) return;

        // Use active state directly
        if (this.active['KeyW']) ControlManager.controller.input.movement.z -= 1;
        if (this.active['KeyS']) ControlManager.controller.input.movement.z += 1;
        if (this.active['KeyA']) ControlManager.controller.input.movement.x -= 1;
        if (this.active['KeyD']) ControlManager.controller.input.movement.x += 1;

        // Only process mouse input if pointer is locked
        if (document.pointerLockElement) {
            const dx = Math.abs(this.mouse.x) < 0.05 ? 0 : this.mouse.x;
            const dy = Math.abs(this.mouse.y) < 0.05 ? 0 : this.mouse.y;

            ControlManager.controller.input.rotation.x = -dx * MOUSE_SENSITIVITY;
            ControlManager.controller.input.rotation.y = -dy * MOUSE_SENSITIVITY;
        }

        // Reset mouse movement.
        this.mouse.x = 0;
        this.mouse.y = 0;

        // Update jump directly from active state
        ControlManager.controller.input.jump |= this.active['Space'];
    };

    static onKeyDown = ev => this.active[ev.code] = true;
    static onKeyUp = ev => this.active[ev.code] = false;

    static onMouseMove = ev => {
        // Scale movement by screen size for consistent feel
        this.mouse.x = ev.movementX;
        this.mouse.y = ev.movementY;
    };

};
