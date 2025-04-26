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

// Format vector to readable string
const formatVector = (vec) => {
  if (!vec) return 'N/A';
  return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
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

.debug-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
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
