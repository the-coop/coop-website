import { reactive } from 'vue'

// Global reactive state that can be accessed from anywhere
export const State = reactive({
  connected: false,
  playerCount: 0,
  playerId: null,
  playerHealth: null,
  currentVehicle: null,
  nearbyVehicle: null,
  thirdPerson: false,
  showDebugInfo: false,
  fps: 0,
  carryingGhost: null,
  nearbyGhost: null
})
