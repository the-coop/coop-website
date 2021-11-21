
import GroundPlayerManager from '../entity/groundPlayerManager';
import { groundMovementListen } from '../setupGroundMovement';

export default function playerRecognised(player, uiRef) {
    const { socket, me } = window.CONQUEST;
    
    // Otherwise spawn it as a stranger/other player.
    const spawnedPlayer = GroundPlayerManager.spawn(player);
    
    // If logged in and this player is self spawn it as self (with controls).
    const isMe = player.id === socket.id;
    if (!me && isMe) {
        // Capture a reference to myself.
        window.CONQUEST.me = spawnedPlayer;

        // Debug what information is returned about the spawned player.
        console.log(spawnedPlayer);

        // Add the controls for player (self) movement.
        groundMovementListen();

        // Update UI ref.
        uiRef.me = spawnedPlayer;
    }
}