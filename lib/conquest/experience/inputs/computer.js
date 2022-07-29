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

    static mousemove(ev) {
        const euler = new Euler(ev.movementY * 0.01, ev.movementX * 0.01, 0, 'XYZ');
        
        // Affect the quaternion.
        WORLD.me.player.aim.setFromEuler(euler);
        WORLD.me.player.aim.normalize();
    }

    static clicked(ev) {
        // Check that the click was on the canvas and not a menu etc.
        if (ev.target !== WORLD.canvas) 
            return false;

        console.log('Conquest clicked...');
        console.log(ev);
        console.log(ev.target);
    }

    static listen() {
        console.log('Listening comuter inputs');

        // Add keyboard event listeners.
        document.addEventListener("keydown", this.keyToggleHandler(true, this), false);
        document.addEventListener("keyup",  this.keyToggleHandler(false, this), false);

        // Add mouse event listeners.
        window.addEventListener('click', this.clicked);
        window.addEventListener('mousemove', this.mousemove);


        // DEV BELOW:

		// Interaction required*
		WORLD.renderer.domElement.requestPointerLock();
		document.addEventListener('pointerlockchange', ev => {
			// ev
			// ev.target?
			console.log(document.pointerLockElement, WORLD.renderer.domElement);
			if (document.pointerLockElement === WORLD.renderer.domElement) {
				console.log('The pointer lock status is now locked');
			} else {
				console.log('The pointer lock status is now unlocked');
			}
		}, false);

		document.addEventListener('pointerlockerror', ev => {
			console.log('Error with pointer lock' + ev);
		}, false);
    }

    static destroy() {
        console.log('Remove connections.');
        document.removeEventListener("keydown", this.keyToggleHandler(true, this))
        document.removeEventListener("keyup",  this.keyToggleHandler(false, this))

         // Remove mouse event listeners.
         window.removeEventListener('click', this.clicked);
         window.removeEventListener('mousemove', this.mousemove);
    }

    static reset() {
        this.destroy();
        this.listen();
    }

    static track(delta) {

    }
};