<template>
  <div class="game">
    <Start v-if="!started" @start="startGame" />
    <canvas class="viewer" ref="canvas"></canvas>
  </div>
</template>

<script>
import Engine from '../lib/game/engine.mjs';
import Start from '../components/game/Start.vue';

export default {
  name: 'Game',
  components: {
    Start,
  },
  data() {
    return {
      started: false
    };
  },
  methods: {
    startGame() {
      this.started = true;
      // Setup renderer, world, camera, basics.
      Engine.setup(this.$refs.canvas);

      // Temp testing.
      Engine.cube = Engine.createCube();
      Engine.scene.add(Engine.cube);

      // Gamepad input needs to be ready for start screen.

      // Start game loop.
      Engine.loop();
    }
  },
  mounted() {
    if (this.started) {
      this.startGame();
    }
  },
  unmounted() {
    Engine.cleanup();
  },
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
