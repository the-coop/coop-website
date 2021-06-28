export default function playerMoved({ id, direction }) {
    const { players } = window.GROUND_LEVEL;
    const { x, y, z } = direction;

    // Handle self and other user movements.
    players[id].direction.set(x, y, z);
}