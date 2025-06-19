<template>
  <div>
    <div id="info">
      <div>Use WASD to move, Space to jump, Click to shoot</div>
      <div v-if="!connected" class="status disconnected">Connecting...</div>
      <div v-else class="status connected">
        Connected - Players: {{ playerCount }}
        <div v-if="playerId">Your ID: {{ playerId.substring(0, 6) }}</div>
        <div v-if="playerHealth !== null">Health: {{ playerHealth }}/100</div>
        <div v-if="currentVehicle" class="vehicle-info">
          Driving: {{ getVehicleType() }} | Press F to exit
          <div v-if="isHelicopter">Space - Up | Shift/Z - Down | WASD - Move/Turn</div>
          <div v-else-if="isPlane">W - Throttle Up | S - Throttle Down | Space/Shift - Pitch | A/D - Roll</div>
        </div>
        <div v-if="carryingGhost" class="carrying-info">
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
      <div v-if="nearbyVehicle && !currentVehicle" class="interaction-prompt">
        Press F to enter {{ getVehicleTypeName(nearbyVehicle) }}
      </div>
      <div v-if="nearbyGhost && !carryingGhost && !currentVehicle" class="interaction-prompt">
        Press G to grab object
      </div>
    </div>
    <div v-if="showDebugInfo" class="debug-info">
      <h3>Debug Info</h3>
      <div v-if="currentPlayer">
        <div>Position: {{ formatVector(currentPlayer.position) }}</div>
        <div>Velocity: {{ formatVector(currentPlayer.velocity) }}</div>
        <div>Speed: {{ getSpeed(currentPlayer.velocity).toFixed(2) }} m/s</div>
        <div>Grounded: {{ currentPlayer.isGrounded ? 'Yes' : 'No' }}</div>
        <div v-if="currentPlayer.groundDistance !== null">Ground Distance: {{ currentPlayer.groundDistance?.toFixed(3) }}</div>
        <div v-if="currentPlayer.groundNormal">Ground Normal: {{ formatVector(currentPlayer.groundNormal) }}</div>
        <div>Camera Mode: {{ thirdPerson ? 'Third Person' : 'First Person' }}</div>
        <div>FPS: {{ fps }}</div>
        <div v-if="currentVehicle && getCurrentVehicle()">
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
import * as THREE from 'three'
import { MessageTypes, VehicleConstants, PlayerConstants, VehicleTypes, GhostConstants, GhostTypes } from '@game/shared'
import { ModelPaths, ModelLoader } from '@game/shared/core/models.js'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { Models } from '~/lib/models'

const gameContainer = ref(null)
const connected = ref(false)
const playerCount = ref(0)
const playerId = ref(null)
const playerHealth = ref(null)
const currentVehicle = ref(null)
const nearbyVehicle = ref(null)
const thirdPerson = ref(false)
const showDebugInfo = ref(false)
const fps = ref(0)
const carryingGhost = ref(null)
const nearbyGhost = ref(null)

let scene, camera, renderer, ws
let players = new Map()
let playerMeshes = new Map()
let projectileMeshes = new Map()
let vehicles = new Map()
let vehicleMeshes = new Map()
let ghosts = new Map()
let ghostMeshes = new Map()
let ghostPhysics = new Map() // Client-side physics simulation
let keys = {}
let lastInputSent = {}
let animationId = null
let mouse = { x: 0, y: 0 }
let cameraRotation = { x: 0, y: 0 }
let levelObjects = [] // Store level objects
let debugRayHelper = null
let lastTime = performance.now()
let frameCount = 0

const currentPlayer = computed(() => {
  return playerId.value ? players.get(playerId.value) : null
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
  return currentVehicle.value ? vehicles.get(currentVehicle.value) : null
}

function getVehicleType() {
  const vehicle = getCurrentVehicle()
  if (!vehicle) return 'Unknown'
  return vehicle.type.charAt(0).toUpperCase() + vehicle.type.slice(1)
}

function getVehicleTypeName(vehicleId) {
  const vehicle = vehicles.get(vehicleId)
  if (!vehicle) return 'vehicle'
  return vehicle.type
}

let modelsLoaded = false

onMounted(() => {
  initGame()
})

onUnmounted(() => {
  cleanup()
})

async function initGame() {
  // Setup Three.js scene
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)
  renderer = new THREE.WebGLRenderer({ antialias: true })
  
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  gameContainer.value.appendChild(renderer.domElement)

  // Setup scene
  scene.background = new THREE.Color(0x87ceeb)
  scene.fog = new THREE.Fog(0x87ceeb, 10, 100)

  // Add lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
  directionalLight.position.set(50, 50, 25)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  directionalLight.shadow.camera.left = -50
  directionalLight.shadow.camera.right = 50
  directionalLight.shadow.camera.top = 50
  directionalLight.shadow.camera.bottom = -50
  directionalLight.shadow.camera.near = 0.1
  directionalLight.shadow.camera.far = 200
  scene.add(directionalLight)

  // Create ground
  const groundGeometry = new THREE.BoxGeometry(100, 1, 100)
  const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x3a5f3a })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.position.y = -0.5
  ground.receiveShadow = true
  scene.add(ground)
  
  // Setup camera
  camera.position.set(0, 15, 20)
  camera.lookAt(0, 0, 0)

  // Setup controls
  setupControls()
  
  // Setup shooting
  setupShooting()
  
  // Load models before connecting
  try {
    await ModelLoader.loadModels(false, true)
    modelsLoaded = true
    console.log('All models loaded successfully')
  } catch (error) {
    console.error('Failed to load models:', error)
  }
  
  // Connect to server
  connectToServer()
  
  // Start render loop
  animate()
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize)
}

function setupControls() {
  // Store event listeners for cleanup
  const keydownHandler = (e) => {
    // Prevent key repeat
    if (keys[e.code]) return;
    
    keys[e.code] = true
    
    // Handle vehicle enter/exit
    if (e.code === 'KeyF') {
      handleVehicleInteraction()
    }
    
    // Handle ghost grab/drop
    if (e.code === 'KeyG') {
      handleGhostInteraction()
    }
    
    // Toggle third person camera
    if (e.code === 'KeyO') {
      thirdPerson.value = !thirdPerson.value
    }
    
    // Toggle debug info
    if (e.code === 'Backquote') {
      showDebugInfo.value = !showDebugInfo.value
      updateDebugVisualization()
    }
  }
  
  const keyupHandler = (e) => {
    keys[e.code] = false
  }
  
  const blurHandler = () => {
    // Clear all keys
    Object.keys(keys).forEach(key => {
      keys[key] = false
    })
  }
  
  window.addEventListener('keydown', keydownHandler)
  window.addEventListener('keyup', keyupHandler)
  window.addEventListener('blur', blurHandler)
  
  // Store handlers for cleanup
  window._keydownHandler = keydownHandler
  window._keyupHandler = keyupHandler
  window._blurHandler = blurHandler

  // Mouse controls for camera
  let isPointerLocked = false
  
  gameContainer.value.addEventListener('click', () => {
    if (!isPointerLocked) {
      gameContainer.value.requestPointerLock()
    }
  })
  
  const pointerlockchangeHandler = () => {
    isPointerLocked = document.pointerLockElement === gameContainer.value
    // Reset keys when pointer lock is lost
    if (!isPointerLocked) {
      Object.keys(keys).forEach(key => {
        keys[key] = false
      })
    }
  }
  
  const mousemoveHandler = (e) => {
    if (isPointerLocked) {
      cameraRotation.y -= e.movementX * PlayerConstants.MOUSE_SENSITIVITY
      cameraRotation.x -= e.movementY * PlayerConstants.MOUSE_SENSITIVITY
      cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotation.x))
    }
  }
  
  document.addEventListener('pointerlockchange', pointerlockchangeHandler)
  document.addEventListener('mousemove', mousemoveHandler)
  
  // Store handlers
  document._pointerlockchangeHandler = pointerlockchangeHandler
  document._mousemoveHandler = mousemoveHandler
}

function handleVehicleInteraction() {
  if (!playerId.value || !connected.value) return
  
  if (currentVehicle.value) {
    // Exit vehicle
    ws.send(JSON.stringify({
      type: MessageTypes.EXIT_VEHICLE
    }))
  } else if (nearbyVehicle.value) {
    // Enter vehicle
    ws.send(JSON.stringify({
      type: MessageTypes.ENTER_VEHICLE,
      vehicleId: nearbyVehicle.value
    }))
  }
}

function handleGhostInteraction() {
  if (!playerId.value || !connected.value || currentVehicle.value) return
  
  if (carryingGhost.value) {
    // Drop ghost
    ws.send(JSON.stringify({
      type: MessageTypes.DROP_GHOST
    }))
  } else if (nearbyGhost.value) {
    // Grab ghost
    ws.send(JSON.stringify({
      type: MessageTypes.GRAB_GHOST,
      ghostId: nearbyGhost.value
    }))
  }
}

function setupShooting() {
  gameContainer.value.addEventListener('click', () => {
    if (!playerId.value || !connected.value) return
    
    const player = players.get(playerId.value)
    if (!player) return
    
    // If carrying a ghost, throw it instead of shooting
    if (carryingGhost.value) {
      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyQuaternion(camera.quaternion)
      direction.normalize()
      
      ws.send(JSON.stringify({
        type: MessageTypes.THROW_GHOST,
        direction: { x: direction.x, y: direction.y, z: direction.z }
      }))
      return
    }
    
    // Calculate shooting direction from camera
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(camera.quaternion)
    direction.normalize()
    
    // Shoot from slightly in front of player
    const origin = {
      x: player.position.x + direction.x * 1,
      y: player.position.y + 1.5,
      z: player.position.z + direction.z * 1
    }
    
    ws.send(JSON.stringify({
      type: MessageTypes.FIRE,
      direction: { x: direction.x, y: direction.y, z: direction.z },
      origin: origin
    }))
  })
}

function connectToServer() {
  ws = new WebSocket('ws://localhost:8080')
  
  ws.onopen = () => {
    console.log('Connected to server')
    connected.value = true
  }
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    handleServerMessage(message)
  }
  
  ws.onclose = () => {
    console.log('Disconnected from server')
    connected.value = false
  }
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }
}

function handleServerMessage(message) {
  switch (message.type) {
    case MessageTypes.INIT:
      playerId.value = message.playerId
      if (message.level) {
        createLevel(message.level) // Create level from server data
      }
      ws.send(JSON.stringify({ type: MessageTypes.JOIN }))
      break
      
    case MessageTypes.GAME_STATE:
      updateGameState(message.state)
      break
      
    case MessageTypes.PLAYER_JOINED:
      addPlayer(message.player)
      break
      
    case MessageTypes.PLAYER_LEFT:
      removePlayer(message.playerId)
      break
      
    case MessageTypes.PROJECTILE_SPAWN:
      addProjectile(message.projectile)
      break
      
    case MessageTypes.PROJECTILE_REMOVE:
      removeProjectile(message.projectileId)
      break
      
    case MessageTypes.HIT:
      handleHit(message)
      break
    
    case MessageTypes.VEHICLE_UPDATE:
      updateVehicle(message.vehicle)
      break
    
    case MessageTypes.GHOST_UPDATE:
      updateGhost(message.ghost)
      break
  }
}

function updateGameState(state) {
  // Update player count
  playerCount.value = state.players.length
  
  // Update players
  for (const playerData of state.players) {
    const existingPlayer = players.get(playerData.id)
    
    if (!existingPlayer) {
      // New player
      addPlayer(playerData)
    } else {
      // Update existing player
      players.set(playerData.id, playerData)
      
      // Update mesh position and rotation
      const mesh = playerMeshes.get(playerData.id)
      if (mesh) {
        mesh.position.set(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        )
        
        // Update rotation based on look direction
        if (playerData.lookDirection) {
          const angle = Math.atan2(playerData.lookDirection.x, playerData.lookDirection.z)
          mesh.rotation.y = angle
        }
      }
      
      // Update own player data
      if (playerData.id === playerId.value) {
        playerHealth.value = playerData.health
        carryingGhost.value = playerData.carryingGhost
      }
    }
  }
  
  // Remove players that are no longer in state
  for (const [id, player] of players) {
    if (!state.players.find(p => p.id === id)) {
      removePlayer(id)
    }
  }
  
  // Update projectiles
  for (const projectileData of state.projectiles) {
    const mesh = projectileMeshes.get(projectileData.id)
    if (mesh) {
      mesh.position.set(
        projectileData.position.x,
        projectileData.position.y,
        projectileData.position.z
      )
    } else {
      addProjectile(projectileData)
    }
  }
  
  // Remove projectiles that are no longer in state
  for (const [id, mesh] of projectileMeshes) {
    if (!state.projectiles.find(p => p.id === id)) {
      removeProjectile(id)
    }
  }
  
  // Update vehicles
  for (const vehicleData of state.vehicles) {
    updateVehicle(vehicleData)
  }
  
  // Update ghosts
  for (const ghostData of state.ghosts) {
    updateGhost(ghostData)
  }
  
  // Check nearby vehicles and ghosts
  checkNearbyVehicles()
  checkNearbyGhosts()
}

async function updateVehicle(vehicleData) {
  const existingVehicle = vehicles.get(vehicleData.id)
  
  if (!existingVehicle) {
    // New vehicle
    vehicles.set(vehicleData.id, vehicleData)
    await createVehicleMesh(vehicleData)
  } else {
    // Update existing vehicle
    vehicles.set(vehicleData.id, vehicleData)
    
    // Update mesh position and rotation
    const mesh = vehicleMeshes.get(vehicleData.id)
    if (mesh) {
      mesh.position.set(
        vehicleData.position.x,
        vehicleData.position.y,
        vehicleData.position.z
      )
      
      if (vehicleData.rotation && vehicleData.rotation.w !== undefined) {
        mesh.quaternion.set(
          vehicleData.rotation.x,
          vehicleData.rotation.y,
          vehicleData.rotation.z,
          vehicleData.rotation.w
        )
      }
    }
    
    // Update current vehicle reference
    if (vehicleData.driver === playerId.value) {
      currentVehicle.value = vehicleData.id
    } else if (currentVehicle.value === vehicleData.id && vehicleData.driver !== playerId.value) {
      currentVehicle.value = null
    }
  }
}

async function updateGhost(ghostData) {
  const existingGhost = ghosts.get(ghostData.id)
  
  if (!existingGhost) {
    // New ghost
    ghosts.set(ghostData.id, ghostData)
    await createGhostMesh(ghostData)
  } else {
    // Update existing ghost
    ghosts.set(ghostData.id, ghostData)
    
    // Update mesh
    const mesh = ghostMeshes.get(ghostData.id)
    if (mesh) {
      // Update position only if not being carried by the local player
      if (ghostData.carrier !== playerId.value) {
        mesh.position.set(
          ghostData.position.x,
          ghostData.position.y,
          ghostData.position.z
        )
        
        if (ghostData.rotation) {
          mesh.quaternion.set(
            ghostData.rotation.x,
            ghostData.rotation.y,
            ghostData.rotation.z,
            ghostData.rotation.w
          )
        }
      }
      
      // Update opacity based on carried state
      mesh.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = ghostData.carrier ? 0.8 : 1.0
        }
      })
    }
  }
}

function createLevel(levelData) {
  // Remove any existing level objects
  for (const obj of levelObjects) {
    scene.remove(obj)
    obj.geometry.dispose()
    obj.material.dispose()
  }
  levelObjects = []
  
  // Create objects from server data
  for (const objData of levelData) {
    if (objData.type === 'cube') {
      const geometry = new THREE.BoxGeometry(objData.size.x, objData.size.y, objData.size.z)
      const material = new THREE.MeshLambertMaterial({ 
        color: objData.color 
      })
      const cube = new THREE.Mesh(geometry, material)
      cube.position.set(
        objData.position.x,
        objData.position.y,
        objData.position.z
      )
      cube.castShadow = true
      cube.receiveShadow = true
      scene.add(cube)
      levelObjects.push(cube)
    }
  }
}

async function addPlayer(playerData) {
  // Try to load player model first
  let group
  const model = modelsLoaded ? await Models.loadModel(ModelPaths.PLAYER) : null
  
  if (model) {
    group = model
    // Scale and position the model appropriately
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const scale = PlayerConstants.HEIGHT / size.y
    group.scale.setScalar(scale)
    
    // Update material color for player identification
    group.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.color = new THREE.Color(
          playerData.id === playerId.value ? 0x0088ff : 0xff8800
        )
      }
    })
  } else {
    // Fallback to basic capsule mesh
    group = new THREE.Group()
    
    // Body - proper capsule geometry matching server physics
    const capsuleRadius = PlayerConstants.RADIUS
    const capsuleHeight = PlayerConstants.HEIGHT - PlayerConstants.RADIUS * 2
    
    const bodyGeometry = new THREE.CapsuleGeometry(
      capsuleRadius,
      capsuleHeight,
      4, 
      8
    )
    const bodyMaterial = new THREE.MeshLambertMaterial({ 
      color: playerData.id === playerId.value ? 0x0088ff : 0xff8800 
    })
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
    bodyMesh.castShadow = true
    bodyMesh.receiveShadow = true
    
    group.add(bodyMesh)
  }
  
  // Add name tag
  if (playerData.id !== playerId.value) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 64
    context.fillStyle = 'rgba(0, 0, 0, 0.8)'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'white'
    context.font = '24px Arial'
    context.textAlign = 'center'
    context.fillText(`Player ${playerData.id.substring(0, 6)}`, 128, 40)
    
    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.position.y = PlayerConstants.HEIGHT / 2 + 0.5
    sprite.scale.set(2, 0.5, 1)
    group.add(sprite)
  }
  
  scene.add(group)
  playerMeshes.set(playerData.id, group)
  players.set(playerData.id, playerData)
}

async function createVehicleMesh(vehicleData) {
  let group
  let modelPath
  
  // Determine model path based on vehicle type
  switch (vehicleData.type) {
    case VehicleTypes.HELICOPTER:
      modelPath = ModelPaths.HELICOPTER
      break
    case VehicleTypes.PLANE:
      modelPath = ModelPaths.PLANE
      break
    default:
      modelPath = ModelPaths.CAR
  }
  
  // Try to load model
  const model = modelsLoaded ? await Models.loadModel(modelPath) : null
  
  if (model) {
    group = model
    
    // Scale model to match vehicle constants
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    
    let targetSize
    switch (vehicleData.type) {
      case VehicleTypes.HELICOPTER:
        targetSize = VehicleConstants.HELICOPTER_SIZE
        break
      case VehicleTypes.PLANE:
        targetSize = VehicleConstants.PLANE_SIZE
        break
      default:
        targetSize = VehicleConstants.CAR_SIZE
    }
    
    const scaleX = targetSize.width / size.x
    const scaleY = targetSize.height / size.y
    const scaleZ = targetSize.length / size.z
    const scale = Math.min(scaleX, scaleY, scaleZ)
    group.scale.setScalar(scale)
    
    // Adjust position to match server physics collider
    if (vehicleData.type === VehicleTypes.HELICOPTER) {
      // The server creates the collider with its center at the vehicle position
      // We need to ensure the visual model aligns with this
      const scaledBox = new THREE.Box3().setFromObject(group)
      const modelBottom = scaledBox.min.y
      
      // Create a wrapper group to handle the offset
      const wrapper = new THREE.Group()
      wrapper.add(group)
      
      // The physics collider is centered at the spawn position
      // Move the model up so its bottom aligns with the bottom of the physics collider
      // Physics collider bottom = position.y - (height/2)
      // We want model bottom to match this, so offset the model up
      const physicsHeight = targetSize.height
      const offsetY = -modelBottom - physicsHeight / 2
      group.position.y = offsetY
      
      group = wrapper
    }
    
    // Find animated parts
    const actualModel = group.children[0] || group
    if (vehicleData.type === VehicleTypes.HELICOPTER) {
      const mainRotor = Models.getNamedMesh(actualModel, 'MainRotor')
      if (mainRotor) {
        // Store the original rotation to preserve any tilt
        group.userData.mainRotor = mainRotor
        group.userData.mainRotorOriginalRotation = mainRotor.rotation.clone()
      }
      
      const tailRotor = Models.getNamedMesh(actualModel, 'TailRotor')
      if (tailRotor) {
        group.userData.tailRotor = tailRotor
        group.userData.tailRotorOriginalRotation = tailRotor.rotation.clone()
      }
    } else if (vehicleData.type === VehicleTypes.PLANE) {
      const propeller = actualModel.getObjectByName('propeller') || 
                       actualModel.getObjectByName('prop')
      if (propeller) group.userData.propeller = propeller
    }
  } else {
    // Fallback to procedural meshes (existing code)
    group = new THREE.Group()
    
    if (vehicleData.type === VehicleTypes.HELICOPTER) {
      // Helicopter body
      const bodyGeometry = new THREE.BoxGeometry(
        VehicleConstants.HELICOPTER_SIZE.width,
        VehicleConstants.HELICOPTER_SIZE.height * 0.6,
        VehicleConstants.HELICOPTER_SIZE.length
      )
      const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x445566 })
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
      bodyMesh.castShadow = true
      bodyMesh.receiveShadow = true
      
      // Cockpit
      const cockpitGeometry = new THREE.SphereGeometry(1.2, 8, 6)
      const cockpitMaterial = new THREE.MeshLambertMaterial({ color: 0x222233 })
      const cockpitMesh = new THREE.Mesh(cockpitGeometry, cockpitMaterial)
      cockpitMesh.position.z = -1.5
      cockpitMesh.scale.z = 1.5
      cockpitMesh.castShadow = true
      
      // Main rotor (simplified)
      const rotorGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8)
      const rotorMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 })
      const rotorHub = new THREE.Mesh(rotorGeometry, rotorMaterial)
      rotorHub.position.y = 1
      
      // Rotor blades
      const bladeGeometry = new THREE.BoxGeometry(8, 0.05, 0.3)
      const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 })
      const rotorBlades = new THREE.Mesh(bladeGeometry, bladeMaterial)
      rotorBlades.position.y = 1.1
      
      // Tail
      const tailGeometry = new THREE.CylinderGeometry(0.3, 0.5, 3, 8)
      const tailMaterial = new THREE.MeshLambertMaterial({ color: 0x445566 })
      const tailMesh = new THREE.Mesh(tailGeometry, tailMaterial)
      tailMesh.rotation.z = Math.PI / 2
      tailMesh.position.z = 3
      tailMesh.castShadow = true
      
      group.add(bodyMesh)
      group.add(cockpitMesh)
      group.add(rotorHub)
      group.add(rotorBlades)
      group.add(tailMesh)
      
      // Store rotor reference for animation
      group.userData.rotor = rotorBlades
    
    } else if (vehicleData.type === VehicleTypes.PLANE) {
      // Plane fuselage
      const fuselageGeometry = new THREE.CylinderGeometry(0.8, 0.8, VehicleConstants.PLANE_SIZE.length, 8)
      const fuselageMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc })
      const fuselageMesh = new THREE.Mesh(fuselageGeometry, fuselageMaterial)
      fuselageMesh.rotation.z = Math.PI / 2
      fuselageMesh.castShadow = true
      fuselageMesh.receiveShadow = true
      
      // Wings
      const wingGeometry = new THREE.BoxGeometry(VehicleConstants.PLANE_SIZE.width, 0.2, 1.5)
      const wingMaterial = new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
      const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial)
      wingMesh.castShadow = true
      
      // Tail wing
      const tailWingGeometry = new THREE.BoxGeometry(2, 0.2, 0.8)
      const tailWingMesh = new THREE.Mesh(tailWingGeometry, wingMaterial)
      tailWingMesh.position.z = 2
      tailWingMesh.castShadow = true
      
      // Vertical stabilizer
      const stabilizerGeometry = new THREE.BoxGeometry(0.2, 1.5, 0.8)
      const stabilizerMesh = new THREE.Mesh(stabilizerGeometry, wingMaterial)
      stabilizerMesh.position.z = 2
      stabilizerMesh.position.y = 0.5
      stabilizerMesh.castShadow = true
      
      // Cockpit
      const cockpitGeometry = new THREE.SphereGeometry(0.6, 8, 6)
      const cockpitMaterial = new THREE.MeshLambertMaterial({ color: 0x333344 })
      const cockpitMesh = new THREE.Mesh(cockpitGeometry, cockpitMaterial)
      cockpitMesh.position.z = -2
      cockpitMesh.position.y = 0.3
      cockpitMesh.scale.z = 1.5
      
      // Propeller
      const propGeometry = new THREE.BoxGeometry(0.1, 2, 0.2)
      const propMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 })
      const propeller = new THREE.Mesh(propGeometry, propMaterial)
      propeller.position.z = -2.5
      
      group.add(fuselageMesh)
      group.add(wingMesh)
      group.add(tailWingMesh)
      group.add(stabilizerMesh)
      group.add(cockpitMesh)
      group.add(propeller)
      
      // Store propeller reference for animation
      group.userData.propeller
    
    } else {
      // Existing car creation code
      const bodyGeometry = new THREE.BoxGeometry(
        VehicleConstants.CAR_SIZE.width,
        VehicleConstants.CAR_SIZE.height,
        VehicleConstants.CAR_SIZE.length
      )
      const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4444ff })
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
      bodyMesh.position.y = 0.2
      bodyMesh.castShadow = true
      bodyMesh.receiveShadow = true
      
      // Car roof
      const roofGeometry = new THREE.BoxGeometry(
        VehicleConstants.CAR_SIZE.width * 0.8,
        VehicleConstants.CAR_SIZE.height * 0.6,
        VehicleConstants.CAR_SIZE.length * 0.5
      )
      const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x3333cc })
      const roofMesh = new THREE.Mesh(roofGeometry, roofMaterial)
      roofMesh.position.y = VehicleConstants.CAR_SIZE.height * 0.8
      roofMesh.castShadow = true
      
      // Wheels
      const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8)
      const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x222222 })
      
      const wheelPositions = [
        { x: -0.8, z: -1.5 },
        { x: 0.8, z: -1.5 },
        { x: -0.8, z: 1.5 },
        { x: 0.8, z: 1.5 }
      ]
      
      for (const pos of wheelPositions) {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial)
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(pos.x, -0.3, pos.z)
        wheel.castShadow = true
        group.add(wheel)
      }
      
      group.add(bodyMesh)
      group.add(roofMesh)
    }
  }
  
  scene.add(group)
  vehicleMeshes.set(vehicleData.id, group)
}

async function createGhostMesh(ghostData) {
  let mesh
  let modelPath
  
  // Determine model path based on ghost type
  switch (ghostData.type) {
    case GhostTypes.BOX:
      modelPath = ModelPaths.GHOST_BOX
      break
    case GhostTypes.SPHERE:
      modelPath = ModelPaths.GHOST_SPHERE
      break
    case GhostTypes.CYLINDER:
      modelPath = ModelPaths.GHOST_CYLINDER
      break
  }
  
  // Try to load model
  const model = modelsLoaded ? await Models.loadModel(modelPath) : null
  
  if (model) {
    mesh = model
    
    // Scale to match ghost size
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    
    let scale
    switch (ghostData.type) {
      case GhostTypes.BOX:
        scale = Math.min(
          ghostData.size.width / size.x,
          ghostData.size.height / size.y,
          ghostData.size.depth / size.z
        )
        break
      case GhostTypes.SPHERE:
        scale = (ghostData.size.radius * 2) / Math.max(size.x, size.y, size.z)
        break
      case GhostTypes.CYLINDER:
        scale = Math.min(
          (ghostData.size.radius * 2) / Math.max(size.x, size.z),
          ghostData.size.height / size.y
        )
        break
    }
    
    mesh.scale.setScalar(scale)
    
    // Update material opacity for carried state
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone()
        child.material.transparent = true
        child.material.opacity = ghostData.carrier ? 0.8 : 1.0
      }
    })
  } else {
    // Fallback to procedural geometry
    let geometry
    const material = new THREE.MeshLambertMaterial({ 
      color: ghostData.color,
      transparent: true,
      opacity: ghostData.carrier ? 0.8 : 1.0
    })
    
    switch (ghostData.type) {
      case GhostTypes.BOX:
        geometry = new THREE.BoxGeometry(
          ghostData.size.width,
          ghostData.size.height,
          ghostData.size.depth
        )
        break
      case GhostTypes.SPHERE:
        geometry = new THREE.SphereGeometry(ghostData.size.radius, 16, 12)
        break
      case GhostTypes.CYLINDER:
        geometry = new THREE.CylinderGeometry(
          ghostData.size.radius,
          ghostData.size.radius,
          ghostData.size.height,
          16
        )
        break
    }
    
    mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
  }
  
  scene.add(mesh)
  ghostMeshes.set(ghostData.id, mesh)
  
  // Initialize client physics for this ghost
  ghostPhysics.set(ghostData.id, {
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 }
  })
}

function updateCarriedGhostPhysics(ghostData) {
  const mesh = ghostMeshes.get(ghostData.id)
  const physics = ghostPhysics.get(ghostData.id)
  const player = players.get(playerId.value)
  
  if (!mesh || !physics || !player) return
  
  // Calculate target position (in front of player)
  const targetPos = new THREE.Vector3(
    player.position.x + player.lookDirection.x * GhostConstants.CARRY_DISTANCE,
    player.position.y + 0.5 + player.lookDirection.y * GhostConstants.CARRY_DISTANCE,
    player.position.z + player.lookDirection.z * GhostConstants.CARRY_DISTANCE
  )
  
  // Spring physics for smooth movement
  const springStrength = 0.2
  const damping = 0.8
  
  // Calculate spring force
  const dx = targetPos.x - mesh.position.x
  const dy = targetPos.y - mesh.position.y
  const dz = targetPos.z - mesh.position.z
  
  physics.velocity.x = physics.velocity.x * damping + dx * springStrength
  physics.velocity.y = physics.velocity.y * damping + dy * springStrength
  physics.velocity.z = physics.velocity.z * damping + dz * springStrength
  
  // Apply velocity
  mesh.position.x += physics.velocity.x
  mesh.position.y += physics.velocity.y
  mesh.position.z += physics.velocity.z
  
  // Rotate based on movement
  physics.angularVelocity.x *= 0.9
  physics.angularVelocity.y *= 0.9
  physics.angularVelocity.z = physics.velocity.x * 0.1
  
  mesh.rotation.x += physics.angularVelocity.x
  mesh.rotation.y += physics.angularVelocity.y
  mesh.rotation.z += physics.angularVelocity.z
}

function checkNearbyVehicles() {
  if (!playerId.value || currentVehicle.value) {
    nearbyVehicle.value = null
    return
  }
  
  const player = players.get(playerId.value)
  if (!player) return
  
  let closestVehicle = null
  let closestDistance = VehicleConstants.INTERACTION_RANGE
  
  for (const [vehicleId, vehicle] of vehicles) {
    if (vehicle.driver) continue // Skip occupied vehicles
    
    const distance = Math.sqrt(
      (player.position.x - vehicle.position.x) ** 2 +
      (player.position.y - vehicle.position.y) ** 2 +
      (player.position.z - vehicle.position.z) ** 2
    )
    
    if (distance < closestDistance) {
      closestDistance = distance
      closestVehicle = vehicleId
    }
  }
  
  nearbyVehicle.value = closestVehicle
}

function checkNearbyGhosts() {
  if (!playerId.value || carryingGhost.value || currentVehicle.value) {
    nearbyGhost.value = null
    return
  }
  
  const player = players.get(playerId.value)
  if (!player) return
  
  let closestGhost = null
  let closestDistance = GhostConstants.INTERACTION_RANGE
  
  for (const [ghostId, ghost] of ghosts) {
    if (ghost.carrier) continue // Skip carried ghosts
    
    const distance = Math.sqrt(
      (player.position.x - ghost.position.x) ** 2 +
      (player.position.y - ghost.position.y) ** 2 +
      (player.position.z - ghost.position.z) ** 2
    )
    
    if (distance < closestDistance) {
      closestDistance = distance
      closestGhost = ghostId
    }
  }
  
  nearbyGhost.value = closestGhost
}

function removePlayer(playerId) {
  const mesh = playerMeshes.get(playerId)
  if (mesh) {
    scene.remove(mesh)
    // Clean up geometries and materials
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
  
  playerMeshes.delete(playerId)
  players.delete(playerId)
}

function addProjectile(projectileData) {
  const geometry = new THREE.SphereGeometry(0.05, 8, 6)
  const material = new THREE.MeshStandardMaterial({ 
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 0.5
  })
  const mesh = new THREE.Mesh(geometry, material)
  
  mesh.position.set(
    projectileData.position.x,
    projectileData.position.y,
    projectileData.position.z
  )
  
  scene.add(mesh)
  projectileMeshes.set(projectileData.id, mesh)
}

function removeProjectile(projectileId) {
  const mesh = projectileMeshes.get(projectileId)
  if (mesh) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
    projectileMeshes.delete(projectileId)
  }
}

function handleHit(hitData) {
  if (hitData.target === playerId.value) {
    // Flash red effect
    const overlay = document.createElement('div')
    overlay.style.position = 'fixed'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100%'
    overlay.style.height = '100%'
    overlay.style.backgroundColor = 'red'
    overlay.style.opacity = '0.3'
    overlay.style.pointerEvents = 'none'
    overlay.style.zIndex = '1000'
    document.body.appendChild(overlay)
    
    setTimeout(() => {
      document.body.removeChild(overlay)
    }, 200)
  }
}

function sendInput() {
  const input = {
    moveForward: keys['KeyW'] || false,
    moveBackward: keys['KeyS'] || false,
    moveLeft: keys['KeyA'] || false,
    moveRight: keys['KeyD'] || false,
    jump: keys['Space'] || false,
    shift: keys['ShiftLeft'] || keys['ShiftRight'] || false,
    descend: keys['KeyZ'] || false,
    lookDirection: currentVehicle.value ? null : getLookDirection()
  }
  
  // Always send input when there's movement or look changes
  const hasMovement = input.moveForward || input.moveBackward || input.moveLeft || input.moveRight || input.jump || input.shift || input.descend;
  const lookChanged = JSON.stringify(input.lookDirection) !== JSON.stringify(lastInputSent.lookDirection);
  
  if (hasMovement || lookChanged || JSON.stringify(input) !== JSON.stringify(lastInputSent)) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: MessageTypes.INPUT,
        input: input
      }))
    }
    lastInputSent = { ...input }
  }
}

function getLookDirection() {
  const direction = new THREE.Vector3(0, 0, -1)
  direction.applyQuaternion(camera.quaternion)
  return { x: direction.x, y: direction.y, z: direction.z }
}

function updateDebugVisualization() {
  // Remove existing debug helpers
  if (debugRayHelper) {
    scene.remove(debugRayHelper)
    debugRayHelper.geometry.dispose()
    debugRayHelper.material.dispose()
    debugRayHelper = null
  }
  
  if (showDebugInfo.value && playerId.value) {
    // Create ground detection rays visualization (multiple rays)
    const rayCount = 5 // Center + 4 corners
    const positions = new Float32Array(rayCount * 6) // 2 vertices per ray, 3 coordinates each
    const colors = new Float32Array(rayCount * 6) // 2 colors per ray, 3 components each
    
    const rayGeometry = new THREE.BufferGeometry()
    rayGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    rayGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    
    const rayMaterial = new THREE.LineBasicMaterial({ 
      vertexColors: true,
      linewidth: 2
    })
    
    debugRayHelper = new THREE.LineSegments(rayGeometry, rayMaterial)
    scene.add(debugRayHelper)
  }
}

function updateDebugRay() {
  if (!debugRayHelper || !playerId.value) return
  
  const player = players.get(playerId.value)
  if (!player) return
  
  // Update ray positions
  const positions = debugRayHelper.geometry.attributes.position.array
  const colors = debugRayHelper.geometry.attributes.color.array
  
  // Ray offsets matching server
  const rayOffsets = [
    { x: 0, z: 0 }, // Center
    { x: PlayerConstants.RADIUS * 0.7, z: 0 }, // Right
    { x: -PlayerConstants.RADIUS * 0.7, z: 0 }, // Left
    { x: 0, z: PlayerConstants.RADIUS * 0.7 }, // Front
    { x: 0, z: -PlayerConstants.RADIUS * 0.7 }, // Back
  ]
  
  const rayLength = PlayerConstants.HEIGHT / 2 + 0.5 // Match server ray length
  const groundedColor = { r: 0, g: 1, b: 0 }
  const airborneColor = { r: 1, g: 0, b: 0 }
  const color = player.isGrounded ? groundedColor : airborneColor
  
  for (let i = 0; i < rayOffsets.length; i++) {
    const offset = rayOffsets[i]
    const idx = i * 6 // Each ray has 2 vertices * 3 coordinates
    
    // Ray start (from capsule center)
    positions[idx] = player.position.x + offset.x
    positions[idx + 1] = player.position.y
    positions[idx + 2] = player.position.z + offset.z
    
    // Ray end
    const actualLength = player.groundDistance !== null && player.groundDistance < rayLength ? 
      player.groundDistance : rayLength
    positions[idx + 3] = player.position.x + offset.x
    positions[idx + 4] = player.position.y - actualLength
    positions[idx + 5] = player.position.z + offset.z
    
    // Colors for both vertices
    colors[idx] = color.r
    colors[idx + 1] = color.g
    colors[idx + 2] = color.b
    colors[idx + 3] = color.r
    colors[idx + 4] = color.g
    colors[idx + 5] = color.b
  }
  
  debugRayHelper.geometry.attributes.position.needsUpdate = true
  debugRayHelper.geometry.attributes.color.needsUpdate = true
}

function updateCamera() {
  if (playerId.value && players.has(playerId.value)) {
    const player = players.get(playerId.value)
    
    if (currentVehicle.value) {
      // Third-person vehicle camera
      const vehicle = vehicles.get(currentVehicle.value)
      if (vehicle) {
        // Calculate camera position behind vehicle
        const vehicleRotation = new THREE.Quaternion()
        if (vehicle.rotation.w !== undefined) {
          vehicleRotation.set(
            vehicle.rotation.x,
            vehicle.rotation.y,
            vehicle.rotation.z,
            vehicle.rotation.w
          )
        }
        
        // Create offset vector behind and above vehicle
        const offset = new THREE.Vector3(0, 5, 10)
        offset.applyQuaternion(vehicleRotation)
        
        // Set camera position
        camera.position.set(
          vehicle.position.x + offset.x,
          vehicle.position.y + offset.y,
          vehicle.position.z + offset.z
        )
        
        // Look at vehicle
        camera.lookAt(
          vehicle.position.x,
          vehicle.position.y + 2,
          vehicle.position.z
        )
      }
    } else if (thirdPerson.value) {
      // Third-person player camera
      const distance = 5
      const height = 3
      
      // Calculate camera offset based on look direction
      const offset = new THREE.Vector3(
        Math.sin(cameraRotation.y) * distance,
        height,
        Math.cos(cameraRotation.y) * distance
      )
      
      camera.position.set(
        player.position.x + offset.x,
        player.position.y + offset.y,
        player.position.z + offset.z
      )
      
      // Look at player center
      camera.lookAt(
        player.position.x,
        player.position.y,
        player.position.z
      )
    } else {
      // First-person camera - at eye level
      const eyeHeight = PlayerConstants.HEIGHT / 2 - 0.1
      camera.position.set(
        player.position.x,
        player.position.y + eyeHeight,
        player.position.z
      )
      
      // Apply rotation
      camera.rotation.order = 'YXZ'
      camera.rotation.y = cameraRotation.y
      camera.rotation.x = cameraRotation.x
    }
  }
}

function animate() {
  animationId = requestAnimationFrame(animate)
  
  // Calculate FPS
  const currentTime = performance.now()
  frameCount++
  if (currentTime - lastTime >= 1000) {
    fps.value = frameCount
    frameCount = 0
    lastTime = currentTime
  }
  
  // Animate vehicle parts
  for (const [vehicleId, mesh] of vehicleMeshes) {
    const vehicle = vehicles.get(vehicleId)
    if (!vehicle) continue
    
    // Animate helicopter rotors
    if (vehicle.type === VehicleTypes.HELICOPTER) {
      // Animate main rotor while preserving its tilt
      if (mesh.userData.mainRotor && mesh.userData.mainRotorOriginalRotation) {
        const rotor = mesh.userData.mainRotor
        const originalRotation = mesh.userData.mainRotorOriginalRotation
        
        // Create a rotation around local Y-axis
        const rotationSpeed = 0.5
        const time = Date.now() * 0.001
        
        // Reset to original rotation then apply spin
        rotor.rotation.copy(originalRotation)
        rotor.rotateY(time * rotationSpeed * Math.PI * 2)
      }
      
      // Animate tail rotor
      if (mesh.userData.tailRotor && mesh.userData.tailRotorOriginalRotation) {
        const tailRotor = mesh.userData.tailRotor
        const originalRotation = mesh.userData.tailRotorOriginalRotation
        
        // Tail rotor typically spins around Z axis (forward/back)
        const rotationSpeed = 0.8
        const time = Date.now() * 0.001
        
        // Reset to original rotation
        tailRotor.rotation.copy(originalRotation)
        
        // Tail rotors rotate around their local Z axis
        tailRotor.rotateZ(time * rotationSpeed * Math.PI * 2)
      }
    }
    
    // Animate plane propeller
    if (vehicle.type === VehicleTypes.PLANE && mesh.userData.propeller) {
      const throttle = vehicle.throttle || 0
      mesh.userData.propeller.rotation.z += 0.3 + throttle * 0.5
    }
  }
  
  // Update carried ghost physics
  if (carryingGhost.value) {
    const ghost = ghosts.get(carryingGhost.value)
    if (ghost && ghost.carrier === playerId.value) {
      updateCarriedGhostPhysics(ghost)
    }
  }
  
  sendInput()
  updateCamera()
  updateDebugRay()
  
  renderer.render(scene, camera)
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  
  if (ws) {
    ws.close()
  }
  
  // Reset keys state
  keys = {}
  
  // Remove event listeners with stored references
  if (window._keydownHandler) {
    window.removeEventListener('keydown', window._keydownHandler)
    window.removeEventListener('keyup', window._keyupHandler)
    window.removeEventListener('blur', window._blurHandler)
  }
  
  if (document._pointerlockchangeHandler) {
    document.removeEventListener('pointerlockchange', document._pointerlockchangeHandler)
    document.removeEventListener('mousemove', document._mousemoveHandler)
  }
  
  window.removeEventListener('resize', onWindowResize)
  
  // Clean up all player meshes
  for (const mesh of playerMeshes.values()) {
    scene.remove(mesh)
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
  
  // Clean up projectiles
  for (const mesh of projectileMeshes.values()) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
  }
  projectileMeshes.clear()

  // Clean up level objects
  for (const obj of levelObjects) {
    scene.remove(obj)
    obj.geometry.dispose()
    obj.material.dispose()
  }
  levelObjects = []
  
  // Clean up vehicle meshes
  for (const mesh of vehicleMeshes.values()) {
    scene.remove(mesh)
    mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }
  vehicleMeshes.clear()

  // Clean up ghost meshes
  for (const mesh of ghostMeshes.values()) {
    scene.remove(mesh)
    mesh.geometry.dispose()
    mesh.material.dispose()
  }
  ghostMeshes.clear()
  ghosts.clear()
  ghostPhysics.clear()
}
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