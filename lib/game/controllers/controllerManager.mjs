import FPS from './fps.mjs';
import OrbitController from './orbit.mjs';
import PlayerManager from '../players/playerManager.mjs';

export default class ControllerManager {
    static mode = 'fps'; // Renamed from currentMode to mode ('fps' or 'orbit')

    static switchToFPS() {
        if (this.mode === 'fps') return; // Updated from currentMode

        // Disconnect Orbit Controller
        OrbitController.disconnect();

        // Reset Orbit Controller state if needed
        OrbitController.reset();

        // Setup FPS Controller
        FPS.setup(PlayerManager.players[0]); // Assuming single player

        this.mode = 'fps'; // Updated from currentMode
        console.log('Switched to FPS mode');
    }

    static switchToOrbit(camera, target) {
        if (this.mode === 'orbit') return; // Updated from currentMode

        // Disconnect FPS Controller
        FPS.disconnect();

        // Reset FPS Controller state
        FPS.reset();

        // Setup Orbit Controller
        OrbitController.setup(camera, target);

        this.mode = 'orbit'; // Updated from currentMode
        console.log('Switched to Orbit mode');
    }

    static toggleMode(camera, target) {
        if (this.mode === 'fps') { // Updated from currentMode
            this.switchToOrbit(camera, target);
        } else {
            this.switchToFPS();
        }
    }

    static resetCurrentController() {
        if (this.mode === 'fps') { // Updated from currentMode
            FPS.reset();
        } else if (this.mode === 'orbit') { // Updated from currentMode
            OrbitController.reset();
        }
    }
};
