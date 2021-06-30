import GroundPlayerManager from '../entity/groundPlayerManager';
import { movementListen } from '../setupGroundMovement';

const loadOthers = async () => {
    const { me } = window.GROUND_LEVEL;

    // Load the1 initial state, can refine later to specific tile data.
    const initialState = await fetch('https://cooperchickenbot.herokuapp.com/ground');
    const initialPlayers = (await initialState.json()).players || {};

    // Load all the players in that aren't this player/client.
    Object.keys(initialPlayers).map(playerID => {
        const player = initialPlayers[playerID];
        if (me.id !== player.id) playerRecognised(player);
    });
}

const loadSelf = (id, position, color) => {
    const { camera } = window.GROUND_LEVEL;
    
    // My own identity if now known/prepared.
    window.GROUND_LEVEL.me = GroundPlayerManager.spawn(id, position, color);

    // Attach the camera to the mesh.
    window.GROUND_LEVEL.me.mesh.add(camera);

    // Add the controls for player (self) movement.
    movementListen();

    // Load the other players now I know myself - zen.
    loadOthers();
}

export default function playerRecognised({ id, position, color }) {
    const { socket, me } = window.GROUND_LEVEL;
    
    const isMe = id === socket.id;
    const amIDefined = !!me;

    // Capture a reference to self if none exists yet, then load others.
    if (isMe && !amIDefined)
        loadSelf(id, position, color);

    else if (!isMe)
        GroundPlayerManager.spawn(id, position, color);
}