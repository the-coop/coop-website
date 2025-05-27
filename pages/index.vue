<template>
  <div class="game-container">
    <div ref="gameCanvas" class="game-canvas"></div>
    <div v-if="loading" class="loading-screen">Loading physics engine...</div>
    <div v-if="!started" class="start-screen">
      <button @click="startGame" class="start-button">Start Game</button>
    </div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div v-if="networkManager?.connectionStatus !== 'connected'" class="connection-status">
      {{ networkManager?.connectionStatus || 'disconnected' }}
    </div>
    <div class="debug-info" v-if="started">
      <div>Grounded: {{ fpsController?.isGrounded || false }}</div>
      <div>Position: {{ playerPosition.x.toFixed(2) }}, {{ playerPosition.y.toFixed(2) }}, {{ playerPosition.z.toFixed(2) }}</div>
      <div>Moving: {{ fpsController?.isMoving || false }}</div>
      <div>Speed: {{ fpsController?.currentSpeed?.toFixed(2) || '0.00' }}</div>
      <div>Facing: {{ playerFacing.x.toFixed(2) }}, {{ playerFacing.y.toFixed(2) }}, {{ playerFacing.z.toFixed(2) }}</div>
      <div>Ping: {{ networkManager?.ping || 0 }}ms</div>
      <div>Players: {{ Object.keys(serverPlayers).length }}</div>
      <div>Prediction Error: {{ fpsController?.predictionError?.toFixed(2) || '0.00' }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, shallowRef, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { SceneManager } from '@/lib/scene';
import { PhysicsManager } from '@/lib/physics';
import { FPSController } from '@/lib/FPSController'; // Fix import path
import { NetworkManager } from '@/lib/network';
import { PLAYER_CONFIG, NETWORK_CONFIG, parsePlayerState } from '@/lib/players';

// Refs for DOM elements
const gameCanvas = ref(null);

// State variables
const loading = ref(true);
const started = ref(false);
const errorMessage = ref('');
const frameCount = ref(0);
const serverPlayers = reactive({});
const serverDynamicObjects = reactive({});

// Player state for UI
const playerPosition = ref(new THREE.Vector3());
const playerFacing = ref(new THREE.Vector3(0, 0, -1));

// Game managers
const sceneManager = shallowRef(null);
const physicsManager = shallowRef(null);
const fpsController = shallowRef(null);
const networkManager = shallowRef(null);

// Floating origin
const worldOriginOffset = shallowRef(new THREE.Vector3(0, 0, 0));

// Initialize game systems
const initializeGame = async () => {
  try {
    physicsManager.value = new PhysicsManager();
    sceneManager.value = new SceneManager();
    
    await sceneManager.value.initializeGame(physicsManager.value, gameCanvas.value);
    
    // Create FPS controller but DON'T create player yet
    fpsController.value = new FPSController(physicsManager.value, sceneManager.value);
    
    // DON'T connect to network here - wait for startGame
    // DON'T create player here - wait for startGame
    return true;
  } catch (e) {
    console.error("Error initializing game:", e);
    errorMessage.value = "Failed to initialize game: " + e.message;
    return false;
  }
};

// Start game
const startGame = () => {
  if (gameCanvas.value && fpsController.value) {
    // Request pointer lock first
    gameCanvas.value.requestPointerLock();
    started.value = true;
    
    // NOW create the player when game actually starts
    fpsController.value.createPlayer(0, PLAYER_CONFIG.SPAWN_HEIGHT, 0);
    
    // Initialize network manager ONLY when actually starting
    if (!networkManager.value) {
      networkManager.value = new NetworkManager();
      setupNetworkHandlers();
      
      const config = useRuntimeConfig();
      const wsUrl = config.public.wsUrl || 'ws://localhost:8080/ws';
      
      console.log('Connecting to server after game start and player creation');
      networkManager.value.connect(wsUrl).catch(e => {
        errorMessage.value = "Failed to connect to server: " + e.message;
      });
      
      // Start sending inputs only after connection
      setInterval(sendInputToServer, 1000 / NETWORK_CONFIG.INPUT_RATE);
    }
    
    // Start animation loop
    sceneManager.value.startAnimationLoop(physicsManager.value, fpsController.value, onAnimationFrame);
  }
};

// Animation frame callback
const onAnimationFrame = (deltaTime) => {
  if (!started.value) return;
  
  try {
    frameCount.value++;
    
    // Apply gravity to all dynamic objects INCLUDING other players BEFORE physics step
    physicsManager.value.applyGravityToScene(sceneManager.value.scene, deltaTime);
    
    // Step physics - this moves all physics bodies including other players
    physicsManager.value.step();
    
    // Process collision events
    fpsController.value.processCollisionEvents();
    
    // Check grounded state
    fpsController.value.checkGrounded(frameCount.value);
    
    // Handle movement for local player
    fpsController.value.handleAllMovement(deltaTime, frameCount.value);
    
    // Update player transform
    fpsController.value.updatePlayerTransform();
    
    // Update dynamic objects - this syncs visuals to physics for ALL objects
    // This is where other players' visual positions get updated from their physics bodies
    sceneManager.value.updateDynamicObjects(
      sceneManager.value.movingPlatform?.userData?.physicsBody
    );
    
    // Update ray visualizations
    sceneManager.value.updateRayVisualizations(
      fpsController.value.leftFootPos,
      fpsController.value.rightFootPos,
      fpsController.value.centerFootPos,
      fpsController.value.rayDir,
      2.0,
      fpsController.value.leftFootHit,
      fpsController.value.rightFootHit,
      fpsController.value.centerFootHit
    );
    
    // Update detached camera if needed
    if (fpsController.value.isCameraDetached) {
      fpsController.value.updateDetachedCamera();
    }
    
    // Update UI state
    playerPosition.value.copy(fpsController.value.playerPosition);
    playerFacing.value.copy(fpsController.value.playerFacing);
    
    // Clean up stale players every 5 seconds
    if (frameCount.value % 300 === 0) {
      cleanupStalePlayers();
    }
    
    // Debug log other player positions every second
    if (frameCount.value % 60 === 0) {
      const otherPlayerCount = Object.keys(sceneManager.value.otherPlayerMeshes).length;
      if (otherPlayerCount > 0) {
        console.log(`Frame ${frameCount.value}: ${otherPlayerCount} other players in scene`);
        Object.entries(sceneManager.value.otherPlayerMeshes).forEach(([id, mesh]) => {
          const body = mesh.userData.physicsBody;
          const velocity = body ? body.linvel() : { x: 0, y: 0, z: 0 };
          console.log(`  Player ${id}: visual pos [${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)}], physics vel [${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}, ${velocity.z.toFixed(1)}]`);
        });
      }
    }
  } catch (e) {
    errorMessage.value = "Error in animation loop: " + e.message;
    console.error("Error in animation loop:", e);
  }
};

// Add cleanup function for stale players
const cleanupStalePlayers = () => {
  const now = Date.now();
  const staleTimeout = 10000; // 10 seconds
  
  Object.entries(sceneManager.value.otherPlayerMeshes).forEach(([playerId, mesh]) => {
    const lastUpdate = mesh.userData.lastServerUpdate || 0;
    const timeSinceUpdate = now - lastUpdate;
    
    // If player hasn't been updated in 10 seconds and isn't in server state, remove them
    if (timeSinceUpdate > staleTimeout && !serverPlayers[playerId]) {
      console.log(`Removing stale player ${playerId} - no updates for ${timeSinceUpdate}ms`);
      sceneManager.value.removeOtherPlayer(playerId);
    }
  });
};

// Setup network event handlers
const setupNetworkHandlers = () => {
  if (!networkManager.value) return;
  
  networkManager.value.onInit = (message) => {
    console.log('Received init message with player ID:', message.playerId, 'and state:', Object.keys(message.state || {}));
    
    // Store our player ID immediately BEFORE processing state
    networkManager.value.playerId = message.playerId;
    const ourPlayerId = message.playerId;
    
    if (message.state) {
      Object.entries(message.state).forEach(([id, playerData]) => {
        const parsedData = parsePlayerState(playerData);
        
        // Double-check we're not creating ourselves
        if (id === ourPlayerId || id === networkManager.value.playerId) {
          console.warn('Init message incorrectly contains our own player data, skipping:', id);
          return;
        }
        
        // This is another player
        console.log(`Init other player ${id} at world pos: [${parsedData.position[0].toFixed(1)}, ${parsedData.position[1].toFixed(1)}, ${parsedData.position[2].toFixed(1)}]`);
        
        // Handle world origin offset for other players
        const serverOrigin = new THREE.Vector3(...parsedData.worldOrigin);
        if (!worldOriginOffset.value.equals(serverOrigin) && worldOriginOffset.value.length() === 0) {
          console.log('Setting initial world origin from other player:', serverOrigin);
          worldOriginOffset.value.copy(serverOrigin);
        }
        
        // Create the other player
        sceneManager.value.updateOtherPlayer(id, playerData, worldOriginOffset.value);
        serverPlayers[id] = playerData;
        console.log(`Created other player ${id} during init`);
      });
    }
    
    // Handle our own initial world origin
    if (!worldOriginOffset.value || worldOriginOffset.value.length() === 0) {
      console.log('Setting default world origin for first player');
      worldOriginOffset.value.set(0, 0, 0);
    }
    
    // Handle dynamic objects
    if (message.dynamicObjects) {
      Object.entries(message.dynamicObjects).forEach(([id, objData]) => {
        sceneManager.value.createOrUpdateDynamicObject(id, objData, worldOriginOffset.value);
        serverDynamicObjects[id] = objData;
      });
    }
  };
  
  networkManager.value.onStateUpdate = (message) => {
    // CRITICAL: Ignore state updates until we have our player ID and are initialized
    if (!networkManager.value.playerId || !networkManager.value.initialized) {
      console.log('Ignoring state update - not initialized yet');
      return;
    }
    
    const actualState = message.state || message;
    
    // Only log if we have other players
    const otherPlayerCount = Object.keys(actualState).filter(id => id !== networkManager.value.playerId).length;
    if (otherPlayerCount > 0) {
      console.log(`Received state update with ${Object.keys(actualState).length} players (${otherPlayerCount} others)`);
    }
    
    // Update server players state
    Object.keys(serverPlayers).forEach(id => {
      if (!actualState[id] && id !== networkManager.value.playerId) {
        delete serverPlayers[id];
      }
    });
    
    Object.entries(actualState).forEach(([id, playerData]) => {
      if (id !== networkManager.value.playerId) {
        serverPlayers[id] = playerData;
        sceneManager.value.updateOtherPlayer(id, playerData, worldOriginOffset.value);
      } else if (fpsController.value?.playerBody) {
        const parsedData = parsePlayerState(playerData);
        handleOriginShift(parsedData);
        fpsController.value.reconcileWithServer(parsedData, worldOriginOffset.value);
      }
    });
    
    // Update dynamic objects
    if (message.dynamicObjects) {
      // Clear removed objects first
      Object.keys(serverDynamicObjects).forEach(id => {
        if (!message.dynamicObjects[id]) {
          delete serverDynamicObjects[id];
        }
      });
      
      Object.assign(serverDynamicObjects, message.dynamicObjects);
      
      Object.entries(message.dynamicObjects).forEach(([id, objData]) => {
        sceneManager.value.createOrUpdateDynamicObject(id, objData, worldOriginOffset.value);
      });
      
      // Remove objects that no longer exist
      Object.keys(sceneManager.value?.dynamicObjects || {}).forEach(id => {
        if (!message.dynamicObjects[id]) {
          sceneManager.value.removeDynamicObject(id);
        }
      });
    }
    
    // Remove players that are no longer in the state
    Object.keys(sceneManager.value?.otherPlayerMeshes || {}).forEach(id => {
      if (!actualState[id]) {
        console.log('Player', id, 'no longer in state, removing');
        sceneManager.value.removeOtherPlayer(id);
      }
    });
  };
  
  networkManager.value.onPlayerLeft = (playerId) => {
    console.log('Player left:', playerId);
    sceneManager.value.removeOtherPlayer(playerId);
    delete serverPlayers[playerId];
  };
};

// Handle world origin shifts
const handleOriginShift = (parsedData) => {
  const serverOrigin = new THREE.Vector3(...parsedData.worldOrigin);
  
  if (!worldOriginOffset.value.equals(serverOrigin)) {
    console.log('Server shifted origin from', worldOriginOffset.value, 'to', serverOrigin);
    
    const shift = serverOrigin.clone().sub(worldOriginOffset.value);
    worldOriginOffset.value.copy(serverOrigin);
    
    // Shift other players
    Object.entries(sceneManager.value?.otherPlayerMeshes || {}).forEach(([id, mesh]) => {
      mesh.position.sub(shift);
    });
    
    // Shift physics bodies
    if (sceneManager.value?.scene) {
      sceneManager.value.scene.traverse((child) => {
        if (child.isMesh && child.userData.physicsBody && child !== sceneManager.value.player) {
          const body = child.userData.physicsBody;
          const pos = body.translation();
          body.setTranslation({
            x: pos.x - shift.x,
            y: pos.y - shift.y,
            z: pos.z - shift.z
          });
        }
      });
    }
  }
};

// Send input to server
const sendInputToServer = () => {
  if (!networkManager.value || !started.value || !fpsController.value) return;
  
  const playerState = fpsController.value.getPlayerState();
  if (!playerState) return;
  
  // Generate input with current movement state
  const input = fpsController.value.generateInput();
  
  // Always include current world position and origin
  input.world_position = playerState.position;
  input.world_origin = [
    worldOriginOffset.value.x,
    worldOriginOffset.value.y,
    worldOriginOffset.value.z
  ];
  
  const sequence = ++fpsController.value.inputSequence;
  const deltaTime = 1.0 / 60.0;
  
  // Add to pending inputs for prediction
  fpsController.value.addPendingInput(input, sequence, deltaTime);
  
  // Send to server and clean up old inputs
  if (networkManager.value.sendInput(input, sequence)) {
    fpsController.value.cleanupOldInputs(2000); // 2 second timeout
    
    // Log input sending for debugging (occasionally)
    if (sequence % 60 === 0 && (input.forward || input.backward || input.left || input.right)) {
      console.log('Sent input sequence', sequence, '- movement keys active:', {
        forward: input.forward,
        backward: input.backward,
        left: input.left,
        right: input.right,
        yaw: input.yaw.toFixed(2)
      });
    }
  }
};

// Event handlers
const onResize = () => sceneManager.value?.onResize();

const onKeyDown = (event) => {
  if (!started.value || !fpsController.value) return;
  fpsController.value.handleKeyDown(event);
};

const onKeyUp = (event) => {
  if (!started.value || !fpsController.value) return;
  fpsController.value.handleKeyUp(event);
};

const onMouseMove = (event) => {
  if (!started.value || document.pointerLockElement !== gameCanvas.value || !fpsController.value) return;
  fpsController.value.handleMouseMove(event);
};

const onPointerLockChange = () => {
  if (!fpsController.value) return;
  fpsController.value.handlePointerLockChange(gameCanvas.value);
};

// Lifecycle hooks
onMounted(async () => {
  try {
    console.log("Starting game initialization...");
    
    const initTimeout = setTimeout(() => {
      if (loading.value) {
        console.warn("Initialization timed out");
        loading.value = false;
        errorMessage.value = "Some systems may not be working correctly.";
      }
    }, 8000);
    
    const success = await initializeGame();
    
    clearTimeout(initTimeout);
    loading.value = false;
    
    if (success) {
      window.addEventListener('resize', onResize);
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('pointerlockchange', onPointerLockChange);
      
      console.log("Game ready to start");
    }
  } catch (e) {
    console.error("Error during game initialization:", e);
    errorMessage.value = "Failed to initialize game: " + e.message;
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('pointerlockchange', onPointerLockChange);
  
  // Clean up network connection
  if (networkManager.value) {
    console.log('Cleaning up network connection');
    networkManager.value.disconnect();
    networkManager.value = null;
  }
  
  sceneManager.value?.cleanup();
});
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.game-canvas {
  width: 100%;
  height: 100%;
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
  padding: 10px;
  border-radius: 4px;
  line-height: 1.4;
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

.connection-status {
  position: absolute;
  top: 10px;
  right: 10px;
  color: white;
  font-family: monospace;
  font-size: 14px;
  background-color: rgba(200, 0, 0, 0.7);
  padding: 5px 10px;
  border-radius: 4px;
}
</style>