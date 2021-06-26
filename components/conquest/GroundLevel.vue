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
    name: 'GroundLevel',
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
    }
  }
</script> 