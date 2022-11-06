import {  Vector3, Euler, Quaternion } from 'three';

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

    static aimSpeed = Math.PI / 920;

    static mousemove(ev) {
        // WORLD.me.player.isGrounded
        if (WORLD.me.player) {
            const up = WORLD.me.player.mesh.up;
            const right = new Vector3(0, 0, 1);
            const xrot = new Quaternion();
            const yrot = new Quaternion();

            right.applyQuaternion(WORLD.me.player.aim);
            right.cross(up);

            xrot.setFromAxisAngle(up, -ev.movementY * this.aimSpeed);
            yrot.setFromAxisAngle(right, -ev.movementX * this.aimSpeed);
            
            WORLD.me.player.aim.multiply(xrot);
            WORLD.me.player.aim.multiply(yrot);
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
