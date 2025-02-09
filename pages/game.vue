<template>
  <div class="game">
    <Start v-if="!started" :start="start" />
    <canvas class="canvas" ref="canvas"></canvas>
  </div>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import Engine from '../lib/game/engine.mjs';
  import ControlManager from '../lib/game/control.mjs';
  import FPSController from '../lib/game/controllers/FPSController.mjs';
  import Start from '../components/game/Start.vue';
  import PlayersManager from '../lib/game/players.mjs';

  // Use the full sized game layout for simplicity/separation.
  definePageMeta({ layout: 'gaming' });

  const started = ref(false);
  const canvas = ref(null);

  // Starting the game, hiding the UI and handling spawning.
  async function start() {
    try {
      // Enter fullscreen and pointer lock, if possible.
      await document.documentElement?.requestFullscreen();
      document.body?.requestPointerLock();

      // Wait for fullscreen transition to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      Engine.resize();

      // Spawn player before changing to FPS controller
      PlayersManager.spawn();
      ControlManager.change(FPSController);

      // Mark as started last to prevent duplicate starts
      started.value = true;
      
    } catch (e) {
      console.error(e);
    }
  };

  // Setup game engine when page ready.
  onMounted(() => Engine.setup(canvas));

  // Cleanup engine, fullscreen,inputs an pointer lock.
  onBeforeUnmount(() => {
    document.exitPointerLock();
    Engine.cleanup();
  });
</script>

<style scoped>
  .game {
    height: 100%;
    width: 100%;
  }

  .canvas {
    display: block;
    height: 100%;
    width: 100%;
  }
</style>