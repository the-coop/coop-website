import { io } from "socket.io-client";  
import API from "~/lib/api/api";

// Websocket routes/actions.
// import playerDisconnected from "./network/playerDisconnected";
// import playerMoved from "./network/playerMoved";
// import playerRecognised from "./network/playerRecognised";

const loadOthers = async () => {
    const { me } = window.WORLD;

    // Load the initial state, can refine later to specific tile data.
    const initialState = await fetch(API.BASE_URL + 'ground');
    const initialPlayers = (await initialState.json()).players || {};

    console.log(initialPlayers);

    // Load all the players in that aren't this player/client.
    Object.keys(initialPlayers).map(playerID => {
        const player = initialPlayers[playerID];
        // if (!me || me.id !== player.id) 
            // playerRecognised(player, null);
    });
};

export default function setupNetworking(token) {
    // Connect to the Heroku api websocket.
    const socket = window.WORLD.socket = io(API.BASE_URL, {
        auth: { token },
        transports: ["websocket"]
    });
    
    // Load the other players now I know myself - zen.
    loadOthers();

    
    socket.on('connection', (socket) => {
        console.log('Connected');
        console.log(socket);
    });

    socket.on("player_recognised", () => {
        console.log('LOL player_recognised');
    });

    // Handle the connection of another player into the current level/scene.
    socket.on("player_recognised", () => {
        console.log('LOL player_recognised');
    });
    // playerRecognised

    // Handle disconnection of player from the websocket (server errors/restart/etc).
    socket.on("player_disconnected", () => {
        console.log('LOL player_disconnected');
    });
    // playerDisconnected

    // Handle data for other players (and self, server-enforced position?).
    socket.on("player_moved", () => {
        console.log('LOL player_moved');
    });
    // playerMoved
};