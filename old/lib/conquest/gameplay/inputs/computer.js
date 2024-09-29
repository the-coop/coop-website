import { Vector3, Euler, Quaternion, MathUtils } from 'three';

export default class ComputerInput {

    static keyCodeMap = {
        87: 'w',
        83: 's',
        65: 'a',
        68: 'd',
        32: 'space',
        69: 'e'
    };

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
    };

    static aimSpeed = Math.PI / 2000;

    static lat = 0;
    static lon = 0;

    static mousemove(ev) {
        if (!WORLD.me.player) return;

        WORLD.me.player.viewDX = (ev.movementX * this.aimSpeed);
        WORLD.me.player.viewDY = (ev.movementY * this.aimSpeed);

        WORLD.me.player.lon = (WORLD.me.player.lon || 0)  - WORLD.me.player.viewDX;

        WORLD.me.player.lat = WORLD.me.player.lat - (2 * Math.PI) * Math.floor((WORLD.me.player.lat + Math.PI) / (2 * Math.PI))
        
        // Allow free rotation if not on the ground.
        if (WORLD.me.player.onGround)
            WORLD.me.player.lat = MathUtils.clamp((WORLD.me.player.lat ?? 0) + WORLD.me.player.viewDY,-1,1);
        else
            WORLD.me.player.lat = (WORLD.me.player.lat ?? 0) + WORLD.me.player.viewDY;
    };

    static clicked(ev) {
        console.log('Conquest clicked...');
        // console.log(ev);
        // console.log(ev.target);

        // Check that the click was on the canvas and not a menu etc.
        if (ev.target !== WORLD.canvas) 
            return false;
    };

    static listen() {
        console.log('Listening computer inputs');

        // Add keyboard event listeners.
        document.addEventListener("keydown", this.keyToggleHandler(true, this), false);
        document.addEventListener("keyup",  this.keyToggleHandler(false, this), false);

        // Add mouse event listeners.
        window.addEventListener('click', this.clicked);
        window.addEventListener('mousemove', this.mousemove.bind(this));
    };

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
