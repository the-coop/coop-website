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
    
    <!-- Enhanced Collisions & Walls section -->
    <div class="debug-section">
      <h3>Collisions & Walls</h3>
      <p>Active Collisions: {{ activeCollisions.length }}</p>
      <div v-if="activeCollisions.length > 0" class="collision-list">
        <div v-for="(collision, index) in activeCollisions" :key="index" class="collision-item">
          <span :class="{'collision-type': true, 'wall-collision': collision.type === 'wall'}">
            {{ collision.type }}
          </span>
          <span class="collision-dist">{{ collision.distance.toFixed(2) }}m</span>
          <!-- Add collision normal display if available -->
          <span v-if="collision.normal" class="collision-normal">
            N:({{ formatNormal(collision.normal) }})
          </span>
        </div>
      </div>
      
      <p>Nearby walls: {{ nearbyWalls.length }}</p>
      <div v-if="nearbyWalls.length > 0" class="wall-list">
        <div v-for="(wall, index) in nearbyWalls" :key="index" 
             :class="{'wall-item': true, 'wall-very-close': wall.distance < 3}">
          <span>{{ wall.name || 'Wall' + index }}</span>
          <span class="wall-dist">{{ wall.distance.toFixed(2) }}m</span>
        </div>
      </div>
      
      <p>Other collidables: {{ nearbyCollidables.length }}</p>
      <div v-if="nearbyCollidables.length > 0" class="collidable-list">
        <div v-for="(obj, index) in nearbyCollidables" :key="index" class="collidable-item">
          <span>{{ obj.type }}</span>
          <span class="collidable-dist">{{ obj.distance.toFixed(2) }}m</span>
        </div>
      </div>
    </div>
    
    <div class="debug-section">
      <h3>Vehicles</h3>
      <p>Total vehicles: {{ vehicleCount }}</p>
      <p>Cars: {{ carCount }}</p>
      <p>Airplanes: {{ airplaneCount }}</p>
      <p>Current vehicle: {{ currentVehicle }}</p>
      <div v-if="inVehicle">
        <p>Position: {{ formatVector(vehiclePos) }}</p>
        <p>Speed: {{ vehicleSpeed.toFixed(2) }}</p>
      </div>
      
      <p>Nearby vehicles:</p>
      <ul v-if="nearbyVehicles.length > 0">
        <li v-for="(vehicle, index) in nearbyVehicles" :key="index">
          {{ vehicle.name }} ({{ vehicle.type }}) - {{ vehicle.distance.toFixed(2) }}m
        </li>
      </ul>
      <p v-else>None in range</p>
    </div>
    <div class="controls">
      <button @click="teleportToNearestVehicle" v-if="vehicleCount > 0">
        Teleport to Nearest Vehicle
      </button>
      <button @click="teleportToNearestCar" v-if="carCount > 0">
        Teleport to Car
      </button>
      <button @click="teleportToNearestAirplane" v-if="airplaneCount > 0">
        Teleport to Airplane
      </button>
      <!-- Added new button to teleport to nearest wall -->
      <button @click="teleportToNearestWall" v-if="nearbyWalls.length > 0">
        Teleport to Nearest Wall
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Vector3 } from 'three';
import PlayersManager from '../../lib/game/players.mjs';
import VehicleManager from '../../lib/game/vehicles.mjs';
import ObjectManager from '../../lib/game/object.mjs'; // Added import for ObjectManager

const playerPos = ref(new Vector3());
const playerVel = ref(new Vector3());
const playerSoi = ref('None');
const playerFalling = ref(true);
const vehicleCount = ref(0);
const carCount = ref(0);
const airplaneCount = ref(0);
const currentVehicle = ref('None');
const inVehicle = ref(false);
const vehicleName = ref('');
const vehiclePos = ref(new Vector3());
const vehicleSpeed = ref(0);
const nearbyVehicles = ref([]);

// New refs for tracking walls and collisions
const nearbyWalls = ref([]);
const nearbyCollidables = ref([]);
const activeCollisions = ref([]);
const lastCollisionTime = ref(0);
const lastCollidedTypes = ref(new Set());

// Format Vector3 to readable string - fixed to work correctly
function formatVector(vector) {
  if (!vector || !vector.x) return 'N/A';
  return `(${vector.x.toFixed(1)}, ${vector.y.toFixed(1)}, ${vector.z.toFixed(1)})`;
}

// Format normal vector to short readable string
function formatNormal(normal) {
  if (!normal) return 'N/A';
  return `${normal.x.toFixed(1)},${normal.y.toFixed(1)},${normal.z.toFixed(1)}`;
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
    teleportToVehicle(closestVehicle);
  }
}

// Teleport to nearest car
function teleportToNearestCar() {
  teleportToVehicleByType('car');
}

// Teleport to nearest airplane
function teleportToNearestAirplane() {
  teleportToVehicleByType('airplane');
}

// NEW: Teleport to nearest wall
function teleportToNearestWall() {
  if (nearbyWalls.value.length === 0) return;
  
  const player = PlayersManager.self;
  if (!player) return;
  
  // Get the nearest wall (already sorted by distance)
  const wall = nearbyWalls.value[0];
  if (wall && wall.object) {
    // Position player near wall
    const teleportPosition = wall.object.position.clone();
    
    // Offset a bit in the direction away from the planet
    if (wall.object.userData && wall.object.userData.surfaceNormal) {
      teleportPosition.add(
        wall.object.userData.surfaceNormal.clone().multiplyScalar(5)
      );
    } else {
      teleportPosition.add(new Vector3(0, 5, 0)); // Default offset
    }
    
    player.position.copy(teleportPosition);
    player.handle.position.copy(teleportPosition);
    
    console.log(`Teleported to wall at (${teleportPosition.x.toFixed(1)}, ${teleportPosition.y.toFixed(1)}, ${teleportPosition.z.toFixed(1)})`);
    
    if (typeof window !== 'undefined' && window.gameNotify) {
      window.gameNotify(`Teleported to wall ${wall.distance.toFixed(1)}m away`);
    }
  }
}

// Helper function to teleport to vehicle by type
function teleportToVehicleByType(vehicleType) {
  if (!VehicleManager.vehicles || VehicleManager.vehicles.length === 0) return;
  
  const player = PlayersManager.self;
  if (!player) return;
  
  let closestVehicle = null;
  let closestDist = Infinity;
  
  // Find closest vehicle of specified type
  for (const vehicle of VehicleManager.vehicles) {
    if (!vehicle || vehicle.userData.type !== vehicleType) continue;
    const dist = player.position.distanceTo(vehicle.position);
    if (dist < closestDist) {
      closestDist = dist;
      closestVehicle = vehicle;
    }
  }
  
  if (closestVehicle) {
    teleportToVehicle(closestVehicle);
  } else {
    if (typeof window !== 'undefined' && window.gameNotify) {
      window.gameNotify(`No ${vehicleType} found to teleport to!`);
    }
  }
}

// Function to teleport to a specific vehicle
function teleportToVehicle(vehicle) {
  if (!vehicle) return;
  
  const player = PlayersManager.self;
  if (!player) return;
  
  // Position player near vehicle
  const teleportPosition = vehicle.position.clone();
  teleportPosition.add(new Vector3(5, 5, 5)); // Offset a bit
  
  player.position.copy(teleportPosition);
  player.handle.position.copy(teleportPosition);
  
  console.log(`Teleported to ${vehicle.userData.name} at (${teleportPosition.x.toFixed(1)}, ${teleportPosition.y.toFixed(1)}, ${teleportPosition.z.toFixed(1)})`);
  
  if (typeof window !== 'undefined' && window.gameNotify) {
    window.gameNotify(`Teleported to ${vehicle.userData.name} (${vehicle.userData.type})`);
  }
}

// NEW: Helper function to check collisions
function checkPlayerCollisions() {
  const player = PlayersManager.self;
  if (!player || !player.handle) return [];
  
  // Check for collisions with all object types
  const collisions = ObjectManager.checkAllCollisions ? 
    ObjectManager.checkAllCollisions(player.handle) :
    [];
  
  return collisions;
}

// Update debug info periodically
const interval = setInterval(() => {
  const player = PlayersManager.self;
  if (player) {
    playerPos.value = player.position;
    playerVel.value = player.velocity;
    playerSoi.value = player.soi?.name || 'None';
    playerFalling.value = player.falling;
    
    // NEW: Check for nearby walls and other collidables
    if (ObjectManager && ObjectManager.collidableObjects) {
      const walls = [];
      const otherCollidables = [];
      
      for (const collidable of ObjectManager.collidableObjects) {
        if (!collidable || !collidable.active || !collidable.object) continue;
        
        // Skip player and current vehicle
        if (collidable.object === player.handle) continue;
        if (inVehicle.value && collidable.object === VehicleManager.currentVehicle) continue;
        
        try {
          const distance = player.position.distanceTo(collidable.object.position);
          
          if (distance < 100) { // Show only objects within 100 units
            const objData = {
              type: collidable.type,
              distance: distance,
              object: collidable.object,
              name: collidable.object.userData?.name || collidable.type
            };
            
            // Separate walls from other collidables
            if (collidable.type === 'wall') {
              walls.push(objData);
            } else {
              otherCollidables.push(objData);
            }
          }
        } catch (e) {
          console.error("Error calculating distance to collidable:", e);
        }
      }
      
      // Sort by distance
      walls.sort((a, b) => a.distance - b.distance);
      otherCollidables.sort((a, b) => a.distance - b.distance);
      
      // Limit to closest objects
      nearbyWalls.value = walls.slice(0, 5);
      nearbyCollidables.value = otherCollidables.slice(0, 5);
      
      // NEW: Check for active collisions
      const currentCollisions = [];
      
      // Method 1: Use ObjectManager's checkAllCollisions if available
      if (ObjectManager.checkAllCollisions && player && player.handle) {
        try {
          const collisions = ObjectManager.checkAllCollisions(player.handle);
          if (collisions && collisions.length > 0) {
            collisions.forEach(collision => {
              if (collision && collision.otherCollidable) {
                currentCollisions.push({
                  type: collision.otherCollidable.type,
                  distance: collision.distance || 0,
                  object: collision.otherCollidable.object,
                  isWall: collision.otherCollidable.type === 'wall',
                  normal: collision.normal, // Capture normal vector for display
                  time: Date.now()
                });
                
                // Highlight wall collisions in console for debugging
                if (collision.otherCollidable.type === 'wall') {
                  console.log(`ACTIVE WALL COLLISION at distance ${collision.distance.toFixed(2)}m, normal: ${formatNormal(collision.normal)}`);
                }
              }
            });
            
            // Update last collision time
            lastCollisionTime.value = Date.now();
            
            // Update set of collided types
            collisions.forEach(collision => {
              if (collision && collision.otherCollidable && collision.otherCollidable.type) {
                lastCollidedTypes.value.add(collision.otherCollidable.type);
              }
            });
          }
        } catch (e) {
          console.error("Error checking collisions:", e);
        }
      } 
      // Method 2: Fallback to simple distance-based check
      else {
        // Consider objects within 2 units to be colliding
        const collisionThreshold = 2.0;
        [...nearbyWalls.value, ...nearbyCollidables.value].forEach(obj => {
          if (obj.distance < collisionThreshold) {
            currentCollisions.push({
              type: obj.type,
              distance: obj.distance,
              object: obj.object,
              time: Date.now()
            });
          }
        });
      }
      
      activeCollisions.value = currentCollisions;
      
      // Expire old collisions after 1 second
      const now = Date.now();
      if (activeCollisions.value.length === 0 && lastCollisionTime.value > 0 && 
          now - lastCollisionTime.value < 1000) {
        // Keep showing "recent" collisions for a second after they stop
        activeCollisions.value = Array.from(lastCollidedTypes.value).map(type => ({
          type,
          distance: 0,
          recent: true
        }));
      } else if (activeCollisions.value.length === 0 && now - lastCollisionTime.value >= 1000) {
        // Clear old collision data after 1 second
        lastCollidedTypes.value.clear();
      }
    }
  }
  
  // Get vehicle information
  if (VehicleManager.vehicles) {
    vehicleCount.value = VehicleManager.vehicles.length;
    
    // Count vehicles by type
    carCount.value = 0;
    airplaneCount.value = 0;
    for (const vehicle of VehicleManager.vehicles) {
      if (!vehicle) continue;
      if (vehicle.userData.type === 'car') carCount.value++;
      if (vehicle.userData.type === 'airplane') airplaneCount.value++;
    }
  }
  
  // Check if player is in a vehicle
  inVehicle.value = !!VehicleManager.currentVehicle;
  
  if (inVehicle.value) {
    const vehicle = VehicleManager.currentVehicle;
    vehicleName.value = vehicle.userData.name || `${vehicle.userData.type}-unknown`;
    currentVehicle.value = `${vehicle.userData.name} (${vehicle.userData.type})`;
    
    // Get vehicle position
    vehiclePos.value = vehicle.position;
    vehicleSpeed.value = Math.abs(vehicle.userData.speed || 0);
  } else {
    vehicleName.value = '';
    currentVehicle.value = 'None';
    vehicleSpeed.value = 0;
  }
  
  // Find nearby vehicles within 100 units
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

.controls {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

button {
  background-color: #4CAF50;
  border: none;
  color: white;
  padding: 5px 10px;
  text-align: center;
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}

/* New styles for collision and wall lists */
.collision-list, .wall-list, .collidable-list {
  margin: 3px 0;
  padding: 3px;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 3px;
  max-height: 80px;
  overflow-y: auto;
}

.collision-item, .wall-item, .collidable-item {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  margin-bottom: 2px;
}

.collision-type {
  color: #ff6b6b;
  font-weight: bold;
}

.collision-dist, .wall-dist, .collidable-dist {
  color: #aaa;
}

.wall-collision {
  color: #ff0000 !important; /* Bright red for wall collisions */
  font-weight: bold;
}

.wall-very-close {
  background-color: rgba(255, 0, 0, 0.3);
  border-radius: 3px;
}

.collision-normal {
  color: #66ccff;
  font-size: 10px;
  margin-left: 4px;
}
</style>
