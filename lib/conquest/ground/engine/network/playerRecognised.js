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

    // Capture a reference to self.
    if (id === socket.id) {
        // My own identity if now known/prepared.
        window.GROUND_LEVEL.me = player;

        // Load the other players now I know myself - zen.
        loadOthers();
    }
}