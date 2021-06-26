import { io } from "socket.io-client";  
import API from "~/lib/api/api";

// Websocket routes/actions.
import playerConnected from "./network/playerConnected";
import playerDisconnected from "./network/playerDisconnected";
import playerMoved from "./network/playerMoved";
import playerRecognised from "./network/playerRecognised";

import GroundPlayerManager from "./entity/groundPlayerManager";

export default function setupGroundNetworking() {
    // Connect to the Heroku api websocket.
    const socket = window.GROUND_LEVEL.socket = io(API.BASE_URL, {
        // auth: { token: "123" },
        transports: ["websocket"]
    });

    // Handle players connecting, indictating the need to load existing players into scene.
    socket.on("connect", playerConnected);

    // Handle disconnection of player from the websocket (server errors/restart/etc).
    socket.on("disconnect", playerDisconnected);

    // Handle the connection of another player into the current level/scene.
    socket.on("player_recognised", playerRecognised);

    // Handle data for other players (and self, server-enforced position?).
    socket.on("player_moved", playerMoved);


    // Experiment with and debug two below WS routes.
    socket.on("world_state_change", world => {
        // Spawn all the newbs (new/unknown players).
        const newbIDs = Object.keys(world.players).filter(p => !!players[p.id]);
        newbIDs.map(nID => {
            const newb = world.players[nID];
            GroundPlayerManager.spawn(newb.id, newb.position);
        });
        
        console.log('world state change', world);
        console.log('newbs', newbs);
    });

    socket.on("player_disconnected", data => {
        // 1. Remove the game object.
        // 2. Remove from players data object.

        console.log('player disconnected', data);
    });
};