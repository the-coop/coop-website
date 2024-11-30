<template>
  <div ref="gameContainer" @click="startGame" :class="{ fullscreen: isGameStarted }">
    <div v-if="!isGameStarted" class="start">CLICK TO START</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { GameEngine } from '../lib/game/engine.mjs';

const gameContainer = ref(null);
const isGameStarted = ref(false);
let engine = null;

const startGame = async () => {
  if (isGameStarted.value) return;
  
  try {
    await Promise.all([
      gameContainer.value.requestFullscreen(),
      document.documentElement.requestPointerLock()
    ]);
    
    engine = new GameEngine(gameContainer.value);
    engine.start();
    isGameStarted.value = true;
  } catch (error) {
    console.error('Failed to start:', error);
  }
};
</script>

<style scoped>
div {
  margin: 0;
  padding: 0;
}

.start {
  width: 100vw;
  height: 100vh;
  display: grid;
  place-items: center;
  background: black;
  color: white;
  cursor: pointer;
}

.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: black;
}
</style>