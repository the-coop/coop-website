<template>
  <div>
    <div id="info">
      <div>Use WASD to move, Space to jump, Click to shoot</div>
      <div v-if="!State.connected" class="status disconnected">Connecting...</div>
      <div v-else class="status connected">
        Connected - Players: {{ State.playerCount }}
        <div v-if="State.playerId">Your ID: {{ State.playerId.substring(0, 6) }}</div>
        <div v-if="State.playerHealth !== null">Health: {{ State.playerHealth }}/100</div>
        <div v-if="State.currentVehicle" class="vehicle-info">
          Driving: {{ getVehicleType() }} | Press F to exit
          <div v-if="isHelicopter">Space - Up | Shift/Z - Down | WASD - Move/Turn</div>
          <div v-else-if="isPlane">W - Throttle Up | S - Throttle Down | Space/Shift - Pitch | A/D - Roll</div>
        </div>
        <div v-if="State.carryingGhost" class="carrying-info">
          Carrying object | G - Drop | Click - Throw
        </div>
      </div>
      <div class="controls">
        <div>W/A/S/D - Move</div>
        <div>Space - Jump</div>
        <div>Mouse - Look around</div>
        <div>Click - Shoot/Throw</div>
        <div>F - Enter/Exit vehicle</div>
        <div>G - Grab/Drop object</div>
        <div>O - Toggle third person</div>
        <div>` - Toggle debug info</div>
      </div>
      <div class="crosshair">+</div>
      <div v-if="State.nearbyVehicle && !State.currentVehicle" class="interaction-prompt">
        Press F to enter {{ getVehicleTypeName(State.nearbyVehicle) }}
      </div>
      <div v-if="State.nearbyGhost && !State.carryingGhost && !State.currentVehicle" class="interaction-prompt">
        Press G to grab object
      </div>
    </div>
    <div v-if="State.showDebugInfo" class="debug-info">
      <h3>Debug Info</h3>
      <div v-if="currentPlayer">
        <div>Position: {{ formatVector(currentPlayer.position) }}</div>
        <div>Velocity: {{ formatVector(currentPlayer.velocity) }}</div>
        <div>Speed: {{ getSpeed(currentPlayer.velocity).toFixed(2) }} m/s</div>
        <div>Grounded: {{ currentPlayer.isGrounded ? 'Yes' : 'No' }}</div>
        <div v-if="currentPlayer.groundDistance !== null">Ground Distance: {{ currentPlayer.groundDistance?.toFixed(3) }}</div>
        <div v-if="currentPlayer.groundNormal">Ground Normal: {{ formatVector(currentPlayer.groundNormal) }}</div>
        <div>Camera Mode: {{ State.thirdPerson ? 'Third Person' : 'First Person' }}</div>
        <div>FPS: {{ State.fps }}</div>
        <div v-if="State.currentVehicle && getCurrentVehicle()">
          <div>Vehicle: {{ getCurrentVehicle().type }}</div>
          <div v-if="getCurrentVehicle().type === 'plane'">Throttle: {{ (getCurrentVehicle().throttle * 100).toFixed(0) }}%</div>
          <div v-if="getCurrentVehicle().type === 'helicopter'">Altitude: {{ getCurrentVehicle().position.y.toFixed(1) }}m</div>
        </div>
      </div>
    </div>
    <div ref="gameContainer" class="game-container" />
  </div>
</template>

<script setup>
import { VehicleTypes } from '@game/shared'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { Engine } from '~/lib/engine'
import { Entities } from '~/lib/entities'
import { Vehicles } from '~/lib/vehicles'
import { State } from '~/lib/state'

const gameContainer = ref(null)

const currentPlayer = computed(() => {
  return State.playerId ? Entities.players.get(State.playerId) : null
})

const isHelicopter = computed(() => {
  const vehicle = getCurrentVehicle()
  return vehicle && vehicle.type === VehicleTypes.HELICOPTER
})

const isPlane = computed(() => {
  const vehicle = getCurrentVehicle()
  return vehicle && vehicle.type === VehicleTypes.PLANE
})

function formatVector(vec) {
  if (!vec) return 'N/A'
  return `(${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)})`
}

function getSpeed(velocity) {
  if (!velocity) return 0
  return Math.sqrt(velocity.x ** 2 + velocity.z ** 2)
}

function getCurrentVehicle() {
  return State.currentVehicle ? Vehicles.vehicles.get(State.currentVehicle) : null
}

function getVehicleType() {
  const vehicle = getCurrentVehicle()
  if (!vehicle) return 'Unknown'
  return vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1)
}

function getVehicleTypeName(vehicleId) {
  const vehicle = Vehicles.vehicles.get(vehicleId)
  if (!vehicle) return 'vehicle'
  return vehicle.type
}

onMounted(async () => {
  await Engine.init(gameContainer.value)
})

onUnmounted(() => {
  Engine.cleanup()
})
</script>

<style scoped>
/* Global styles */
:global(body) {
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

:global(*) {
  box-sizing: border-box;
}

/* Component styles */
.game-container {
  width: 100vw;
  height: 100vh;
  cursor: pointer;
}

#info {
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  z-index: 100;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.4;
}

.status {
  margin: 5px 0;
  padding: 5px;
  border-radius: 4px;
}

.connected {
  background: rgba(0, 255, 0, 0.2);
  border: 1px solid #00ff00;
}

.disconnected {
  background: rgba(255, 0, 0, 0.2);
  border: 1px solid #ff0000;
}

.controls {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.8;
}

.controls div {
  margin: 2px 0;
}

.crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 24px;
  font-weight: bold;
  text-shadow: 0 0 3px black;
  pointer-events: none;
  z-index: 1000;
}

.vehicle-info {
  margin-top: 5px;
  color: #88ff88;
  font-weight: bold;
}

.carrying-info {
  margin-top: 5px;
  color: #88ff88;
  font-weight: bold;
}

.interaction-prompt {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  font-size: 16px;
  z-index: 100;
}

.debug-info {
  position: absolute;
  top: 10px;
  right: 10px;
  color: white;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 8px;
  z-index: 100;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  min-width: 250px;
}

.debug-info h3 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #00ff00;
}

.debug-info div {
  margin: 2px 0;
}
</style>