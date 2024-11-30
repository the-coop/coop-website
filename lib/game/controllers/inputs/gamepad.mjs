import ControllerManager from '../controllerManager.mjs';
import State from '../../state.mjs';

export default class GamepadInput {
    static connectedGamepads = [];
    static initialised = false;

    static async setup() {
        if (this.initialised) return;

        window.addEventListener('gamepadconnected', this.onGamepadConnect.bind(this));
        window.addEventListener('gamepaddisconnected', this.onGamepadDisconnect.bind(this));

        this.connectedGamepads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(gp => gp) : [];
        if (this.connectedGamepads.length > 0) {
            this.startGameOnButtonPress();
        }

        this.initialised = true;
    }

    static cleanup() {
        window.removeEventListener('gamepadconnected', this.onGamepadConnect.bind(this));
        window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnect.bind(this));
        this.connectedGamepads = [];
        ControllerManager.inputState.gamepad = {
            connected: false,
            type: null,
            initialised: false
        };
        this.initialised = false;
    }

    static onGamepadConnect(event) {
        this.connectedGamepads.push(event.gamepad);
        ControllerManager.inputState.gamepad = {
            connected: true,
            type: this.getGamepadType(event.gamepad),
            initialised: true
        };
        ControllerManager.emit('gamepadConnected', event.gamepad);
    }

    static onGamepadDisconnect(event) {
        this.connectedGamepads = this.connectedGamepads.filter(gp => gp.index !== event.gamepad.index);
        const isConnected = this.connectedGamepads.length > 0;
        ControllerManager.inputState.gamepad.connected = isConnected;
        ControllerManager.inputState.gamepad.type = isConnected ? this.getGamepadType(this.connectedGamepads[0]) : null;
        ControllerManager.inputState.gamepad.initialised = isConnected;
        ControllerManager.emit('gamepadDisconnected', event.gamepad);
    }

    static getGamepadType(gamepad) {
        const id = gamepad.id.toLowerCase();
        if (id.includes('xbox')) return 'xbox';
        if (id.includes('playstation') || id.includes('sony')) return 'playstation';
        return 'generic';
    }

    static update(delta) {
        if (!State.isGameStarted) return;

        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (!gamepad) continue;

            // Handle analog sticks
            this.handleAnalogSticks(gamepad);
            
            // Handle buttons
            this.handleButtons(gamepad);
        }
    }

    static handleAnalogSticks(gamepad) {
        // Left stick (movement)
        const leftStickX = Math.abs(gamepad.axes[0]) > 0.1 ? gamepad.axes[0] : 0;
        const leftStickY = Math.abs(gamepad.axes[1]) > 0.1 ? gamepad.axes[1] : 0;
        
        if (leftStickX !== 0 || leftStickY !== 0) {
            ControllerManager.setInput('computer', 'movement', {
                input: 'leftStick',
                value: { x: leftStickX, y: leftStickY }
            });
        }

        // Right stick (camera)
        const rightStickX = Math.abs(gamepad.axes[2]) > 0.1 ? gamepad.axes[2] : 0;
        const rightStickY = Math.abs(gamepad.axes[3]) > 0.1 ? gamepad.axes[3] : 0;
        
        if (rightStickX !== 0 || rightStickY !== 0) {
            ControllerManager.setInput('computer', 'movement', {
                input: 'rightStick',
                value: { x: rightStickX, y: rightStickY }
            });
        }
    }

    static handleButtons(gamepad) {
        // Map gamepad buttons to actions
        const buttonMappings = {
            0: 'jump',      // A button
            1: 'crouch',    // B button
            10: 'sprint'    // Right stick button
        };

        gamepad.buttons.forEach((button, index) => {
            const action = buttonMappings[index];
            if (action) {
                ControllerManager.setInput('computer', 'movement', {
                    input: action,
                    value: button.pressed
                });
            }
        });
    }

    static startGameOnButtonPress() {
        const gameLoop = () => {
            this.update();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
}