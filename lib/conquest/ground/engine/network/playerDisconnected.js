export default function playerDisconnected(data) {
    const { socket } = window.GROUND_LEVEL;

    console.log('disconnect', socket.id);

    console.log('disconnection data', data);

    // 1. Remove the game object.
    // Access mesh by uuid.

    // 2. Remove from players data object.

    console.log('player disconnected', data);

    // Remove the game object.
            // Debug the mesh id/identifier for later removal (on disconnect).
            // console.log(playerMesh);

    // Remove from local memory data.
    console.log(window.GROUND_LEVEL);
}