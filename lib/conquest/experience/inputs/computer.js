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

    // https://stackoverflow.com/questions/8500809/detecting-mouse-movement-for-a-3d-first-person-world-in-java
    // https://stackoverflow.com/questions/17406274/three-js-first-person-controls-moves-the-camera-all-the-time
    static mousemove(ev) {
        // TODO: Check if in first person mode and not dead, few other checks...
        if (WORLD.me.player) {
            const aim = WORLD.me.player.aim;
            const euler = new Euler(
                aim.x + ev.movementX * WORLD.deltaTime, 
                aim.y + ev.movementY * WORLD.deltaTime, 
                0,
                'XYZ'
            );

            // Affect the quaternion.
            aim.setFromEuler(euler);
            aim.normalize();
        }
    }

    static clicked(ev) {
		// Interaction required*
		WORLD.renderer.domElement.requestPointerLock();

		document.addEventListener('pointerlockchange', ev => {
			// console.log(document.pointerLockElement, WORLD.renderer.domElement);
			if (document.pointerLockElement === WORLD.renderer.domElement) {
				console.log('The pointer lock status is now locked');
			} else {
				console.log('The pointer lock status is now unlocked');
			}
		}, false);

		document.addEventListener('pointerlockerror', ev => {
			console.log('Error with pointer lock' + ev);
            console.error(ev);
		}, false);

        console.log('Conquest clicked...');
        // console.log(ev);
        // console.log(ev.target);

        // Check that the click was on the canvas and not a menu etc.
        if (ev.target !== WORLD.canvas) 
            return false;
    }

    static listen() {
        console.log('Listening comuter inputs');

        // Add keyboard event listeners.
        document.addEventListener("keydown", this.keyToggleHandler(true, this), false);
        document.addEventListener("keyup",  this.keyToggleHandler(false, this), false);

        // Add mouse event listeners.
        window.addEventListener('click', this.clicked);
        window.addEventListener('mousemove', this.mousemove);
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