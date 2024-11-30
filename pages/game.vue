<template>
  <div ref="gameContainer" class="container" :class="{ full: isGameStarted }">
    <LoadingStatus />
    <canvas id="gameCanvas" ref="gameCanvas"></canvas>

    <!-- Game Start UI -->
    <div v-if="!isGameStarted" class="start" @click="handleStartClick">
      <div class="content">
        <!-- Start prompt at the top -->
        <span class="start-prompt">{{ startPromptText }}</span>
        
        <div class="blurb">
          A Web3 MMO Combat Experience on Algorand
        </div>
        
        <div class="controls" v-html="formattedControlsHint"></div>
        
        <!-- Connected Gamepads Display -->
        <div v-if="hasGamepad" class="pads">
          <h3>Connected Controllers:</h3>
          <ul>
            <li v-for="gamepad in connectedGamepads" :key="gamepad.index">
              {{ getControllerName(gamepad) }}
            </li>
          </ul>
        </div>

        <div class="actions">
          <button class="btn config" @click.stop="toggleSettings">
            <Gear class="icon"></Gear>
            Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Game UI -->
    <div v-if="isGameStarted" class="hud">
      <button class="btn" @click.stop="toggleSettings">
        <Gear class="icon"></Gear>
      </button>
    </div>

    <Settings 
      :show="showSettings"
      :control-mode="controlMode"
      :game-started="isGameStarted"
      :connected-gamepads="connectedGamepads"
      @close="toggleSettings"
      @update-control-mode="updateControlMode"
      @updateShowFPS="updateShowFPS"
    />
  </div>
</template>

<style scoped>
* {
  box-sizing: border-box;
}

.container {
  position: relative;
  height: 400px; /* Reduced from calc(100vh - 120px) to fixed height */
  width: 100%;
  overflow: hidden;
  border-radius: 8px; /* Optional: adds nice rounded corners before game starts */
}

canvas {
  height: 100% !important;
  width: 100% !important;
}

.start {
  position: absolute; /* Changed from fixed to absolute */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  z-index: 100;
  background: rgba(0, 0, 0, 0.7); /* Add semi-transparent background */
}

/* When game is started, make container fullscreen */
.full {
  position: fixed;
  top: 0;
  left: 0;
  height: 100dvh;
  width: 100vw;
  border-radius: 0;
  z-index: 1000;
}

.start-prompt {
  font-size: 2em;
  color: #ffcc00; /* Make it stand out */
  font-weight: bold;
  user-select: none;
  /* Optional: Center the text */
  display: block;
  text-align: center;
  margin-bottom: 1em;
  text-shadow: 0 0 10px rgba(255, 204, 0, 0.5); /* Add glow effect */
}

.controls {
  color: #aaa;
  font-size: 1.2em;
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
  padding: 1em;
}

.controls ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.controls li {
  margin: 0.5em 0;
  line-height: 1.4;
}

.btn {
  padding: 1em 2em;
  font-size: 1.2em;
  background-color: rgba(255, 204, 0, 0.9);
  border: none;
  border-radius: 0.5em;
  cursor: pointer;
  transition: transform 0.2s, background-color 0.2s;
  width: 100%;
  margin-bottom: 1em;
}

.btn:hover {
  transform: scale(1.05);
  background-color: rgba(255, 204, 0, 1);
}

.start-hint {
  color: white;
  font-size: 1em;
  margin: 0;
  line-height: 1.5;
}

.hud {
  position: absolute;
  top: 1em;
  right: 1em;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
  z-index: 10;
}

.control-switcher,
.control-switcher select {
  display: none;
}

.controllers-list {
  background: rgba(0, 0, 0, 0.7);
  padding: 0.5em;
  border-radius: 0.5em;
  color: white;
  font-size: 0.8em;
}

.controller-item {
  display: block;
  padding: 0.2em 0;
}

.mobile-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 200px;
  pointer-events: none; /* Allow click-through for non-control areas */
}

.touch-joystick {
  position: absolute;
  bottom: 20px;
  left: 20px;
  width: 120px;
  height: 120px;
  pointer-events: auto;
}

.touch-buttons {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  gap: 20px;
}

.touch-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: rgba(255, 204, 0, 0.5);
  border: none;
  color: white;
  font-weight: bold;
  pointer-events: auto;
}

.jump-button {
  background: rgba(0, 255, 0, 0.5);
}

.sprint-button {
  background: rgba(255, 0, 0, 0.5);
}

.device-info {
  position: absolute;
  top: 1em;
  left: 1em;
  display: flex;
  flex-direction: column;
  gap: 0.5em;
}

.device-type {
  color: white;
  font-size: 1.2em;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.5em 1em;
  border-radius: 0.5em;
}

.controller-status {
  color: #4CAF50;
  font-size: 1em;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.5em 1em;
  border-radius: 0.5em;
}

.btn {
  background: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 8px;
  margin-bottom: 8px;
}

.icon {
  width: 100%;
  height: 100%;
  fill: white;
}

.btn:hover {
  background: rgba(0, 0, 0, 0.9);
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2em;
  text-align: center;
  padding: 2em;
  max-width: 600px;
}

.config {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em 1em;
  font-size: 1em;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 4px;
  width: auto;
  margin-top: 1em;
}

.config .icon {
  width: 20px;
  height: 20px;
}

.config:hover {
  background: rgba(255, 255, 255, 0.2);
}

.actions {
  display: flex;
  gap: 1em;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 400px;
}

.actions .btn {
  display: none;
}

.btn {
  background: rgba(255, 204, 0, 0.9);
  color: black;
  padding: 0.5em 1em;
  font-size: 1em;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.btn:hover {
  background: rgba(255, 204, 0, 1);
}

.config {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border-radius: 4px;
  width: auto;
  margin: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1em;
}

/* Update connected gamepads styles for start screen */
.pads {
  position: absolute;
  top: 1em;
  left: 1em;
  padding: 1em;
  border-radius: 8px;
  color: white;
  text-align: left;
}

.pads h3 {
  margin: 0 0 0.5em 0;
  font-size: 1em;
  color: #aaa;
}

.pads ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.pads li {
  margin: 0.3em 0;
  color: #4CAF50;
}

.blurb {
  color: #aaa;
  font-size: 1.2em;
  margin-bottom: 1.5em;
  text-align: center;
}

.game-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#gameCanvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useLayout } from '../composables/useLayout';
import LoadingStatus from '../components/game/LoadingStatus.vue'; // Existing import
import Gear from '../components/icons/Gear.vue'; // Existing import
import Settings from '../components/game/Settings.vue'; // Existing import
import State from '../lib/game/state.mjs';
import Engine from '../lib/game/engine.mjs';
import InputManager from '../lib/game/controllers/inputManager.mjs';
import ControllerManager from '../lib/game/controllers/controllerManager.mjs';

// const { setLayout } = useLayout(); // Assuming it's used elsewhere

// Core refs
const gameCanvas = ref(null);
const gameContainer = ref(null);
const isLoading = ref(true);
const isStartInitiated = ref(false);

// Computed state
const isGameStarted = computed(() => State.isGameStarted);
const showSettings = computed(() => State.showSettings);
const connectedGamepads = computed(() => State.connectedGamepads);
const controlMode = computed(() => State.controlMode);
const hasGamepad = computed(() => connectedGamepads.value?.length > 0);

// UI computed properties
const startPromptText = computed(() => {
  if (!Engine.loaded || State.currentStage || isLoading.value) return '';
  return 'Click or Press Enter';
});

const formattedControlsHint = computed(() => `
  <ul>
    <li>WASD - Move</li>
    <li>Mouse - Look around</li>
    <li>Space - Jump</li>
    <li>Shift - Sprint</li>
  </ul>
`);

// Event Handlers
async function handleStartClick(event) {
  console.log('Start button clicked'); // Debugging
  await Engine.setGameStarted(true); // Adjusted to use Engine directly
}

function toggleSettings() {
  State.setShowSettings(!State.showSettings);
}

function updateControlMode(newMode) {
  // Update control mode without Player
  State.controlMode = newMode;
  ControllerManager.switchMode(newMode);
}

function updateShowFPS(value) {
  State.setShowFPS(value);
  Engine.setShowFPS(value);
}

function getControllerName(gamepad) {
  if (!gamepad) return 'Unknown Controller';
  const id = gamepad.id || 'Unknown ID';
  return `Game Controller (${id})`;
}

// Game Lifecycle
onMounted(async () => {
  // Initialize Engine without Player
  try {
    await Engine.setup(gameCanvas.value);
    isLoading.value = false;
  } catch (err) {
    console.error('Game setup failed:', err);
    isLoading.value = false;
  }
});

onBeforeUnmount(() => {
  Engine.cleanup();
});
</script>