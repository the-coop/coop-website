<template>
  <div class="game">
    <Start v-if="!started" :gamepad="gamepad" :start="start" />
    <canvas class="viewer" ref="canvas" tabindex="0"></canvas>
  </div>
</template>

<script>
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';
  import Gamepad from '../lib/game/controllers/inputs/gamepad.mjs';

  export default {
    name: 'Game',
    components: {
      Start
    },
    data() {
      return {
        started: false,
        gamepad: null,
        fullscreenHandler: null
      };
    },
    methods: {
      async start() {
        this.started = true;
        const canvas = this.$refs.canvas;
        try {
          await canvas.requestFullscreen();
          canvas.requestPointerLock();
          Engine.resize();
        } catch (err) {
          console.error('Fullscreen error:', err);
        }
      }
    },
    mounted() {
      Engine.setup(this);
      Engine.cube = Engine.createCube();
      Engine.scene.add(Engine.cube);
      Gamepad.setup();
      Engine.loop();
      Engine.resize();
    },
    unmounted() {
      document.removeEventListener('pointerlockchange', this.pointerLockChangeHandler);
      document.removeEventListener('fullscreenchange', this.fullscreenChangeHandler);
      Engine.cleanup();
      Gamepad.cleanup();
    }
  };
</script>

<style scoped>
  .game {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #000;
  }

  .viewer {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>