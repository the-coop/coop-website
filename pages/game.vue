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

  definePageMeta({ layout: 'gaming' });

  const started = ref(false);
  const canvas = ref(null);

  async function start() {
    try {
      await document.documentElement?.requestFullscreen();
      document.body?.requestPointerLock();

      requestAnimationFrame(() => Engine.resize());
      started.value = true;
    } catch (e) {
      console.error(e);
    }
  }

  onMounted(() => Engine.setup({ $refs: { canvas: canvas.value } }));

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