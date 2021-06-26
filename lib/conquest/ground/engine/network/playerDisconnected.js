export default function playerDisconnected() {
    const { socket } = window.GROUND_LEVEL;

    console.log('disconnect', socket.id);
}