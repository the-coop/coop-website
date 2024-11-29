<template>
  <div class="game-container" @click="handleGameStart">
    <canvas ref="canvas"></canvas>
    
    <!-- Game Start UI -->
    <div v-if="!isGameStarted" class="game-start">
      <div class="device-type">{{ deviceType }}</div>
      <div class="start-prompt">Play Game</div>
      <div class="controls-list" v-html="formattedControlsHint"></div>
    </div>

    <!-- Game UI - Only show when game is started -->
    <div v-if="isGameStarted" class="game-ui">
      <!-- Control Mode Switcher -->
      <div class="control-switcher">
        <select v-model="controlMode" @change="switchControlMode">
          <option value="fps">First-Person</option>
          <option value="thirdperson">Third-Person</option>
          <option value="orbit">Orbit</option>
        </select>
      </div>

      <!-- Connected Controllers List -->
      <div class="controllers-list" v-if="connectedGamepads.length > 0">
        <span v-for="gamepad in connectedGamepads" :key="gamepad.index" class="controller-item">
          {{ getControllerName(gamepad) }}
        </span>
      </div>
    </div>

    <!-- Mobile Touch Controls - Only show on mobile when game is started -->
    <div v-if="isMobile && isGameStarted" class="mobile-controls">
      <!-- Wrap joystick in client-only -->
      <ClientOnly>
        <!-- Virtual joystick for movement -->
        <div class="touch-joystick" ref="joystickZone"></div>
      </ClientOnly>
      
      <!-- Action buttons -->
      <div class="touch-buttons">
        <button class="touch-button jump-button" @touchstart="handleJump" @touchend="handleJumpEnd">
          Jump
        </button>
        <button class="touch-button sprint-button" @touchstart="handleSprint" @touchend="handleSprintEnd">
          Sprint
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  position: relative;
  height: 100vh; /* Use vh instead of dvh for better compatibility */
  width: 100vw;
  overflow: hidden;
}

.game-start {
  position: fixed;
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

.control-switcher {
  background: rgba(0, 0, 0, 0.7);
  padding: 0.5em;
  border-radius: 0.5em;
}

.control-switcher select {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  padding: 0.3em 0.6em;
  border-radius: 0.3em;
  font-size: 0.9em;
  cursor: pointer;
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
</style>

<script setup>
import { onMounted, onBeforeUnmount, ref, reactive, nextTick, watch } from 'vue';
import Engine from '../lib/game/engine';
import ControllerManager from '../lib/game/controllers/controllerManager.mjs';
import PlayerManager from '../lib/game/players/playerManager.mjs';
import InputManager from '../lib/game/controllers/inputManager.mjs';

definePageMeta({ layout: 'fullscreen' });

const canvas = ref(null);
const isGameStarted = ref(false);
const hasActiveController = ref(false);
const hasGamepad = ref(false);
const connectedGamepads = reactive([]);
let pollGamepads;

const showGamepadPrompt = ref(true);
const defaultControlMode = 'fps';
const controlMode = ref(defaultControlMode);
const isMobile = ref(false);
const gamepadType = ref(null);
const deviceType = ref('');

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

const start = (usingGamepad = false) => {
  if (isGameStarted.value) return;

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

  Engine.loop();

  if (isMobile.value) {
    nextTick(() => {
      initTouchControls();
    });
  }

  if (!usingGamepad && controlMode.value === 'fps') {
    requestAnimationFrame(() => document.body.requestPointerLock());
  }
};

const checkGamepadStart = () => {
  if (!isGameStarted.value) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let gamepad of gamepads) {
      if (gamepad && gamepad.buttons.some(btn => btn.pressed)) {
        hasActiveController.value = true;
        connectedGamepads.splice(0, connectedGamepads.length, gamepad);
        start(true);
        break;
      }
    }
  } else {
    const gamepads = Engine.getConnectedGamepads();
    connectedGamepads.splice(0, connectedGamepads.length, ...gamepads.filter(gp => gp !== null));
  }
};

onMounted(() => {
  const promptStatus = localStorage.getItem('shown-gamepad-prompt');
  showGamepadPrompt.value = promptStatus !== 'false';

  const updateGamepads = () => {
    checkGamepadStart();
    pollGamepads = requestAnimationFrame(updateGamepads);
  };
  updateGamepads();
});

onBeforeUnmount(() => {
  Engine.cleanup();
  if (pollGamepads) {
    cancelAnimationFrame(pollGamepads);
  }
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
  isGameStarted.value = false;
  hasGamepad.value = false;
});

const handleDrag = (e) => {
  const currentController = ControllerManager.currentController;
  const isOrbit = currentController && currentController.constructor.name.toLowerCase().includes('orbit');
  if (!isOrbit) {
    e.preventDefault();
    e.stopPropagation();
  }
};

onMounted(() => {
  const gameContainer = document.querySelector('.game-container');
  if (gameContainer) {
    gameContainer.addEventListener('dragstart', handleDrag);
    gameContainer.addEventListener('drag', handleDrag);
  }
});

onBeforeUnmount(() => {
  const gameContainer = document.querySelector('.game-container');
  if (gameContainer) {
    gameContainer.removeEventListener('dragstart', handleDrag);
    gameContainer.removeEventListener('drag', handleDrag);
  }
});

const isTouchDevice = () => {
  return window.matchMedia('(pointer: coarse)').matches;
};

const detectMobile = () => {
  isMobile.value = isTouchDevice();
};

const detectGamepadType = (gamepad) => {
  if (!gamepad) return null;
  const id = gamepad.id.toLowerCase();
  if (id.includes('xbox')) return 'xbox';
  if (id.includes('054c') || id.includes('playstation') || id.includes('ps4') || id.includes('ps5')) {
    return 'playstation';
  }
  return null;
};

const onGamepadConnect = (e) => {
  hasActiveController.value = true;
  hasGamepad.value = true;
  gamepadType.value = detectGamepadType(e.gamepad);
  connectedGamepads.splice(0, connectedGamepads.length, e.gamepad);
};

onMounted(() => {
  detectMobile();
  window.addEventListener('gamepadconnected', onGamepadConnect);
  checkGamepadInput();
});

onBeforeUnmount(() => {
  window.removeEventListener('gamepadconnected', onGamepadConnect);
  document.removeEventListener('pointerlockchange', handlePointerLockChange);
});

const getControllerName = (gamepad) => {
  const id = gamepad.id.toLowerCase();
  if (id.includes('xbox')) return 'Xbox Controller';
  if (id.includes('054c') || id.includes('playstation')) return 'PlayStation Controller';
  return 'Generic Controller';
};

const handlePointerLockChange = () => {
  if (document.pointerLockElement) {
    isGameStarted.value = true;
  } else {
    // Ensure canvas resizes correctly when pointer lock changes
    const canvasElement = canvas.value;
    if (canvasElement) {
      canvasElement.style.width = '100%';
      canvasElement.style.height = '100%';
    }
  }
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

const updateDeviceType = () => {
  const device = isMobile.value ? 'MOBILE' : 'DESKTOP';
  const input = hasGamepad.value ? ' + CONTROLLER' : '';
  deviceType.value = device + input;
};

const updateControlsHint = () => {
  let hint = '';
  if (isMobile.value) {
    hint = `
      <ul>
        <li>Left virtual joystick: Move</li>
        <li>Swipe screen: Look around</li>
        <li>Jump button: Jump</li>
        <li>Sprint button: Sprint/Run</li>
      </ul>
    `;
  } else if (hasGamepad.value) {
    const jumpBtn = gamepadType.value === 'xbox' ? 'A' : 'X';
    const sprintBtn = gamepadType.value === 'xbox' ? 'Left Stick Click' : 'L3';
    hint = `
      <ul>
        <li>Left Stick: Move</li>
        <li>Right Stick: Look around</li>
        <li>${jumpBtn} button: Jump</li>
        <li>${sprintBtn}: Sprint/Run</li>
      </ul>
    `;
  } else {
    hint = `
      <ul>
        <li>WASD: Move</li>
        <li>Mouse: Look around</li>
        <li>Space: Jump</li>
        <li>Shift: Sprint/Run</li>
      </ul>
    `;
  }
  return hint.replace(/\n/g, '<br>');
};

const formattedControlsHint = ref(updateControlsHint());

watch([isMobile, hasGamepad, gamepadType], () => {
  updateDeviceType();
  formattedControlsHint.value = updateControlsHint();
});

// Game start handler
const handleGameStart = () => {
  if (!isGameStarted.value) {
    start();
  }
};

// Check for gamepad input
const checkGamepadInput = () => {
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
  requestAnimationFrame(checkGamepadInput);
};

// Initialize gamepad detection
onMounted(() => {
  // Start checking for gamepad input
  checkGamepadInput();

  // Listen for gamepad connections
  window.addEventListener('gamepadconnected', () => {
    hasGamepad.value = true;
  });
});

onBeforeUnmount(() => {
  isGameStarted.value = false;
  Engine.isGameStarted = false; // Reset the flag in the Engine class
});
</script>