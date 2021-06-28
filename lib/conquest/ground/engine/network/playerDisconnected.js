export default function playerDisconnected(disconnectedID) {
    const { scene, players } = window.GROUND_LEVEL;

    console.log(players, players[disconnectedID], disconnectedID);

    // 1. Remove the game object.
    scene.remove(players[disconnectedID].mesh);
    
    // 2. Remove from players data object.
    delete players[disconnectedID];

    console.log(players, players[disconnectedID], disconnectedID);
}