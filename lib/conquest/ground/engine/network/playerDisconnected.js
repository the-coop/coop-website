export default function playerDisconnected() {
    const { socket } = window.GROUND_LEVEL;

    console.log('disconnect', socket.id);

    // Remove the game object.

    // Remove from local memory data.
    console.log(window.GROUND_LEVEL);
}