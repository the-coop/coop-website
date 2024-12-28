import Engine from '../../engine.mjs';
import ControlManager from '../../control.mjs';

export default class Gamepad {
    static interval = null;
    static index = null;
    static GAMEPAD_SENSITIVITY = 0.05;

    static setup() {
        window.addEventListener('gamepadconnected', ev => {
            this.index = ev.gamepad.index;
            
            const poll = () => {
                Engine.state.gamepad = navigator.getGamepads()[this.index];
                this.interval = requestAnimationFrame(poll);
            };
            poll();
        });

        window.addEventListener('gamepaddisconnected', () => {
            this.cleanup();
        });
    }

    static cleanup() {
        if (this.interval) {
            cancelAnimationFrame(this.interval);
            this.interval = null;
        }
        this.index = null;
        Engine.state.gamepad = null;
    };

    static isButtonPressed(buttonIndex) {
        if (!Engine.state.gamepad) return false;
        return Engine.state.gamepad.buttons[buttonIndex].pressed;
    };

    static getAxisValue(axisIndex) {
        if (!Engine.state.gamepad) return 0;
        return Engine.state.gamepad.axes[axisIndex];
    };

    static update() {
        if (!ControlManager.controller?.input || !Engine.state.gamepad) return;

        const deadzone = 0.15;  // Increased deadzone for smoother control

        // Update movement with deadzone
        const moveX = this.getAxisValue(0);
        const moveY = this.getAxisValue(1);
        if (Math.abs(moveX) > deadzone) {
            const scaledX = (moveX - Math.sign(moveX) * deadzone) / (1 - deadzone);
            ControlManager.controller.input.movement.x += scaledX;
        }
        if (Math.abs(moveY) > deadzone) {
            const scaledY = (moveY - Math.sign(moveY) * deadzone) / (1 - deadzone);
            ControlManager.controller.input.movement.z += scaledY;
        }

        // Update rotation with deadzone
        const lookX = this.getAxisValue(2);
        const lookY = this.getAxisValue(3);
        if (Math.abs(lookX) > deadzone) {
            const scaledX = (lookX - Math.sign(lookX) * deadzone) / (1 - deadzone);
            ControlManager.controller.input.rotation.x -= scaledX * this.GAMEPAD_SENSITIVITY;
        }
        if (Math.abs(lookY) > deadzone) {
            const scaledY = (lookY - Math.sign(lookY) * deadzone) / (1 - deadzone);
            ControlManager.controller.input.rotation.y -= scaledY * this.GAMEPAD_SENSITIVITY;
        }

        // Update jump
        ControlManager.controller.input.jump |= this.isButtonPressed(0);
    }
}
