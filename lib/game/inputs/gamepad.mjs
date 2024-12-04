import Engine from '../engine.mjs';

export default class Gamepad {

    static setup() {
        window.addEventListener('gamepadconnected', ev => this.connected(ev));
        window.addEventListener('gamepaddisconnected', ev => this.disconnected(ev));
    };

    static connected(ev) {
        if (!Engine.ui.gamepad) {
            Engine.ui.gamepad = ev.gamepad;
            console.log('Gamepad connected:', ev.gamepad);
        }
    };

    static disconnected(ev) {
        if (Engine.ui.gamepad && Engine.ui.gamepad.index === ev.gamepad.index) {
            Engine.ui.gamepad = null;
            console.log('Gamepad disconnected:', ev.gamepad);
        }
    };

    static cleanup() {
        window.removeEventListener('gamepadconnected', ev => this.connected(ev));
        window.removeEventListener('gamepaddisconnected',ev =>  this.disconnected(ev));
        Engine.ui.gamepad = null;
    };
};
