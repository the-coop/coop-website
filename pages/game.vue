<template>
  <div class="game" @click="engage">
    <Start v-if="!started" :start="engage" />
    <canvas class="canvas" ref="canvas"></canvas>
    <MobileUI v-if="started" />
    <DebugBox v-if="started && showDebug" />
  </div>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import { Vector3 } from 'three'; // Import Vector3 from three.js
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';
  import MobileUI from '../components/game/MobileUI.vue';
  import DebugBox from '../components/game/DebugBox.vue';
  import PlayersManager from '../lib/game/players.mjs';
  import Mobile from '../lib/game/controllers/inputs/mobile.mjs';
  import ControlManager from '../lib/game/control.mjs';
  import FPSController from '../lib/game/controllers/FPSController.mjs';

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

  // Handle game initialization and device-specific setup
  async function engage(ev) {
    // Handle initial game start
    if (!started.value) {
      try {
        console.log("Starting game, checking vehicles...");
        // Log the number of vehicles on scene
        if (window.VehicleManager && window.VehicleManager.vehicles) {
          console.log(`Found ${window.VehicleManager.vehicles.length} vehicles`);
        } else {
          console.log("VehicleManager not accessible for debugging");
        }
        
        isMobile.value = detectMobile();
        if (isMobile.value) {
          Mobile.setup();
        }

        // Start the game first
        Engine.resize();
        
        // Spawn player near second planet where there should be vehicles
        PlayersManager.spawn(true, new Vector3(5000, 120, 0));
        
        // Switch to FPS controller after spawn using 'change' instead of 'setController'
        ControlManager.change(FPSController);
        
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
      } catch (error) {
        console.error('Error starting game:', error);
      }
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