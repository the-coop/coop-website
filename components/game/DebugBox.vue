<template>
  <div class="debug-box">
    <h3>Debug Info</h3>
    <div class="debug-row">
      <span>Player Position:</span>
      <span>{{ formatVector(playerPos) }}</span>
    </div>
    <div class="debug-row">
      <span>Player Velocity:</span>
      <span>{{ formatVector(playerVel) }}</span>
    </div>
    <div class="debug-row">
      <span>Planet SOI:</span>
      <span>{{ playerSoi }}</span>
    </div>
    <div class="debug-row">
      <span>Falling:</span>
      <span :class="playerFalling ? 'status-bad' : 'status-good'">
        {{ playerFalling ? 'Yes' : 'No' }}
      </span>
    </div>
    <div class="debug-row">
      <span>Vehicles:</span>
      <span>{{ vehicleCount }} (Cars: {{ carCount }}, Airplanes: {{ airplaneCount }})</span>
    </div>
    <div class="debug-row">
      <span>Colliding:</span>
      <span :class="isColliding ? 'status-bad' : 'status-good'">
        {{ isColliding ? 'Yes' : 'No' }}
      </span>
    </div>
    <div class="debug-row">
      <span>Collision Objects:</span>
      <span>{{ collisionCount }}</span>
    </div>
    
    <!-- New section for nearby vehicles -->
    <div class="debug-section">
      <h4>Nearby Vehicles</h4>
      <div v-if="nearbyVehicles.length === 0" class="vehicle-row">
        <span>No vehicles nearby</span>
      </div>
      <div v-for="(vehicle, index) in nearbyVehicles" :key="index" class="vehicle-row">
        <span>{{ vehicle.name }} ({{ formatDistance(vehicle.distance) }}m)</span>
        <span :class="vehicle.isOccupied ? 'status-bad' : 'status-good'">
          {{ vehicle.isOccupied ? 'Occupied' : 'Available' }}
        </span>
      </div>
      <div class="vehicle-row" v-if="currentVehicle">
        <span><strong>Current Vehicle:</strong> {{ currentVehicle }}</span>
      </div>
    </div>
    
    <button @click="toggleCollisionDebug">
      {{ showCollisionDebug ? 'Hide Collision Debug' : 'Show Collision Debug' }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Vector3 } from 'three';
import PlayersManager from '../../lib/game/players.mjs';
import VehicleManager from '../../lib/game/vehicles.mjs';
import ObjectManager from '../../lib/game/object.mjs'; // Added import for ObjectManager
import Engine from '../../lib/game/engine.mjs';

const playerPos = ref(new Vector3());
const playerVel = ref(new Vector3());
const playerSoi = ref('None');
const playerFalling = ref(true);
const vehicleCount = ref(0);
const carCount = ref(0);
const airplaneCount = ref(0);
const isColliding = ref(false);
const collisionCount = ref(0);
const showCollisionDebug = ref(false);

// New ref for nearby vehicles
const nearbyVehicles = ref([]);
const currentVehicle = ref(null);

// Format vector to readable string
const formatVector = (vec) => {
  if (!vec) return 'N/A';
  return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
};

// Format distance to show only 2 decimal places
const formatDistance = (distance) => {
  return distance.toFixed(2);
};

// Toggle collision debug visualization
const toggleCollisionDebug = () => {
  showCollisionDebug.value = !showCollisionDebug.value;
  if (Engine && Engine.toggleCollisionDebug) {
    Engine.toggleCollisionDebug(showCollisionDebug.value);
  }
};

// Update debug info every 100ms
const updateDebugInfo = () => {
  if (!PlayersManager.self) return;

  // Update player info
  playerPos.value.copy(PlayersManager.self.position || new Vector3());
  playerVel.value.copy(PlayersManager.self.velocity || new Vector3());
  playerSoi.value = PlayersManager.self.soi?.name || 'None';
  playerFalling.value = PlayersManager.self.falling || false;
  
  // Update vehicle counts
  vehicleCount.value = VehicleManager.vehicles.length;
  carCount.value = VehicleManager.vehicles.filter(v => v && v.userData.type === 'car').length;
  airplaneCount.value = VehicleManager.vehicles.filter(v => v && v.userData.type === 'airplane').length;
  
  // Update collision info
  isColliding.value = PlayersManager.self.currentlyColliding || false;
  collisionCount.value = ObjectManager.collidableObjects.length || 0;
  
  // Find and sort nearby vehicles
  if (PlayersManager.self && PlayersManager.self.position) {
    const vehicles = VehicleManager.vehicles
      .filter(v => v && v.position)
      .map(v => ({
        name: v.name || `${v.userData?.type || 'Unknown'} Vehicle`,
        type: v.userData?.type || 'Unknown',
        distance: PlayersManager.self.position.distanceTo(v.position),
        isOccupied: v.userData?.isOccupied || false,
        id: v.userData?.id || v.uuid // Use userData.id first, then fall back to uuid
      }));
    
    // MODIFIED: Only filter for UI display purposes - no cleanup needed
    const filteredVehicles = [];
    const seen = new Set();
    
    vehicles.forEach(vehicle => {
      // Use the vehicle's ID or full name as the unique key
      const key = vehicle.id || vehicle.name;
      if (!seen.has(key)) {
        seen.add(key);
        filteredVehicles.push(vehicle);
      }
    });

    // Sort and limit to 5 closest
    nearbyVehicles.value = filteredVehicles
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    
    // Update current vehicle info
    currentVehicle.value = VehicleManager.currentVehicle ? 
      `${VehicleManager.currentVehicle.name || VehicleManager.currentVehicle.userData?.type || 'Unknown'}` : 
      null;
  }
  
  // Check for all collisions with player's handle for debugging
  if (PlayersManager.self.handle && PlayersManager.self.collidable) {
    const collisions = ObjectManager.checkAllCollisions(PlayersManager.self.handle);
    
    if (collisions && collisions.length > 0) {
      console.log(`Detected ${collisions.length} collisions in debug check`);
      isColliding.value = true;
      
      // Update collision visuals if debug mode is active
      if (showCollisionDebug.value && !PlayersManager.self.currentlyColliding) {
        console.log("Collision detected in debug but not in physics system");
      }
    }
  }
};

let debugInterval;

onMounted(() => {
  debugInterval = setInterval(updateDebugInfo, 100);
});

onBeforeUnmount(() => {
  clearInterval(debugInterval);
  // Make sure to disable collision debug when component unmounts
  if (Engine && Engine.toggleCollisionDebug) {
    Engine.toggleCollisionDebug(false);
  }
});
</script>

<style scoped>
.debug-box {
  position: absolute;
  top: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-family: monospace;
  z-index: 1000;
  max-width: 300px;
}

h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.2em;
}

/* Add styling for the new section */
.debug-section {
  margin-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 5px;
}

h4 {
  margin: 5px 0;
  font-size: 1em;
}

.debug-row, .vehicle-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.vehicle-row {
  font-size: 0.9em;
}

.status-good {
  color: #4CFF00;
}

.status-bad {
  color: #FF004C;
}

button {
  margin-top: 10px;
  width: 100%;
  padding: 5px;
  background-color: #333;
  color: white;
  border: 1px solid #666;
  border-radius: 3px;
  cursor: pointer;
}

button:hover {
  background-color: #555;
}
</style>
