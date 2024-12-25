<template>
  <div class="game">
    <Start v-if="!started" :start="start" />
    <canvas class="canvas" ref="canvas"></canvas>
  </div>
</template>

<script>
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';

  export default {
    name: 'Game',
    layout: 'Gaming',
    components: {
      Start
    },
    data: () => ({ 
      started: false 
    }),
    methods: {
      async start() {
        try {
          // Get full screen and pointer lock.
          await document.documentElement?.requestFullscreen();
          document.body?.requestPointerLock();
          requestAnimationFrame(() => Engine.resize());

          // Start the game/show other elements.
          this.started = true;

        } catch (e) {
          console.error(e);
        }
      }
    },
    async mounted() {
      Engine.setup(this);
    },
    beforeUnmount() {
      document.documentElement?.exitPointerLock();
      document?.exitPointerLock?.();
      Engine.cleanup();
    }
  };
</script>

<style scoped>
  .game {
    height: 100%;
    width: 100%;
  }

  .canvas {
    height: 100%;
    width: 100%;
  }
</style>