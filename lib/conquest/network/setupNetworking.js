import { io } from "socket.io-client";  
import API from "~/lib/api/api";
import PlayerManager from "../entities/playerManager";

export default async function setupNetworking(token, user) {
    // Connect to the Heroku api websocket.
    const socket = window.WORLD.socket = io(API.BASE_URL, {
        auth: { token },
        transports: ["websocket"]
    });
    
    // TODO: This should be more specific/localised based on player being logged in:
    
    // Load the initial state, can refine later to specific tile data.
    const initialState = await fetch(API.BASE_URL + 'ground');
    const initialPlayers = (await initialState.json()).players || {};
    Object.keys(initialPlayers)
        .map(playerID => PlayerManager.add(initialPlayers[playerID]));

    socket.on('connection', (socket) => {
        console.log('Conquest socket connection established', socket);
    });

    socket.on("disconnect", (reason) => {
        console.log('disconnect', reason);  

        // Need to mark the player as disconnected or remove?
    });

    // Handle the connection of another player into the current level/scene.
    socket.on("player_recognised", (config) => {
        const player = PlayerManager.add(config);

        // Capture a reference to self (config and 3d instance).
        if (config.player_id === user.id)
            WORLD.me = { config, player };

        console.log(config);
        console.log('Player recognised', config);
    });

    // Handle disconnection of player from the websocket (server errors/restart/etc).
    socket.on("player_disconnected", () => {
        console.log('LOL player_disconnected');
    });

    // Handle data for other players (and self, server-enforced position?).
    socket.on("player_moved", (packet) => {
        const player = WORLD.players[packet.id];
        if (!player) return;

        const jumpThresholdSquared = 25;
        const updateTime = 0.1;
    
        if (player.body.position.distanceToSquared(packet.p) > jumpThresholdSquared) {
            player.body.position = packet.p;
        } else {
            let gap = player.body.position.clone().sub(packet.p);
            player.correctionVelocity = gap.multiplyScalar(1 / updateTime);
            player.correctionTime = updateTime;
        }

        player.velocity = packet.v;
    });
};
