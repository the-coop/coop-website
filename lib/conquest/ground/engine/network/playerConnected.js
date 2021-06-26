import GroundPlayerManager from "../entity/groundPlayerManager";

export default function playerConnected(data) {
    const { socket } = window.GROUND_LEVEL;

    console.log('connect', socket.id);
    console.log('connection data', data);

    // TOOD:
    // Return the existing players that are currently known to exist so we can render
    // and store them in local memory here?

    // GroundPlayerManager.spawn(id, position, color)
}