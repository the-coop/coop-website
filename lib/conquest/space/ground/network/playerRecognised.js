
import GroundPlayerManager from '../entity/groundPlayerManager';
import { groundMovementListen } from '../setupGroundMovement';

export default function playerRecognised(player) {
    const { socket, me } = window.CONQUEST;
    
    // Otherwise spawn it as a stranger/other player.
    const spawnedPlayer = GroundPlayerManager.spawn(player);
    
    // If logged in and this player is self spawn it as self (with controls).
    const isMe = player.id === socket.id;
    if (!me && isMe) {
        // Capture a reference to myself.
        window.CONQUEST.me = spawnedPlayer;

        // Add the controls for player (self) movement.
        groundMovementListen();

        // Update UI ref's property for rendering UI data.
        window.CONQUEST.VIEW.UI.me = spawnedPlayer;

        // Set the camera to first person view and lock/block changing focus target.
        spawnedPlayer.mesh.add(window.CONQUEST.camera);
    }
}