import { Vector3, Plane, Raycaster, Vector2 } from "three";
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
            rotation: me.rotation,
            id: me.id
        });
    });

    // https://stackoverflow.com/questions/58433370/plane-constant-definition-in-three-js
    // https://mathworld.wolfram.com/HessianNormalForm.html
    // https://github.com/mrdoob/three.js/issues/10957
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const pointOfIntersection = new Vector3();

    document.addEventListener('mousemove', ev => {
        const { camera, me } = window.GROUND_LEVEL;
        if (me.mesh) {
            mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (ev.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            raycaster.ray.intersectPlane(plane, pointOfIntersection);

            // Send the data to the API for broadcast/validation.
            const { id, direction } = me;
            GroundPlayerManager.move({ 
                direction, 
                rotation: pointOfIntersection,
                id 
            });
        }
    });

    document.addEventListener('keydown', ev => {
        const { me, camera } = window.GROUND_LEVEL;

        // Checks if the input event is an attempt at movement.
        if (ALL_MOVEMENT_KEYS.includes(ev.key)) {
            // Collect once for optimisation.
            const { UP, RIGHT, DOWN, LEFT } = MOVEMENT.keymap;

            // Apply the movement to the direction and velocity vectors.
            if (UP.includes(ev.key)) me.direction.set(0, .1, 0);
            else if (RIGHT.includes(ev.key)) me.direction.set(.1, 0, 0);
            else if (DOWN.includes(ev.key)) me.direction.set(0, -.1, 0);
            else if (LEFT.includes(ev.key)) me.direction.set(-.1, 0, 0);

            // Send the data to the API for broadcast/validation.
            GroundPlayerManager.move({
                direction: me.direction, 
                rotation: me.rotation, 
                id: me.id
            });
        }
    });
};
