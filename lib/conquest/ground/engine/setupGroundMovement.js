// import { Vector3 } from 'three';


export default function setupGroundMovement() {
    // Connect to the Heroku api websocket.
    const MOVEMENT = window.GROUND_LEVEL.MOVEMENT = {
        keymap: {
            UP: ['ArrowUp', 'w'],
            RIGHT: ['ArrowRight', 'd'],
            DOWN: ['ArrowDown', 's'],
            LEFT: ['ArrowLeft', 'a'],
            _all: null
        }
    };

    // Collect once for optimisation.
    const { UP, RIGHT, DOWN, LEFT } = MOVEMENT.keymap;
    MOVEMENT._all = [...UP, ...RIGHT, ...DOWN, ...LEFT ];

    // Attach listeners for movement. (Currently WASD + ARROWS).
    document.addEventListener('keyup', () => {
        const { me } = window.GROUND_LEVEL;

        if (me)
            me.direction.set(0, 0, 0);
    });
    document.addEventListener('keydown', ev => {
        const { me } = window.GROUND_LEVEL;

        // Checks if the input event is an attempt at movement.
        if (MOVEMENT._all.includes(ev.key)) {            
            // If player is recognised, process movement.
            if (me) {
                // Apply the movement to the direction and velocity vectors.
                if (UP.includes(ev.key)) me.direction.set(0, .1, 0);
                else if (RIGHT.includes(ev.key)) me.direction.set(.1, 0, 0);
                else if (DOWN.includes(ev.key)) me.direction.set(0, -.1, 0);
                else if (LEFT.includes(ev.key)) me.direction.set(-.1, 0, 0);

                // Send the data to the API for broadcast/validation.
                window.GROUND_LEVEL.socket.emit('player_moved', {
                    direction: me.direction

                    //  with acknowledgement
                    // socket.emit("question", () => {});
                });
            }
        }
    });
};