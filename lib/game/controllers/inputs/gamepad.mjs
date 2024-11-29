import ControllerManager from '../controllerManager.mjs';

export default class GamepadInput {
    // Initialize static properties using proper static initialization
    static state = {
        active: false,
        devices: {},
        buttonsState: {}
    };

    static type = null;
    static isClientSide = (typeof window !== 'undefined');
    static deadzone = 0.2;

    static setup() {
        // Early return if not in browser environment
        if (!this.isClientSide) {
            return;
        }

        // Continue with setup only if we're in the browser
        this._handleGamepadConnectedBound = this.handleGamepadConnected.bind(this);
        this._handleGamepadDisconnectedBound = this.handleGamepadDisconnected.bind(this);

        window.addEventListener('gamepadconnected', this._handleGamepadConnectedBound);
        window.addEventListener('gamepaddisconnected', this._handleGamepadDisconnectedBound);
        
        this.state.active = true;

        // Use requestAnimationFrame only in browser context
        if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
                this.detectExistingGamepads();
            });
        }

        // Add listener for deadzone changes
        this._handleDeadzoneChange = this.setDeadzone.bind(this);
        ControllerManager.on('deadzoneThresholdChange', this._handleDeadzoneChange);
    }

    static cleanup() {
        if (typeof window === 'undefined') return;

        // Remove the bound event listeners
        if (this._handleGamepadConnectedBound) {
            window.removeEventListener('gamepadconnected', this._handleGamepadConnectedBound);
            this._handleGamepadConnectedBound = null;
        }
        if (this._handleGamepadDisconnectedBound) {
            window.removeEventListener('gamepaddisconnected', this._handleGamepadDisconnectedBound);
            this._handleGamepadDisconnectedBound = null;
        }
        this.state.active = false;
        this.type = null; // Reset type on cleanup

        // Remove deadzone listener
        if (this._handleDeadzoneChange) {
            ControllerManager.off('deadzoneThresholdChange', this._handleDeadzoneChange);
            this._handleDeadzoneChange = null;
        }
    }

    static handleGamepadConnected(event) {
        const gamepad = event.gamepad;
        this.state.devices[gamepad.index] = gamepad;
        // Set the static type property based on gamepad
        this.type = ControllerManager.getGamepadType(gamepad);
        ControllerManager.setControllerState('gamepad', { connected: true, type: this.type });
        ControllerManager.emit('controllerStateChange', 'gamepad', { connected: true, type: this.type });
    }

    static handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        delete this.state.devices[gamepad.index];
        if (Object.keys(this.state.devices).length === 0) {
            this.state.active = false;
            this.type = null; // Reset type when no gamepads are connected
            ControllerManager.setControllerState('gamepad', { connected: false, type: null });
            ControllerManager.emit('controllerStateChange', 'gamepad', { connected: false, type: null });
        }
    }

    // New method to detect existing gamepads
    static detectExistingGamepads() {
        if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
        
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;

        for (let gamepad of gamepads) {
            if (gamepad && !this.state.devices[gamepad.index]) {
                this.handleGamepadConnected({ gamepad });
            }
        }
    }

    static update(delta) {
        if (!this.state.active) return;
        this.pollGamepads();
    }

    static pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

        // Use class's deadzone property instead of accessing ControllerManager
        const deadzone = this.deadzone;

        for (let gamepad of gamepads) {
            if (!gamepad) continue;

            // Update device reference
            this.state.devices[gamepad.index] = gamepad;

            // Process buttons first for more responsive jumping
            gamepad.buttons.forEach((button, index) => {
                const buttonKey = `button${index}`;
                const wasPressed = this.state.buttonsState[`${gamepad.index}-${buttonKey}`];
                const isPressed = button.pressed;

                // Only send input if state changed
                if (wasPressed !== isPressed) {
                    this.state.buttonsState[`${gamepad.index}-${buttonKey}`] = isPressed;

                    // Handle jump button (button 0 on most gamepads)
                    if (index === 0) {
                        ControllerManager.setInput('gamepad', 'movement', {
                            type: 'jump',
                            value: isPressed
                        });
                    }

                    // Add handling for circle button (button 1) on PlayStation gamepads
                    if (index === 1 && this.type === 'playstation') {
                        if (isPressed) {
                            alert('Circle button pressed!');
                        }
                    }

                    // Send the raw button input as well
                    ControllerManager.setInput('gamepad', buttonKey, isPressed);
                }
            });

            // Process axes second with deadzone threshold
            const axes = gamepad.axes;
            if (axes.length >= 2) {
                // Left stick - movement (with deadzone)
                const leftX = Math.abs(axes[0]) > deadzone ? axes[0] : 0;
                const leftY = Math.abs(axes[1]) > deadzone ? axes[1] : 0;

                if (leftX !== 0 || leftY !== 0) {
                    ControllerManager.setInput('gamepad', 'leftStick', {
                        x: leftX,
                        y: leftY
                    });
                }
            }

            if (axes.length >= 4) {
                // Right stick - camera (with deadzone)
                const rightX = Math.abs(axes[2]) > deadzone ? axes[2] : 0;
                const rightY = Math.abs(axes[3]) > deadzone ? axes[3] : 0;

                if (rightX !== 0 || rightY !== 0) {
                    ControllerManager.setInput('gamepad', 'rightStick', {
                        x: rightX,
                        y: rightY
                    });
                }
            }
        }
    }

    static setDeadzone(value) {
        // Validate the input
        if (typeof value !== 'number' || isNaN(value)) {
            console.warn('Invalid deadzone value:', value);
            return;
        }

        // Clamp value between 0 and 1
        this.deadzone = Math.max(0, Math.min(1, value));
        console.log(`GamepadInput deadzone set to ${this.deadzone}`);
    }

    static getConnectedGamepads() {
        return Object.values(this.state.devices);
    }
}