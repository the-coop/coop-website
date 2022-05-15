import { io } from "socket.io-client";  
import API from "~/lib/api/api";
import Player from '~/lib/conquest/entities/player';
import PlayerManager from "../entities/playerManager";

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
    socket.on("player_recognised", (player) => {
        if (player.player_id === user.id)
            WORLD.me = player;

        PlayerManager.add(player);

        console.log('Player recognised', player);
    });

    // Handle disconnection of player from the websocket (server errors/restart/etc).
    socket.on("player_disconnected", () => {
        console.log('LOL player_disconnected');
    });

    // Handle data for other players (and self, server-enforced position?).
    socket.on("player_moved", (data) => {
      
      const packet = JSON.parse(data);
      console.log(packet);
      //Associate packet with a player :D <3
      const player = WORLD.players[packet.id];


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
