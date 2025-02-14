<template>
  <div class="game" @click="requestLock">
    <Start v-if="!started" :start="start" />
    <canvas class="canvas" ref="canvas"></canvas>
    <MobileUI v-if="started" />
  </div>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';
  import MobileUI from '../components/game/MobileUI.vue';
  import PlayersManager from '../lib/game/players.mjs';
  import Mobile from '../lib/game/controllers/inputs/mobile.mjs';

  // Use the full sized game layout for simplicity/separation.
  definePageMeta({ layout: 'gaming' });

  const started = ref(false);
  const canvas = ref(null);
  const isMobile = ref(false);

  // Check for mobile device
  function detectMobile() {
    // return 'ontouchstart' in window && window.innerWidth <= 768;
    return window.innerWidth <= 768;
  };

  // Starting the game, hiding the UI and handling spawning.
  async function start() {
    try {
      // Enter fullscreen
      await document.documentElement?.requestFullscreen();
      
      isMobile.value = detectMobile();
      if (isMobile.value) Mobile.setup();

      // Only request pointer lock for non-mobile
      if (!isMobile.value) {
        console.log(isMobile);
        document.body?.requestPointerLock();
      }

      // Wait for fullscreen transition to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      Engine.resize();

      // Spawn player before changing to FPS controller
      PlayersManager.spawn();

      // Mark as started last to prevent duplicate starts
      started.value = true;
      
    } catch (e) {
      console.error(e);
    }
  };

  function requestLock(ev) {
    if (!isMobile.value && !document.pointerLockElement) {
      document.body?.requestPointerLock();
    }
  };

  // Setup game engine when page ready.
  onMounted(() => {   
    // Setup game engine.
    Engine.setup(canvas);
  });

  // Cleanup engine, fullscreen, inputs and pointer lock.
  onBeforeUnmount(() => {
    // Remove pointer lock if it was applied.
    if (!isMobile.value)
      document.exitPointerLock();

    // Cleanup the entire engine.
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