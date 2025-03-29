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
      <div><span>Current SOI:</span> {{ player.soi?.name || "Unknown" }}</div>
      <div><span>Planet Radius:</span> {{ player.soi?.radius.toFixed(2) || "N/A" }}</div>
      <div><span>Distance to Center:</span> {{ distanceToPlanet.toFixed(2) }}</div>
      <div><span>Height Above Surface:</span> {{ surfaceDistance.toFixed(2) }}</div>
      <div><span>Friction:</span> {{ player.soi?.CoF || "N/A" }}</div>
    </div>
    <div class="debug-section">
      <h4>Collisions</h4>
      <div><span>Last Object:</span> {{ lastCollisionObject }}</div>
      <div><span>Hit Normal:</span> {{ formatVector(lastCollisionNormal) }}</div>
      <div><span>Collision Time:</span> {{ lastCollisionTime.toFixed(4) }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import PlayersManager from '../../lib/game/players.mjs';

// Get player data
const player = computed(() => PlayersManager.self);

// Collision tracking
const lastCollisionObject = ref("None");
const lastCollisionNormal = ref(null);
const lastCollisionTime = ref(0);

// Watch for changes in player state to detect collisions
watch(() => player.value?.velocity, (newVal, oldVal) => {
  if (newVal && oldVal) {
    // If velocity direction changed significantly, assume collision
    if (newVal.clone().normalize().dot(oldVal.clone().normalize()) < 0.9) {
      lastCollisionTime.ref = performance.now() / 1000;
      // Using surfaceNormal as a proxy for collision normal
      if (player.value?.surfaceNormal) {
        lastCollisionNormal.value = player.value.surfaceNormal.clone();
        lastCollisionObject.value = player.value.soi?.name || "Unknown";
      }
    }
  }
}, { deep: true });

// Calculate distance to planet's center
const distanceToPlanet = computed(() => {
  if (!player.value?.soi?.object?.position || !player.value?.position) return 0;
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
