import { io } from "socket.io-client";  
import API from "~/lib/api/api";

// Websocket routes/actions.
import playerDisconnected from "./network/playerDisconnected";
import playerMoved from "./network/playerMoved";
import playerRecognised from "./network/playerRecognised";

export default function setupGroundNetworking(token) {
    // Connect to the Heroku api websocket.
    const socket = window.CONQUEST.socket = io(API.BASE_URL, {
        auth: { token },
        transports: ["websocket"]
    });

    // Handle the connection of another player into the current level/scene.
    socket.on("player_recognised", playerRecognised);

    // Handle disconnection of player from the websocket (server errors/restart/etc).
    socket.on("player_disconnected", playerDisconnected);

    // Handle data for other players (and self, server-enforced position?).
    socket.on("player_moved", playerMoved);
};