<template>
  <div class="debug-box">
    <div class="debug-section">
      <h3>Player</h3>
      <p>Position: {{ formatVector(playerPos) }}</p>
      <p>Velocity: {{ formatVector(playerVel) }}</p>
      <p>SOI: {{ playerSoi }}</p>
      <p>Falling: {{ playerFalling }}</p>
      <p>In Vehicle: {{ inVehicle ? 'Yes' : 'No' }}</p>
      <p v-if="inVehicle">Vehicle: {{ vehicleName }}</p>
    </div>
    <div class="debug-section">
      <h3>Vehicles</h3>
      <p>Total vehicles: {{ vehicleCount }}</p>
      <p>Current vehicle: {{ currentVehicle }}</p>
      
      <p>Nearby vehicles:</p>
      <ul v-if="nearbyVehicles.length > 0">
        <li v-for="(vehicle, index) in nearbyVehicles" :key="index">
          {{ vehicle.name }} ({{ vehicle.type }}) - {{ vehicle.distance.toFixed(2) }}m
        </li>
      </ul>
      <p v-else>None in range</p>
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
const currentVehicle = ref('None');
const inVehicle = ref(false);
const vehicleName = ref('');
const nearbyVehicles = ref([]);

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
    if (!vehicle) continue;
    const dist = player.position.distanceTo(vehicle.position);
    if (dist < closestDist) {
      closestDist = dist;
      closestVehicle = vehicle;
    }
  }
  
  if (closestVehicle) {
    // Position player near vehicle
    const teleportPosition = closestVehicle.position.clone();
    teleportPosition.add(new Vector3(5, 5, 5)); // Offset a bit
    
    player.position.copy(teleportPosition);
    player.handle.position.copy(teleportPosition);
    
    console.log(`Teleported to ${closestVehicle.userData.name} at (${teleportPosition.x.toFixed(1)}, ${teleportPosition.y.toFixed(1)}, ${teleportPosition.z.toFixed(1)})`);
    
    if (typeof window !== 'undefined' && window.gameNotify) {
      window.gameNotify(`Teleported to ${closestVehicle.userData.name}`);
    }
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
  
  // Get vehicle information
  vehicleCount.value = VehicleManager.vehicles?.length || 0;
  
  // Check if player is in a vehicle
  inVehicle.value = !!VehicleManager.currentVehicle;
  
  if (inVehicle.value) {
    const vehicle = VehicleManager.currentVehicle;
    vehicleName.value = vehicle.userData.name || `${vehicle.userData.type}-unknown`;
    currentVehicle.value = `${vehicle.userData.name} (${vehicle.userData.type})`;
  } else {
    vehicleName.value = '';
    currentVehicle.value = 'None';
  }
  
  // Find nearby vehicles within 50 units
  nearbyVehicles.value = [];
  if (player && VehicleManager.vehicles) {
    for (const vehicle of VehicleManager.vehicles) {
      if (!vehicle) continue;
      
      const distance = player.position.distanceTo(vehicle.position);
      if (distance < 100) { // Show vehicles within 100 units
        nearbyVehicles.value.push({
          name: vehicle.userData.name || 'Unknown',
          type: vehicle.userData.type,
          distance: distance,
          isOccupied: vehicle.userData.isOccupied
        });
      }
    }
    
    // Sort by distance
    nearbyVehicles.value.sort((a, b) => a.distance - b.distance);
    
    // Limit to 5 closest
    nearbyVehicles.value = nearbyVehicles.value.slice(0, 5);
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
  max-height: 80vh;
  overflow-y: auto;
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

ul {
  margin: 5px 0;
  padding-left: 15px;
}

li {
  font-size: 11px;
  margin-bottom: 2px;
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
