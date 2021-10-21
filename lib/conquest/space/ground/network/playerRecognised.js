import API from '~/lib/api/api';
import GroundPlayerManager from '../entity/groundPlayerManager';
import { groundMovementListen } from '../setupGroundMovement';

const loadOthers = async () => {
    const { me } = window.CONQUEST;

    // Load the1 initial state, can refine later to specific tile data.
    const initialState = await fetch(API.BASE_URL + 'ground');
    const initialPlayers = (await initialState.json()).players || {};

    // Load all the players in that aren't this player/client.
    Object.keys(initialPlayers).map(playerID => {
        const player = initialPlayers[playerID];
        if (me.id !== player.id) playerRecognised(player);
    });
}

const loadSelf = (player) => {   
    // My own identity if now known/prepared.
    window.CONQUEST.me = GroundPlayerManager.spawn(player);

    // Add the controls for player (self) movement.
    groundMovementListen();

    // Load the other players now I know myself - zen.
    loadOthers();
}

export default function playerRecognised(player) {
    const { socket, me } = window.CONQUEST;
    
    const isMe = player.id === socket.id;
    const amIDefined = !!me;

    // Capture a reference to self if none exists yet, then load others.
    if (isMe && !amIDefined)
        loadSelf(player);

    else if (!isMe)
        GroundPlayerManager.spawn(player);
}