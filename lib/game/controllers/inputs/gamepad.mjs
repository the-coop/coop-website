import Engine from '../../engine.mjs';

export default class Gamepad {
    static interval = null;
    static index = null;

    static setup() {
        console.log('setting up gamepad controls');
        window.addEventListener('gamepadconnected', ev => {
            console.log('game pad connected', ev);
            this.index = ev.gamepad.index;
            
            // Start polling the gamepad.
            const poll = () => {
                // Update gamepad state each frame
                Engine.state.gamepad = navigator.getGamepads()[this.index];
                this.interval = requestAnimationFrame(poll);
            };
            poll();
        });

        window.addEventListener('gamepaddisconnected', () => {
            Engine.state.gamepad = null;
            this.index = null;
            if (this.interval) {
                cancelAnimationFrame(this.interval);
                this.interval = null;
            }
        });
    };

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
}
