export default function playerConnected(data) {
    const { socket } = window.GROUND_LEVEL;

    console.log('connect', socket.id);


    console.log('connection data', data);
}