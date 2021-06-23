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
      const socket = io("https://cooperchickenbot.herokuapp.com/");
      
    }
  }
</script>