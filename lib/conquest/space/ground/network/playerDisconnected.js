export default function playerDisconnected(disconnectedID) {
    const { scene, players } = window.GROUND_LEVEL;

    // 1. Remove the game object.
    scene.remove(players[disconnectedID].mesh);
    
    // 2. Remove from players data object.
    delete players[disconnectedID];
}