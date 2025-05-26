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
      <div>Grounded: {{ isGrounded }}</div>
      <div>Position: {{ playerPosition.x.toFixed(2) }}, {{ playerPosition.y.toFixed(2) }}, {{ playerPosition.z.toFixed(2) }}</div>
      <div>Moving: {{ isMoving }}</div>
      <div>Speed: {{ currentSpeed.toFixed(2) }}</div>
      <div>Facing: {{ playerFacing.x.toFixed(2) }}, {{ playerFacing.y.toFixed(2) }}, {{ playerFacing.z.toFixed(2) }}</div>
      <div>Ping: {{ ping }}ms</div>
      <div>Players: {{ Object.keys(serverPlayers).length }}</div>
      <div>Prediction Error: {{ predictionError.toFixed(2) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, shallowRef, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createPlanet, createPlatform, createPushableRock, updateDynamicObjects } from '~/lib/scene.js';
import { createPlayer, createRayVisualizations, updateRayVisualizations, setupCollisionHandling } from '~/lib/players.js';
import { processCollisionEvents, checkGrounded, alignPlayerToSurface, handleAllMovement, updatePlayerTransform, applyInputLocally } from '~/lib/physics.js';

// Make sure rayDir exists globally first thing
window.rayDir = new THREE.Vector3(0, -1, 0);

// Define the reactive version and all related ray variables properly
const rayDir = shallowRef(window.rayDir);
const leftFootPos = shallowRef(new THREE.Vector3());
const rightFootPos = shallowRef(new THREE.Vector3());
const centerFootPos = shallowRef(new THREE.Vector3());
const collisionPoints = shallowRef([]);

// WebSocket connection variables
const ws = shallowRef(null);
const connectionStatus = ref('disconnected');
const ping = ref(0);
const playerId = ref(null);
const serverPlayers = reactive({});
const inputSequence = ref(0);
const pendingInputs = ref([]);
const otherPlayerMeshes = reactive({});

// Add prediction-related variables
const predictionError = ref(0);
const lastServerUpdate = ref(null);

// Refs for DOM elements
const gameCanvas = ref(null);

// State variables
const loading = ref(true);
const started = ref(false);
const isGrounded = ref(false);
const wasGrounded = ref(false);
const playerPosition = ref(new THREE.Vector3());
const playerFacing = ref(new THREE.Vector3(0, 0, -1)); // Add player facing direction
const isMoving = ref(false);
const currentSpeed = ref(0);
const isCameraDetached = ref(false);
const errorMessage = ref(''); // Add error message state
const lastPlayerPosition = shallowRef(null); // Add this declaration
const positionStuckFrames = ref(0); // Add this declaration
const lastDebugTime = ref(0); // Add this declaration
const frameCount = ref(0); // Add frameCount as a reactive variable
const initTimeout = ref(null); // For physics initialization timeout

// THREE.js objects - use shallowRef to prevent reactivity issues
const scene = shallowRef(null);
const camera = shallowRef(null);
const renderer = shallowRef(null);
const player = shallowRef(null);
const platform = shallowRef(null);
const planet = shallowRef(null);
const movingPlatform = shallowRef(null); // Add moving platform reference
const movingPlatformBody = shallowRef(null); // Add moving platform body reference
const clock = new THREE.Clock();

// Debug visualization objects
const leftRayLine = shallowRef(null);
const rightRayLine = shallowRef(null);
const centerRayLine = shallowRef(null);
const facingLine = shallowRef(null);

// Physics
const physicsWorld = shallowRef(null);
const playerBody = shallowRef(null);
const leftFootHit = shallowRef(null);
const rightFootHit = shallowRef(null);
const centerFootHit = shallowRef(null); // Add this line to define centerFootHit as a shallowRef

// Add missing jump-related variables
const jumpInProgress = shallowRef(false);
const jumpTime = ref(0);
const jumpDuration = 0.5; // Jump duration in seconds
const lastGroundNormal = shallowRef(new THREE.Vector3(0, 1, 0));

// Player data
const playerHeight = 1.8;
const playerRadius = 0.4;
const cameraRotation = shallowRef(new THREE.Euler(0, 0, 0, 'YXZ'));
const walkSpeed = 8; // Increased from 4 to 8
const runSpeed = 16;  // Increased from 8 to 16
const jumpForce = 8;

// Controls
const keys = reactive({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  run: false,
  rollLeft: false,   // Add Q key for roll left
  rollRight: false   // Add E key for roll right
});

// Physics settings
const gravity = reactive({
  center: new THREE.Vector3(0, -230, 0), // Planet center position
  strength: 25  // Reduced from 50 to 25 for lighter, more comfortable gravity
});

// Initialize debugInfo as a reactive object to store debugging information
const debugInfo = reactive({
  planetHandle: null,
  platformHandle: null,
  wallHandle: null,
  rampHandle: null,
  playerColliderHandle: null,
  lastQueryResult: null,
  colliderCount: 0
});

// Modify the utility function to get ground normal to use planet-centered gravity
const getGroundNormal = () => {
  // Get player position
  const playerTranslation = playerBody.value.translation();
  const playerPos = new THREE.Vector3(
    playerTranslation.x,
    playerTranslation.y,
    playerTranslation.z
  );
  
  // Calculate gravity direction from planet center
  const gravityDir = new THREE.Vector3()
    .subVectors(gravity.center, playerPos)
    .normalize();
  
  // Use surface normal from ray hits if available
  let groundNormal = gravityDir.clone().multiplyScalar(-1); // Default to opposite of gravity
  
  if (centerFootHit.value && centerFootHit.value.normal) {
    groundNormal = new THREE.Vector3(
      centerFootHit.value.normal.x,
      centerFootHit.value.normal.y,
      centerFootHit.value.normal.z
    );
  }
  
  // Up vector is the ground normal
  const upVector = groundNormal.clone();
  
  return { groundNormal, upVector, gravityDir, playerPos };
};

// Define the onResize function earlier in the file, before onMounted
const onResize = () => {
  if (!camera.value || !renderer.value) return;
  
  // Update camera aspect ratio
  camera.value.aspect = window.innerWidth / window.innerHeight;
  camera.value.updateProjectionMatrix();
  
  // Resize renderer
  renderer.value.setSize(window.innerWidth, window.innerHeight);
};

// Fix the onMouseMove function to handle player rotation when grounded and full 3D rotation when airborne
const onMouseMove = (event) => {
  if (!started.value || document.pointerLockElement !== gameCanvas.value) return;
  
  const lookSensitivity = 0.001;
  const yawSensitivity = 0.002;
  
  try {
    if (isGrounded.value && playerBody.value) {
      // When grounded, only allow camera pitch and player yaw
      
      // Update camera pitch with limits (always affects camera)
      cameraRotation.value.x -= event.movementY * lookSensitivity;
      cameraRotation.value.x = Math.max(
        -Math.PI / 2 + 0.01, 
        Math.min(Math.PI / 2 - 0.01, cameraRotation.value.x)
      );
      
      // Rotate the player body for yaw instead of camera
      const currentPlayerQuat = new THREE.Quaternion(
        playerBody.value.rotation().x,
        playerBody.value.rotation().y,
        playerBody.value.rotation().z,
        playerBody.value.rotation().w
      );
      
      // Create yaw rotation around the up vector (surface normal)
      let upVector = new THREE.Vector3(0, 1, 0); // Default up
      if (lastGroundNormal.value) {
        upVector = lastGroundNormal.value.clone();
      }
      
      const yawDelta = -event.movementX * yawSensitivity;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, yawDelta);
      
      // Apply yaw rotation to player body
      currentPlayerQuat.premultiply(yawQuat);
      
      // Update player body rotation
      playerBody.value.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
      
      // Keep camera yaw at 0 since player body is now handling the yaw
      cameraRotation.value.y = 0;
    } else {
      // When airborne, rotate the entire player capsule with mouse movement
      if (playerBody.value) {
        const currentPlayerQuat = new THREE.Quaternion(
          playerBody.value.rotation().x,
          playerBody.value.rotation().y,
          playerBody.value.rotation().z,
          playerBody.value.rotation().w
        );
        
        // Create pitch rotation around local right axis
        const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
        const pitchDelta = -event.movementY * lookSensitivity;
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, pitchDelta);
        
        // Create yaw rotation around local up axis
        const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentPlayerQuat);
        const yawDelta = -event.movementX * yawSensitivity;
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(localUp, yawDelta);
        
        // Apply both rotations to player body
        currentPlayerQuat.premultiply(pitchQuat);
        currentPlayerQuat.premultiply(yawQuat);
        
        // Update player body rotation
        playerBody.value.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
        
        // Keep camera rotation at 0 since player body handles all rotation
        cameraRotation.value.x = 0;
        cameraRotation.value.y = 0;
      }
    }
  } catch (e) {
    console.error("Error in mouse move:", e);
  }
};

// Add missing onPointerLockChange function before onMounted
const onPointerLockChange = () => {
  if (document.pointerLockElement !== gameCanvas.value) {
    // Pointer lock was exited
    keys.forward = false;
    keys.backward = false;
    keys.left = false;
    keys.right = false;
    keys.jump = false;
    keys.run = false;
  }
};

// Update resetCameraForAirborne function to properly handle transition
const resetCameraForAirborne = () => {
  // When transitioning from grounded to airborne, transfer camera pitch to player rotation
  if (player.value && playerBody.value && wasGrounded.value && !isGrounded.value) {
    console.log("Transitioning to airborne - transferring camera rotation to player body");
    
    // Get current player quaternion
    const currentPlayerQuat = new THREE.Quaternion(
      playerBody.value.rotation().x,
      playerBody.value.rotation().y,
      playerBody.value.rotation().z,
      playerBody.value.rotation().w
    );
    
    // Apply current camera pitch to player rotation around local right axis
    if (Math.abs(cameraRotation.value.x) > 0.01) {
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, cameraRotation.value.x);
      
      currentPlayerQuat.premultiply(pitchQuat);
      
      // Update player body with new rotation
      playerBody.value.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
    }
    
    // Reset camera rotation since player body now handles all rotation
    cameraRotation.value.x = 0;
    cameraRotation.value.y = 0;
    cameraRotation.value.z = 0;
    
    // Unlock rotations for airborne movement
    // Note: We can't change the locked rotations flag after creation, 
    // but we can manually control rotation through setRotation
  }
};

// Add missing projectVectorOntoPlane function
const projectVectorOntoPlane = (vector, planeNormal) => {
  const dot = vector.dot(planeNormal);
  return vector.clone().sub(planeNormal.clone().multiplyScalar(dot));
};

// Add onKeyDown and onKeyUp functions before onMounted
const onKeyDown = (event) => {
  if (!started.value) return;
  
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = true;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = true;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = true;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = true;
      break;
    case 'KeyQ': // Add Q key for roll left when airborne
      keys.rollLeft = true;
      break;
    case 'KeyE': // Add E key for roll right when airborne
      keys.rollRight = true;
      break;
    case 'Space':
      if (isGrounded.value) {
        keys.jump = true;
      }
      break;
    case 'ShiftLeft':
      keys.run = true;
      break;
    case 'KeyO': // Add 'o' key handler
      toggleCameraAttachment();
      break;
  }
};

const onKeyUp = (event) => {
  if (!started.value) return;
  
  switch (event.code) {
    case 'KeyW':
    case 'ArrowUp':
      keys.forward = false;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keys.backward = false;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keys.left = false;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keys.right = false;
      break;
    case 'KeyQ': // Add Q key release
      keys.rollLeft = false;
      break;
    case 'KeyE': // Add E key release
      keys.rollRight = false;
      break;
    case 'Space':
      keys.jump = false;
      break;
    case 'ShiftLeft':
      keys.run = false;
      break;
  }
};

// Connect to WebSocket server
const connectToServer = () => {
  try {
    // Use runtime config to get WebSocket URL
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
          const startTime = Date.now();
          ws.value.send(JSON.stringify({ type: 'ping' }));
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
      console.log('Initial state received:', message.state);
      // Process initial state to create other players
      if (message.state) {
        Object.entries(message.state).forEach(([id, playerData]) => {
          if (id !== playerId.value) {
            console.log('Creating initial player:', id, playerData);
            updateOtherPlayer(id, playerData);
          }
        });
      }
      break;
      
    case 'state':
      // The state message contains the state object
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
  
  // Check if state is wrapped in a 'state' property (from ServerMessage::State)
  const actualState = state.state || state;
  
  // Update server players state
  Object.assign(serverPlayers, actualState);
  
  // Update other players
  Object.entries(actualState).forEach(([id, playerData]) => {
    if (id !== playerId.value) {
      updateOtherPlayer(id, playerData);
    } else if (playerBody.value) {
      // Reconcile own player position with server
      reconcilePlayerPosition(playerData);
    }
  });
  
  // Remove players that are no longer in the state
  Object.keys(otherPlayerMeshes).forEach(id => {
    if (!actualState[id]) {
      removeOtherPlayer(id);
    }
  });
};

// Reconcile local player position with server state
const reconcilePlayerPosition = (serverData) => {
  if (!playerBody.value) return;
  
  // Update our world origin to match server
  const serverOrigin = new THREE.Vector3(
    serverData.worldOrigin[0],
    serverData.worldOrigin[1],
    serverData.worldOrigin[2]
  );
  
  // Check if server shifted the origin
  if (!worldOriginOffset.value.equals(serverOrigin)) {
    console.log('Server shifted origin from', worldOriginOffset.value, 'to', serverOrigin);
    
    // Calculate the shift amount
    const shift = serverOrigin.clone().sub(worldOriginOffset.value);
    
    // Update our world origin
    worldOriginOffset.value.copy(serverOrigin);
    
    // Adjust all other players' visual positions by the shift
    Object.entries(otherPlayerMeshes).forEach(([id, mesh]) => {
      mesh.position.sub(shift);
    });
    
    // Adjust all physics objects
    if (scene.value) {
      scene.value.traverse((child) => {
        if (child.isMesh && child.userData.physicsBody && child !== player.value) {
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
  
  // Store last server update
  lastServerUpdate.value = {
    position: serverData.position,
    velocity: serverData.velocity,
    rotation: serverData.rotation,
    sequence: serverData.inputSequence,
    timestamp: Date.now()
  };
  
  // Calculate prediction error
  const currentPosRapier = playerBody.value.translation();
  const currentPos = new THREE.Vector3(
    currentPosRapier.x,
    currentPosRapier.y,
    currentPosRapier.z
  );
  
  // Server sends world position, we need to convert to local
  const serverWorldPos = new THREE.Vector3(
    serverData.position[0],
    serverData.position[1],
    serverData.position[2]
  );
  const serverLocalPos = serverWorldPos.sub(worldOriginOffset.value);
  
  predictionError.value = currentPos.distanceTo(serverLocalPos);
  
  // Find the input that matches the server's acknowledged sequence
  const ackIndex = pendingInputs.value.findIndex(
    input => input.sequence === serverData.inputSequence
  );
  
  if (ackIndex >= 0) {
    // Remove acknowledged inputs
    const acknowledgedInputs = pendingInputs.value.splice(0, ackIndex + 1);
    
    // Only reconcile if prediction error is significant
    if (predictionError.value > 0.1) {
      console.log('Reconciling position - error:', predictionError.value);
      
      // Apply server position (already converted to local)
      playerBody.value.setTranslation({
        x: serverLocalPos.x,
        y: serverLocalPos.y,
        z: serverLocalPos.z
      });
      
      playerBody.value.setLinvel({
        x: serverData.velocity[0],
        y: serverData.velocity[1],
        z: serverData.velocity[2]
      });
      
      playerBody.value.setRotation({
        x: serverData.rotation[0],
        y: serverData.rotation[1],
        z: serverData.rotation[2],
        w: serverData.rotation[3]
      });
      
      // Re-apply unacknowledged inputs for client-side prediction
      pendingInputs.value.forEach(input => {
        applyInputLocally(input.input, input.deltaTime);
      });
    }
  }
};

// Send input to server with timestamp
const sendInputToServer = () => {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN || !started.value) return;
  
  const playerPos = playerBody.value ? playerBody.value.translation() : { x: 0, y: 0, z: 0 };
  
  // Don't shift origin on client - let server handle it
  // Remove the client-side origin shifting logic
  
  const input = {
    forward: keys.forward,
    backward: keys.backward,
    left: keys.left,
    right: keys.right,
    jump: keys.jump,
    run: keys.run,
    yaw: cameraRotation.value.y,
    pitch: cameraRotation.value.x,
    world_position: [
      playerPos.x + worldOriginOffset.value.x,
      playerPos.y + worldOriginOffset.value.y,
      playerPos.z + worldOriginOffset.value.z
    ],
    world_origin: [
      worldOriginOffset.value.x,
      worldOriginOffset.value.y,
      worldOriginOffset.value.z
    ]
  };
  
  const sequence = ++inputSequence.value;
  const timestamp = Date.now();
  const deltaTime = 1.0 / 60.0; // Assuming 60Hz
  
  // Store input for reconciliation
  pendingInputs.value.push({
    input,
    sequence,
    timestamp,
    deltaTime
  });
  
  // Apply input locally immediately (client-side prediction)
  applyInputLocally(input, deltaTime);
  
  // Send to server
  ws.value.send(JSON.stringify({
    type: 'input',
    input,
    sequence
  }));
  
  // Clean up old pending inputs (older than 2 seconds)
  const cutoffTime = timestamp - 2000;
  pendingInputs.value = pendingInputs.value.filter(
    pendingInput => pendingInput.timestamp > cutoffTime
  );
};

// Update other player visual representation with interpolation and floating origin
const updateOtherPlayer = (id, playerData) => {
  if (!scene.value) return;
  
  let mesh = otherPlayerMeshes[id];
  
  // Create mesh if it doesn't exist
  if (!mesh) {
    const geometry = new THREE.CapsuleGeometry(0.4, 1.0, 8, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.7
    });
    
    mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.value.add(mesh);
    otherPlayerMeshes[id] = mesh;
    
    // Store interpolation data
    mesh.userData.interpolation = {
      fromPos: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      fromRot: new THREE.Quaternion(),
      toRot: new THREE.Quaternion(),
      startTime: Date.now(),
      duration: 100 // Interpolate over 100ms
    };
    
    console.log('Created mesh for player:', id);
  }
  
  // Server sends world position, convert to local position
  const worldPos = new THREE.Vector3(
    playerData.position[0],
    playerData.position[1],
    playerData.position[2]
  );
  
  // Get the other player's world origin from server data
  const otherPlayerOrigin = new THREE.Vector3(
    playerData.worldOrigin[0],
    playerData.worldOrigin[1],
    playerData.worldOrigin[2]
  );
  
  // Calculate relative position: other player's world position relative to our world origin
  // This accounts for both players potentially having different origins
  const relativePos = worldPos.clone().sub(worldOriginOffset.value);
  
  // Update interpolation targets
  const interp = mesh.userData.interpolation;
  interp.fromPos.copy(mesh.position);
  interp.fromRot.copy(mesh.quaternion);
  interp.toPos.copy(relativePos);
  interp.toRot.set(
    playerData.rotation[0],
    playerData.rotation[1],
    playerData.rotation[2],
    playerData.rotation[3]
  );
  interp.startTime = Date.now();
  
  console.log(`Player ${id} at world pos [${playerData.position.join(', ')}], origin [${playerData.worldOrigin.join(', ')}], relative pos [${relativePos.x.toFixed(1)}, ${relativePos.y.toFixed(1)}, ${relativePos.z.toFixed(1)}]`);
};

// Add interpolation update to animate function
const updateOtherPlayersInterpolation = () => {
  const now = Date.now();
  
  Object.values(otherPlayerMeshes).forEach(mesh => {
    if (!mesh.userData.interpolation) return;
    
    const interp = mesh.userData.interpolation;
    const elapsed = now - interp.startTime;
    const t = Math.min(elapsed / interp.duration, 1.0);
    
    // Smooth interpolation using easing
    const easedT = t * t * (3.0 - 2.0 * t); // smoothstep
    
    // Interpolate position
    mesh.position.lerpVectors(interp.fromPos, interp.toPos, easedT);
    
    // Interpolate rotation
    mesh.quaternion.slerpQuaternions(interp.fromRot, interp.toRot, easedT);
  });
};

// Modify the animate function to use imported physics functions
const animate = () => {
  if (!started.value) return;
  
  requestAnimationFrame(animate);
  
  try {
    if (!rayDir || !rayDir.value) {
      console.warn("rayDir not initialized, creating default");
      rayDir.value = new THREE.Vector3(0, -1, 0);
    }
    
    if (errorMessage.value) {
      errorMessage.value = '';
    }
    
    const deltaTime = Math.min(clock.getDelta(), 0.1);
    
    if (physicsWorld.value) {
      try {
        physicsWorld.value.step();
        // Process collision events after physics step - use imported function
        processCollisionEvents(physicsWorld.value, debugInfo);
        
        // Also process contact force events if available
        if (physicsWorld.value.contactForceEventQueue) {
          physicsWorld.value.contactForceEventQueue.drainContactForceEvents((event) => {
            // Contact force events can help with grounding detection
            if (debugInfo.playerColliderHandle && 
                (event.collider1() === debugInfo.playerColliderHandle || 
                 event.collider2() === debugInfo.playerColliderHandle)) {
              lastGroundContact.value = performance.now();
            }
          });
        }
      } catch (e) {
        console.error("Error stepping physics world:", e);
      }
    }
    
    if (!physicsWorld.value || !playerBody.value || !player.value) {
      if (renderer.value && scene.value && camera.value) {
        renderer.value.render(scene.value, camera.value);
      }
      console.warn("Waiting for game components to initialize...");
      return;
    }
    
    frameCount.value++;
    
    // Update physics and player - IMPORTANT: Order matters!
    // Check grounded using imported function
    const groundingResult = checkGrounded(
      playerBody.value,
      physicsWorld.value,
      gravity,
      playerRadius,
      playerHeight,
      rayDir.value,
      leftFootPos.value,
      rightFootPos.value,
      centerFootPos.value,
      frameCount.value
    );
    
    wasGrounded.value = isGrounded.value;
    isGrounded.value = groundingResult.isGrounded;
    leftFootHit.value = groundingResult.leftFootHit;
    rightFootHit.value = groundingResult.rightFootHit;
    centerFootHit.value = groundingResult.centerFootHit;
    
    // Handle transition from grounded to airborne
    if (wasGrounded.value && !isGrounded.value) {
      resetCameraForAirborne();
    }
    
    // Align player to surface when grounded AND adjust position so feet touch ground
    if (isGrounded.value && (centerFootHit.value || leftFootHit.value || rightFootHit.value)) {
      alignPlayerToSurface(
        playerBody.value,
        player.value,
        groundingResult.gravityDir,
        centerFootHit.value,
        leftFootHit.value,
        rightFootHit.value,
        lastGroundNormal.value
      );
      
      // Adjust player position so feet are at contact point
      const closestHit = centerFootHit.value || leftFootHit.value || rightFootHit.value;
      if (closestHit && closestHit.toi !== undefined) {
        // Calculate where the feet should be based on the ray hit
        const hitPoint = new THREE.Vector3(
          closestHit.point.x,
          closestHit.point.y,
          closestHit.point.z
        );
        
        // Calculate the offset from current player center to where it should be
        const upDir = groundingResult.gravityDir.clone().multiplyScalar(-1);
        const targetPlayerCenter = hitPoint.clone().add(upDir.clone().multiplyScalar(playerHeight * 0.5));
        
        // Apply a small offset to prevent sinking into terrain
        targetPlayerCenter.add(upDir.clone().multiplyScalar(0.05));
        
        // Smoothly move player to correct position
        const playerTranslation = playerBody.value.translation();
        const currentPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
        const correction = targetPlayerCenter.clone().sub(currentPos);
        
        // Only apply correction if it's significant
        if (correction.length() > 0.01 && correction.length() < 2.0) {
          // Apply partial correction to avoid jitter
          correction.multiplyScalar(0.3);
          playerBody.value.setTranslation({
            x: currentPos.x + correction.x,
            y: currentPos.y + correction.y,
            z: currentPos.z + correction.z
          });
        }
      }
    }
    
    // Handle all movement in one place including gravity - use imported function
    const movementResult = handleAllMovement(
      playerBody.value,
      scene.value,
      keys,
      gravity,
      cameraRotation.value,
      isGrounded.value,
      lastGroundNormal.value,
      jumpInProgress,
      jumpTime,
      jumpDuration,
      jumpForce,
      walkSpeed,
      runSpeed,
      frameCount.value,
      deltaTime
    );
    
    jumpInProgress.value = movementResult.jumpInProgress;
    jumpTime.value = movementResult.jumpTime;
    isMoving.value = movementResult.isMoving;
    currentSpeed.value = movementResult.currentSpeed;
    
    // Update visual transform after physics - use imported function
    const transformResult = updatePlayerTransform(
      playerBody.value,
      player.value,
      camera.value,
      isGrounded.value,
      cameraRotation.value
    );
    
    if (transformResult) {
      playerFacing.value = transformResult.playerFacing;
    }
    
    // Update all dynamic physics objects (rocks, etc.) - use imported function
    updateDynamicObjects(scene.value);
    
    // Update ray visualizations using imported function
    if (player.value && rayDir.value && leftRayLine.value) {
      const rayLines = {
        leftRayLine: leftRayLine.value,
        rightRayLine: rightRayLine.value,
        centerRayLine: centerRayLine.value,
        facingLine: facingLine.value
      };
      
      updateRayVisualizations(
        rayLines,
        leftFootPos.value.clone(), 
        rightFootPos.value.clone(), 
        centerFootPos.value.clone(), 
        rayDir.value, 
        2.0, // Shorter rays for grounding
        leftFootHit.value,
        rightFootHit.value,
        centerFootHit.value,
        player.value
      );
    }
    
    // Update other players' interpolation
    updateOtherPlayersInterpolation();
    
    // Update camera if detached
    if (isCameraDetached.value) {
      updateDetachedCamera();
    }
    
    // Update UI position display
    if (playerBody.value) {
      const position = playerBody.value.translation();
      const displayPos = playerPosition.value;
      displayPos.set(position.x, position.y, position.z);
    }
    
    // Render scene
    if (renderer.value && scene.value && camera.value) {
      renderer.value.render(scene.value, camera.value);
    }
  } catch (e) {
    errorMessage.value = "Error in animation loop: " + e.message;
    console.error("Error in animation loop:", e);
  }
};

// Add missing setupScene function before onMounted
const setupScene = () => {
  try {
    console.log("Setting up scene...");
    
    // Create Three.js scene
    scene.value = new THREE.Scene();
    scene.value.background = new THREE.Color(0x111122);
    scene.value.fog = new THREE.Fog(0x111122, 100, 300);
    
    // Create camera
    camera.value = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.value.position.set(0, playerHeight, 0);
    
    // Create renderer
    renderer.value = new THREE.WebGLRenderer({ antialias: true });
    renderer.value.setSize(window.innerWidth, window.innerHeight);
    renderer.value.setPixelRatio(window.devicePixelRatio);
    renderer.value.shadowMap.enabled = true;
    renderer.value.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
    
    // Add to DOM
    if (gameCanvas.value) {
      gameCanvas.value.appendChild(renderer.value.domElement);
    } else {
      console.error("Game canvas element not found");
      throw new Error("Game canvas element not found");
    }
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x444444, 0.4);
    scene.value.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.value.add(directionalLight);
    
    // Create game objects if physics is ready
    if (physicsWorld.value) {
      planet.value = createPlanet(scene.value, physicsWorld.value, debugInfo, gravity);
      const platformResult = createPlatform(scene.value, physicsWorld.value, debugInfo);
      if (platformResult) {
        platform.value = platformResult.platform;
        movingPlatform.value = platformResult.movingPlatform;
      }
      
      // Create player using imported function
      const playerResult = createPlayer(scene.value, physicsWorld.value, camera.value, debugInfo, playerHeight, playerRadius);
      if (playerResult) {
        player.value = playerResult.player;
        playerBody.value = playerResult.playerBody;
      }
      
      // Create ray visualizations using imported function
      const rayResult = createRayVisualizations(scene.value, player.value);
      if (rayResult) {
        leftRayLine.value = rayResult.leftRayLine;
        rightRayLine.value = rayResult.rightRayLine;
        centerRayLine.value = rayResult.centerRayLine;
        facingLine.value = rayResult.facingLine;
      }
      
      // Set up collision handling using imported function
      setupCollisionHandling(physicsWorld.value);
    } else {
      console.warn("Physics not initialized, skipping physics object creation");
    }
    
    console.log("Scene setup complete!");
    return true;
  } catch (e) {
    console.error("Error in setupScene:", e);
    errorMessage.value = "Failed to set up scene: " + e.message;
    return false;
  }
};

// Modify the onMounted function to ensure proper initialization sequence
onMounted(async () => {
  try {
    console.log("Starting to initialize Rapier physics engine...");
    
    // Set a timeout to prevent hanging on loading screen
    initTimeout.value = setTimeout(() => {
      if (loading.value) {
        console.warn("Physics initialization timed out - forcing start anyway");
        loading.value = false;
        errorMessage.value = "Physics engine may not be working correctly, but you can try to play anyway.";
      }
    }, 8000); // 8 second timeout (increased from 5)
    
    // Initialize Rapier physics engine with explicit version and better error handling
    try {
      await RAPIER.init({
        locateFile: (path) => {
          console.log("Locating Rapier file:", path);
          return `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/${path}`;
        }
      });
      console.log("Rapier physics engine initialized successfully");
      
      // Create physics world with gravity that matches our planet-centered gravity
      if (!physicsWorld.value) {
        // Disable global gravity - we'll apply our own planet-centered gravity
        const gravityVec = { x: 0, y: 0, z: 0 };
        physicsWorld.value = new RAPIER.World(gravityVec);
        console.log("Physics world created with disabled gravity:", gravityVec);
      }
    } catch (rapierError) {
      console.error("Error initializing Rapier:", rapierError);
      errorMessage.value = "Failed to initialize physics engine: " + rapierError.message;
      // Continue to allow user to try starting the game anyway
    }
    
    // Clear timeout since initialization completed (successfully or not)
    if (initTimeout.value) {
      clearTimeout(initTimeout.value);
      initTimeout.value = null;
    }
    
    // Set loading to false
    loading.value = false;
    
    // Set up scene
    setupScene();
    
    // Handle browser events
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    
    console.log("Game initialization complete, ready to start");
  } catch (e) {
    console.error("Error during game initialization:", e);
    
    // Clear timeout since we hit the catch block
    if (initTimeout.value) {
      clearTimeout(initTimeout.value);
      initTimeout.value = null;
    }
    
    // Set error message and hide loading screen
    errorMessage.value = "Failed to initialize game: " + e.message;
    loading.value = false;
  }
}); // <-- This closing parenthesis was missing

// Update the startGame function to connect to server when starting
const startGame = () => {
  if (!physicsWorld.value) {
    errorMessage.value = "Physics engine not initialized. Please refresh the page.";
    return;
  }
  
  try {
    gameCanvas.value.requestPointerLock();
    started.value = true;
    
    // Connect to server when game starts
    connectToServer();
    
    // Start sending inputs to server at fixed rate
    setInterval(() => {
      sendInputToServer();
    }, 1000 / 60); // 60Hz input rate
    
    // Start animation loop
    animate();
  } catch (e) {
    console.error("Error starting game:", e);
    errorMessage.value = "Failed to start game: " + e.message;
  }
};

// Update the removeOtherPlayer function
const removeOtherPlayer = (id) => {
  const mesh = otherPlayerMeshes[id];
  if (mesh) {
    scene.value.remove(mesh);
    delete otherPlayerMeshes[id];
  }
  delete serverPlayers[id];
};

// Add floating origin variables near other state variables (after line ~24)
const worldOriginOffset = shallowRef(new THREE.Vector3(0, 0, 0));
const ORIGIN_SHIFT_THRESHOLD = 1000; // Shift origin when player is 1000 units from origin
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