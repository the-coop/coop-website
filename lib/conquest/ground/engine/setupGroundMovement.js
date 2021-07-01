import { Vector3 } from "three";
import GroundPlayerManager from "./entity/groundPlayerManager";


export const MOVEMENT = {
    keymap: {
        UP: ['ArrowUp', 'w'],
        RIGHT: ['ArrowRight', 'd'],
        DOWN: ['ArrowDown', 's'],
        LEFT: ['ArrowLeft', 'a'],
        _all: null
    }
};

export const ALL_MOVEMENT_KEYS = [
    ...MOVEMENT.keymap.UP, 
    ...MOVEMENT.keymap.RIGHT, 
    ...MOVEMENT.keymap.DOWN, 
    ...MOVEMENT.keymap.LEFT 
];

export const movementListen = () => {
    // Attach listeners for movement. (Currently WASD + ARROWS).
    document.addEventListener('keyup', () => {
        const { me } = window.GROUND_LEVEL;

        // Send empty movement event to stop the user moving.
        GroundPlayerManager.move({
            direction: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0),
            id: me.id
        });
    });

    document.addEventListener('mousemove', ev => {
        const { camera, me } = window.GROUND_LEVEL;

        // Better variable names/comments for these?
        const vec = new Vector3(); // create once and reuse
        const pos = new Vector3(); // create once and reuse

        // Calculate the target position of cursor.
        const tx = (ev.clientX / window.innerWidth) * 2 - 1;
        const ty = -(ev.clientY / window.innerHeight) * 2 + 1;
        vec.set(tx, ty, 0.5);

        // https://stackoverflow.com/questions/13055214/mouse-canvas-x-y-to-three-js-world-x-y-z
        vec.unproject(camera);

        // @iso, what does this do?
        vec.sub(camera.position).normalize();

        // What is this doing? LMF does not know, iso might.
        const distance = - camera.position.z / vec.z;
        pos.copy(camera.position).add(vec.multiplyScalar(distance));

        // Attempt to make mesh "look at" (rotate) to target position.
        me.mesh.lookAt(vec);

        // Send the data to the API for broadcast/validation.
        GroundPlayerManager.move({
            direction: me.direction, 
            rotation: me.mesh.rotation, 
            id: me.id
        });
    });


    document.addEventListener('keydown', ev => {
        const { me } = window.GROUND_LEVEL;

        // Checks if the input event is an attempt at movement.
        if (ALL_MOVEMENT_KEYS.includes(ev.key)) {
            // Collect once for optimisation.
            const { UP, RIGHT, DOWN, LEFT } = MOVEMENT.keymap;

            // Apply the movement to the direction and velocity vectors.
            if (UP.includes(ev.key)) me.direction.set(0, .1, 0);
            else if (RIGHT.includes(ev.key)) me.direction.set(.1, 0, 0);
            else if (DOWN.includes(ev.key)) me.direction.set(0, -.1, 0);
            else if (LEFT.includes(ev.key)) me.direction.set(-.1, 0, 0);

            // Apply the rotation input.


            // Send the data to the API for broadcast/validation.
            GroundPlayerManager.move({
                direction: me.direction, 
                rotation: me.rotation, 
                id: me.id
            });
        }
    });
}