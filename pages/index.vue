<template>
  <div>
    <div id="info">
      <div>Use WASD to move, Space to jump, Click to shoot</div>
      <div v-if="!connected" class="status disconnected">Connecting...</div>
      <div v-else class="status connected">
        Connected - Players: {{ playerCount }}
        <div v-if="playerId">Your ID: {{ playerId.substring(0, 6) }}</div>
        <div v-if="playerHealth !== null">Health: {{ playerHealth }}/100</div>
      </div>
      <div class="controls">
        <div>W/A/S/D - Move</div>
        <div>Space - Jump</div>
        <div>Mouse - Look around</div>
        <div>Click - Shoot</div>
      </div>
      <div class="crosshair">+</div>
    </div>
    <div ref="gameContainer" class="game-container" />
  </div>
</template>

<script setup>
import * as THREE from 'three'
import { MessageTypes } from '@game/shared'
import { onMounted, onUnmounted, ref } from 'vue'

const gameContainer = ref(null)
const connected = ref(false)
const playerCount = ref(0)
const playerId = ref(null)
const playerHealth = ref(null)

let scene, camera, renderer, ws
let players = new Map()
let playerMeshes = new Map()
let projectileMeshes = new Map()
let keys = {}
let lastInputSent = {}
let animationId = null
let mouse = { x: 0, y: 0 }
let cameraRotation = { x: 0, y: 0 }
let levelObjects = [] // Store level objects

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

  // Don't create random cubes here - wait for server level data
  
  // Setup camera
  camera.position.set(0, 15, 20)
  camera.lookAt(0, 0, 0)

  // Setup controls
  setupControls()
  
  // Setup shooting
  setupShooting()
  
  // Connect to server
  connectToServer()
  
  // Start render loop
  animate()
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize)
}

function setupControls() {
  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true
  })
  
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false
  })

  // Mouse controls for camera
  let isPointerLocked = false
  
  gameContainer.value.addEventListener('click', () => {
    if (!isPointerLocked) {
      gameContainer.value.requestPointerLock()
    }
  })
  
  document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === gameContainer.value
  })
  
  document.addEventListener('mousemove', (e) => {
    if (isPointerLocked) {
      cameraRotation.y -= e.movementX * 0.002
      cameraRotation.x -= e.movementY * 0.002
      cameraRotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, cameraRotation.x))
    }
  })
}

function setupShooting() {
  gameContainer.value.addEventListener('click', () => {
    if (!playerId.value || !connected.value) return
    
    const player = players.get(playerId.value)
    if (!player) return
    
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

function updateGameState(state) {
  playerCount.value = state.players.length
  
  // Update player health
  const currentPlayer = state.players.find(p => p.id === playerId.value)
  if (currentPlayer) {
    playerHealth.value = currentPlayer.health
  }
  
  for (const playerData of state.players) {
    if (!players.has(playerData.id)) {
      addPlayer(playerData)
    }
    
    const player = players.get(playerData.id)
    const mesh = playerMeshes.get(playerData.id)
    
    if (player && mesh) {
      // Update player data
      player.position = playerData.position
      player.rotation = playerData.rotation
      player.velocity = playerData.velocity
      
      mesh.position.set(player.position.x, player.position.y, player.position.z)
      
      // Add some visual feedback for velocity
      const speed = Math.sqrt(
        player.velocity.x ** 2 + 
        player.velocity.z ** 2
      )
      mesh.scale.setScalar(1 + speed * 0.02)
    }
  }
  
  // Update projectiles
  const activeProjectileIds = new Set(state.projectiles.map(p => p.id))
  
  // Remove old projectiles
  for (const [id, mesh] of projectileMeshes) {
    if (!activeProjectileIds.has(id)) {
      removeProjectile(id)
    }
  }
  
  // Update or add projectiles
  for (const projectileData of state.projectiles) {
    if (!projectileMeshes.has(projectileData.id)) {
      addProjectile(projectileData)
    } else {
      const mesh = projectileMeshes.get(projectileData.id)
      mesh.position.set(
        projectileData.position.x,
        projectileData.position.y,
        projectileData.position.z
      )
    }
  }
}

function addPlayer(playerData) {
  // Create player mesh - capsule-like shape
  const group = new THREE.Group()
  
  // Body
  const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1.4, 4, 8)
  const bodyMaterial = new THREE.MeshLambertMaterial({ 
    color: playerData.id === playerId.value ? 0x0088ff : 0xff8800 
  })
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial)
  bodyMesh.castShadow = true
  bodyMesh.receiveShadow = true
  
  // Add a small cube as "head" indicator
  const headGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3)
  const headMaterial = new THREE.MeshLambertMaterial({ 
    color: playerData.id === playerId.value ? 0x004488 : 0xcc4400 
  })
  const headMesh = new THREE.Mesh(headGeometry, headMaterial)
  headMesh.position.y = 1.2
  headMesh.castShadow = true
  
  group.add(bodyMesh)
  group.add(headMesh)
  
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
    sprite.position.y = 2.5
    sprite.scale.set(2, 0.5, 1)
    group.add(sprite)
  }
  
  scene.add(group)
  playerMeshes.set(playerData.id, group)
  players.set(playerData.id, playerData)
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
    lookDirection: getLookDirection()
  }
  
  // Only send if input changed
  if (JSON.stringify(input) !== JSON.stringify(lastInputSent)) {
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

function updateCamera() {
  if (playerId.value && players.has(playerId.value)) {
    const player = players.get(playerId.value)
    
    // First-person camera
    camera.position.set(
      player.position.x,
      player.position.y + 1.5,
      player.position.z
    )
    
    // Apply rotation
    camera.rotation.order = 'YXZ'
    camera.rotation.y = cameraRotation.y
    camera.rotation.x = cameraRotation.x
  }
}

function animate() {
  animationId = requestAnimationFrame(animate)
  
  sendInput()
  updateCamera()
  
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
  
  window.removeEventListener('resize', onWindowResize)
  
  if (renderer) {
    renderer.dispose()
    if (gameContainer.value && renderer.domElement) {
      gameContainer.value.removeChild(renderer.domElement)
    }
  }
  
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
</style>