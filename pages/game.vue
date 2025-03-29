<template>
  <div class="game" @click="engage">
    <Start v-if="!started" :started="started" />
    <canvas class="canvas" ref="canvas"></canvas>
    <MobileUI v-if="started" />
    <DebugBox v-if="started && showDebug" />
  </div>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';
  import MobileUI from '../components/game/MobileUI.vue';
  import DebugBox from '../components/game/DebugBox.vue';
  import PlayersManager from '../lib/game/players.mjs';
  import Mobile from '../lib/game/controllers/inputs/mobile.mjs';

  // Use the full sized game layout for simplicity/separation.
  definePageMeta({ layout: 'gaming' });

  const started = ref(false);
  const canvas = ref(null);
  const isMobile = ref(false);
  const showDebug = ref(false);

  // Check for mobile device
  function detectMobile() {
    // return 'ontouchstart' in window && window.innerWidth <= 768;
    return window.innerWidth <= 768;
  };

  // Toggle debug display with backtick key
  function handleKeyDown(event) {
    if (event.key === '`' || event.key === 'Backquote') {
      showDebug.value = !showDebug.value;
    }
  }

  // Remove the start function since we'll merge it into requestLock
  async function engage(ev) {
    // Handle initial game start
    if (!started.value) {
      try {
        isMobile.value = detectMobile();
        if (isMobile.value) {
          Mobile.setup();
        }

        // Start the game first
        Engine.resize();
        PlayersManager.spawn();
        started.value = true;

          try {
            // Attempt full screen on mobile and desktop.
            await document.documentElement?.requestFullscreen();
          } catch (e) {
              console.error('Failed to get full screen:', e);
          }
        // Then handle fullscreen/pointer lock for desktop
        if (!isMobile.value) {
          // await new Promise(resolve => setTimeout(resolve, 100));
          await document.body?.requestPointerLock();
        }
      } catch (e) {
        console.error('Failed to start game:', e);
      }
      return;
    }

    // Handle reapplying lock/fullscreen for desktop
    if (started.value && !isMobile.value && !document.pointerLockElement) {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement?.requestFullscreen();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await document.body?.requestPointerLock();
      } catch (e) {
        console.error('Failed to enter fullscreen/pointer lock:', e);
      }
    }
  };

  // Setup game engine when page ready.
  onMounted(() => {   
    // Setup game engine.
    Engine.setup(canvas);
    
    // Add keyboard listener for debug toggle
    window.addEventListener('keydown', handleKeyDown);
  });

  // Cleanup engine, fullscreen, inputs and pointer lock.
  onBeforeUnmount(() => {
    // Remove pointer lock if it was applied.
    if (!isMobile.value)
      document.exitPointerLock();

    // Remove keyboard listener
    window.removeEventListener('keydown', handleKeyDown);

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