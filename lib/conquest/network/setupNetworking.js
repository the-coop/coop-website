import { io } from "socket.io-client";  
import API from "~/lib/api/api";

export default function setupNetworking(token, user) {
    // Connect to the Heroku api websocket.
    const socket = window.WORLD.socket = io(API.BASE_URL, {
        auth: { token },
        transports: ["websocket"]
    });
    
    // Load the initial state, can refine later to specific tile data.
    const initialState = await fetch(API.BASE_URL + 'ground');
    const initialPlayers = (await initialState.json()).players || {};

    // Load all the players in that aren't this player/client.
    // Object.keys(initialPlayers)
        // .map(playerID => initialPlayers[playerID]);

    socket.on('connection', (socket) => {
        console.log('Connected');
        console.log(socket);
    });

    socket.on("disconnect", (reason) => {
        console.log('disconnect', reason);  
    });

    // Handle the connection of another player into the current level/scene.
    socket.on("player_recognised", (player) => {
        if (player.player_id === user.id) {
            WORLD.me = player;

            // PlayerManager.isSpawned()
                // Spawn the player, unless unspawned.
                    // TODO If player logged in spawn/re-center world.
        }
    });

    // Handle disconnection of player from the websocket (server errors/restart/etc).
    socket.on("player_disconnected", () => {
        console.log('LOL player_disconnected');
    });

    // Handle data for other players (and self, server-enforced position?).
    socket.on("player_moved", () => {
        console.log('LOL player_moved');
    });
};