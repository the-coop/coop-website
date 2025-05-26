<template>
  <div class="game-container">
    <div ref="gameCanvas" class="game-canvas"></div>
    <div v-if="loading" class="loading-screen">Loading physics engine...</div>
    <div v-if="!started" class="start-screen">
      <button @click="startGame" class="start-button">Start Game</button>
    </div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div v-if="connectionStatus !== 'connected'" class="connection-status">
      {{ connectionStatus }}
    </div>
    <div class="debug-info" v-if="started">
      <div>Grounded: {{ fpsController?.isGrounded || false }}</div>
      <div>Position: {{ playerPosition.x.toFixed(2) }}, {{ playerPosition.y.toFixed(2) }}, {{ playerPosition.z.toFixed(2) }}</div>
      <div>Moving: {{ fpsController?.isMoving || false }}</div>
      <div>Speed: {{ fpsController?.currentSpeed?.toFixed(2) || '0.00' }}</div>
      <div>Facing: {{ playerFacing.x.toFixed(2) }}, {{ playerFacing.y.toFixed(2) }}, {{ playerFacing.z.toFixed(2) }}</div>
      <div>Ping: {{ ping }}ms</div>
      <div>Players: {{ Object.keys(serverPlayers).length }}</div>
      <div>Prediction Error: {{ predictionError.toFixed(2) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, shallowRef, onMounted, onBeforeUnmount } from 'vue';
import * as THREE from 'three';
import { SceneManager } from '@/lib/scene';
import { PhysicsManager } from '@/lib/physics';
import { FPSController } from '@/lib/fpscontroller';
import { PLAYER_CONFIG, NETWORK_CONFIG, parsePlayerState, formatPlayerState } from '@/lib/players';

// WebSocket connection variables
const ws = shallowRef(null);
const connectionStatus = ref('disconnected');
const ping = ref(0);
const playerId = ref(null);
const serverPlayers = reactive({});
const inputSequence = ref(0);
const pendingInputs = ref([]);

// Add prediction-related variables
const predictionError = ref(0);
const lastServerUpdate = ref(null);

// Refs for DOM elements
const gameCanvas = ref(null);

// State variables
const loading = ref(true);
const started = ref(false);
const errorMessage = ref('');
const frameCount = ref(0);
const initTimeout = ref(null);

// Player state for UI
const playerPosition = ref(new THREE.Vector3());
const playerFacing = ref(new THREE.Vector3(0, 0, -1));

// Game managers
const sceneManager = shallowRef(null);
const physicsManager = shallowRef(null);
const fpsController = shallowRef(null);

// Clock for animation
const clock = new THREE.Clock();

// Floating origin
const worldOriginOffset = shallowRef(new THREE.Vector3(0, 0, 0));

// Initialize game systems
const initializeGame = async () => {
  try {
    // Initialize physics
    physicsManager.value = new PhysicsManager();
    await physicsManager.value.initialize();
    
    // Initialize scene
    sceneManager.value = new SceneManager();
    sceneManager.value.setupScene(gameCanvas.value);
    
    // Create game world
    const planet = physicsManager.value.createPlanet(sceneManager.value.scene);
    sceneManager.value.planet = planet;
    
    const platformData = physicsManager.value.createPlatform(sceneManager.value.scene);
    if (platformData) {
      sceneManager.value.platform = platformData.platform;
      sceneManager.value.movingPlatform = platformData.movingPlatform;
      platformData.movingPlatform.userData.physicsBody = platformData.movingPlatformBody;
    }
    
    // Initialize FPS controller
    fpsController.value = new FPSController(physicsManager.value, sceneManager.value);
    fpsController.value.createPlayer(0, PLAYER_CONFIG.SPAWN_HEIGHT, 0);
    
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
    gameCanvas.value.requestPointerLock();
    started.value = true;
    
    // Connect to server
    connectToServer();
    
    // Start sending inputs
    setInterval(sendInputToServer, 1000 / NETWORK_CONFIG.INPUT_RATE);
    
    // Start animation loop
    animate();
  }
};

// Animation loop
const animate = () => {
  if (!started.value) return;
  
  requestAnimationFrame(animate);
  
  try {
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    frameCount.value++;
    
    if (physicsManager.value && fpsController.value && sceneManager.value) {
      // Step physics
      physicsManager.value.step();
      
      // Process collision events
      fpsController.value.processCollisionEvents();
      
      // Check grounded state
      fpsController.value.checkGrounded(frameCount.value);
      
      // Handle movement
      fpsController.value.handleAllMovement(deltaTime, frameCount.value);
      
      // Update player transform
      fpsController.value.updatePlayerTransform();
      
      // Update dynamic objects
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
      
      // Update other players interpolation
      sceneManager.value.updateOtherPlayersInterpolation();
      
      // Update detached camera if needed
      if (fpsController.value.isCameraDetached) {
        fpsController.value.updateDetachedCamera();
      }
      
      // Update UI state
      playerPosition.value.copy(fpsController.value.playerPosition);
      playerFacing.value.copy(fpsController.value.playerFacing);
    }
    
    // Render scene
    sceneManager.value?.render();
  } catch (e) {
    errorMessage.value = "Error in animation loop: " + e.message;
    console.error("Error in animation loop:", e);
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

// Connect to WebSocket server
const connectToServer = () => {
  try {
    const config = useRuntimeConfig();
    const wsUrl = config.public.wsUrl || 'ws://localhost:8080/ws';
    
    console.log('Connecting to WebSocket server at:', wsUrl);
    
    ws.value = new WebSocket(wsUrl);
    connectionStatus.value = 'connecting...';
    
    ws.value.onopen = () => {
      console.log('Connected to server');
      connectionStatus.value = 'connected';
      
      // Start ping interval
      setInterval(() => {
        if (ws.value && ws.value.readyState === WebSocket.OPEN) {
          ws.value.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 1000);
    };
    
    ws.value.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (e) {
        console.error('Error parsing server message:', e);
      }
    };
    
    ws.value.onclose = () => {
      connectionStatus.value = 'disconnected';
      console.log('Disconnected from server');
      
      // Try to reconnect after 3 seconds
      setTimeout(connectToServer, 3000);
    };
    
    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error);
      connectionStatus.value = 'error';
    };
  } catch (e) {
    console.error('Error connecting to server:', e);
    errorMessage.value = 'Failed to connect to server: ' + e.message;
  }
};

// Handle messages from server
const handleServerMessage = (message) => {
  switch (message.type) {
    case 'init':
      playerId.value = message.playerId;
      console.log('Initialized as player:', playerId.value);
      if (message.state) {
        Object.entries(message.state).forEach(([id, playerData]) => {
          if (id !== playerId.value) {
            updateOtherPlayer(id, playerData);
          }
        });
      }
      break;
      
    case 'state':
      applyServerState(message);
      break;
      
    case 'playerLeft':
      removeOtherPlayer(message.playerId);
      break;
      
    case 'pong':
      ping.value = Date.now() - message.timestamp;
      break;
  }
};

// Apply server state with client-side prediction
const applyServerState = (state) => {
  if (!state) return;
  
  const actualState = state.state || state;
  
  Object.assign(serverPlayers, actualState);
  
  Object.entries(actualState).forEach(([id, playerData]) => {
    if (id !== playerId.value) {
      updateOtherPlayer(id, playerData);
    } else if (fpsController.value?.playerBody) {
      reconcilePlayerPosition(playerData);
    }
  });
  
  Object.keys(sceneManager.value?.otherPlayerMeshes || {}).forEach(id => {
    if (!actualState[id]) {
      removeOtherPlayer(id);
    }
  });
};

// Reconcile local player position with server state
const reconcilePlayerPosition = (serverData) => {
  if (!fpsController.value?.playerBody) return;
  
  const parsedData = parsePlayerState(serverData);
  const serverOrigin = new THREE.Vector3(...parsedData.worldOrigin);
  
  if (!worldOriginOffset.value.equals(serverOrigin)) {
    console.log('Server shifted origin from', worldOriginOffset.value, 'to', serverOrigin);
    
    const shift = serverOrigin.clone().sub(worldOriginOffset.value);
    worldOriginOffset.value.copy(serverOrigin);
    
    Object.entries(sceneManager.value?.otherPlayerMeshes || {}).forEach(([id, mesh]) => {
      mesh.position.sub(shift);
    });
    
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
  
  lastServerUpdate.value = {
    ...parsedData,
    timestamp: Date.now()
  };
  
  const currentPosRapier = fpsController.value.playerBody.translation();
  const currentPos = new THREE.Vector3(currentPosRapier.x, currentPosRapier.y, currentPosRapier.z);
  
  const serverWorldPos = new THREE.Vector3(...parsedData.position);
  const serverLocalPos = serverWorldPos.sub(worldOriginOffset.value);
  
  predictionError.value = currentPos.distanceTo(serverLocalPos);
  
  const ackIndex = pendingInputs.value.findIndex(
    input => input.sequence === parsedData.inputSequence
  );
  
  if (ackIndex >= 0) {
    pendingInputs.value.splice(0, ackIndex + 1);
    
    if (predictionError.value > NETWORK_CONFIG.RECONCILIATION_THRESHOLD) {
      console.log('Reconciling position - error:', predictionError.value);
      
      fpsController.value.playerBody.setTranslation({
        x: serverLocalPos.x,
        y: serverLocalPos.y,
        z: serverLocalPos.z
      });
      
      fpsController.value.playerBody.setLinvel({
        x: parsedData.velocity[0],
        y: parsedData.velocity[1],
        z: parsedData.velocity[2]
      });
      
      fpsController.value.playerBody.setRotation({
        x: parsedData.rotation[0],
        y: parsedData.rotation[1],
        z: parsedData.rotation[2],
        w: parsedData.rotation[3]
      });
      
      pendingInputs.value.forEach(input => {
        fpsController.value.applyInputLocally(input.input, input.deltaTime);
      });
    }
  }
};

// Send input to server with timestamp
const sendInputToServer = () => {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN || !started.value) return;
  
  const playerState = fpsController.value.getPlayerState();
  if (!playerState) return;
  
  const input = {
    forward: fpsController.value.keys.forward,
    backward: fpsController.value.keys.backward,
    left: fpsController.value.keys.left,
    right: fpsController.value.keys.right,
    jump: fpsController.value.keys.jump,
    run: fpsController.value.keys.run,
    yaw: fpsController.value.cameraRotation.y,
    pitch: fpsController.value.cameraRotation.x,
    world_position: playerState.position,
    world_origin: [
      worldOriginOffset.value.x,
      worldOriginOffset.value.y,
      worldOriginOffset.value.z
    ]
  };
  
  const sequence = ++inputSequence.value;
  const timestamp = Date.now();
  const deltaTime = 1.0 / 60.0;
  
  pendingInputs.value.push({
    input,
    sequence,
    timestamp,
    deltaTime
  });
  
  fpsController.value.applyInputLocally(input, deltaTime);
  
  ws.value.send(JSON.stringify({
    type: 'input',
    input,
    sequence
  }));
  
  const cutoffTime = timestamp - NETWORK_CONFIG.PENDING_INPUT_TIMEOUT;
  pendingInputs.value = pendingInputs.value.filter(
    pendingInput => pendingInput.timestamp > cutoffTime
  );
};

// Update other player handling
const updateOtherPlayer = (id, playerData) => {
  if (!sceneManager.value) return;
  sceneManager.value.updateOtherPlayer(id, playerData, worldOriginOffset.value);
};

const removeOtherPlayer = (id) => {
  if (!sceneManager.value) return;
  sceneManager.value.removeOtherPlayer(id);
  delete serverPlayers[id];
};

// Lifecycle hooks
onMounted(async () => {
  try {
    console.log("Starting game initialization...");
    
    initTimeout.value = setTimeout(() => {
      if (loading.value) {
        console.warn("Initialization timed out - forcing start anyway");
        loading.value = false;
        errorMessage.value = "Some systems may not be working correctly, but you can try to play anyway.";
      }
    }, 8000);
    
    const success = await initializeGame();
    
    if (initTimeout.value) {
      clearTimeout(initTimeout.value);
      initTimeout.value = null;
    }
    
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
    
    if (initTimeout.value) {
      clearTimeout(initTimeout.value);
      initTimeout.value = null;
    }
    
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
  
  if (ws.value) {
    ws.value.close();
  }
  
  sceneManager.value?.renderer?.dispose();
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