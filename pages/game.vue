<template>
  <div ref="gameContainer" class="container" :class="{ full: isGameStarted }" @click="handleGameStart">
    <canvas id="gameCanvas" ref="canvas"></canvas>
    
    <!-- Game Start UI -->
    <div v-if="!isGameStarted" class="start">
      <!-- Connected Gamepads Display -->
      <div v-if="hasGamepad" class="pads">
        <h3>Connected Controllers:</h3>
        <ul>
          <li v-for="gamepad in connectedGamepads" :key="gamepad.index">
            {{ getControllerName(gamepad) }}
          </li>
        </ul>
      </div>
      
      <div class="content">
        <!-- Remove the title h1 since it's now in the layout -->
        <div class="blurb">
          A Web3 MMO Combat Experience on Algorand
        </div>
        <div class="controls" v-html="formattedControlsHint"></div>
        <div class="actions">
          <button class="btn" @click.stop="handleGameStart">
            {{ startPromptText }}
          </button>
          <button class="btn config" @click.stop="toggleSettings">
            <Gear class="icon" />
            Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Game UI -->
    <div v-if="isGameStarted" class="hud">
      <button class="btn" @click.stop="toggleSettings">
        <Gear class="icon" />
      </button>
    </div>

    <!-- Settings Overlay -->
    <Settings 
      :show="showSettings"
      :control-mode="controlMode"
      :game-started="isGameStarted"
      :connected-gamepads="connectedGamepads"
      @close="toggleSettings"
      @update-control-mode="updateControlMode"
      @updateShowFPS="updateShowFPS"
    />

    <!-- Mobile Touch Controls - Only show on mobile when game is started -->
    <MobileInterface v-if="isMobile && isGameStarted" />
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
  color: white;
  font-size: 2em;
  margin-bottom: 1em;
  text-align: center;
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
  gap: 1em;
  text-align: center;
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
// Add definePageMeta at the top of your script
definePageMeta({
  layout: 'default',
  layoutProps: {
    title: 'CONQUEST'
  }
});

import { onMounted, onBeforeUnmount, ref, reactive, nextTick, watch, computed } from 'vue';
import { useNuxtApp } from '#app';
import { useLayout } from '../composables/useLayout';

import State from '../lib/game/state.mjs';
import Engine from '../lib/game/engine';

import PlayerManager from '../lib/game/players/playerManager.mjs';
import ControllerManager from '../lib/game/controllers/controllerManager.mjs';
import InputManager from '../lib/game/controllers/inputManager.mjs';
import GamepadInput from '../lib/game/controllers/inputs/gamepad.mjs';
import MobileInterface from '../components/game/MobileInterface.vue';
import Settings from '../components/game/Settings.vue';
import Gear from '../components/icons/Gear.vue';

const { setLayout } = useLayout()

// Add default control mode
const defaultControlMode = 'fps';

// Helper functions should be defined first
const updateControlsHint = () => {
  if (State.isMobile) {
    return `
      <ul>
        <li>Left virtual joystick: Move</li>
        <li>Swipe screen: Look around</li>
        <li>Jump button: Jump</li>
        <li>Sprint button: Sprint/Run</li>
      </ul>
    `;
  } 
  if (hasGamepad.value) {
    const type = ControllerManager.inputState.gamepad.type;
    const jumpBtn = type === 'xbox' ? 'A' : 'X';
    const sprintBtn = type === 'xbox' ? 'Left Stick Click' : 'L3';
    return `
      <ul>
        <li>Left Stick: Move</li>
        <li>Right Stick: Look around</li>
        <li>${jumpBtn} button: Jump</li>
        <li>${sprintBtn}: Sprint/Run</li>
      </ul>
    `;
  }
  return `
    <ul>
      <li>WASD: Move</li>
      <li>Mouse: Look around</li>
      <li>Space: Jump</li>
      <li>Shift: Sprint/Run</li>
    </ul>
  `;
};

// Single source of truth for game state
const reactiveState = reactive({
    isGameStarted: State.isGameStarted,
    isMobile: State.isMobile,
    isSafari: State.isSafari,
    showFPS: State.showFPS,
    isFullscreen: State.isFullscreen,
    isEngineInitialized: false // Add this to reactiveState
});

// All refs declared in one place
const hasGamepad = ref(false);
const connectedGamepads = reactive([]);
const deviceType = ref('');
const canvas = ref(null);
const gameContainer = ref(null);
const controlMode = ref('fps');
const showSettings = ref(false);
const showGamepadPrompt = ref(true);
const formattedControlsHint = ref(updateControlsHint());
const isControllerReady = ref(false);
const selectedMode = ref('fps');
const joystickZone = ref(null);
let pollGamepads;
let joystick = null;

// Add these as class fields after other refs
const isRequestingFullscreen = ref(false);
const fullscreenAttempts = ref(0);
const maxFullscreenAttempts = 2;

// All computed properties in one place
const isGameStarted = computed(() => reactiveState.isGameStarted);
const isMobile = computed(() => reactiveState.isMobile);
const isSafari = computed(() => reactiveState.isSafari);
const showFPS = computed(() => reactiveState.showFPS);
const isEngineInitialized = computed(() => State.isEngineInitialized); // Add this computed
const startPromptText = computed(() => {
    if (hasGamepad.value) return 'Press any button to start';
    if (isControllerReady.value) return 'Click again to start game';
    return 'Click to connect controller';
});

const getControllerName = (gamepad) => {
  if (!gamepad) return 'Unknown Controller';
  const type = ControllerManager.getGamepadType(gamepad);
  if (type === 'xbox') return 'Xbox Controller';
  if (type === 'playstation') return 'PlayStation Controller';
  return 'Game Controller';
};

const updateDeviceType = () => {
  const device = isMobile.value ? 'MOBILE' : 'DESKTOP';
  const input = hasGamepad.value ? ' + CONTROLLER' : '';
  deviceType.value = device + input;
};

const switchControlMode = () => {
  ControllerManager.switchMode(controlMode.value);
  togglePlayerVisibility(controlMode.value);
};

const togglePlayerVisibility = (mode) => {
  if (PlayerManager.protagonist) {
    if (mode === 'thirdperson') {
      PlayerManager.protagonist.mesh.visible = true;
    } else {
      PlayerManager.protagonist.mesh.visible = false;
    }
  }
};

const { $layout } = useNuxtApp();

// Modify the start function to handle initialization order
const start = async () => {
    if (!canvas.value) {
        throw new Error('Canvas element not found');
    }

    try {
        // Initialize engine first
        const engineSetupSuccess = await Engine.setup(canvas.value);
        if (!engineSetupSuccess) {
            throw new Error('Engine setup failed');
        }

        // Initialize controls after engine setup
        const controllerSetupSuccess = await ControllerManager.setup();
        if (!controllerSetupSuccess) {
            throw new Error('Controller setup failed');
        }
        
        // Initialize input systems last
        const inputSetupSuccess = await InputManager.setup();
        if (!inputSetupSuccess) {
            throw new Error('Input setup failed');
        }

        // Set game running state after all systems are initialized
        State.setGameStarted(true);
        InputManager.setGameRunning(true);

        return true;
    } catch (err) {
        console.error('Failed to start game:', err);
        State.setGameStarted(false);
        await cleanup();
        throw err;
    }
};

// Add this function to check initial gamepads
const checkInitialGamepads = () => {
  if (!process.client) return;
  
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let gamepad of gamepads) {
    if (gamepad) {
      hasGamepad.value = true;
      connectedGamepads.splice(0, connectedGamepads.length, gamepad);
      updateDeviceType();
      formattedControlsHint.value = updateControlsHint();
      break;
    }
  }
};

// Define listener functions to allow removal
const onOpenSettings = () => {
  if (isGameStarted.value) {
    toggleSettings();
  }
};

const onDoubleEsc = () => {
  if (isGameStarted.value) {
    toggleSettings();
  }
};

// Single consolidated onMounted block
onMounted(() => {
  if (!process.client) return;
  
  nextTick(() => {
    if (canvas.value) {
      canvas.value.width = canvas.value.offsetWidth || window.innerWidth;
      canvas.value.height = canvas.value.offsetHeight || window.innerHeight;
    }
  });

  checkInitialGamepads();

  const promptStatus = localStorage.getItem('shown-gamepad-prompt');
  showGamepadPrompt.value = promptStatus !== 'false';

  // Initialize mobile detection
  detectMobile();
  window.addEventListener('resize', detectMobile);

  // Initialize gamepad detection and checking
  window.addEventListener('gamepadconnected', onGamepadConnect);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnect);
  
  // Start gamepad polling with all checks
  const updateGamepads = () => {
    pollGamepads = requestAnimationFrame(updateGamepads);
  };
  updateGamepads();

  // Listen for settings events
  ControllerManager.on('openSettings', onOpenSettings);
  ControllerManager.on('doubleEsc', onDoubleEsc);

  // Add pointer lock change listener
  document.addEventListener('pointerlockchange', handlePointerLockChange);

  // Initialize canvas size
  if (canvas.value) {
    canvas.value.width = canvas.value.offsetWidth;
    canvas.value.height = canvas.value.offsetHeight;
  }

  // Add fullscreen change listeners
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('mozfullscreenchange', handleFullscreenChange);
  document.addEventListener('MSFullscreenChange', handleFullscreenChange);
});

// Single consolidated onBeforeUnmount block
onBeforeUnmount(() => {
  setLayout('default');
  window.removeEventListener('gamepadconnected', onGamepadConnect);
  window.removeEventListener('gamepaddisconnected', onGamepadDisconnect);
  window.removeEventListener('resize', detectMobile);
  document.removeEventListener('pointerlockchange', handlePointerLockChange);
  
  if (pollGamepads) {
    cancelAnimationFrame(pollGamepads);
  }

  cleanup();
  
  ControllerManager.off('openSettings', onOpenSettings);
  ControllerManager.off('doubleEsc', onDoubleEsc);
  InputManager.computerInput?.setGameStarted(false);

  // Remove fullscreen change listeners
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
  document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
});

const isTouchDevice = () => {
  return window.matchMedia('(pointer: coarse)').matches;
};

const detectMobile = () => {
  // Check if device is mobile using touch capability and screen size
  State.setMobile(isTouchDevice() && window.innerWidth <= 768);
  updateDeviceType();
};

const onGamepadConnect = (e) => {
  hasGamepad.value = true;
  // Update the type and connected gamepads
  updateDeviceType();
  connectedGamepads.splice(0, connectedGamepads.length, e.gamepad);
  // Update the controls hint when gamepad connects
  formattedControlsHint.value = updateControlsHint();
};

const onGamepadDisconnect = (e) => {
  connectedGamepads.splice(0, connectedGamepads.length);
  hasGamepad.value = false;
  updateDeviceType();
  formattedControlsHint.value = updateControlsHint();
};

const initTouchControls = () => {
  if (typeof window === 'undefined' || !joystickZone.value || !isMobile.value) return;

  import('nipplejs').then(({ default: nipplejs }) => {
    joystick = nipplejs.create({
      zone: joystickZone.value,
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      color: 'white',
      size: 120
    });

    joystick.on('move', (evt, data) => {
      if (data.vector.y > 0.3) ControllerManager.setInput('mobile', 'forward', true);
      if (data.vector.y < -0.3) ControllerManager.setInput('mobile', 'back', true);
      if (data.vector.x > 0.3) ControllerManager.setInput('mobile', 'right', true);
      if (data.vector.x < -0.3) ControllerManager.setInput('mobile', 'left', true);
    });

    joystick.on('end', () => {
      ControllerManager.setInput('mobile', 'forward', false);
      ControllerManager.setInput('mobile', 'back', false);
      ControllerManager.setInput('mobile', 'left', false);
      ControllerManager.setInput('mobile', 'right', false);
    });
  }).catch(err => {
    console.error('Failed to load nipplejs:', err);
  });
};

const handleJump = () => {
  ControllerManager.setInput('mobile', 'jump', true);
};

const handleJumpEnd = () => {
  ControllerManager.setInput('mobile', 'jump', false);
};

const handleSprint = () => {
  ControllerManager.setInput('mobile', 'sprint', true);
};

const handleSprintEnd = () => {
  ControllerManager.setInput('mobile', 'sprint', false);
};

// Move the watch after all refs are defined
watch([isMobile, hasGamepad], () => {
  updateDeviceType();
  formattedControlsHint.value = updateControlsHint();
});

// Game start handler

// Modify handleGameStart to set game state before engine setup
const handleGameStart = async (event) => {
    if (showSettings.value || reactiveState.isGameStarted || isRequestingFullscreen.value) return;
    
    if (!State.isControllersInitialized) {
        console.error('Controllers not initialized');
        // Optionally, display a user-friendly message
        return;
    }

    try {
        if (event) event.stopPropagation();
        isRequestingFullscreen.value = true;

        // 1. Initialize engine and player first
        await Engine.setup(canvas.value);
        
        // 2. Verify player and controller setup
        if (!PlayerManager.getProtagonist()) {
            throw new Error('Failed to create player');
        }

        if (!ControllerManager.isInitialized) {
            throw new Error('Controllers not initialized');
        }

        // 3. Set game state after setup verification
        Engine.setGameStarted(true);
        State.setGameStarted(true);
        setLayout('fullscreen');

        // 4. Request fullscreen after successful initialization
        const container = gameContainer.value;
        if (container?.requestFullscreen) {
            await container.requestFullscreen();
        }

        // 5. Finally request pointer lock
        const gameCanvas = document.getElementById('gameCanvas');
        if (gameCanvas?.requestPointerLock) {
            gameCanvas.requestPointerLock();
        }

    } catch (err) {
        console.error('Failed to start game:', err);
        exitFullscreenAndGame();
    } finally {
        isRequestingFullscreen.value = false;
        fullscreenAttempts.value = 0;
    }
};

// Simplify cleanup
const cleanup = () => {
    if (!reactiveState.isGameStarted) return;
    
    State.setGameStarted(false);
    InputManager.setGameRunning(false);
    Engine.cleanup();
    setLayout('default');
};

// Add the updateShowFPS method
const updateShowFPS = (value) => {
  State.setShowFPS(value);
  Engine.setShowFPS(value);
};

// Add pointer lock change handler
const handlePointerLockChange = () => {
  ControllerManager.handlePointerLockChange();
};

const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};

const updateControlMode = (newMode) => {
  controlMode.value = newMode;
  ControllerManager.switchMode(newMode);
};

// Add new helper method to handle exiting
const exitFullscreenAndGame = async () => {
    if (document.fullscreenElement) {
        try {
            await document.exitFullscreen();
        } catch (error) {
            console.error('Failed to exit fullscreen:', error);
        }
    }
    Engine.setGameStarted(false);
    State.setGameStarted(false);
    setLayout('default');
    
    // Force cleanup of all systems
    Engine.cleanup();
    ControllerManager.cleanup();
    InputManager.cleanup();
};

// Add fullscreen change listener
const handleFullscreenChange = () => {
    const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    );
    
    State.setFullscreen(isFullscreen);
    
    if (!isFullscreen && reactiveState.isGameStarted) {
        cleanup();
    }
};

// Replace the State.on listener with watch statements
watch(() => State.isGameStarted, (value) => {
    reactiveState.isGameStarted = value;
});

watch(() => State.isMobile, (value) => {
    reactiveState.isMobile = value;
});

watch(() => State.isSafari, (value) => {
    reactiveState.isSafari = value;
});

watch(() => State.showFPS, (value) => {
    reactiveState.showFPS = value;
});

watch(() => State.isEngineInitialized, (value) => {
    reactiveState.isEngineInitialized = value;
});
</script>