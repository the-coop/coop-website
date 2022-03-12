import { FirstPersonControls } from './FirstPersonControls';
import { TrackballControls } from './TrackballControls';

export default class ExperienceManager {

    static CAMERA_KEYS = {
        TRACKBALL: 'TRACKBALL',
        FIRST_PERSON: 'FIRST_PERSON'
    };

    static CAMERA_TYPES = { 
        [this.CAMERA_KEYS.TRACKBALL]: TrackballControls,
        [this.CAMERA_KEYS.FIRST_PERSON]: FirstPersonControls
    };

    static change(cameraKey) {    
        window.WORLD.controls = new this.CAMERA_TYPES[cameraKey](WORLD.camera, WORLD.canvas);
        window.WORLD.settings.view.CURRENT_CAMERA_KEY = cameraKey;
        window.WORLD.controls.reset();
    }
}