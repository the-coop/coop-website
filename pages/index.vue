<template>
  <div class="game-container">
    <!-- Canvas container -->
    <div ref="gameCanvas" class="game-canvas"></div>
    
    <!-- Loading screen -->
    <div v-if="loading" class="loading-screen">
      <div class="loading-text">Loading...</div>
    </div>
    
    <!-- Start screen -->
    <div v-else-if="!started" class="start-screen">
      <div class="menu-container">
        <h1 class="game-title">CONQUEST</h1>
        <div class="menu-buttons">
          <button @click="startCampaign" class="menu-button campaign-button">
            <div class="button-title">Campaign</div>
            <div class="button-description">Play through story missions</div>
          </button>
          <button @click="startSandbox" class="menu-button sandbox-button">
            <div class="button-title">Sandbox</div>
            <div class="button-description">Free play with all features</div>
          </button>
          <button @click="startMultiplayer" class="menu-button multiplayer-button">
            <div class="button-title">Multiplayer</div>
            <div class="button-description">Play with others online</div>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Crosshair -->
    <div v-if="started && showCrosshair" class="crosshair">
      <div class="crosshair-line crosshair-horizontal"></div>
      <div class="crosshair-line crosshair-vertical"></div>
    </div>
    
    <!-- Debug info -->
    <div v-if="started && showDebug" class="debug-info">
      <div>Mode: {{ gameMode }}</div>
      <div>Position: {{ formatVector(debugInfo.position) }}</div>
      <div>Facing: {{ formatVector(debugInfo.facing) }}</div>
      <div>Speed: {{ debugInfo.currentSpeed.toFixed(2) }} m/s</div>
      <div>Moving: {{ debugInfo.isMoving ? 'Yes' : 'No' }}</div>
      <div>Grounded: {{ debugInfo.isGrounded ? 'Yes' : 'No' }}</div>
      <div>Swimming: {{ debugInfo.isSwimming ? 'Yes' : 'No' }}</div>
      <div v-if="debugInfo.inVehicle" class="vehicle-info">In Vehicle</div>
      <div v-if="gameMode === 'multiplayer'">
        <div>Connected: {{ debugInfo.connected ? 'Yes' : 'No' }}</div>
        <div>Players Online: {{ debugInfo.playersOnline }}</div>
      </div>
    </div>
    
    <!-- Add weapon HUD when game is started and in sandbox mode -->
    <div v-if="started && gameMode === 'sandbox' && weaponInfo" class="weapon-hud">
      <div class="weapon-name">{{ weaponInfo.weaponName }}</div>
      <div class="ammo-display" v-if="weaponInfo.maxAmmo > 0">
        <span class="current-ammo">{{ weaponInfo.currentAmmo }}</span>
        <span class="ammo-separator">/</span>
        <span class="max-ammo">{{ weaponInfo.maxAmmo }}</span>
      </div>
      <div v-if="weaponInfo.isReloading" class="reload-bar">
        <div class="reload-progress" :style="{ width: (weaponInfo.reloadProgress * 100) + '%' }"></div>
      </div>
    </div>
    
    <!-- Flight HUD -->
    <div v-if="showFlightHUD" class="flight-hud">
      <div class="flight-instruments">
        <div class="instrument-panel left-panel">
          <div class="instrument">
            <label>ALT</label>
            <span class="value">{{ flightData.altitude }}m</span>
          </div>
          <div class="instrument">
            <label>IAS</label>
            <span class="value">{{ flightData.airspeed }}m/s</span>
          </div>
          <div class="instrument">
            <label>VS</label>
            <span class="value" :class="{ positive: flightData.verticalSpeed > 0, negative: flightData.verticalSpeed < 0 }">
              {{ flightData.verticalSpeed > 0 ? '+' : '' }}{{ flightData.verticalSpeed }}m/s
            </span>
          </div>
        </div>
        
        <div class="attitude-indicator">
          <div class="horizon" :style="{ transform: `rotate(${-flightData.roll}deg) translateY(${flightData.pitch * 2}px)` }">
            <div class="sky"></div>
            <div class="ground"></div>
            <div class="horizon-line"></div>
          </div>
          <div class="aircraft-symbol"></div>
          <div class="pitch-ladder">
            <div class="pitch-mark" v-for="pitch in [-20, -10, 0, 10, 20]" :key="pitch" :style="{ top: `${50 - pitch * 2}%` }">
              {{ pitch }}°
            </div>
          </div>
          <!-- Add gravity reference indicator -->
          <div v-if="flightData.gravityDir" class="gravity-indicator" :style="gravityIndicatorStyle"></div>
        </div>
        
        <div class="instrument-panel right-panel">
          <div class="instrument">
            <label>HDG</label>
            <span class="value">{{ String(flightData.heading).padStart(3, '0') }}°</span>
          </div>
          <div class="instrument">
            <label>THR</label>
            <span class="value">{{ flightData.throttle }}%</span>
          </div>
          <div class="instrument" v-if="flightData.engineRPM">
            <label>RPM</label>
            <span class="value">{{ flightData.engineRPM }}</span>
          </div>
        </div>
      </div>
      
      <div class="flight-status">
        <span v-if="flightData.isGrounded" class="status-indicator grounded">GROUNDED</span>
        <span v-if="flightData.stallWarning" class="status-indicator warning">STALL WARNING</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, reactive, shallowRef, markRaw, computed } from 'vue';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsManager } from '../lib/physics.js';
import { SceneManager } from '../lib/scene.js';
import { FPSController } from '../lib/fpsController.js';
import { WebSocketManager } from '../lib/network.js';
import { PlayerManager } from '../lib/players.js';
import { CampaignLoader } from '../lib/campaignLoader.js';
import { WeaponSystem } from '../lib/weapons.js';
import { Pyrotechnics } from '../lib/pyrotechnics.js';

// Get WebSocket URL from runtime config
const config = useRuntimeConfig();
const wsUrl = config.public.wsUrl || 'ws://localhost:8080/ws';

// Refs
const gameCanvas = ref(null);
const loading = ref(true);
const started = ref(false);
const errorMessage = ref('');
const showDebug = ref(false); // Start with debug UI hidden

// Game state - use shallowRef to prevent deep reactivity
const physics = shallowRef(null);
const scene = shallowRef(null);
const player = shallowRef(null);
const clock = shallowRef(null);
const frameCount = ref(0);
const wsManager = shallowRef(null);
const playerManager = shallowRef(null);
const weaponSystem = shallowRef(null); // ADD THIS LINE - Define weaponSystem ref

// Add debug visibility state
const showDebugVisuals = ref(false); // Start with debug visuals hidden

// Add crosshair visibility state
const showCrosshair = ref(true);

// Add flight HUD visibility state
const showFlightHUD = ref(false);

// Network update throttling
let lastNetworkUpdate = 0;
const networkUpdateInterval = 33; // Increased to 30Hz from 20Hz for smoother falling

const debugInfo = reactive({
  isGrounded: false,
  position: new THREE.Vector3(),
  isMoving: false,
  currentSpeed: 0,
  facing: new THREE.Vector3(0, 0, -1),
  connected: false,
  playersOnline: 0,
  inVehicle: false, // Add vehicle state
  isSwimming: false // Add swimming state
});

// Add game mode ref
const gameMode = ref('');

// Add weapon info reactive state for HUD
const weaponInfo = reactive({
  weaponName: '',
  currentAmmo: 0,
  maxAmmo: 0,
  isReloading: false,
  reloadProgress: 0
});

// Flight data reactive state
const flightData = reactive({
  altitude: 0,
  airspeed: 0,
  verticalSpeed: 0,
  heading: 0,
  pitch: 0,
  roll: 0,
  throttle: 0,
  engineRPM: 0,
  isGrounded: true,
  stallWarning: false,
  gravityDir: new THREE.Vector3(0, -1, 0) // Default gravity direction
});

// Computed style for gravity indicator
const gravityIndicatorStyle = computed(() => {
  if (!flightData.gravityDir) return {};
  
  // Project gravity direction onto the aircraft's local coordinate system
  // This will show which way is "down" relative to the aircraft
  const angle = Math.atan2(flightData.gravityDir.x, flightData.gravityDir.y) * (180 / Math.PI);
  
  return {
    transform: `rotate(${angle}deg)`
  };
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

// Add interaction state
const interactionState = reactive({
  lastPushTime: 0,
  pushCooldown: 50, // Reduced from 100ms
  pushForce: 15.0,
  interactionRange: 3.0,
  ownedObjects: new Map(), // Track objects we own
  lastPushedObjects: new Map() // Track recently pushed objects to prevent spam
});

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
      
      // Add platform update handler
      ws.onPlatformUpdate = (platformId, position) => {
        if (scene.value) {
          scene.value.updatePlatformPosition(platformId, position);
        }
      };
      
      // Add dynamic object handlers
      ws.onDynamicObjectSpawn = (objectId, data) => {
        if (scene.value) {
          // Prevent duplicate dynamic platforms
          if (data.type === 'dynamic_platform' && scene.value.dynamicObjects.has(objectId)) {
            console.log(`Dynamic platform ${objectId} already exists, skipping spawn`);
            return;
          }
          
          if (data.type === 'rock') {
            scene.value.spawnMultiplayerRock(objectId, data.position, data.scale);
          } else if (data.type === 'dynamic_platform') {
            scene.value.spawnMultiplayerDynamicPlatform(objectId, data.position, data.scale);
          } else if (data.type === 'vehicle') {
            scene.value.spawnMultiplayerVehicle(objectId, data.position, data.scale);
          }
        }
      };
      
      ws.onDynamicObjectUpdate = (objectId, state) => {
        // Remove logging to reduce console spam
        scene.value.updateDynamicObject(objectId, state);
      };
      
      ws.onDynamicObjectRemove = (objectId) => {
        this.scene.removeDynamicObject(objectId);
      };
      
      ws.onError = (error) => {
        console.error("WebSocket error:", error);
        errorMessage.value = "Connection error: " + (error.message || "Unknown error");
        reject(error);
      };
      
      // Add level data handler
      ws.onLevelData = (levelObjects) => {
        console.log("Building level from server data");
        // For multiplayer, build level from server data exclusively
        scene.value.buildLevelFromData(levelObjects);
        
        // Now create player after level is built
        if (scene.value.multiplayerSpawnPosition) {
          const spawnPos = new THREE.Vector3(
            scene.value.multiplayerSpawnPosition.x,
            scene.value.multiplayerSpawnPosition.y,
            scene.value.multiplayerSpawnPosition.z
          );
          
          // Only create player if not already created
          if (!player.value) {
            console.log("Creating player at server position:", spawnPos);
            createLocalPlayer(spawnPos);
            
            // Don't set local origin or recenter at start - keep everything at server positions
            localOrigin.value.set(0, 0, 0);
          }
        } else {
          console.warn("No spawn position available after level data received");
        }
      };
      
      // Add ownership callbacks
      ws.onObjectOwnershipGranted = (objectId, playerId, durationMs) => {
        console.log(`Ownership granted for ${objectId} to ${playerId} for ${durationMs}ms`);
        // Track ownership locally
        interactionState.ownedObjects.set(objectId, Date.now() + durationMs);
      };
      
      ws.onObjectOwnershipRevoked = (objectId) => {
        console.log(`Ownership revoked for ${objectId}`);
        interactionState.ownedObjects.delete(objectId);
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
        
        // In multiplayer, explicitly wait for level data before proceeding
        if (wsManager.value) {
          loading.value = true; // Show loading while waiting for level data
          console.log("Waiting for level data from server...");
          
          try {
            await wsManager.value.waitForLevelData();
            console.log("Level data received, proceeding with game start");
          } catch (error) {
            console.error("Error waiting for level data:", error);
            errorMessage.value = "Failed to load level data. Please try again.";
            loading.value = false;
            return;
          }
        }
        
        // By this point, the level should be built and player created via onLevelData callback
        loading.value = false;
        
        // Check if player was created properly
        if (!player.value && scene.value.multiplayerSpawnPosition) {
          console.log("Player not created yet, creating now with spawn position:", 
            scene.value.multiplayerSpawnPosition);
          
          const spawnPos = new THREE.Vector3(
            scene.value.multiplayerSpawnPosition.x,
            scene.value.multiplayerSpawnPosition.y,
            scene.value.multiplayerSpawnPosition.z
          );
          
          createLocalPlayer(spawnPos);
        }
        
      } catch (error) {
        console.error("Network connection failed:", error);
        errorMessage.value = "Failed to connect to multiplayer server";
        loading.value = false;
        return; // Don't fallback to single player
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
        // Create full sandbox level with planet locally
        console.log("Creating sandbox level...");
        scene.value.createPlanet();
        scene.value.createPlatform();
      }
      
      createLocalPlayer(spawnPosition);
      debugInfo.connected = false;
      debugInfo.playersOnline = 1;
    }
    
    // Check for player with a more robust approach
    if (!player.value) {
      console.error("Player not created after all setup steps");
      errorMessage.value = "Failed to create player. Please try again.";
      loading.value = false;
      return;
    }
    
    // Create weapon system for sandbox mode
    if (gameMode.value === 'sandbox') {
      weaponSystem.value = markRaw(new WeaponSystem(scene.value, physics.value, player.value));
      
      // Set global reference for FPS controller
      window.weaponSystem = weaponSystem.value;
      
      // Spawn weapons on the platform after weapon system is initialized
      scene.value.spawnSandboxWeapons(weaponSystem.value);
      
      // Update weapon HUD info
      const updateWeaponHUD = () => {
        const info = weaponSystem.value.getHUDInfo();
        if (info) {
          weaponInfo.weaponName = info.weaponName;
          weaponInfo.currentAmmo = info.currentAmmo;
          weaponInfo.maxAmmo = info.maxAmmo;
          weaponInfo.isReloading = info.isReloading;
          weaponInfo.reloadProgress = info.reloadProgress;
        }
      };
      
      // Initial HUD update
      updateWeaponHUD();
      
      // Update HUD periodically
      setInterval(updateWeaponHUD, 100);
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
    loading.value = false;
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
  
  // Set initial debug visibility
  fpsController.setDebugVisualsEnabled(showDebugVisuals.value);
  
  player.value = markRaw(fpsController);
  
  console.log("Player created at:", spawnPosition);
};

// Send player state to server
const sendPlayerState = () => {
  if (gameMode.value !== 'multiplayer') return;
  if (!wsManager.value?.connected || !player.value?.body) return;
  
  const currentTime = performance.now();
  
  // Get full player state including grounded
  const state = player.value.getNetworkState();
  if (!state) return;
  
  // Send updates more frequently when falling
  const updateInterval = state.isGrounded ? networkUpdateInterval : 16; // 60Hz when falling
  
  if (currentTime - lastNetworkUpdate < updateInterval) return;
  
  lastNetworkUpdate = currentTime;
  
  // Check if we need to recenter local origin
  const localPos = new THREE.Vector3(state.position.x, state.position.y, state.position.z);
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
      state.rotation,
      state.velocity,
      state.isGrounded,
      state.isSwimming
    );
  } else {
    // Send normal position update with grounded and swimming state
    wsManager.value.sendPlayerState(
      state.position,
      state.rotation,
      state.velocity,
      state.isGrounded,
      state.isSwimming
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

// Apply gravity to all dynamic bodies
const applyGlobalGravity = (deltaTime) => {
  if (!physics.value || !scene.value) return;
  
  // Apply gravity to all dynamic objects
  scene.value.dynamicObjects.forEach((obj, id) => {
    if (obj.body && gameMode.value !== 'multiplayer') {
      // Only apply gravity to local physics bodies in single-player modes
      physics.value.applyGravityToBody(obj.body, deltaTime);
    }
  });
  
  // Apply gravity to any other dynamic bodies in the scene
  scene.value.scene.traverse((child) => {
    if (child.isMesh && child.userData.physicsBody && 
        child !== player.value?.mesh && 
        !scene.value.dynamicObjects.has(child.userData?.objectId)) {
      // Check if it's a dynamic body
      const body = child.userData.physicsBody;
      if (body && body.bodyType && body.bodyType() === 0) { // 0 = Dynamic body type
        physics.value.applyGravityToBody(body, deltaTime);
      }
    }
  });
};

// Add physics stepping flag
let isPhysicsStepping = false;

// Add automatic push detection
const checkAndPushNearbyRocks = () => {
  if (!player.value || !scene.value || gameMode.value !== 'multiplayer') return;
  
  const playerPos = player.value.getPosition();
  const playerVel = player.value.getVelocity();
  const playerSpeed = playerVel.length();
  
  // Only check if player is moving with some speed
  if (playerSpeed < 0.5) return;
  
  const currentTime = Date.now();
  // Player collision radius
  const playerRadius = 0.4; // From FPSController
  
  scene.value.dynamicObjects.forEach((obj, id) => {
    if (obj.type === 'rock' && obj.mesh) {
      const rockPos = obj.mesh.position;
      const distance = playerPos.distanceTo(rockPos);
      
      // Check sphere-sphere collision
      const rockRadius = 2 * obj.scale;
      const collisionDistance = playerRadius + rockRadius + 0.1; // Smaller buffer
      
      if (distance < collisionDistance) {
        // Calculate push direction from player to rock
        const pushDir = rockPos.clone().sub(playerPos);
        
        // Check if player is moving towards the rock
        if (pushDir.length() > 0) {
          pushDir.normalize();
          const dotProduct = playerVel.clone().normalize().dot(pushDir);
          
          if (dotProduct > 0.5) { // Player must be moving towards rock
            // Check if we recently pushed this object
            const lastPushTime = interactionState.lastPushedObjects.get(id) || 0;
            if (currentTime - lastPushTime < 100) return; // Shorter cooldown for responsiveness
            
            // Calculate push force with more conservative values
            const penetrationDepth = Math.max(0, collisionDistance - distance);
            const basePushStrength = 5.0; // Further reduced
            const speedMultiplier = Math.min(playerSpeed * 0.5, 3.0); // Lower multiplier
            const penetrationMultiplier = Math.min(penetrationDepth * 3.0, 2.0); // Lower multiplier
            
            const forceMagnitude = basePushStrength + speedMultiplier + penetrationMultiplier;
            
            const pushForce = pushDir.multiplyScalar(forceMagnitude);
            
            // Add minimal momentum transfer
            const momentumTransfer = playerVel.clone().multiplyScalar(0.2);
            pushForce.add(momentumTransfer);
            
            // Add very small upward component
            const upDirection = player.value.getUpDirection();
            pushForce.add(upDirection.multiplyScalar(0.5));
            
            // Send push request to server
            if (wsManager.value?.connected) {
              // Contact point should be on the rock surface
              const contactPoint = pushDir.clone().multiplyScalar(-rockRadius);
              wsManager.value.sendPushObject(id, pushForce, contactPoint);
              
              // Track this push
              interactionState.lastPushedObjects.set(id, currentTime);
              
              // Clean up old entries
              interactionState.lastPushedObjects.forEach((time, objId) => {
                if (currentTime - time > 1000) {
                  interactionState.lastPushedObjects.delete(objId);
                }
              });
            }
          }
        }
      }
    }
  });
};

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
  
  // Update vehicles
  if (scene.value && !isPhysicsStepping) {
    scene.value.vehicles.forEach((vehicle, id) => {
      // Apply gravity to vehicle bodies
      if (vehicle.chassisBody) {
        // Car - only apply gravity to chassis
        physics.value.applyGravityToBody(vehicle.chassisBody, deltaTime);
      } else if (vehicle.body) {
        // Plane or Helicopter - apply gravity to main body
        physics.value.applyGravityToBody(vehicle.body, deltaTime);
      }
      
      // Then update the vehicle
      vehicle.update(deltaTime);
    });
    
    // Also check dynamic objects for vehicles
    scene.value.dynamicObjects.forEach((obj, id) => {
      if (obj.type === 'vehicle' && obj.controller) {
        // Apply gravity to vehicle chassis and wheels
        if (obj.controller.chassisBody) {
          physics.value.applyGravityToBody(obj.controller.chassisBody, deltaTime);
        }
        obj.controller.wheelBodies.forEach(wheel => {
          physics.value.applyGravityToBody(wheel, deltaTime);
        });
        
        // Then update the vehicle
        obj.controller.update(deltaTime);
      } else if ((obj.type === 'plane' || obj.type === 'helicopter') && obj.controller) {
        // Apply gravity to aircraft body
        if (obj.controller.body) {
          physics.value.applyGravityToBody(obj.controller.body, deltaTime);
        }
        
        // Update the aircraft
        obj.controller.update(deltaTime);
      }
    });
  }
  
  // Update player
  if (player.value && !isPhysicsStepping) {
    player.value.update(deltaTime);
    
    // Update debug info
    debugInfo.isGrounded = player.value.isGrounded;
    debugInfo.position = player.value.getPosition();
    debugInfo.facing = player.value.getFacing();
    debugInfo.inVehicle = player.value.isInVehicle;
    debugInfo.isSwimming = player.value.isSwimming;
    
    // Calculate speed and movement
    const velocity = player.value.getVelocity();
    debugInfo.currentSpeed = velocity.length();
    debugInfo.isMoving = debugInfo.currentSpeed > 0.1;
    
    // Update crosshair visibility based on camera mode
    if (player.value.tpController) {
      showCrosshair.value = !player.value.tpController.isActive;
    }
  }
  
  // Check for automatic rock pushing in multiplayer - but not every frame
  if (gameMode.value === 'multiplayer' && frameCount.value % 3 === 0) { // Check every 3rd frame (~20Hz)
    checkAndPushNearbyRocks();
  }
  
  // Send player or vehicle state to server
  if (gameMode.value === 'multiplayer' && wsManager?.connected) {
    if (player.value.isInVehicle && player.value.currentVehicle) {
      // Send vehicle controls
      wsManager.value.sendVehicleControl({
        forward: player.value.keys.forward,
        backward: player.value.keys.backward,
        left: player.value.keys.left,
        right: player.value.keys.right,
        brake: player.value.keys.jump
      });
    } else {
      // Send regular player state
      const state = player.value.getNetworkState();
      if (state) {
        wsManager.value.sendPlayerState(
          state.position,
          state.rotation,
          state.velocity,
          state.isGrounded,
          state.isSwimming
        );
      }
    }
  }
  
  // Update remote players
  if (playerManager.value && !isPhysicsStepping) {
    playerManager.value.update(deltaTime);
  }
  
  // Update scene dynamic objects
  if (!isPhysicsStepping) {
    scene.value.updateDynamicObjects();
  }
  
  // Update ownership
  updateOwnership();
  
  // Update weapon system
  if (weaponSystem.value && !isPhysicsStepping) {
    weaponSystem.value.update(deltaTime);
    
    // Update weapon HUD
    if (frameCount.value % 3 === 0) // Update HUD less frequently
      weaponInfo.value = weaponSystem.value.getHUDInfo();
  }
  
  // Update flight HUD if in vehicle
  if (player.value && player.value.isInVehicle && player.value.currentVehicle) {
    const vehicle = player.value.currentVehicle;
    if (vehicle.getFlightData) {
      const data = vehicle.getFlightData();
      if (data) {
        // Update flight data without touching camera
        Object.assign(flightData, {
          altitude: data.altitude,
          airspeed: data.airspeed,
          verticalSpeed: data.verticalSpeed,
          heading: data.heading,
          pitch: data.pitch,
          roll: data.roll,
          throttle: data.throttle,
          engineRPM: data.engineRPM || 0,
          isGrounded: data.isGrounded,
          stallWarning: data.stallWarning || false
        });
        
        showFlightHUD.value = true;
      }
    } else {
      // Not an aircraft, hide flight HUD
      showFlightHUD.value = false;
    }
  } else {
    showFlightHUD.value = false;
  }
  
  // Render
  scene.value.render();
  
  frameCount.value++;
};

// Check for pushable objects in front of player
const checkForPushableObject = () => {
  if (!player.value || !scene.value) return null;
  
  const playerPos = player.value.getPosition();
  const playerDir = player.value.getFacing();
  
  let closestObject = null;
  let closestDistance = interactionState.interactionRange;
  
  // Check all dynamic objects
  scene.value.dynamicObjects.forEach((obj, id) => {
    if (obj.mesh && obj.type === 'rock') {
      const objPos = obj.mesh.position;
      const toObject = objPos.clone().sub(playerPos);
      const distance = toObject.length();
      
      // Check if within range
      if (distance < closestDistance) {
        // Check if in front of player (dot product)
        const dot = toObject.normalize().dot(playerDir);
        if (dot > 0.5) { // Within ~60 degree cone
          closestObject = { id, obj, distance, position: objPos };
          closestDistance = distance;
        }
      }
    }
  });
  
  return closestObject;
};

// Push object
const pushObject = (objectInfo) => {
  if (!wsManager.value?.connected || !player.value) return;
  
  const currentTime = Date.now();
  if (currentTime - interactionState.lastPushTime < interactionState.pushCooldown) {
    return;
  }
  
  interactionState.lastPushTime = currentTime;
  
  // Calculate push force
  const playerPos = player.value.getPosition();
  const playerDir = player.value.getFacing();
  const playerVel = player.value.getVelocity();
  
  // Base force in player's facing direction
  let pushForce = playerDir.clone().multiplyScalar(interactionState.pushForce);
  
  // Add player's velocity for momentum transfer
  pushForce.add(playerVel.clone().multiplyScalar(0.5));
  
  // Calculate contact point (simplified - use player position)
  const contactPoint = playerPos.clone().sub(objectInfo.position);
  
  // Send push request
  wsManager.value.sendPushObject(objectInfo.id, pushForce, contactPoint);
  
  console.log(`Pushing object ${objectInfo.id} with force:`, pushForce);
};

// Update ownership expiry
const updateOwnership = () => {
  const now = Date.now();
  const expired = [];
  
  interactionState.ownedObjects.forEach((expiry, objectId) => {
    if (expiry <= now) {
      expired.push(objectId);
    }
  });
  
  expired.forEach(id => interactionState.ownedObjects.delete(id));
};

// Request pointer lock
const requestPointerLock = () => {
  if (scene.value?.renderer) {
    scene.value.renderer.domElement.requestPointerLock();
  }
};

// Input handlers
const onKeyDown = (event) => {
  if (!started.value || isPhysicsStepping) return;
  
  // Always update player keys, whether in vehicle or not
  switch(event.key.toLowerCase()) {
    case 'w':
      player.value.keys.forward = true;
      break;
    case 's':
      player.value.keys.backward = true;
      break;
    case 'a':
      player.value.keys.left = true;
      break;
    case 'd':
      player.value.keys.right = true;
      break;
    case ' ':
      player.value.keys.jump = true;
      break;
    case 'shift':
      player.value.keys.run = true;
      break;
    case 'control':
      player.value.keys.crouch = true;  // Add Control key for crouch
      break;
    case 'q':
      player.value.keys.rollLeft = true;
      break;
    case 'e':
      player.value.keys.rollRight = true;
      break;
    case 'u':
      player.value.keys.interact = true;
      break;
    case 'v':
      // Toggle debug ray visualizations
      showDebugVisuals.value = !showDebugVisuals.value;
      if (player.value) {
        player.value.setDebugVisualsEnabled(showDebugVisuals.value);
      }
      break;
    case 'o':
      player.value.keys.toggleCamera = true;
      break;
    case '`':
      // Backtick toggles debug UI
      showDebug.value = !showDebug.value;
      break;
    case 'l':
      player.value.keys.landingGear = true;
      break;
    case 'g':
      player.value.keys.fireGun = true;
      break;
    case 'm':
      player.value.keys.fireMissile = true;
      break;
    case 'n':
      player.value.keys.toggleLights = true; // Add N key for toggling lights
      break;
  }
  
  // Weapon controls - only when not in vehicle
  if (weaponSystem.value && !player.value?.isInVehicle) {
    switch(event.key.toLowerCase()) {
      case '1':
        weaponSystem.value.switchWeapon('hands');
        break;
      case '2':
        weaponSystem.value.switchWeapon('pistol');
        break;
      case '3':
        weaponSystem.value.switchWeapon('rifle');
        break;
      case '4':
        weaponSystem.value.switchWeapon('shotgun');
        break;
      case 'r':
        weaponSystem.value.reload();
        break;
    }
  }
};

const onKeyUp = (event) => {
  if (!started.value || isPhysicsStepping) return;
  
  // Always update player keys
  switch(event.key.toLowerCase()) {
    case 'w':
      player.value.keys.forward = false;
      break;
    case 's':
      player.value.keys.backward = false;
      break;
    case 'a':
      player.value.keys.left = false;
      break;
    case 'd':
      player.value.keys.right = false;
      break;
    case ' ':
      player.value.keys.jump = false;
      break;
    case 'shift':
      player.value.keys.run = false;
      break;
    case 'control':
      player.value.keys.crouch = false;  // Add Control key release
      break;
    case 'q':
      player.value.keys.rollLeft = false;
      break;
    case 'e':
      player.value.keys.rollRight = false;
      break;
    case 'u':
      player.value.keys.interact = false;
      break;
    case 'o':
      player.value.keys.toggleCamera = false;
      break;
    case 'l':
      player.value.keys.landingGear = false;
      break;
    case 'g':
      player.value.keys.fireGun = false;
      break;
    case 'm':
      player.value.keys.fireMissile = false;
      break;
    case 'n':
      player.value.keys.toggleLights = false; // Release N key for toggling lights
      break;
  }
};

// Modified mouse handler to check physics stepping
const onMouseMove = (event) => {
  if (!started.value || !document.pointerLockElement || isPhysicsStepping) return;
  
  // Don't handle mouse movement for player if in vehicle
  if (!player.value?.isInVehicle) {
    player.value?.handleMouseMove(event);
  }
};

const onMouseDown = (event) => {
  if (!started.value || !player.value) return;
  if (document.pointerLockElement !== scene.value?.renderer?.domElement) return;
  
  if (event.button === 0) { // Left click
    // Fire weapon if in sandbox mode
    if (gameMode.value === 'sandbox' && weaponSystem.value) {
      weaponSystem.value.fire();
    }
    
    // Push object if in multiplayer mode
    if (gameMode.value === 'multiplayer') {
      const pushableObject = checkForPushableObject();
      if (pushableObject) {
        pushObject(pushableObject);
      }
    }
  }
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
    
    // Initialize pyrotechnics system after scene is created
    if (scene.value && scene.value.scene) {
      const pyro = new Pyrotechnics(scene.value.scene);
      window.pyrotechnics = markRaw(pyro); // Make it globally accessible
    }
    
    clearTimeout(initTimeout);
    
    console.log("Game ready to start");
    
    // Setup event listeners
    window.addEventListener('resize', handleResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
    document.addEventListener('mousedown', onMouseDown);
    
    // Key bindings
    const keyMap = {
      'w': 'forward',
      's': 'backward',
      'a': 'left',
      'd': 'right',
      ' ': 'jump',
      'shift': 'run',
      'q': 'rollLeft',
      'e': 'rollRight',
      'u': 'interact'  // Add U key for vehicle interaction
    };
    
    // Update setupMultiplayer to handle vehicles
    const setupMultiplayer = async () => {
      // ...existing code...
      
      // Vehicle event handlers
      webSocketManager.onPlayerEnteredVehicle = (playerId, vehicleId) => {
        if (playerId === webSocketManager.playerId && player) {
          // Local player entered vehicle
          const vehicle = scene.dynamicObjects.get(vehicleId);
          if (vehicle && vehicle.controller) {
            player.enterVehicle(vehicle.controller);
          }
        } else {
          // Remote player entered vehicle
          const remotePlayer = playerManager.players.get(playerId);
          if (remotePlayer) {
            remotePlayer.isInVehicle = true;
            remotePlayer.currentVehicle = vehicleId;
            // Hide remote player mesh when in vehicle
            if (remotePlayer.mesh) {
              remotePlayer.mesh.visible = false;
            }
          }
        }
      };
      
      webSocketManager.onPlayerExitedVehicle = (playerId, vehicleId, exitPosition) => {
        if (playerId === webSocketManager.playerId && player) {
          // Local player exited vehicle
          player.exitVehicle();
          // Update position from server
          if (player.body && exitPosition) {
            player.body.setTranslation({
              x: exitPosition.x,
              y: exitPosition.y,
              z: exitPosition.z
            });
          }
        } else {
          // Remote player exited vehicle
          const remotePlayer = playerManager.players.get(playerId);
          if (remotePlayer) {
            remotePlayer.isInVehicle = false;
            remotePlayer.currentVehicle = null;
            // Show remote player mesh
            if (remotePlayer.mesh) {
              remotePlayer.mesh.visible = true;
            }
            // Update position
            if (remotePlayer.body && exitPosition) {
              remotePlayer.body.setTranslation({
                x: exitPosition.x,
                y: exitPosition.y,
                z: exitPosition.z
              });
            }
          }
        }
      };
      
      webSocketManager.onVehicleUpdate = (vehicleId, state) => {
        const vehicle = scene.dynamicObjects.get(vehicleId);
        if (vehicle && vehicle.controller) {
          // Update vehicle position from server
          if (vehicle.controller.isMultiplayer && !vehicle.controller.isOccupied) {
            // Only update if not locally controlled
            vehicle.controller.updateFromServer(state);
          }
        }
      };
      
      // Set network manager on player
      if (player) {
        player.setNetworkManager(webSocketManager);
      }
      
      // ...existing code...
    };
    
    // Update animation loop to send vehicle controls
    const animate = (currentTime) => {
      // ...existing code...
      
      // Send player or vehicle state to server
      if (gameMode.value === 'multiplayer' && webSocketManager?.connected) {
        if (player.isInVehicle && player.currentVehicle) {
          // Send vehicle controls
          webSocketManager.sendVehicleControl({
            forward: player.keys.forward,
            backward: player.keys.backward,
            left: player.keys.left,
            right: player.keys.right,
            brake: player.keys.jump
          });
        } else {
          // Send regular player state
          const state = player.getNetworkState();
          if (state) {
            webSocketManager.sendPlayerState(
              state.position,
              state.rotation,
              state.velocity,
              state.isGrounded,
              state.isSwimming
            );
          }
        }
      }
      
      // ...existing code...
    };
    
    // ...existing code...
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
  document.removeEventListener('mousedown', onMouseDown);
  
  // Clean up weapon system
  if (weaponSystem.value) {
    weaponSystem.value.clear();
    window.weaponSystem = null; // Clear global reference
  }
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

.vehicle-info {
  color: #00ff00;
  font-weight: bold;
  margin-top: 5px;
}

.swimming-info {
  color: #00ffff;
  font-weight: bold;
  margin-top: 5px;
}

.weapon-hud {
  position: fixed;
  bottom: 40px;
  right: 40px;
  color: white;
  font-family: 'Courier New', monospace;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  user-select: none;
  pointer-events: none;
}

.weapon-name {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 8px;
  text-align: right;
}

.ammo-display {
  font-size: 32px;
  text-align: right;
}

.current-ammo {
  font-weight: bold;
}

.ammo-separator {
  margin: 0 4px;
  opacity: 0.6;
}

.max-ammo {
  opacity: 0.8;
}

.reload-bar {
  width: 200px;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  margin-top: 8px;
  position: relative;
  overflow: hidden;
}

.reload-progress {
  height: 100%;
  background: rgba(255, 255, 255, 0.8);
  transition: width 0.1s ease-out;
}

.crosshair {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  pointer-events: none;
  z-index: 100;
}

.crosshair-line {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
}

.crosshair-horizontal {
  width: 100%;
  height: 2px;
  top: 50%;
  transform: translateY(-50%);
}

.crosshair-vertical {
  width: 2px;
  height: 100%;
  left: 50%;
  transform: translateX(-50%);
}

/* Flight HUD styles */
.flight-hud {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #00ff00;
  font-family: 'Courier New', monospace;
  pointer-events: none;
  user-select: none;
}

.flight-instruments {
  display: flex;
  gap: 20px;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border: 1px solid #00ff00;
  border-radius: 5px;
}

.instrument-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.instrument {
  display: flex;
  align-items: center;
  gap: 10px;
}

.instrument label {
  font-size: 12px;
  color: #00ff00;
  width: 30px;
}

.instrument .value {
  font-size: 16px;
  font-weight: bold;
  color: #00ff00;
  min-width: 60px;
  text-align: right;
}

.value.positive {
  color: #00ff00;
}

.value.negative {
  color: #ff6666;
}

.attitude-indicator {
  width: 150px;
  height: 150px;
  border: 2px solid #00ff00;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  background: #000;
}

.horizon {
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  transition: transform 0.1s ease-out;
}

.sky {
  position: absolute;
  top: 0;
  width: 100%;
  height: 50%;
  background: #1e3c72;
}

.ground {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 50%;
  background: #654321;
}

.horizon-line {
  position: absolute;
  top: 50%;
  width: 100%;
  height: 2px;
  background: #fff;
}

.aircraft-symbol {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 2px;
  background: #ffff00;
}

.aircraft-symbol::before,
.aircraft-symbol::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 2px;
  background: #ffff00;
  top: 0;
}

.aircraft-symbol::before {
  left: -10px;
  transform: rotate(90deg);
}

.aircraft-symbol::after {
  right: -10px;
  transform: rotate(90deg);
}

.pitch-ladder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.pitch-mark {
  position: absolute;
  width: 100%;
  text-align: center;
  font-size: 10px;
  color: #00ff00;
}

.flight-status {
  margin-top: 10px;
  text-align: center;
}

.status-indicator {
  padding: 5px 10px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: bold;
  margin: 0 5px;
}

.status-indicator.grounded {
  background: #333;
  color: #00ff00;
  border: 1px solid #00ff00;
}

.status-indicator.warning {
  background: #ff0000;
  color: #fff;
  animation: blink 0.5s infinite;
}

@keyframes blink {
  50% { opacity: 0.5; }
}

.gravity-indicator {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 10px solid #ff0000;
  opacity: 0.7;
}
</style>