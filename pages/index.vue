<template>
  <div class="game-container">
    <div ref="gameCanvas" class="game-canvas"></div>
    <div v-if="loading" class="loading-screen">Loading physics engine...</div>
    <div v-if="!started && !loading" class="start-screen">
      <button @click="startGame" class="start-button">Start Game</button>
    </div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div class="debug-info" v-if="started && showDebug">
      <div>Grounded: {{ debugInfo.isGrounded }}</div>
      <div>Position: {{ formatVector(debugInfo.position) }}</div>
      <div>Moving: {{ debugInfo.isMoving }}</div>
      <div>Speed: {{ debugInfo.currentSpeed?.toFixed(2) }}</div>
      <div>Facing: {{ formatVector(debugInfo.facing) }}</div>
      <div>Connected: {{ debugInfo.connected }}</div>
      <div>Players Online: {{ debugInfo.playersOnline }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, reactive, shallowRef, markRaw } from 'vue';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsManager } from '../lib/physics.js';
import { SceneManager } from '../lib/scene.js';
import { FPSController } from '../lib/fpsController.js';
import { WebSocketManager } from '../lib/network.js';
import { PlayerManager } from '../lib/players.js';

// Get WebSocket URL from runtime config
const config = useRuntimeConfig();
const wsUrl = config.public.wsUrl || 'ws://localhost:8080/ws';

// Refs
const gameCanvas = ref(null);
const loading = ref(true);
const started = ref(false);
const errorMessage = ref('');
const showDebug = ref(true);

// Game state - use shallowRef to prevent deep reactivity
const physics = shallowRef(null);
const scene = shallowRef(null);
const player = shallowRef(null);
const clock = shallowRef(null);
const frameCount = ref(0);
const wsManager = shallowRef(null);
const playerManager = shallowRef(null);

// Network update throttling
let lastNetworkUpdate = 0;
const networkUpdateInterval = 50 // Send updates every 50ms (20 Hz)

const debugInfo = reactive({
  isGrounded: false,
  position: new THREE.Vector3(),
  isMoving: false,
  currentSpeed: 0,
  facing: new THREE.Vector3(0, 0, -1),
  connected: false,
  playersOnline: 0
});

// Format vector for display
const formatVector = (vec) => {
  if (!vec) return '0.00, 0.00, 0.00';
  return `${vec.x.toFixed(2)}, ${vec.y.toFixed(2)}, ${vec.z.toFixed(2)}`;
};

// Initialize game
const initGame = async () => {
  try {
    console.log("Initializing game...");
    
    // Initialize physics
    const physicsManager = new PhysicsManager();
    await physicsManager.init();
    physics.value = markRaw(physicsManager);
    
    // Initialize scene
    const sceneManager = new SceneManager(physics.value);
    sceneManager.init(gameCanvas.value);
    scene.value = markRaw(sceneManager);
    
    // Create world
    scene.value.createPlanet();
    scene.value.createPlatform();
    
    // Create player manager (but not the local player yet)
    const manager = new PlayerManager(scene.value, physics.value);
    playerManager.value = markRaw(manager);
    
    // Setup clock
    clock.value = markRaw(new THREE.Clock());
    
    loading.value = false;
    console.log("Game initialized successfully");
    
    return true;
  } catch (error) {
    console.error("Failed to initialize game:", error);
    loading.value = false;
    throw error;
  }
};

// Create player with spawn position from server
const createLocalPlayer = (spawnPosition) => {
  console.log("Creating local player at:", spawnPosition);
  
  const spawnPos = new THREE.Vector3(
    spawnPosition.x,
    spawnPosition.y,
    spawnPosition.z
  );
  
  // Create player
  const fpsController = new FPSController(scene.value, physics.value);
  fpsController.create(spawnPos);
  player.value = markRaw(fpsController);
  
  console.log("Local player created");
};

// Connect to WebSocket server
const connectToServer = () => {
  return new Promise((resolve, reject) => {
    try {
      console.log("Connecting to multiplayer server...");
      
      const ws = new WebSocketManager(wsUrl);
      wsManager.value = markRaw(ws);
      
      // Setup WebSocket callbacks
      ws.onConnected = () => {
        debugInfo.connected = true;
        console.log("Connected to multiplayer server");
      };
      
      ws.onWelcome = (playerId, spawnPosition) => {
        console.log("Welcome received with spawn position:", spawnPosition);
        // Set local player ID in player manager
        playerManager.value.setLocalPlayerId(playerId);
        // Create local player with server-provided spawn position
        createLocalPlayer(spawnPosition);
        updatePlayerCount();
        resolve();
      };
      
      ws.onDisconnected = () => {
        debugInfo.connected = false;
        console.log("Disconnected from multiplayer server");
      };
      
      ws.onPlayerJoin = (playerId, position) => {
        console.log(`Player joined: ${playerId}`, position);
        // Convert position object to THREE.Vector3
        const pos = new THREE.Vector3(position.x, position.y, position.z);
        playerManager.value.addPlayer(playerId, pos);
        updatePlayerCount();
      };
      
      ws.onPlayerLeave = (playerId) => {
        console.log(`Player left: ${playerId}`);
        playerManager.value.removePlayer(playerId);
        updatePlayerCount();
      };
      
      ws.onPlayerUpdate = (playerId, state) => {
        playerManager.value.updatePlayer(playerId, state);
      };
      
      ws.onError = (error) => {
        console.error("WebSocket error:", error);
        errorMessage.value = "Connection error: " + (error.message || "Unknown error");
        reject(error);
      };
      
      // Connect to server
      ws.connect().catch(reject);
      
    } catch (error) {
      console.error("Failed to connect to server:", error);
      errorMessage.value = "Failed to connect to multiplayer server";
      reject(error);
    }
  });
};

// Update player count
const updatePlayerCount = () => {
  debugInfo.playersOnline = playerManager.value.getPlayerCount() + 1; // +1 for local player
};

// Send player state to server
const sendPlayerState = () => {
  if (!wsManager.value?.connected || !player.value?.body) return;
  
  const currentTime = performance.now();
  if (currentTime - lastNetworkUpdate < networkUpdateInterval) return;
  
  lastNetworkUpdate = currentTime;
  
  // Get player state
  const position = player.value.body.translation();
  const rotation = player.value.body.rotation();
  const velocity = player.value.body.linvel();
  
  // Send to server
  wsManager.value.sendPlayerState(
    { x: position.x, y: position.y, z: position.z },
    { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
    { x: velocity.x, y: velocity.y, z: velocity.z }
  );
};

// Animation loop
const animate = () => {
  if (!started.value) return;
  
  requestAnimationFrame(animate);
  
  const deltaTime = Math.min(clock.value.getDelta(), 0.1);
  
  // Step physics
  physics.value.step();
  
  // Process collision events
  if (player.value) {
    physics.value.processCollisionEvents(player.value.colliderHandle, (handle, started) => {
      // Collision callback if needed
    });
  }
  
  // Apply gravity to all dynamic bodies
  applyGlobalGravity(deltaTime);
  
  // Update player
  if (player.value) {
    player.value.update(deltaTime);
    
    // Update debug info
    debugInfo.isGrounded = player.value.isGrounded;
    debugInfo.position.copy(player.value.getPosition());
    debugInfo.facing.copy(player.value.getFacing());
    debugInfo.currentSpeed = player.value.getSpeed();
    debugInfo.isMoving = player.value.keys.forward || player.value.keys.backward || 
                        player.value.keys.left || player.value.keys.right;
    
    // Send player state to server
    sendPlayerState();
  }
  
  // Update remote players
  if (playerManager.value) {
    playerManager.value.update(deltaTime);
  }
  
  // Update scene dynamic objects
  scene.value.updateDynamicObjects();
  
  // Render
  scene.value.render();
  
  frameCount.value++;
};

// Apply gravity to all bodies
const applyGlobalGravity = (deltaTime) => {
  if (!scene.value?.scene) return;
  
  // Apply gravity to player
  if (player.value && player.value.body) {
    physics.value.applyGravityToBody(player.value.body, deltaTime);
  }
  
  // Apply gravity to all dynamic objects
  scene.value.scene.traverse((child) => {
    if (child.isMesh && child.userData.physicsBody) {
      physics.value.applyGravityToBody(child.userData.physicsBody, deltaTime);
    }
  });
};

// Start the game
const startGame = async () => {
  try {
    if (!scene.value) {
      errorMessage.value = "Game not initialized";
      return;
    }
    
    // Request pointer lock immediately after user click
    requestPointerLock();
    
    // Connect to server and wait for spawn position
    try {
      await connectToServer();
    } catch (error) {
      console.error("Network connection failed, starting in single player mode");
      // Fallback to single player mode
      createLocalPlayer(new THREE.Vector3(0, 35, 0));
    }
    
    // Wait a bit to ensure player is created
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!player.value) {
      errorMessage.value = "Failed to create player";
      return;
    }
    
    started.value = true;
    clock.value.start();
    animate();
    
    console.log("Game started");
    
    // Add error handler for pointer lock
    document.addEventListener('pointerlockerror', (e) => {
      console.warn('Pointer lock error:', e);
    }, { once: true });
    
  } catch (e) {
    errorMessage.value = "Error starting game: " + e.message;
    console.error("Error starting game:", e);
  }
};

// Request pointer lock
const requestPointerLock = () => {
  if (scene.value?.renderer) {
    scene.value.renderer.domElement.requestPointerLock();
  }
};

// Input handlers
const onKeyDown = (event) => {
  if (!started.value || !player.value) return;
  
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      player.value.keys.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      player.value.keys.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      player.value.keys.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      player.value.keys.right = true;
      break;
    case 'KeyQ':
      player.value.keys.rollLeft = true;
      break;
    case 'KeyE':
      player.value.keys.rollRight = true;
      break;
    case 'Space':
      if (player.value.isGrounded) {
        player.value.keys.jump = true;
      }
      break;
    case 'ShiftLeft':
      player.value.keys.run = true;
      break;
    case 'KeyO':
      player.value.toggleCamera();
      break;
  }
};

const onKeyUp = (event) => {
  if (!started.value || !player.value) return;
  
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      player.value.keys.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      player.value.keys.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      player.value.keys.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      player.value.keys.right = false;
      break;
    case 'KeyQ':
      player.value.keys.rollLeft = false;
      break;
    case 'KeyE':
      player.value.keys.rollRight = false;
      break;
    case 'Space':
      player.value.keys.jump = false;
      break;
    case 'ShiftLeft':
      player.value.keys.run = false;
      break;
  }
};

const onMouseMove = (event) => {
  if (!started.value || !player.value) return;
  if (document.pointerLockElement !== scene.value?.renderer?.domElement) return;
  
  player.value.handleMouseMove(event);
};

const onPointerLockChange = () => {
  if (document.pointerLockElement !== scene.value?.renderer?.domElement) {
    // Reset all keys when pointer lock is lost
    if (player.value) {
      Object.keys(player.value.keys).forEach(key => {
        player.value.keys[key] = false;
      });
    }
  }
};

// Handle resize events
const handleResize = () => {
  if (scene.value) {
    scene.value.onResize();
  }
  
  // Remove inline styles from canvas to let CSS take over
  const canvas = gameCanvas.value?.querySelector('canvas');
  if (canvas) {
    canvas.style.width = '';
    canvas.style.height = '';
  }
};

// Handle pointer lock changes with delay
const handlePointerLockChange = () => {
  onPointerLockChange();
  handleResize();
  // Add multiple delayed calls to handle Safari's async viewport updates
  setTimeout(handleResize, 50);
  setTimeout(handleResize, 150);
  setTimeout(handleResize, 300);
};

// Initialize game on mount
onMounted(async () => {
  try {
    console.log("Initializing game...");
    
    // Initialize with timeout
    const initTimeout = setTimeout(() => {
      if (loading.value) {
        console.warn("Initialization timed out");
        loading.value = false;
        errorMessage.value = "Physics engine may not be working correctly";
      }
    }, 8000);
    
    await initGame();
    
    clearTimeout(initTimeout);
    
    console.log("Game ready to start");
    
    // Setup event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
    
  } catch (e) {
    console.error("Failed to initialize game:", e);
    errorMessage.value = "Failed to initialize game: " + e.message;
    loading.value = false;
  }
});

// Cleanup on unmount
onBeforeUnmount(() => {
  started.value = false;
  
  // Disconnect from server
  if (wsManager.value) {
    wsManager.value.disconnect();
  }
  
  // Clear all remote players
  if (playerManager.value) {
    playerManager.value.clear();
  }
  
  // Remove event listeners
  window.removeEventListener('resize', handleResize);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('pointerlockchange', handlePointerLockChange);
  document.removeEventListener('webkitpointerlockchange', handlePointerLockChange);
});
</script>

<style scoped>
:global(html), :global(body) {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
}

.game-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #111122;
}

.game-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #111122;
}

.game-canvas :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.loading-screen, .start-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  font-family: Arial, sans-serif;
  font-size: 24px;
}

.start-button {
  padding: 15px 30px;
  font-size: 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.start-button:hover {
  background-color: #45a049;
}

.debug-info {
  position: absolute;
  top: 10px;
  left: 10px;
  color: white;
  font-family: monospace;
  font-size: 14px;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 5px;
  border-radius: 4px;
}

.error-message {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(200, 0, 0, 0.8);
  color: white;
  padding: 15px 20px;
  border-radius: 5px;
  font-family: Arial, sans-serif;
  font-size: 16px;
  max-width: 80%;
  text-align: center;
  z-index: 1000;
}
</style>