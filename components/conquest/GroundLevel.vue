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

  // Define the animation loop.
  const animate = () => {
    requestAnimationFrame(animate);

    // TODO: Read the player positions into the render here.
    // cube.rotation.x += 0.01; cube.rotation.y += 0.01;

    // Render the scene using the camera for frustum culling.
    window.GROUND_LEVEL.renderer.render(
      window.GROUND_LEVEL.scene, 
      window.GROUND_LEVEL.camera
    );
  };

  const generateGroundScene = () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();

    // Set the size and append the element.
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Give the camera its initial position.
    camera.position.z = 25;

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
        const playerMaterial = new THREE.MeshBasicMaterial({ color });
        const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);

        // Set the position based on what the server returns.
        playerMesh.position.set(position);

        // Add the player to the relevent scene layer.
        window.GROUND_LEVEL.scene.add(playerMesh);

        // Add for global data access. =p
        window.GROUND_LEVEL.players[id] = {
          mesh: 'player',
          position
        };

        window.GROUND_LEVEL.camera.lookAt(playerMesh);

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
			animate();
    }
  }
</script> 