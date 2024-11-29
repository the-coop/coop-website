<template>
  <div v-if="show" class="settings-overlay" @click.stop>
    <div class="settings-content">
      <h2>Settings</h2>
      
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

      <button class="close-button" @click="handleClose">Close</button>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import ControllerManager from '../lib/game/controllers/controllerManager.mjs';

const props = defineProps({
  show: Boolean,
  controlMode: String
});

const emit = defineEmits(['close', 'updateControlMode', 'updateShowFPS']);

const selectedMode = ref(props.controlMode);
const showFPS = ref(false);

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
  // Request pointer lock if in FPS mode
  if (selectedMode.value === 'fps') {
    requestAnimationFrame(() => ControllerManager.requestPointerLock());
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
</style>
