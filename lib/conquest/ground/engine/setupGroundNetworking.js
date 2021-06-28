import { io } from "socket.io-client";  
import API from "~/lib/api/api";

// Websocket routes/actions.
import playerConnected from "./network/playerConnected";
import playerDisconnected from "./network/playerDisconnected";
import playerMoved from "./network/playerMoved";
import playerRecognised from "./network/playerRecognised";

export default function setupGroundNetworking() {
    // Connect to the Heroku api websocket.
    const socket = window.GROUND_LEVEL.socket = io(API.BASE_URL, {
        // auth: { token: "123" },
        transports: ["websocket"]
    });

    console.log('trying to connect')

    // Handle players connecting, indictating the need to load existing players into scene.
    socket.on("connect", playerConnected);

    // Handle disconnection of player from the websocket (server errors/restart/etc).
    socket.on("player_disconnected", playerDisconnected);

    // Handle the connection of another player into the current level/scene.
    socket.on("player_recognised", playerRecognised);

    // Handle data for other players (and self, server-enforced position?).
    socket.on("player_moved", playerMoved);
};