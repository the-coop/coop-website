<template>
  <div v-if="show" class="settings-overlay" @click.stop>
    <div class="settings-content">
      <h2>Settings</h2>
      
      <!-- Controllers Section -->
      <div class="setting-group" v-if="localConnectedGamepads.length > 0">
        <label>Connected Controllers:</label>
        <div class="controllers-list">
          <div v-for="gamepad in localConnectedGamepads" :key="gamepad.index" class="controller-item">
            {{ getControllerName(gamepad) }}
          </div>
        </div>
      </div>

      <div class="setting-group">
        <label>Control Mode:</label>
        <select v-model="selectedMode" @change="onControlModeChange">
          <option value="fps">First-Person</option>
          <option value="thirdperson">Third-Person</option>
          <option value="orbit">Orbit</option>
        </select>
      </div>

      <div class="setting-group">
        <label>
          <input type="checkbox" v-model="showFPS" @change="onShowFPSChange" />
          Show FPS
        </label>
      </div>

      <div class="setting-group">
        <label>Aim Sensitivity: {{ sensitivity.toFixed(2) }}</label>
        <input 
          type="range" 
          v-model="sensitivity" 
          min="0.1" 
          max="3" 
          step="0.1"
          class="sensitivity-slider"
          @input="onSensitivityChange"
        />
      </div>

      <button class="close-button" @click="handleClose">Close</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import ControllerManager from '../../lib/game/controllers/controllerManager.mjs';
import GamepadInput from '../../lib/game/controllers/inputs/gamepad.mjs';
import PlayerManager from '../../lib/game/players/playerManager.mjs';
import State from '../../lib/game/state.mjs';

// Fix prop types
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  controlMode: {
    type: String,
    default: 'fps'
  },
  gameStarted: {
    type: Boolean,
    default: false
  },
  connectedGamepads: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'updateControlMode', 'updateShowFPS']);

// Use refs instead of computed for local state
const selectedMode = ref(props.controlMode);
const showFPS = ref(false);
const sensitivity = ref(1.0);
const localConnectedGamepads = ref([]);

// Watch props for changes
watch(() => props.connectedGamepads, (newGamepads) => {
  localConnectedGamepads.value = Array.isArray(newGamepads) ? newGamepads : [];
}, { immediate: true });

watch(() => props.controlMode, (newMode) => {
  selectedMode.value = newMode;
});

const onControlModeChange = () => {
  emit('updateControlMode', selectedMode.value);
};

const onShowFPSChange = () => {
  emit('updateShowFPS', showFPS.value);
};

const handleClose = () => {
  emit('close');
};

const getControllerName = (gamepad) => {
  if (!gamepad) return 'Unknown Controller';
  const id = gamepad.id || 'Unknown ID';
  return `Game Controller (${id})`;
};

onMounted(() => {
  // Set default sensitivity
  sensitivity.value = 1.0;
});

const onSensitivityChange = () => {
  if (ControllerManager.setSensitivity) {
    ControllerManager.setSensitivity(sensitivity.value);
  }
};
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.settings-content {
  background: rgba(30, 30, 30, 0.95);
  padding: 2rem;
  border-radius: 8px;
  min-width: 300px;
  color: white;
}

.setting-group {
  margin: 1rem 0;
}

.setting-group label {
  display: block;
  margin-bottom: 0.5rem;
}

.setting-group select {
  width: 100%;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
}

.close-button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

.controllers-list {
  background: rgba(0, 0, 0, 0.3);
  padding: 0.5em;
  border-radius: 4px;
  margin-top: 0.5em;
}

.controller-item {
  padding: 0.5em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.controller-item:last-child {
  border-bottom: none;
}

.sensitivity-slider {
  width: 100%;
  margin: 10px 0;
  background: rgba(255, 255, 255, 0.1);
  -webkit-appearance: none;
  height: 8px;
  border-radius: 4px;
  outline: none;
}

.sensitivity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}

.sensitivity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
}
</style>
