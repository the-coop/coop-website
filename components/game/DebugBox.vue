<template>
  <div class="debug-box">
    <div class="debug-section">
      <h3>Player</h3>
      <p>Position: {{ formatVector(playerPos) }}</p>
      <p>Velocity: {{ formatVector(playerVel) }}</p>
      <p>SOI: {{ playerSoi }}</p>
      <p>Falling: {{ playerFalling }}</p>
    </div>
    <div class="debug-section">
      <h3>Vehicles</h3>
      <p>Total vehicles: {{ vehicleCount }}</p>
      <p>Nearby vehicle: {{ nearbyVehicle ? 'Yes' : 'No' }}</p>
      <p v-if="nearbyVehicle">Distance: {{ nearbyDistance.toFixed(2) }}</p>
    </div>
    <button @click="teleportToNearestVehicle" v-if="vehicleCount > 0">
      Teleport to Nearest Vehicle
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Vector3 } from 'three';
import PlayersManager from '../../lib/game/players.mjs';
import VehicleManager from '../../lib/game/vehicles.mjs';

const playerPos = ref(new Vector3());
const playerVel = ref(new Vector3());
const playerSoi = ref('None');
const playerFalling = ref(true);
const vehicleCount = ref(0);
const nearbyVehicle = ref(false);
const nearbyDistance = ref(0);

// Format Vector3 to readable string
function formatVector(vector) {
  if (!vector.value) return 'N/A';
  return `(${vector.value.x.toFixed(1)}, ${vector.value.y.toFixed(1)}, ${vector.value.z.toFixed(1)})`;
}

// Teleport player to nearest vehicle for testing
function teleportToNearestVehicle() {
  if (!VehicleManager.vehicles || VehicleManager.vehicles.length === 0) return;
  
  const player = PlayersManager.self;
  if (!player) return;
  
  let closestVehicle = null;
  let closestDist = Infinity;
  
  // Find closest vehicle
  for (const vehicle of VehicleManager.vehicles) {
    const dist = player.position.distanceTo(vehicle.mesh.position);
    if (dist < closestDist) {
      closestDist = dist;
      closestVehicle = vehicle;
    }
  }
  
  if (closestVehicle) {
    // Position player near vehicle
    const teleportPosition = closestVehicle.mesh.position.clone();
    teleportPosition.add(new Vector3(5, 5, 5)); // Offset a bit
    
    player.position.copy(teleportPosition);
    player.handle.position.copy(teleportPosition);
    
    console.log(`Teleported to vehicle at (${teleportPosition.x.toFixed(1)}, ${teleportPosition.y.toFixed(1)}, ${teleportPosition.z.toFixed(1)})`);
  }
}

// Update debug info periodically
const interval = setInterval(() => {
  const player = PlayersManager.self;
  if (player) {
    playerPos.value = player.position.clone();
    playerVel.value = player.velocity.clone();
    playerSoi.value = player.soi?.name || 'None';
    playerFalling.value = player.falling;
  }
  
  vehicleCount.value = VehicleManager.vehicles?.length || 0;
  nearbyVehicle.value = !!VehicleManager.nearbyVehicle;
  
  if (VehicleManager.nearbyVehicle && player) {
    nearbyDistance.value = player.position.distanceTo(VehicleManager.nearbyVehicle.mesh.position);
  }
}, 200);

onBeforeUnmount(() => {
  clearInterval(interval);
});
</script>

<style scoped>
.debug-box {
  position: fixed;
  top: 10px;
  left: 10px;
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 5px;
  font-family: monospace;
  z-index: 1000;
  max-width: 300px;
}

.debug-section {
  margin-bottom: 10px;
}

h3 {
  margin: 0 0 5px 0;
  font-size: 14px;
  color: #4CAF50;
}

p {
  margin: 2px 0;
  font-size: 12px;
}

button {
  background-color: #4CAF50;
  border: none;
  color: white;
  padding: 5px 10px;
  text-align: center;
  font-size: 12px;
  border-radius: 3px;
  cursor: pointer;
}
</style>
