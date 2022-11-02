import { Euler } from 'three';

export default class ComputerInput {
    static keyCodeMap = {
        87: 'w',
        83: 's',
        65: 'a',
        68: 'd',
        32: 'space',
        69: 'e'
    }

    static inputs = { 
        w: false, 
        a: false, 
        s: false, 
        d: false, 
        space: false,

        // Added temporarily
        e: false
    };

    static keyToggleHandler = (state, inputHandler) => ({ which }) => {
        if (which in inputHandler.keyCodeMap) {
            const key = inputHandler.keyCodeMap[which];
            inputHandler.inputs[key] = state;
        }
        return false;
    }

    static aimEuler = new Euler(0, 0, 0, 'YXZ');
    static aimSpeed = Math.PI / 920;

    // https://stackoverflow.com/questions/8500809/detecting-mouse-movement-for-a-3d-first-person-world-in-java
    // https://stackoverflow.com/questions/17406274/three-js-first-person-controls-moves-the-camera-all-the-time
    static mousemove(ev) {
        // TODO: Check if in first person mode and not dead, few other checks...
        if (WORLD.me.player) {
            // TODO: Inverted Y axis controls - make a setting for this (especially useful for aircraft/etc).
            this.aimEuler.y += ev.movementX * this.aimSpeed;
            this.aimEuler.x -= ev.movementY * this.aimSpeed;
            this.aimEuler.x = Math.min(Math.max(this.aimEuler.x, -1.0472), 1.0472);
        
            WORLD.me.player.aim.setFromEuler(this.aimEuler);
        }
    }

    static clicked(ev) {


        console.log('Conquest clicked...');
        // console.log(ev);
        // console.log(ev.target);

        // Check that the click was on the canvas and not a menu etc.
        if (ev.target !== WORLD.canvas) 
            return false;
    }

    static listen() {
        console.log('Listening computer inputs');

        // Add keyboard event listeners.
        document.addEventListener("keydown", this.keyToggleHandler(true, this), false);
        document.addEventListener("keyup",  this.keyToggleHandler(false, this), false);

        // Add mouse event listeners.
        window.addEventListener('click', this.clicked);
        window.addEventListener('mousemove', this.mousemove.bind(this));
    }

    static destroy() {
        console.log('Remove connections.');
        document.removeEventListener("keydown", this.keyToggleHandler(true, this))
        document.removeEventListener("keyup",  this.keyToggleHandler(false, this))

         // Remove mouse event listeners.
         window.removeEventListener('click', this.clicked);
         window.removeEventListener('mousemove', this.mousemove.bind(this));
    }

    static reset() {
        this.destroy();
        this.listen();
    }

    static track(delta) {

    }
};