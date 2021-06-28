import GroundPlayerManager from '../entity/groundPlayerManager';

const loadOthers = async () => {
    // Load the initial state, can refine later to specific tile data.
    const initialState = await fetch('https://cooperchickenbot.herokuapp.com/ground');
    const initialPlayers = await initialState.json();

    // Load all the players in that aren't this player/client.
    Object.keys(initialPlayers).map(player => {
        if (me.id !== player.id) 
            playerRecognised(player);
    });
}

export default function playerRecognised({ id, position, color }) {
    const player = GroundPlayerManager.spawn(id, position, color);
    const { socket } = window.GROUND_LEVEL;

        // const { players } = window.GROUND_LEVEL;

        // // Spawn all the newbs (new/unknown players).
        // const playerIDs = Object.keys(worldState.players);
        // const newbIDs = playerIDs.filter(p => !!players[p.id]);
        // newbIDs.map(nID => {
        //     const newb = worldState.players[nID];
        //     GroundPlayerManager.spawn(newb.id, newb.position);
        // });

    // Capture a reference to self.
    if (id === socket.id) {
        // My own identity if now known/prepared.
        window.GROUND_LEVEL.me = player;

        // Load the other players now I know myself - zen.
        console.log('Trying to load others:');
        loadOthers();

        console.log({ players, me } = window.GROUND_LEVEL);
    }
}