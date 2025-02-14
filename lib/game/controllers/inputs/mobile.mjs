import Engine from '../../engine.mjs';
import ControlManager from '../../control.mjs';

const TOUCH_SENSITIVITY = 0.003;
const MOBILE_BREAKPOINT = 768;

export default class Mobile {
    static movement = { x: 0, y: 0 };
    static aim = { x: 0, y: 0 };

    static detect() {
        return 'ontouchstart' in window && window.innerWidth <= MOBILE_BREAKPOINT;
    }

    static setup() {
        console.log('Trying to setup mobile inputs.');
        Engine.mobile = true;
    }

    static cleanup() {
        this.movement = { x: 0, y: 0 };
        this.aim = { x: 0, y: 0 };
    }

    static update() {
        // Convert movement touch position to WASD-like input
        ControlManager.controller.input.movement.x = this.movement.x;
        ControlManager.controller.input.movement.z = this.movement.y;

        // Convert aim touch position to rotation
        ControlManager.controller.input.rotation.x = this.aim.x * TOUCH_SENSITIVITY;
        ControlManager.controller.input.rotation.y = this.aim.y * TOUCH_SENSITIVITY;
    };

};