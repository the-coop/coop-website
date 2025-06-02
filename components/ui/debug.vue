<template>
  <div v-if="visible" class="debug-info">
    <div>Mode: {{ gameMode }}</div>
    <div>Position: {{ formatVector(data.position) }}</div>
    <div>Facing: {{ formatVector(data.facing) }}</div>
    <div>Speed: {{ data.currentSpeed.toFixed(2) }} m/s</div>
    <div>Moving: {{ data.isMoving ? 'Yes' : 'No' }}</div>
    <div>Grounded: {{ data.isGrounded ? 'Yes' : 'No' }}</div>
    <div>Swimming: {{ data.isSwimming ? 'Yes' : 'No' }}</div>
    <div v-if="data.inVehicle" class="vehicle-info">In Vehicle</div>
    <div v-if="gameMode === 'multiplayer'">
      <div>Connected: {{ data.connected ? 'Yes' : 'No' }}</div>
      <div>Players Online: {{ data.playersOnline }}</div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  gameMode: {
    type: String,
    default: ''
  },
  data: {
    type: Object,
    default: () => ({
      position: { x: 0, y: 0, z: 0 },
      facing: { x: 0, y: 0, z: -1 },
      currentSpeed: 0,
      isMoving: false,
      isGrounded: false,
      isSwimming: false,
      inVehicle: false,
      connected: false,
      playersOnline: 0
    })
  }
});

// Format vector for display
const formatVector = (vec) => {
  if (!vec) return '0.00, 0.00, 0.00';
  return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
};
</script>

<style scoped>
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

.vehicle-info {
  color: #00ff00;
  font-weight: bold;
  margin-top: 5px;
}
</style>
