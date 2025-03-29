import ControlManager from '../../control.mjs';
import StartMenuController from '../StartMenuController.mjs';

export default class Gamepad {
    static gamepads = [];
    static deadzone = 0.15;
    
    static setup() {
        console.log('Setting up gamepad support');
        
        // Setup gamepad detection
        window.addEventListener("gamepadconnected", this.onGamepadConnected);
        window.addEventListener("gamepaddisconnected", this.onGamepadDisconnected);
    }
    
    static cleanup() {
        window.removeEventListener("gamepadconnected", this.onGamepadConnected);
        window.removeEventListener("gamepaddisconnected", this.onGamepadDisconnected);
        this.gamepads = [];
    }
    
    static onGamepadConnected = (event) => {
        console.log("Gamepad connected:", event.gamepad.id);
        this.gamepads.push(event.gamepad.index);
    }
    
    static onGamepadDisconnected = (event) => {
        console.log("Gamepad disconnected:", event.gamepad.id);
        const index = this.gamepads.indexOf(event.gamepad.index);
        if (index !== -1) {
            this.gamepads.splice(index, 1);
        }
    }
    
    static update() {
        // Skip if no gamepads connected
        if (this.gamepads.length === 0) return;
        
        // Get all current gamepads
        const gamepads = navigator.getGamepads();
        let gamepad = null;
        
        // Find first active gamepad
        for (const index of this.gamepads) {
            if (gamepads[index]) {
                gamepad = gamepads[index];
                break;
            }
        }
        
        // Skip if no active gamepad found
        if (!gamepad) return;
        
        // Handle start menu inputs specially
        if (ControlManager.controller === StartMenuController) {
            // Any button press will trigger start
            for (let i = 0; i < gamepad.buttons.length; i++) {
                if (gamepad.buttons[i].pressed) {
                    StartMenuController.input.action = true;
                    break;
                }
            }
            return;
        }
        
        // Skip if no controller or input object
        if (!ControlManager.controller || !ControlManager.controller.input) return;
        
        // Apply inputs if controller exists
        if (ControlManager.controller.input.movement) {
            // Left stick for movement
            const x = Math.abs(gamepad.axes[0]) > this.deadzone ? gamepad.axes[0] : 0;
            const y = Math.abs(gamepad.axes[1]) > this.deadzone ? gamepad.axes[1] : 0;
            
            ControlManager.controller.input.movement.x += x;
            ControlManager.controller.input.movement.z += y;
        }
        
        if (ControlManager.controller.input.rotation) {
            // Right stick for rotation
            const rx = Math.abs(gamepad.axes[2]) > this.deadzone ? gamepad.axes[2] : 0;
            const ry = Math.abs(gamepad.axes[3]) > this.deadzone ? gamepad.axes[3] : 0;
            
            ControlManager.controller.input.rotation.x -= rx * 0.05;
            ControlManager.controller.input.rotation.y -= ry * 0.05;
        }
        
        // Jump with A button (button 0)
        if (ControlManager.controller.input.hasOwnProperty('jump')) {
            ControlManager.controller.input.jump |= gamepad.buttons[0].pressed;
        }
        
        // Exit vehicle with B button (button 1)
        if (ControlManager.controller.input.hasOwnProperty('exit')) {
            ControlManager.controller.input.exit |= gamepad.buttons[1].pressed;
        }
    }
}
