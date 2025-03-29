import Engine from '../../engine.mjs';
import ControlManager from '../../control.mjs';
import StartMenuController from '../StartMenuController.mjs';

// Reduced sensitivity and added deadzone
const TOUCH_SENSITIVITY = 0.003;
const TOUCH_DEADZONE = 0.05;

export default class Mobile {
    static movement = { x: 0, y: 0 };
    static aim = { x: 0, y: 0 };
    static lastAim = { x: 0, y: 0 }; // Track previous frame's aim for smoothing
    
    static setup() {
        console.log('Trying to setup mobile inputs.');
        Engine.mobile = true;
    }

    static cleanup() {
        this.movement = { x: 0, y: 0 };
        this.aim = { x: 0, y: 0 };
        this.lastAim = { x: 0, y: 0 };
    }

    static update() {
        // Do not attempt to calculate with controllers that have no movement/aim.
        if (ControlManager.controller === StartMenuController) return;

        // Convert movement touch position to WASD-like input
        ControlManager.controller.input.movement.x = this.movement.x;
        ControlManager.controller.input.movement.z = this.movement.y;

        // Apply deadzone to aim inputs, similar to PC input
        const dx = Math.abs(this.aim.x) < TOUCH_DEADZONE ? 0 : this.aim.x;
        const dy = Math.abs(this.aim.y) < TOUCH_DEADZONE ? 0 : this.aim.y;
        
        // Apply smoothing by averaging with previous frame (simple low-pass filter)
        const smoothX = (dx + this.lastAim.x) * 0.5;
        const smoothY = (dy + this.lastAim.y) * 0.5;
        
        // Store current values for next frame
        this.lastAim.x = dx;
        this.lastAim.y = dy;

        // Convert aim touch position to rotation
        ControlManager.controller.input.rotation.x = smoothX * TOUCH_SENSITIVITY;
        ControlManager.controller.input.rotation.y = smoothY * TOUCH_SENSITIVITY;
    }
};