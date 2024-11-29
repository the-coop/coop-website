<template>
  <div class="game-container" :class="{ fullscreen: isGameStarted }" @click="handleGameStart">
    <canvas ref="canvas"></canvas>
    
    <!-- Game Start UI -->
    <div v-if="!isGameStarted" class="game-start">
      <div class="device-type">{{ deviceType }}</div>
      <div class="start-content">
        <div class="start-prompt">
          {{ startPromptText }}
        </div>
        <div class="controls-list" v-html="formattedControlsHint"></div>
        <button class="settings-button start-settings-button" @click.stop="toggleSettings">
          <Gear class="gear-icon" />
          Settings
        </button>
      </div>
    </div>

    <!-- Game UI - Only show when game is started -->
    <div v-if="isGameStarted" class="game-ui">
      <!-- Settings Button -->
      <button class="settings-button" @click.stop="toggleSettings">
        <Gear class="gear-icon" />
      </button>

      <!-- Connected Controllers List -->
      <div class="controllers-list" v-if="connectedGamepads.length > 0">
        <span v-for="gamepad in connectedGamepads" :key="gamepad.index" class="controller-item">
          {{ getControllerName(gamepad) }}
        </span>
      </div>
    </div>

    <!-- Settings Overlay -->
    <Settings 
      :show="showSettings"
      :control-mode="controlMode"
      :game-started="isGameStarted"
      @close="toggleSettings"
      @update-control-mode="updateControlMode"
      @updateShowFPS="updateShowFPS"
    />

    <!-- Mobile Touch Controls - Only show on mobile when game is started -->
    <MobileControls v-if="isMobile && isGameStarted" />
  </div>
</template>

<style scoped>
.game-container {
  position: relative;
  height: calc(100vh - 120px); /* Account for logo and padding */
  width: 100%;
  overflow: hidden;
  border-radius: 8px; /* Optional: adds nice rounded corners before game starts */
}

canvas {
  height: 100% !important;
  width: 100% !important;
}

.game-start {
  position: absolute; /* Changed from fixed to absolute */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.8);
  cursor: pointer;
  z-index: 100;
}

/* When game is started, make container fullscreen */
.game-container.fullscreen {
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

.controls-list {
  color: #aaa;
  font-size: 1.2em;
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
  padding: 1em;
}

.controls-list ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.controls-list li {
  margin: 0.5em 0;
  line-height: 1.4;
}

.start-button {
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

.start-button:hover {
  transform: scale(1.05);
  background-color: rgba(255, 204, 0, 1);
}

.start-hint {
  color: white;
  font-size: 1em;
  margin: 0;
  line-height: 1.5;
}

.game-ui {
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

.device-type {
  position: absolute;
  top: 1em;
  left: 1em;
  color: white;
  font-size: 1.2em;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.5em 1em;
  border-radius: 0.5em;
}

.settings-button {
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

.gear-icon {
  width: 100%;
  height: 100%;
  fill: white;
}

.settings-button:hover {
  background: rgba(0, 0, 0, 0.9);
}

.start-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1em;
  text-align: center;
}

.start-settings-button {
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

.start-settings-button .gear-icon {
  width: 20px;
  height: 20px;
}

.start-settings-button:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

<script setup>
// Set the layout to fullscreen
import { onMounted, onBeforeUnmount, ref, reactive, nextTick, watch, computed } from 'vue';
import Engine from '../lib/game/engine';
import ControllerManager from '../lib/game/controllers/controllerManager.mjs';
import PlayerManager from '../lib/game/players/playerManager.mjs';
import InputManager from '../lib/game/controllers/inputManager.mjs';
import Gear from '../components/icons/Gear.vue';
import Settings from '../components/game/Settings.vue';
import GamepadInput from '../lib/game/controllers/inputs/gamepad.mjs';
import MobileControls from '../components/game/MobileControls.vue';
import { useNuxtApp } from '#app';
import { useLayout } from '../composables/useLayout'

const { setLayout } = useLayout()

// Add default control mode
const defaultControlMode = 'fps';

// Helper functions should be defined first
const updateControlsHint = () => {
  if (isMobile.value) {
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
    const jumpBtn = GamepadInput.type === 'xbox' ? 'A' : 'X';
    const sprintBtn = GamepadInput.type === 'xbox' ? 'Left Stick Click' : 'L3';
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

// Reactive references
const hasActiveController = ref(false);
const hasGamepad = ref(false);
const connectedGamepads = reactive([]);
const isMobile = ref(false);
const deviceType = ref('');
const canvas = ref(null);
const isGameStarted = ref(false);
const controlMode = ref('fps');
const showSettings = ref(false);
const showGamepadPrompt = ref(true);
const formattedControlsHint = ref(updateControlsHint());
let pollGamepads;

const showFPS = ref(false);

const updateShowFPS = (value) => {
  showFPS.value = value;
  Engine.setShowFPS(value);
};

// Rest of the existing code...

const getControllerName = (gamepad) => {
  console.log('gamepad debug', gamepad);
  const type = GamepadInput.type;
  if (type === 'xbox') return 'Xbox Controller';
  if (type === 'playstation') return 'PlayStation Controller';
  return 'Generic Controller';
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

const start = (usingGamepad = false) => {
  if (isGameStarted.value) return;
  
  setLayout('fullscreen')

  console.log('Game start clicked');
  isGameStarted.value = true;
  Engine.isGameStarted = true; // Set the flag in the Engine class

  // Setup the game world.
  if (!Engine.scene) Engine.setup(canvas);

  // Create player/self to experience the world.
  if (!PlayerManager.protagonist) {
    const me = PlayerManager.create(Engine.scene, Engine.cam);
    if (me) {
      console.log('Protagonist created:', me);
      controlMode.value = defaultControlMode;
    } else {
      console.error('Failed to create player');
      return;
    }
  } else {
    console.log('Player already exists:', PlayerManager.protagonist);
  }

  // Setup controller manager
  ControllerManager.setup();

  // Setup input manager
  InputManager.setup();

  // Tell ComputerInput that game has started
  InputManager.computerInput?.setGameStarted(true);

  Engine.loop();

  if (isMobile.value) {
    nextTick(() => {
      initTouchControls();
    });
  }

  if (!usingGamepad && controlMode.value === 'fps') {
    requestAnimationFrame(() => ControllerManager.requestPointerLock());
  }
};

// Single consolidated onMounted block
onMounted(() => {
  const promptStatus = localStorage.getItem('shown-gamepad-prompt');
  showGamepadPrompt.value = promptStatus !== 'false';

  // Initialize mobile detection
  detectMobile();
  window.addEventListener('resize', detectMobile);

  // Initialize gamepad detection and checking
  window.addEventListener('gamepadconnected', onGamepadConnect);
  window.addEventListener('gamepaddisconnected', onGamepadDisconnect);
  
  // Start gamepad polling
  const updateGamepads = () => {
    checkGamepadStart();
    pollGamepads = requestAnimationFrame(updateGamepads);
  };
  updateGamepads();

  // Listen for settings events
  ControllerManager.on('openSettings', () => {
    if (isGameStarted.value) {
      toggleSettings();
    }
  });
  
  ControllerManager.on('doubleEsc', () => {
    if (isGameStarted.value) {
      toggleSettings();
    }
  });
});

// Single consolidated onBeforeUnmount block
onBeforeUnmount(() => {
  setLayout('default')
  
  // Cleanup all event listeners
  window.removeEventListener('gamepadconnected', onGamepadConnect);
  window.removeEventListener('gamepaddisconnected', onGamepadDisconnect);
  window.removeEventListener('resize', detectMobile);
  document.removeEventListener('pointerlockchange', handlePointerLockChange);
  
  // Cleanup game state
  Engine.cleanup();
  if (pollGamepads) {
    cancelAnimationFrame(pollGamepads);
  }
  ControllerManager.exitPointerLock();
  isGameStarted.value = false;
  hasGamepad.value = false;
  Engine.isGameStarted = false;

  // Cleanup event listeners
  ControllerManager.off('openSettings', toggleSettings);
  ControllerManager.off('doubleEsc', toggleSettings);
  InputManager.computerInput?.setGameStarted(false);
});

const isTouchDevice = () => {
  return window.matchMedia('(pointer: coarse)').matches;
};

const detectMobile = () => {
  // Check if device is mobile using touch capability and screen size
  isMobile.value = isTouchDevice() && window.innerWidth <= 768;
  updateDeviceType();
};

const onGamepadConnect = (e) => {
  hasActiveController.value = true;
  hasGamepad.value = true;
  // Update the type and connected gamepads
  updateDeviceType();
  connectedGamepads.splice(0, connectedGamepads.length, e.gamepad);
  // Update the controls hint when gamepad connects
  formattedControlsHint.value = updateControlsHint();
};

const onGamepadDisconnect = (e) => {
  connectedGamepads.splice(0, connectedGamepads.length);
  hasGamepad.value = connectedGamepads.length > 0;
  updateDeviceType();
  formattedControlsHint.value = updateControlsHint();
};

const joystickZone = ref(null);
let joystick = null;

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
const handleGameStart = (event) => {
  // Don't start if settings is showing
  if (showSettings.value) return;
  
  if (!isGameStarted.value) {
    start();
  }
};

// Check for gamepad input
const checkGamepadStart = () => {
  if (!isGameStarted.value) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gamepad of gamepads) {
      if (gamepad) {
        hasGamepad.value = true;
        // Check if any button is pressed
        if (gamepad.buttons.some(btn => btn.pressed)) {
          start(true);
          break;
        }
      }
    }
  }
};

const toggleSettings = (event) => {
  if (event) {
    event.stopPropagation();
  }
  showSettings.value = !showSettings.value;
};

const updateControlMode = (mode) => {
  controlMode.value = mode;
  ControllerManager.switchMode(mode);
  togglePlayerVisibility(mode);
};

const startPromptText = computed(() => {
  if (hasGamepad.value) {
    return 'Press any button to start';
  }
  return 'Click to start';
});
</script>