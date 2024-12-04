import Engine from '../engine.mjs';

export default class Gamepad {

    static setup() {
        window.addEventListener('gamepadconnected', this.connected);
        window.addEventListener('gamepaddisconnected', this.disconnected);
    };

    static connected(event) {
        Engine.ui.gamepads = navigator.getGamepads();
        console.log('Gamepad connected:', event.gamepad);
    };

    static disconnected(event) {
        Engine.ui.gamepads = navigator.getGamepads();
        console.log('Gamepad disconnected:', event.gamepad);
    };

    static cleanup() {
        window.removeEventListener('gamepadconnected', this.connected);
        window.removeEventListener('gamepaddisconnected', this.disconnected);
    };

};
