import setFocusTarget from '../../controls/setFocusTarget';
import GroundPlayerManager from '../entity/groundPlayerManager';
import { addKeyboardMovement, addMobileMovement, addMouseLooking } from '../setupGroundMovement';

export default function playerRecognised(data) {
    const { socket, me } = window.CONQUEST;
    
    // Otherwise spawn it as a stranger/other player.
    const player = GroundPlayerManager.spawn(data);
    
    // If logged in and this player is self spawn it as self (with controls).
    const isMe = data.id === socket.id;
    if (!me && isMe) {
        // Capture a reference to myself.
        window.CONQUEST.me = player;

        // Add the controls for player (self) movement.
        addMobileMovement();
        addKeyboardMovement();
        addMouseLooking();
    
        // Update UI ref's property for rendering UI data.
        window.CONQUEST.VIEW.UI.me = player;

        // Set the focus target to the player's aim box OR NOT A CHANCE
        setFocusTarget(player.mesh);
    }
}