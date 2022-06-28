import { io } from "socket.io-client";  
import { Vector3  } from "three";
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
  socket.on("player_soi", ({ pid, soi, p, v }) => {

    });

    // Handle data for other players (and self, server-enforced position?).
  socket.on("player_moved", ({ pid, p, v, soi,i }) => { //P:position, v:velocity, soi: name of new soi, i:player soi index
        const player = WORLD.players[pid];
        if(!player){
          console.error("trying to move invalid player");
          return;
        }

        //check if we are at the right planet
        const WrongID = player.soiIndex != i;
        if (!soi && WrongID) {
          console.error("trying to move player around wrong body");
          return;
        } else if (WrongID) {
          //we are at the wrong planet but its telling us where to go
          if (i > 1 + player.soiIndex) console.log("looks like we are missing some packets. should probally ask for them");
          const newPlanet = WORLD.SOIDict[soi];
          if (!newPlanet) {
            console.error("planet not found");
            return;
          }
          newPlanet.body.attach(player.handle);
          player.handle.position.copy(new Vector3(p.x, p.y, p.z));
          player.velocity = new Vector3(v.x, v.y, v.z);
          player.soiIndex++;
        }

        const jumpThresholdSquared = 5;
        const updateTime = 0.1;
        const vectorPos = new Vector3(p.x, p.y, p.z);

        if (player.handle.position.distanceToSquared(vectorPos) > jumpThresholdSquared) {
            player.handle.position.copy(vectorPos);
        } else {
            let gap = player.handle.position.clone().sub(vectorPos);
            player.correctionVelocity = gap.multiplyScalar(1 / updateTime);
            player.correctionTime = updateTime;
        }

        player.velocity = new Vector3(v.x, v.y, v.z);
    });
};
