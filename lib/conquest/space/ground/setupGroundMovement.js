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


export const addMobileMovement = () => {
    const ongoingTouches = [];

    // Mobile movement
    document.addEventListener("touchstart", ev => {
        // ev.preventDefault();

        // handleStart
        console.log("handleStart touchstart.");

        let touches = ev.changedTouches;

        for (let i = 0; i < touches.length; i++) {
            console.log("touchstart:" + i + "...");
            ongoingTouches.push({ identifier, pageX, pageY } = touches[i]);
            // touches[i].pageX, touches[i].pageY
        }

    }, false);

    document.addEventListener("touchcancel", () => {
        // handleCancel
        console.log('handleCancel');
    }, false);

    document.addEventListener("touchmove", () => {
        // handleMove
        console.log('handleMove');
    }, false);

    document.addEventListener("touchend", () => {
        const { me } = window.CONQUEST;

        // Send empty movement event to stop the user moving.
        GroundPlayerManager.move({
            direction: new Vector3(0, 0, 0),
            rotation: me.rotation,
            velocity: me.velocity,
            id: me.id
        });
    }, false);
}

export const addMouseLooking = () => {
    const plane = new Plane(new Vector3(0, 0, 1), 0);
    const raycaster = new Raycaster();
    const mouse = new Vector2();
    const pointOfIntersection = new Vector3();

    document.addEventListener('mousemove', ev => {
        const { camera, me } = window.CONQUEST;
        if (me.mesh) {
            mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (ev.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            raycaster.ray.intersectPlane(plane, pointOfIntersection);

            // Send the data to the API for broadcast/validation.
            const { id, direction, velocity } = me;
            GroundPlayerManager.move({ 
                velocity: velocity,
                direction, 
                rotation: pointOfIntersection,
                id 
            });
        }
    });
}

export const addKeyboardMovement = () => {
    document.addEventListener('keydown', ev => {
        const { me } = window.CONQUEST;

        // Checks if the input event is an attempt at movement.
        if (ALL_MOVEMENT_KEYS.includes(ev.key)) {
            // Collect once for optimisation.
            const { UP, RIGHT, DOWN, LEFT } = MOVEMENT.keymap;

            // Apply the movement to the direction and velocity vectors.
            if (UP.includes(ev.key)) me.direction.set(0, .0251, 0).normalize();
            else if (RIGHT.includes(ev.key)) me.direction.set(.0251, 0, 0).normalize();
            else if (DOWN.includes(ev.key)) me.direction.set(0, -.0251, 0).normalize();
            else if (LEFT.includes(ev.key)) me.direction.set(-.0251, 0, 0).normalize();

            // Send the data to the API for broadcast/validation.
            GroundPlayerManager.move({
                direction: me.direction.normalise(), 
                rotation: me.rotation, 
                velocity: me.velocity,
                id: me.id
            });
        }
    });

    // Attach listeners for movement. (Currently WASD + ARROWS).
    document.addEventListener('keyup', () => {
        const { me } = window.CONQUEST;

        // Send empty movement event to stop the user moving.
        GroundPlayerManager.move({
            direction: new Vector3(0, 0, 0),
            rotation: me.rotation,
            velocity: me.velocity,
            id: me.id
        });
    });
}