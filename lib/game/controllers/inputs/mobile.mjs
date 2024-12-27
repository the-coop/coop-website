import Engine from '../../engine.mjs';

export default class Mobile {
    
    static detect() {
        return 'ontouchstart' in window && window.innerWidth <= 800;
    };

    static setup() {
        console.log('Trying to setup mobile inputs.')

        // Inform UI and engine to assume mobile medium.
        Engine.mobile = true;

        // Complete this after FPS controls are figured out, secondary priority.
        //TODO:  UI should show the mobile controls.
    };
};
