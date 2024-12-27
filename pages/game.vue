<template>
  <div class="game">
    <Start v-if="!started" :start="start" />
    <canvas class="canvas" ref="canvas"></canvas>
  </div>
</template>

<script setup>
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';
  import { ref, onMounted, onBeforeUnmount } from 'vue';

  // Use the full sized game layout for simplicity/separation.
  definePageMeta({ layout: 'gaming' });

  const started = ref(false);
  const canvas = ref(null);

  async function start() {
    try {
      // Enter fullscreen and pointer lock, if possible.
      await document.documentElement?.requestFullscreen();
      document.body?.requestPointerLock();

      // Resize after fullscren and pointer lock to account for UI/change.
      requestAnimationFrame(() => Engine.resize());

      // Indicate game started to engine.
      started.value = true;

      // TODO: Should attempt to load data/tell if they're a new player.

      // TODO: Should spawn

      // TODO: Should change to FPS controller
      // ControlManager.change(FPSController);

    } catch (e) {
      console.error(e);
    }
  };

  // Setup game engine when page ready.
  onMounted(() => Engine.setup(canvas));

  // Cleanup engine, fullscreen,inputs an pointer lock.
  onBeforeUnmount(() => {
    document.documentElement?.exitPointerLock();
    document?.exitPointerLock?.();
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