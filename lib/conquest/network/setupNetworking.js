import { io } from "socket.io-client";  
import API from "~/lib/api/api";

export default async function setupNetworking(token, user) {
    // Connect to the Heroku api websocket.
    const socket = window.WORLD.socket = io(API.BASE_URL, {
        auth: { token },
        transports: ["websocket"]
    });
    
    // Load the initial state, can refine later to specific tile data.
    const initialState = await fetch(API.BASE_URL + 'ground');
    const initialPlayers = (await initialState.json()).players || {};

    // Set the player data to the world for rendering/manipulation.
    WORLD.players = initialPlayers;

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
        console.log('Player recognised');
        console.log(player);

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
    socket.on("player_moved", (packet) => {
        console.log('LOL player_moved');
        console.log(packet);

        // let Player = findPlayer(packet.id);

        // TODO: Associate packet with a player :D <3
        // WORLD.players[packet.id??]
        const player = {};

        const jumpThresholdSquared = 25;
        const updateTime = 0.1;
    
        if (player.body.position.distanceToSquared(packet.newPosition) > jumpThresholdSquared) {
            player.body.position = packet.newPosition;
            player.velocity = packet.velocity;
        } else {
            player.velocity = packet.velocity;

            let gap = player.body.position.clone().sub(packet.newPosition);
            player.correctionVelocity = gap.multiplyScalar(1 / updateTime);
        }
    });
};