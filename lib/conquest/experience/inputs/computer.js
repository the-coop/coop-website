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
           
          WORLD.me.player.lat = WORLD.me.player.lat - ev.movementY * this.aimSpeed;
          WORLD.me.player.lon = WORLD.me.player.lon - ev.movementX * this.aimSpeed;

          console.log(WORLD.me.player.lat);

          if (!WORLD.me.player.lat || isNaN(WORLD.me.player.lat)) { //self repair in case anything goes wrong
            WORLD.me.player.lat = 0;
          }
          if (!WORLD.me.player.lon || isNaN(WORLD.me.player.lon)) {
            WORLD.me.player.lat = 0;
          }

          const phi = 90 - WORLD.me.player.lat;
          const theta = WORLD.me.player.lon;

          const targetPosition = new Vector3();
          const position = new Vector3();
          WORLD.camera.getWorldPosition(position);
          const quaternion = WORLD.me.player.mesh.quaternion;
          targetPosition.setFromSphericalCoords(1, phi, theta).applyQuaternion(quaternion).add(position);
          WORLD.camera.lookAt(targetPosition);


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
