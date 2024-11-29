import ControllerManager from '../controllerManager.mjs';

export default class GamepadInput {
    static state = {
        active: false,
        devices: {},
        buttonsState: {}
    };

    // Static property for gamepad type
    static type = null;

    static setup() {
        window.addEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
        window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected.bind(this));
        this.state.active = true;  // Ensure gamepad input processing is always active
    }

    static cleanup() {
        window.removeEventListener('gamepadconnected', this.handleGamepadConnected.bind(this));
        window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected.bind(this));
        this.state.active = false;
        this.type = null; // Reset type on cleanup
    }

    static handleGamepadConnected(event) {
        const gamepad = event.gamepad;
        this.state.devices[gamepad.index] = gamepad;
        // Set the static type property based on gamepad
        this.type = ControllerManager.getGamepadType(gamepad);
        ControllerManager.setControllerState('gamepad', { connected: true, type: this.type });
    }

    static handleGamepadDisconnected(event) {
        const gamepad = event.gamepad;
        delete this.state.devices[gamepad.index];
        if (Object.keys(this.state.devices).length === 0) {
            this.state.active = false;
            this.type = null; // Reset type when no gamepads are connected
            ControllerManager.setControllerState('gamepad', { connected: false, type: null });
        }
    }

    static update(delta) {
        if (!this.state.active) return;
        this.pollGamepads();
    }

    static pollGamepads() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        // console.log('Polling gamepads:', gamepads.filter(Boolean).length, 'connected');  // Removed to reduce console spam
        
        const deadzone = ControllerManager.deadzoneThreshold; // Retrieve current deadzone threshold

        for (let gamepad of gamepads) {
            if (!gamepad) continue;

            // Debug gamepad state
            console.log('Gamepad:', gamepad.index, 'Buttons:', gamepad.buttons.filter(b => b.pressed).length);

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
                    console.log('Button state changed:', buttonKey, isPressed);
                    
                    // Handle jump button (button 0 on most gamepads)
                    if (index === 0) {
                        console.log('Jump button:', isPressed ? 'pressed' : 'released');
                        ControllerManager.setInput('gamepad', 'movement', {
                            type: 'jump',
                            value: isPressed
                        });
                    }

                    // Add handling for circle button (button 1) on PlayStation gamepads
                    if (index === 1 && this.type === 'playstation') { // Use static type
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

    static getConnectedGamepads() {
        return Object.values(this.state.devices);
    }
}