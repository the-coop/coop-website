<template>
  <div class="groundlevel-wrapper">
    <div class="groundlevel" />

    <div class="ui">
    </div>
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

  const generateGround = () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();

    // Set the size and append the element.
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Give the camera its initial position.
    camera.position.set(0, 0, 5);

    // Globalise the ground/scene/core components for better access later.
    return { renderer, scene, camera };
  }

  export default {
    name: 'GroundLevel',
    props: {
      tile: {
        type: String,
        default: null
      }
    },
    methods: {
    },
    async mounted() {
      // Used for shared state.
      window.GROUND_LEVEL = {
        // Not really sure what else will go in here yet, prolly something fun.

        // Create basic scene and globalise properties
        ...generateGround()
      };

      // Connect to the website.
      const socket = io("https://cooperchickenbot.herokuapp.com/", {
          // auth: { token: "123" },
          transports: ["websocket"]
      });

      // Debug socket opening/closing.
      socket.on("connect", () => console.log('connect', socket.id));
      socket.on("disconnect", () => console.log('disconnect', socket.id));

      // Generate a colour and cube for the player.
      socket.on("player_recognised", data => {
        console.log('player recognised data', data);

        // Generate geometry and materials for this player object.
        const playerGeometry = new THREE.BoxGeometry(4, 4, 4);
        const playerMaterial = new THREE.MeshBasicMaterial({ color: 0xf6c801 });
        const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

        // Set the position based on what the server returns.
        playerMesh.position = data.position;

        // Add the player to the relevent scene layer.
        window.GROUND_LEVEL.scene.add(playerMesh);
      });

      // socket.on("player_moved", data => {
      //   console.log('player move data', data)

      //   // colour, id, position
      // });

      // Random colour.

      // Render a cube for the user.

      // Render cubes for other people

      // Add move (arrows) + WASD.


      // Extra
      // Load the profile picture for the user if they're logged in.
    }
  }
</script>