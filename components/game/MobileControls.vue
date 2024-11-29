<template>
  <div class="mobile-controls">
    <ClientOnly>
      <div class="touch-joystick" ref="joystickZone"></div>
    </ClientOnly>
    
    <div class="touch-buttons">
      <button class="touch-button jump-button" @touchstart="handleJump" @touchend="handleJumpEnd">
        Jump
      </button>
      <button class="touch-button sprint-button" @touchstart="handleSprint" @touchend="handleSprintEnd">
        Sprint
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import ControllerManager from '../../lib/game/controllers/controllerManager.mjs';

const joystickZone = ref(null);
let joystick = null;

const initTouchControls = () => {
  if (typeof window === 'undefined' || !joystickZone.value) return;

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
  });
};

onMounted(initTouchControls);

const handleJump = () => ControllerManager.setInput('mobile', 'jump', true);
const handleJumpEnd = () => ControllerManager.setInput('mobile', 'jump', false);
const handleSprint = () => ControllerManager.setInput('mobile', 'sprint', true);
const handleSprintEnd = () => ControllerManager.setInput('mobile', 'sprint', false);
</script>

<style scoped>
.mobile-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 200px;
  pointer-events: none;
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
</style>
