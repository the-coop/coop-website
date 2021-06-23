<template>
  <div class="groundlevel" />
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

    // Globalise the ground/scene/core components for better access later.
    window.GROUND_LEVEL.renderer = renderer;
    window.GROUND_LEVEL.scene = scene;
    window.GROUND_LEVEL.camera = camera;
  }

  export default {
    name: 'GroundLevel',
    props: {
      tile: {
        type: String,
        default: null
      }
    },
    async mounted() {
      // Used for shared state.
      window.GROUND_LEVEL = {};

      // Connect to the website.
      const socket = io("https://cooperchickenbot.herokuapp.com/", {
          // TODO: Add auth requirement later.
          // auth: { token: "123" },
          transports: ["websocket"]
      });

      // Debug socket opening/closing.
      socket.on("connect", () => console.log('connect', socket.id));
      socket.on("disconnect", () => console.log('disconnect', socket.id));
      socket.on("data", data => console.log('data', data));

      // Create basic scene.
      generateGround();

      // Random colour.

      // Render a cube for the user.

      // Render cubes for other people

      // Add move (arrows) + WASD.


      // Extra
      // Load the profile picture for the user if they're logged in.
    }
  }
</script>