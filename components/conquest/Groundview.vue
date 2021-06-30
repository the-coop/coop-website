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
  import bootstrapGroundEngine from '../../lib/conquest/ground/engine/bootstrapGroundEngine';
  import runGroundEngine from '../../lib/conquest/ground/engine/runGroundEngine';
  import setupGroundNetworking from '~/lib/conquest/ground/engine/setupGroundNetworking';

  export default {
    name: 'Groundview',
    props: {
      tile: {
        type: String,
        default: null
      }
    },
    methods: {},
    async mounted() {
      // Initialise the ground engine manager/data structures/etc.
      bootstrapGroundEngine();

      // Begin and sustain the rendering loop.
			runGroundEngine();

      // Setup and run the game/level networking (socket based).
      setupGroundNetworking();

      // TODO:
      // Render cubes for other people
      // Add move (arrows) + WASD.
      // Extra
      // Load the profile picture for the user if they're logged in.
    }
  }
</script> 