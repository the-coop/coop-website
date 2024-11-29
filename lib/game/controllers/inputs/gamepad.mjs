import ControllerManager from '../controllerManager.mjs';

export default class GamepadInput {
    constructor() {
        this.state = {
            active: false,
            devices: {},
            buttonsState: {} // Track button states to detect changes
        };
        this.handlers = {
            connected: this.handleGamepadConnected.bind(this),
            disconnected: this.handleGamepadDisconnected.bind(this)
        };
    }

    setup() {
        window.addEventListener('gamepadconnected', this.handlers.connected);
        window.addEventListener('gamepaddisconnected', this.handlers.disconnected);
    }

    cleanup() {
        window.removeEventListener('gamepadconnected', this.handlers.connected);
        window.removeEventListener('gamepaddisconnected', this.handlers.disconnected);
    }

    handleGamepadConnected(event) {
        const gamepad = event.gamepad;
        this.state.active = true;
        this.state.devices[gamepad.index] = gamepad;
        this.state.buttonsState = {}; // Reset button states
        const type = ControllerManager.detectGamepadType(gamepad);
        ControllerManager.setControllerState('gamepad', { connected: true, type });
    }

    handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        delete this.state.devices[gamepad.index];
        if (Object.keys(this.state.devices).length === 0) {
            this.state.active = false;
            ControllerManager.setControllerState('gamepad', { connected: false, type: null });
        }
    }

    // Add the update method to handle polling each frame
    update(delta) {
        this.pollGamepads();
    }

    pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let gamepad of gamepads) {
            if (!gamepad) continue;

            // Update device reference
            this.state.devices[gamepad.index] = gamepad;

            // Process axes first for smoother movement
            const axes = gamepad.axes;
            if (axes.length >= 2) {
                // Left stick - movement (with deadzone)
                const leftX = Math.abs(axes[0]) > 0.1 ? axes[0] : 0;
                const leftY = Math.abs(axes[1]) > 0.1 ? axes[1] : 0;
                
                if (leftX !== 0 || leftY !== 0) {
                    ControllerManager.setInput('gamepad', 'leftStick', {
                        x: leftX,
                        y: leftY
                    });
                }
            }
            
            if (axes.length >= 4) {
                // Right stick - camera (with deadzone)
                const rightX = Math.abs(axes[2]) > 0.1 ? axes[2] : 0;
                const rightY = Math.abs(axes[3]) > 0.1 ? axes[3] : 0;
                
                if (rightX !== 0 || rightY !== 0) {
                    ControllerManager.setInput('gamepad', 'rightStick', {
                        x: rightX,
                        y: rightY
                    });
                }
            }

            // Process buttons
            gamepad.buttons.forEach((button, index) => {
                const buttonKey = `button${index}`;
                const wasPressed = this.state.buttonsState[`${gamepad.index}-${buttonKey}`];
                const isPressed = button.pressed;

                // Only send input if state changed
                if (wasPressed !== isPressed) {
                    this.state.buttonsState[`${gamepad.index}-${buttonKey}`] = isPressed;
                    ControllerManager.setInput('gamepad', buttonKey, isPressed);
                }
            });
        }
    }

    getConnectedGamepads() {
        return Object.values(this.state.devices);
    }
}