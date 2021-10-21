export default function playerMoved({ id, direction, rotation }) {
    console.log('move', id, direction);

    const { players } = window.CONQUEST;
    const { x: dx, y: dy, z: dz } = direction;
    const { x: rx, y: ry, z: rz } = rotation;

    // Handle self and other user movements.
    players[id].direction.set(dx, dy, dz);
    players[id].rotation.set(rx, ry, rz);
}