import Engine from '../../engine.mjs';
import ControlManager from '../../control.mjs';
import StartMenuController from '../StartMenuController.mjs';

const TOUCH_SENSITIVITY = 0.003;

export default class Mobile {
    static movement = { x: 0, y: 0 };
    static aim = { x: 0, y: 0 };

    static setup() {
        console.log('Trying to setup mobile inputs.');
        Engine.mobile = true;
    }

    static cleanup() {
        this.movement = { x: 0, y: 0 };
        this.aim = { x: 0, y: 0 };
    }

    static update() {
        // Do not attempt to calculate with controllers that have no movement/aim.
        if (ControlManager.controller === StartMenuController) return;

        // Convert movement touch position to WASD-like input
        ControlManager.controller.input.movement.x = this.movement.x;
        ControlManager.controller.input.movement.z = this.movement.y;

        // Convert aim touch position to rotation
        ControlManager.controller.input.rotation.x = this.aim.x * TOUCH_SENSITIVITY;
        ControlManager.controller.input.rotation.y = this.aim.y * TOUCH_SENSITIVITY;
    };

};