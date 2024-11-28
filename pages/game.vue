<template>
  <canvas ref="canvas"></canvas>
</template>

<style scoped>
  body {
    height: 100dvh;
    width: 100dvw;
  }
  canvas {
    display: block;
    height: 100%;
    width: 100%;
  }
</style>

<script setup>
  import { onMounted, onBeforeUnmount, ref } from 'vue';
  import Engine from '../lib/game/engine';

  definePageMeta({ layout: 'fullscreen' });

  const canvas = ref(null);

  onMounted(() => {
    Engine.setup(canvas);
    Engine.loop();
  });

  onBeforeUnmount(() => {
    Engine.cleanup();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  });
</script>