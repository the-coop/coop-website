import { FirstPersonControls } from './FirstPersonControls';
import { TrackballControls } from './TrackballControls';

export default class Controls {
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

    static keypad = { 
        w: false, 
        a: false, 
        s: false, 
        d: false, 
        space: false 
    }
    
    static initialise() {    
        const keyToggleHandler = state => ev => {
            if (ev.which == 87) this.keypad.w = state;
            if (ev.which == 83) this.keypad.s = state;
            if (ev.which == 65) this.keypad.a = state;
            if (ev.which == 68) this.keypad.d = state;
            if (ev.which == 32) this.keypad.space = state;
            return false;
        } 
        
        document.addEventListener("keydown", keyToggleHandler(true), false);
        document.addEventListener("keyup",  keyToggleHandler(false), false);
    }

    static update() {
        // Handle camera changes.
        if (WORLD.settings.view.DESIRED_CAMERA_KEY !== WORLD.settings.view.CURRENT_CAMERA_KEY)
            this.change(WORLD.settings.view.DESIRED_CAMERA_KEY);

        // Update the camera changes over WORLD.timeIncrement.
        WORLD.controls.update(WORLD.delta);

        // If there is an incomplete tween, process it.
        if (WORLD.tween) 
            WORLD.tween.update();
    }
}