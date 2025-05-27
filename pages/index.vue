<template>
  <div class="game-container">
    <div ref="gameCanvas" class="game-canvas"></div>
    <div v-if="loading" class="loading-screen">Loading physics engine...</div>
    <div v-if="!started && !loading" class="start-screen">
      <button @click="startGame" class="start-button">Start Game</button>
    </div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div class="debug-info" v-if="started && showDebug">
      <div>Grounded: {{ game?.debugInfo.isGrounded }}</div>
      <div>Position: {{ formatVector(game?.debugInfo.position) }}</div>
      <div>Moving: {{ game?.debugInfo.isMoving }}</div>
      <div>Speed: {{ game?.debugInfo.currentSpeed?.toFixed(2) }}</div>
      <div>Facing: {{ formatVector(game?.debugInfo.facing) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Game } from '../lib/Game.js';

// Refs
const gameCanvas = ref(null);
const game = ref(null);
const loading = ref(true);
const started = ref(false);
const errorMessage = ref('');
const showDebug = ref(true);

// Format vector for display
const formatVector = (vec) => {
  if (!vec) return '0.00, 0.00, 0.00';
  return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
};

// Start the game
const startGame = async () => {
  try {
    if (!game.value) {
      errorMessage.value = "Game not initialized";
      return;
    }
    
    started.value = true;
    game.value.start();
    game.value.requestPointerLock();
    
    // Add error handler for pointer lock
    document.addEventListener('pointerlockerror', (e) => {
      console.warn('Pointer lock error:', e);
    }, { once: true });
    
  } catch (e) {
    errorMessage.value = "Error starting game: " + e.message;
    console.error("Error starting game:", e);
  }
};

// Initialize game on mount
onMounted(async () => {
  try {
    console.log("Initializing game...");
    
    game.value = new Game();
    
    // Initialize with timeout
    const initTimeout = setTimeout(() => {
      if (loading.value) {
        console.warn("Initialization timed out");
        loading.value = false;
        errorMessage.value = "Physics engine may not be working correctly";
      }
    }, 8000);
    
    await game.value.init(gameCanvas.value);
    
    clearTimeout(initTimeout);
    loading.value = false;
    
    console.log("Game ready to start");
    
  } catch (e) {
    console.error("Failed to initialize game:", e);
    errorMessage.value = "Failed to initialize game: " + e.message;
    loading.value = false;
  }
});

// Cleanup on unmount
onBeforeUnmount(() => {
  if (game.value) {
    game.value.destroy();
    game.value = null;
  }
});
</script>

<style scoped>
:global(html), :global(body) {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
}

.game-container {
  position: relative;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
}

.game-canvas {
  width: 100%;
  height: 100%;
}

.loading-screen, .start-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-family: Arial, sans-serif;
  font-size: 24px;
}

.start-button {
  padding: 15px 30px;
  font-size: 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.start-button:hover {
  background-color: #45a049;
}

.debug-info {
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  font-family: monospace;
  font-size: 14px;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 5px;
  border-radius: 4px;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(200, 0, 0, 0.8);
  color: white;
  padding: 15px 20px;
  border-radius: 5px;
  font-family: Arial, sans-serif;
  font-size: 16px;
  max-width: 80%;
  text-align: center;
  z-index: 1000;
}
</style>