import FirstPersonControls from '../controls/firstperson/firstPersonControls';
import TrackballControls from '../controls/trackball/trackballControls';

export default class ControlsManager {
    static CAMERA_KEYS = {
        TRACKBALL: 'TRACKBALL',
        FIRST_PERSON: 'FIRST_PERSON'
    };

    static CAMERA_TYPES = { 
        [this.CAMERA_KEYS.TRACKBALL]: TrackballControls,
        [this.CAMERA_KEYS.FIRST_PERSON]: FirstPersonControls
    };

    static toggleCamera() {
        WORLD.settings.view.DESIRED_CAMERA_KEY = 
            WORLD.settings.view.DESIRED_CAMERA_KEY === this.CAMERA_KEYS.FIRST_PERSON
            ?
                this.CAMERA_KEYS.TRACKBALL
                :
                this.CAMERA_KEYS.FIRST_PERSON;
    }

    static change(cameraKey) {
        const prevControls = WORLD.controls;

        // Clear any existing animation to prevent conflict.
        WORLD.cameraAnimation = null;
    
        // Change camera and preference key.
        window.WORLD.controls = new this.CAMERA_TYPES[cameraKey](WORLD.camera, WORLD.canvas);
        window.WORLD.settings.view.CURRENT_CAMERA_KEY = cameraKey;
        
        // Stop conflicts with the previous camera.
        if (prevControls)
            prevControls.destroy();

        // Initialise the new controls and camera scheme.
        window.WORLD.controls.reset();
    }

    static update(delta) {
        // Handle camera changes.
        if (WORLD.settings.view.DESIRED_CAMERA_KEY !== WORLD.settings.view.CURRENT_CAMERA_KEY) {
            console.log('update caused camera controls change');
            console.log(
                WORLD.settings.view.DESIRED_CAMERA_KEY, 
                WORLD.settings.view.CURRENT_CAMERA_KEY
            );
            this.change(WORLD.settings.view.DESIRED_CAMERA_KEY);
        }

        // Update the camera changes over WORLD.timeIncrement.
        WORLD.controls.update(delta);
    }
}
