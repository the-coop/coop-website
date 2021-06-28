import GroundPlayerManager from '../entity/groundPlayerManager';

export default function playerRecognised({ id, position, color }) {
    const player = GroundPlayerManager.spawn(id, position, color);
    const { socket } = window.GROUND_LEVEL;

    // Capture a reference to self.
    if (id === socket.id)
        window.GROUND_LEVEL.me = player;
}