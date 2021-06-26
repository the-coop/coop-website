<template>
  <div class="groundlevel-wrapper">
    <div class="groundlevel" />
    <div class="ui"></div>
  </div>
</template>

<style>
  .groundlevel {
    width: 100vw;
    height: 100vh;

    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
  }
</style>

<script>
  import * as THREE from 'three';
  import { io } from "socket.io-client";  

  import runGroundEngine from '../../lib/conquest/ground/engine/runGroundEngine';
  import generateGroundScene from '../../lib/conquest/ground/engine/generateGroundScene';

  export default {
    name: 'GroundLevel',
    props: {
      tile: {
        type: String,
        default: null
      }
    },
    methods: {},
    async mounted() {
      // Used for shared state.
      window.GROUND_LEVEL = {
        // Not really sure what else will go in here yet, prolly something fun.
        players: {},

        // Create basic scene and globalise properties
        ...generateGroundScene()
      };

      // Connect to the website.
      const socket = io("https://cooperchickenbot.herokuapp.com/", {
          // auth: { token: "123" },
          transports: ["websocket"]
      });

      // Debug socket opening/closing.
      socket.on("connect", () => console.log('connect', socket.id));
      socket.on("disconnect", () => console.log('disconnect', socket.id));

      // Render a random coloured cube for the user.
      socket.on("player_recognised", ({ position, id, color }) => {
        // Generate geometry and materials for this player object.
        const playerGeometry = new THREE.BoxGeometry(2, 2, 2);
        const playerMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x00ff00,
          wireframe: true
        });
        const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

        // Set the position based on what the server returns.
        playerMesh.position.set(position.x, position.y, position.z);

        // Add the player to the relevent scene layer.
        window.GROUND_LEVEL.scene.add(playerMesh);

        // Add for global data access. =p
        window.GROUND_LEVEL.players[id] = {
          mesh: 'player',
          position
        };

        // Debugging only.
        console.log('player recognised data', { position, id, color });
      });

      // Render cubes for other people

      // socket.on("player_moved", data => {
      //   console.log('player move data', data)
      //   // colour, id, position
      // });

      // Add move (arrows) + WASD.

      // Extra
      // Load the profile picture for the user if they're logged in.

      // Begin and sustain the rendering loop.
			runGroundEngine();
    }
  }
</script> 