import ControlManager from '../../control.mjs';

export default class PC {

    static MOUSE_SENSITIVITY = 0.005;
    static onKeyDown = ev => this.active[ev.code] = true;
    static onKeyUp = ev => this.active[ev.code] = false;
    static active = {};
    static mouseMovement = { x: 0, y: 0 };

    static onMouseMove = ev => {
        this.mouseMovement.x = ev.movementX / window.innerWidth;
        this.mouseMovement.y = ev.movementY / window.innerHeight;
    };

    static setup() {
        console.log('setting up PC controls');
        
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        document.addEventListener('mousemove', this.onMouseMove);
        
        // Lock pointer for FPS controls
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });
    };

    static cleanup() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        document.removeEventListener('mousemove', this.onMouseMove);
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }
        this.active = {};
        this.mouseMovement = { x: 0, y: 0 };
    };

    static isKeyPressed(code) {
        return this.active[code] || false;
    };

    static getMouseMovement() {
        const movement = { ...this.mouseMovement };
        // Reset movement after reading
        this.mouseMovement = { x: 0, y: 0 };
        return movement;
    };

    static update() {
        if (!ControlManager.controller?.input) return;

        // Update movement
        if (this.isKeyPressed('KeyW')) ControlManager.controller.input.movement.z -= 1;
        if (this.isKeyPressed('KeyS')) ControlManager.controller.input.movement.z += 1;
        if (this.isKeyPressed('KeyA')) ControlManager.controller.input.movement.x -= 1;
        if (this.isKeyPressed('KeyD')) ControlManager.controller.input.movement.x += 1;

        // Update rotation
        const mouse = this.getMouseMovement();
        ControlManager.controller.input.rotation.x -= mouse.x * this.MOUSE_SENSITIVITY;
        ControlManager.controller.input.rotation.y -= mouse.y * this.MOUSE_SENSITIVITY;

        // Update jump
        ControlManager.controller.input.jump |= this.isKeyPressed('Space');
    }
}
