import FirstPersonControls from './controls/firstperson/firstPersonControls';
import TrackballControls from './controls/trackball/trackballControls';
import ComputerInput from './inputs/computer';


export default class ControlsManager {
    static CAMERA_KEYS = {
        TRACKBALL: 'TRACKBALL',
        FIRST_PERSON: 'FIRST_PERSON'
    };

    static CAMERA_TYPES = { 
        [this.CAMERA_KEYS.TRACKBALL]: TrackballControls,
        [this.CAMERA_KEYS.FIRST_PERSON]: FirstPersonControls
    };
    
    static initialise() {    
        ComputerInput.listen();
    }

    static change(cameraKey) {
        let prevCamera = window.WORLD.controls;

        window.WORLD.controls = new this.CAMERA_TYPES[cameraKey](WORLD.camera, WORLD.canvas);
        window.WORLD.settings.view.CURRENT_CAMERA_KEY = cameraKey;
        
        // Stop conflicts with the previous camera.
        prevCamera.destroy();

        // Initialise the new camera.
        window.WORLD.controls.reset();
    }

    static update(delta) {
        // Handle camera changes.
        if (WORLD.settings.view.DESIRED_CAMERA_KEY !== WORLD.settings.view.CURRENT_CAMERA_KEY)
            this.change(WORLD.settings.view.DESIRED_CAMERA_KEY);

        // Either run the camera animation or process controls (locks).
        if (WORLD.cameraAnimation)
            // If there is an incomplete tween, process it.
            WORLD.cameraAnimation.update();
        else 
            // Update the camera changes over WORLD.timeIncrement.
            WORLD.controls.update(delta);
    }
}