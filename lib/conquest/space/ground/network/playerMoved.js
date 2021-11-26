export default function playerMoved({ id, direction, rotation, velocity }) {
    const { players } = window.CONQUEST;
    const { x: dx, y: dy, z: dz } = direction;
    const { x: rx, y: ry, z: rz } = rotation;
    const { x: vx, y: vy, z: vz } = velocity;

    players[id].direction.set(dx, dy, dz);
    players[id].rotation.set(rx, ry, rz);
    players[id].velocity.set(vx, vy, vz);
}