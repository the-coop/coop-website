<template>
  <div class="game">
    <Start v-if="!started" :gamepads="gamepads" :start="start" />
    <canvas class="viewer" ref="canvas"></canvas>
  </div>
</template>

<script>
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';
  import Gamepad from '../lib/game/inputs/gamepad.mjs';

  export default {
    name: 'Game',
    components: {
      Start
    },
    data() {
      return {
        started: false,
        gamepads: []
      };
    },
    methods: {
      start() {
        this.started = true;
      }
    },
    mounted() {
      // Setup renderer, world, camera, basics.
      Engine.setup(this);

      // Temp testing.
      Engine.cube = Engine.createCube();
      Engine.scene.add(Engine.cube);

      // Gamepad input needs to be ready for start screen.
      Gamepad.setup();

      // Start game loop.
      Engine.loop();
    },
    unmounted() {
      Engine.cleanup();
      Gamepad.cleanup();
    }
  };
</script>

<style scoped>
  .game {
    display: flex;
    justify-content: center;
    align-items: center;

    height: 100dvh;
    width: 100vw;

    position: absolute;
    top: 0;
    left: 0;
    background: #000;

    overflow: hidden;
  }

  .viewer {
    width: 100%;
    height: 100%;
  }

  .start {
    /* ...existing styles... */
  }
</style>
