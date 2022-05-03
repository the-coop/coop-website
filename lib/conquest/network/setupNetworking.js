import { io } from "socket.io-client";  
import API from "~/lib/api/api";
import { loadInitialPlayers } from "./initialLoad";

// Websocket routes/actions.
// import playerDisconnected from "./network/playerDisconnected";
// import playerMoved from "./network/playerMoved";
// import playerRecognised from "./network/playerRecognised";

export default function setupNetworking(token) {
    // Connect to the Heroku api websocket.
    const socket = window.WORLD.socket = io(API.BASE_URL, {
        auth: { token },
        transports: ["websocket"]
    });
    
    // Load the other players now I know myself - zen.
    loadInitialPlayers();


    // Connect websockets.
    // PlayerManager.isSpawned()
    // PlayerM
    // Spawn the player, unless unspawned.
    // if (this.$auth.user)
    // PlayerManager
    // TODO If player logged in spawn/re-center world.
    // WORLD.me
    // }
    
    socket.on('connection', (socket) => {
        console.log('Connected');
        console.log(socket);
    });

    socket.on("disconnect", (reason) => {
        // ...
        console.log('disconnect', reason);  
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