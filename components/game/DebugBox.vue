<template>
  <div class="debug-box">
    <h3>Physics Debug</h3>
    <div class="debug-section">
      <h4>Player</h4>
      <div><span>Position:</span> {{ formatVector(player.position) }}</div>
      <div><span>Velocity:</span> {{ formatVector(player.velocity) }} ({{ getSpeed() }})</div>
      <div><span>Falling:</span> {{ player.falling ? "Yes" : "No" }}</div>
      <div><span>Surface Normal:</span> {{ formatVector(player.surfaceNormal) }}</div>
    </div>
    <div class="debug-section">
      <h4>Planet</h4>
      <div><span>Current SOI:</span> {{ player.soi?.name || "None" }}</div>
      <div><span>Planet Radius:</span> {{ player.soi?.radius.toFixed(2) || "N/A" }}</div>
      <div><span>Distance to Center:</span> {{ distanceToPlanet.toFixed(2) }}</div>
      <div><span>Height Above Surface:</span> {{ surfaceDistance.toFixed(2) }}</div>
      <div><span>Friction:</span> {{ player.soi?.CoF || "N/A" }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import PlayersManager from '../../lib/game/players.mjs';

// Get player data
const player = computed(() => PlayersManager.self);

// Calculate distance to planet's center
const distanceToPlanet = computed(() => {
  if (!player.value?.soi) return 0;
  return player.value.position.distanceTo(player.value.soi.object.position);
});

// Calculate distance to planet's surface
const surfaceDistance = computed(() => {
  if (!player.value?.soi) return 0;
  return distanceToPlanet.value - player.value.soi.radius;
});

// Format vector for display
const formatVector = (vector) => {
  if (!vector) return "N/A";
  return `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)})`;
};

// Get current speed
const getSpeed = () => {
  if (!player.value?.velocity) return "0.00";
  return player.value.velocity.length().toFixed(2);
};
</script>

<style scoped>
.debug-box {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #00ff00;
  padding: 10px;
  border-radius: 5px;
  font-family: monospace;
  font-size: 12px;
  width: 300px;
  z-index: 1000;
}

h3 {
  margin: 0 0 10px 0;
  text-align: center;
  font-size: 14px;
}

h4 {
  margin: 5px 0;
  font-size: 13px;
}

.debug-section {
  margin-bottom: 10px;
  padding: 5px;
  border-top: 1px solid rgba(0, 255, 0, 0.3);
}

span {
  font-weight: bold;
  margin-right: 5px;
}
</style>
