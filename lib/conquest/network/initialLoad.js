import API from "~/lib/api/api";

// Websocket routes/actions.
// import playerDisconnected from "./network/playerDisconnected";
// import playerMoved from "./network/playerMoved";
// import playerRecognised from "./network/playerRecognised";

export const loadInitialPlayers = async () => {
    const { me } = window.WORLD;

    // Load the initial state, can refine later to specific tile data.
    const initialState = await fetch(API.BASE_URL + 'ground');
    const initialPlayers = (await initialState.json()).players || {};

    console.log(initialPlayers);

    // Load all the players in that aren't this player/client.
    Object.keys(initialPlayers).map(playerID => {
        const player = initialPlayers[playerID];
        console.log(player, me);
        // if (!me || me.id !== player.id) 
            // console.log('Me recognised', player)
            // playerRecognised(player, null);
    });
};
