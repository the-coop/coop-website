import { Vector3 } from 'three';
import ControlManager from '../control.mjs';
import FPSController from './FPSController.mjs';

// Mainly used to support gamepad game starting.
// PC can trigger start by click event handler on start button.
export default class StartMenuController {
    // Simple input state for start menu
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        action: false
    };
    
    // Function to be called when the game starts
    static start = null;
    
    // Reset does nothing for start menu
    static reset() {
        // No camera setup needed for start menu
    }
    
    // Check for action button press and start game if pressed
    static update() {
        if (this.input.action && typeof this.start === 'function') {
            this.start();
            // After start is called, switch to FPS controller using 'change' instead of 'setController'
            ControlManager.change(FPSController);
            this.input.action = false;
            return 'started';
        }
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.action = false;
    }
}