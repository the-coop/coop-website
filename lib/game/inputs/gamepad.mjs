import Engine from '../engine.mjs';

export default class Gamepad {

    static setup() {
        window.addEventListener('gamepadconnected', ev => this.connected(ev));
        window.addEventListener('gamepaddisconnected', ev => this.disconnected(ev));
    };

    static connected(ev) {
        console.log('game pad connected', ev);
        Engine.ui.gamepad = ev.gamepad;
    };

    static disconnected(ev) {
        Engine.ui.gamepad = null;
    };

    static cleanup() {
        window.removeEventListener('gamepadconnected', ev => this.connected(ev));
        window.removeEventListener('gamepaddisconnected', ev => this.disconnected(ev));
        Engine.ui.gamepad = null;
    };
    
}
