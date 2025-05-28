<template>
  <div class="game-container">
    <div ref="gameCanvas" class="game-canvas"></div>
    <div v-if="loading" class="loading-screen">Loading physics engine...</div>
    <div v-if="!started && !loading" class="start-screen">
      <div class="menu-container">
        <h1 class="game-title">Conquest</h1>
        <div class="menu-buttons">
          <button @click="startCampaign" class="menu-button campaign-button">
            <span class="button-title">Campaign</span>
            <span class="button-description">Story mode</span>
          </button>
          <button @click="startSandbox" class="menu-button sandbox-button">
            <span class="button-title">Sandbox</span>
            <span class="button-description">Free play</span>
          </button>
          <button @click="startMultiplayer" class="menu-button multiplayer-button">
            <span class="button-title">Multiplayer</span>
            <span class="button-description">Play online</span>
          </button>
        </div>
      </div>
    </div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div class="debug-info" v-if="started && showDebug">
      <div>Mode: {{ gameMode }}</div>
      <div>Grounded: {{ debugInfo.isGrounded }}</div>
      <div>Position: {{ formatVector(debugInfo.position) }}</div>
      <div>Moving: {{ debugInfo.isMoving }}</div>
      <div>Speed: {{ debugInfo.currentSpeed?.toFixed(2) }}</div>
      <div>Facing: {{ formatVector(debugInfo.facing) }}</div>
      <div v-if="gameMode === 'multiplayer'">Connected: {{ debugInfo.connected }}</div>
      <div v-if="gameMode === 'multiplayer'">Players Online: {{ debugInfo.playersOnline }}</div>
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
import { CampaignLoader } from '../lib/campaignLoader.js';

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

// Add game mode ref
const gameMode = ref('');

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
    
    // Don't create world here - wait until game mode is selected
    
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

// Add floating origin state
const localOrigin = shallowRef(new THREE.Vector3(0, 0, 0));
const ORIGIN_THRESHOLD = 1000; // Recenter when 1km from origin

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
        playerManager.value.setLocalPlayerId(playerId);
        
        // Store spawn position for later use after level is built
        scene.value.multiplayerSpawnPosition = spawnPosition;
        
        updatePlayerCount();
        resolve();
      };
      
      ws.onDisconnected = () => {
        debugInfo.connected = false;
        debugInfo.playersOnline = 1; // Only local player
        console.log("Disconnected from multiplayer server");
      };
      
      ws.onConnectionLost = () => {
        console.log("Connection lost unexpectedly");
        errorMessage.value = "Connection to server lost. Playing in single player mode.";
        
        // Clear all remote players
        if (playerManager.value) {
          playerManager.value.clear();
          updatePlayerCount();
        }
        
        // Clear error message after a few seconds
        setTimeout(() => {
          errorMessage.value = '';
        }, 3000);
      };
      
      ws.onOriginUpdate = (origin) => {
        console.log("Origin updated to:", origin);
        // Server has recentered our origin
        localOrigin.value.set(origin.x, origin.y, origin.z);
        
        // Update all remote player positions relative to new origin
        if (playerManager.value) {
          playerManager.value.updateAllPositionsForNewOrigin();
        }
      };
      
      ws.onPlayerJoin = (playerId, position) => {
        console.log(`Player joined: ${playerId}`, position);
        // Position is already relative to our origin from server
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
      
      // Add dynamic object handlers
      ws.onDynamicObjectSpawn = (objectId, data) => {
        console.log(`Dynamic object spawned: ${objectId}`, data);
        
        if (data.type === 'rock') {
          // Position from server is relative to our origin
          const rockPos = new THREE.Vector3(
            data.position.x,
            data.position.y,
            data.position.z
          );
          
          console.log(`Creating rock ${objectId} at relative position:`, rockPos);
          
          const rock = scene.value.spawnMultiplayerRock(objectId, rockPos, data.scale || 1.0);
          
          // Set initial rotation if provided
          if (rock && data.rotation) {
            scene.value.updateDynamicObject(objectId, { 
              rotation: data.rotation
            });
          }
        }
      };
      
      ws.onDynamicObjectUpdate = (objectId, state) => {
        // Log every 60th update to avoid spam
        if (frameCount.value % 60 === 0) {
          console.log(`Rock ${objectId} update - pos: (${state.position.x.toFixed(2)}, ${state.position.y.toFixed(2)}, ${state.position.z.toFixed(2)})`);
        }
        scene.value.updateDynamicObject(objectId, state);
      };
      
      ws.onDynamicObjectRemove = (objectId) => {
        console.log(`Removing dynamic object: ${objectId}`);
        scene.value.removeDynamicObject(objectId);
      };
      
      ws.onError = (error) => {
        console.error("WebSocket error:", error);
        errorMessage.value = "Connection error: " + (error.message || "Unknown error");
        reject(error);
      };
      
      // Add level data handler
      ws.onLevelData = (levelObjects) => {
        console.log("Building level from server data");
        // For multiplayer, build level at server positions
        scene.value.buildLevelFromData(levelObjects);
        
        // Now create player
        if (scene.value.multiplayerSpawnPosition) {
          const spawnPos = new THREE.Vector3(
            scene.value.multiplayerSpawnPosition.x,
            scene.value.multiplayerSpawnPosition.y,
            scene.value.multiplayerSpawnPosition.z
          );
          
          // Create player at spawn position
          createLocalPlayer(spawnPos);
          
          // Don't set local origin or recenter at start - keep everything at server positions
          localOrigin.value.set(0, 0, 0);
          
          console.log("Player created at server position:", spawnPos);
        }
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

// Start the game with different modes
const startCampaign = async () => {
  gameMode.value = 'campaign';
  await startGameWithMode(false);
};

const startSandbox = async () => {
  gameMode.value = 'sandbox';
  await startGameWithMode(false);
};

const startMultiplayer = async () => {
  gameMode.value = 'multiplayer';
  await startGameWithMode(true);
};

// Modified start game function
const startGameWithMode = async (connectNetwork) => {
  try {
    if (!scene.value) {
      errorMessage.value = "Game not initialized";
      return;
    }
    
    // Set game mode in scene manager
    scene.value.setGameMode(gameMode.value);
    
    // Request pointer lock immediately after user click
    requestPointerLock();
    
    let spawnPosition = new THREE.Vector3(0, 35, 0); // Default spawn
    
    if (connectNetwork) {
      // Connect to server and wait for spawn position and level data
      try {
        await connectToServer();
        // In multiplayer, createLocalPlayer is called from onWelcome callback
        // which happens after level data is received
      } catch (error) {
        console.error("Network connection failed, starting in single player mode");
        // Fallback to single player mode with default level
        scene.value.createPlanet();
        scene.value.createPlatform();
        createLocalPlayer(spawnPosition);
      }
    } else {
      // Start offline mode
      if (gameMode.value === 'campaign') {
        // Load campaign level
        console.log("Loading campaign level...");
        try {
          const levelData = await CampaignLoader.loadLevel('level1');
          const levelSpawn = CampaignLoader.buildLevelFromData(scene.value, physics.value, levelData);
          spawnPosition = new THREE.Vector3(levelSpawn.x, levelSpawn.y, levelSpawn.z);
        } catch (error) {
          console.error("Failed to load campaign level:", error);
          errorMessage.value = "Failed to load campaign level";
          return;
        }
      } else if (gameMode.value === 'sandbox') {
        // Create full sandbox level with planet
        console.log("Creating sandbox level...");
        scene.value.createPlanet();
        scene.value.createPlatform();
      }
      
      createLocalPlayer(spawnPosition);
      debugInfo.connected = false;
      debugInfo.playersOnline = 1;
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
    
    console.log(`Game started in ${gameMode.value} mode`);
    
    // Add error handler for pointer lock
    document.addEventListener('pointerlockerror', (e) => {
      console.warn('Pointer lock error:', e);
    }, { once: true });
    
  } catch (e) {
    errorMessage.value = "Error starting game: " + e.message;
    console.error("Error starting game:", e);
  }
};

// Create local player helper
const createLocalPlayer = (spawnPosition) => {
  if (!scene.value || !physics.value) {
    console.error("Cannot create player: scene or physics not initialized");
    return;
  }
  
  const fpsController = new FPSController(scene.value, physics.value);
  fpsController.create(spawnPosition);
  player.value = markRaw(fpsController);
  
  console.log("Player created at:", spawnPosition);
};

// Send player state to server
const sendPlayerState = () => {
  if (gameMode.value !== 'multiplayer') return;
  if (!wsManager.value?.connected || !player.value?.body) return;
  
  const currentTime = performance.now();
  if (currentTime - lastNetworkUpdate < networkUpdateInterval) return;
  
  lastNetworkUpdate = currentTime;
  
  // Get player state in local coordinates
  const position = player.value.body.translation();
  const rotation = player.value.body.rotation();
  const velocity = player.value.body.linvel();
  
  // Check if we need to recenter local origin
  const localPos = new THREE.Vector3(position.x, position.y, position.z);
  if (localPos.length() > ORIGIN_THRESHOLD) {
    console.log("Recentering local origin, distance:", localPos.length());
    
    // Update local origin
    localOrigin.value.add(localPos);
    
    // Reset player to origin
    player.value.body.setTranslation({ x: 0, y: 0, z: 0 });
    
    // Update all scene objects to be relative to new origin
    recenterSceneObjects(localPos);
    
    // Send position as (0,0,0) since we just recentered
    wsManager.value.sendPlayerState(
      { x: 0, y: 0, z: 0 },
      { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      { x: velocity.x, y: velocity.y, z: velocity.z }
    );
  } else {
    // Send normal position update
    wsManager.value.sendPlayerState(
      { x: position.x, y: position.y, z: position.z },
      { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      { x: velocity.x, y: velocity.y, z: velocity.z }
    );
  }
};

// Recenter all scene objects when origin changes
const recenterSceneObjects = (offset) => {
  // Negate the offset to move scene in opposite direction
  const negOffset = offset.clone().multiplyScalar(-1);
  
  console.log("Recentering scene objects by offset:", negOffset);
  
  // In multiplayer, we need to keep physics bodies in sync with visuals
  // The physics simulation runs in local space, so we need to move physics bodies too
  
  // Update planet
  if (scene.value.objects.planet) {
    scene.value.objects.planet.position.add(negOffset);
    // Update physics body position to match visual
    if (scene.value.objects.planetBody && gameMode.value === 'multiplayer') {
      const currentPos = scene.value.objects.planetBody.translation();
      scene.value.objects.planetBody.setTranslation({
        x: currentPos.x + negOffset.x,
        y: currentPos.y + negOffset.y,
        z: currentPos.z + negOffset.z
      });
    }
  }
  
  // Update platforms
  if (scene.value.objects.platform) {
    scene.value.objects.platform.position.add(negOffset);
    // Update platform physics body to match visual
    if (scene.value.objects.platformBody && gameMode.value === 'multiplayer') {
      const currentPos = scene.value.objects.platformBody.translation();
      scene.value.objects.platformBody.setTranslation({
        x: currentPos.x + negOffset.x,
        y: currentPos.y + negOffset.y,
        z: currentPos.z + negOffset.z
      });
    }
  }
  
  // Update moving platform
  if (scene.value.objects.movingPlatform) {
    scene.value.objects.movingPlatform.position.add(negOffset);
    // Update the initial position stored in userData
    if (scene.value.objects.movingPlatform.userData) {
      scene.value.objects.movingPlatform.userData.initialX += negOffset.x;
    }
    // Update physics body
    if (scene.value.objects.movingPlatformBody && gameMode.value === 'multiplayer') {
      const currentPos = scene.value.objects.movingPlatformBody.translation();
      scene.value.objects.movingPlatformBody.setTranslation({
        x: currentPos.x + negOffset.x,
        y: currentPos.y + negOffset.y,
        z: currentPos.z + negOffset.z
      });
    }
  }
  
  // Update all other scene objects (walls, ramps, rocks, etc.)
  scene.value.scene.traverse((child) => {
    if (child.isMesh && child.userData.physicsBody && child !== player.value?.mesh && !scene.value.dynamicObjects.has(child.userData?.objectId)) {
      // Update mesh position
      child.position.add(negOffset);
      
      // Update physics body in multiplayer
      if (gameMode.value === 'multiplayer') {
        const body = child.userData.physicsBody;
        const currentPos = body.translation();
        body.setTranslation({
          x: currentPos.x + negOffset.x,
          y: currentPos.y + negOffset.y,
          z: currentPos.z + negOffset.z
        });
      }
    }
  });
  
  // Update all dynamic objects - visual and physics in multiplayer
  scene.value.dynamicObjects.forEach((obj, id) => {
    if (obj.mesh) {
      obj.mesh.position.add(negOffset);
    }
    
    // Update kinematic physics body in multiplayer
    if (obj.body && gameMode.value === 'multiplayer') {
      const currentPos = obj.body.translation();
      obj.body.setNextKinematicTranslation({
        x: currentPos.x + negOffset.x,
        y: currentPos.y + negOffset.y,
        z: currentPos.z + negOffset.z
      });
    }
  });
  
  // Update all remote players
  if (playerManager.value) {
    playerManager.value.offsetAllPlayers(negOffset);
  }
  
  // Update gravity center to stay relative
  physics.value.gravity.center.add(negOffset);
};

// Add physics stepping flag
let isPhysicsStepping = false;

// Animation loop
const animate = () => {
  if (!started.value) return;
  
  requestAnimationFrame(animate);
  
  const deltaTime = Math.min(clock.value.getDelta(), 0.1);
  
  // Step physics with flag to prevent concurrent access
  if (!isPhysicsStepping) {
    isPhysicsStepping = true;
    try {
      physics.value.step();
    } finally {
      isPhysicsStepping = false;
    }
  }
  
  // Process collision events
  if (player.value && !isPhysicsStepping) {
    physics.value.processCollisionEvents(player.value.colliderHandle, (handle, started) => {
      // Collision callback if needed
    });
  }
  
  // Apply gravity to all dynamic bodies
  if (!isPhysicsStepping) {
    applyGlobalGravity(deltaTime);
  }
  
  // Update player
  if (player.value && !isPhysicsStepping) {
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
  
  // Remove dynamic object state sending - server controls them now
  // sendDynamicObjectStates(); // REMOVED
  
  // Update remote players
  if (playerManager.value && !isPhysicsStepping) {
    playerManager.value.update(deltaTime);
  }
  
  // Update scene dynamic objects
  if (!isPhysicsStepping) {
    scene.value.updateDynamicObjects();
  }
  
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
  
  // In multiplayer, server controls dynamic object physics
  if (gameMode.value === 'multiplayer') {
    return; // Don't apply gravity to dynamic objects in multiplayer
  }
  
  // Only apply gravity to dynamic objects in single player modes
  scene.value.scene.traverse((child) => {
    if (child.isMesh && child.userData.physicsBody) {
      physics.value.applyGravityToBody(child.userData.physicsBody, deltaTime);
    }
  });
  
  // Also apply to tracked dynamic objects in single player
  scene.value.dynamicObjects.forEach((obj) => {
    if (obj.body) {
      physics.value.applyGravityToBody(obj.body, deltaTime);
    }
  });
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

// Modified mouse handler to check physics stepping
const onMouseMove = (event) => {
  if (!started.value || !player.value || isPhysicsStepping) return;
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
    wsManager.value = null;
  }
  
  // Clear all remote players
  if (playerManager.value) {
    playerManager.value.clear();
    playerManager.value = null;
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

.menu-container {
  text-align: center;
  padding: 20px;
}

.game-title {
  font-size: 48px;
  margin-bottom: 40px;
  color: #ffffff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-family: Arial, sans-serif;
  font-weight: bold;
}

.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  max-width: 400px;
  margin: 0 auto;
}

.menu-button {
  width: 100%;
  padding: 20px 30px;
  font-size: 18px;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.button-title {
  font-size: 24px;
  font-weight: bold;
}

.button-description {
  font-size: 14px;
  opacity: 0.8;
}

.campaign-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.campaign-button:hover {
  background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
}

.sandbox-button {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.sandbox-button:hover {
  background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
}

.multiplayer-button {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.multiplayer-button:hover {
  background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
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