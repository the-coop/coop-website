<template>
  <div class="game-container">
    <div ref="gameCanvas" class="game-canvas"></div>
    <div v-if="loading" class="loading-screen">Loading physics engine...</div>
    <div v-if="!started" class="start-screen">
      <button @click="startGame" class="start-button">Start Game</button>
    </div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div class="debug-info" v-if="started">
      <div>Grounded: {{ isGrounded }}</div>
      <div>Position: {{ playerPosition.x.toFixed(2) }}, {{ playerPosition.y.toFixed(2) }}, {{ playerPosition.z.toFixed(2) }}</div>
      <div>Moving: {{ isMoving }}</div>
      <div>Speed: {{ currentSpeed.toFixed(2) }}</div>
      <div>Facing: {{ playerFacing.x.toFixed(2) }}, {{ playerFacing.y.toFixed(2) }}, {{ playerFacing.z.toFixed(2) }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, shallowRef, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createScene, createPlanet, createPlatform, addPlanetFeatures, updateDynamicObjects } from '../lib/scene.js';
import { initPhysics, setupCollisionHandling, processCollisionEvents, checkGrounded, alignPlayerToSurface, handleAllMovement } from '../lib/physics.js';
import { createPlayer, updatePlayerTransform, createRayVisualizations, updateRayVisualizations, handleMouseMovement, resetCameraForAirborne, playerConfig } from '../lib/player.js';

// Make sure rayDir exists globally first thing
window.rayDir = new THREE.Vector3(0, -1, 0);

// Define the reactive version and all related ray variables properly
const rayDir = shallowRef(window.rayDir);
const leftFootPos = shallowRef(new THREE.Vector3());
const rightFootPos = shallowRef(new THREE.Vector3());
const centerFootPos = shallowRef(new THREE.Vector3());
const collisionPoints = shallowRef([]);

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
const movingPlatform = shallowRef(null);
const movingPlatformBody = shallowRef(null);
const clock = new THREE.Clock();

// Debug visualization objects
const rayLines = shallowRef(null);
const leftFootHit = shallowRef(null);
const rightFootHit = shallowRef(null);
const centerFootHit = shallowRef(null); // Add this line to define centerFootHit as a shallowRef

// Physics
const physicsWorld = shallowRef(null);
const playerBody = shallowRef(null);

// Add missing jump-related variables
const jumpInProgress = shallowRef(false);
const jumpTime = ref(0);
const lastGroundNormal = shallowRef(new THREE.Vector3(0, 1, 0));

// Player data
const cameraRotation = shallowRef(new THREE.Euler(0, 0, 0, 'YXZ'));

// Controls
const keys = reactive({
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  run: false,
  rollLeft: false,
  rollRight: false
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
  
  handleMouseMovement(
    event,
    playerBody.value,
    cameraRotation.value,
    isGrounded.value,
    lastGroundNormal.value
  );
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

// Update the startGame function to use the physics module
const startGame = async () => {
  try {
    console.log("Starting game...");
    
    // Make sure RAPIER is properly initialized before proceeding
    if (!RAPIER.World) {
      console.log("Rapier not fully initialized, initializing now...");
      try {
        await RAPIER.init({
          locateFile: (path) => {
            return `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/${path}`;
          }
        });
        console.log("Rapier initialized successfully");
      } catch (rapierError) {
        console.error("Failed to initialize Rapier:", rapierError);
        errorMessage.value = "Failed to initialize physics engine. Please refresh.";
      }
    }
    
    // Check if physics world exists, if not create it properly
    if (!physicsWorld.value && RAPIER.World) {
      console.log("Creating physics world");
      try {
        // Create physics world using the physics module
        physicsWorld.value = await initPhysics();
        console.log("Physics world created successfully");
        
        // Create necessary game objects if they don't exist
        if (!platform.value) {
          const platformObjects = createPlatform(scene.value, physicsWorld.value, debugInfo);
          if (platformObjects) {
            platform.value = platformObjects.platform;
            movingPlatform.value = platformObjects.movingPlatform;
            movingPlatformBody.value = platformObjects.movingPlatformBody;
          }
        }
        
        if (!planet.value) {
          const planetData = createPlanet(scene.value, physicsWorld.value, debugInfo);
          if (planetData) {
            planet.value = planetData.planet;
            gravity.center.copy(planetData.center);
            
            // Add features to the planet
            addPlanetFeatures(scene.value, physicsWorld.value, gravity.center);
          }
        }
        
        if (!player.value) {
          const playerData = createPlayer(scene.value, physicsWorld.value, debugInfo);
          if (playerData) {
            player.value = playerData.player;
            playerBody.value = playerData.playerBody;
            
            // Add camera to player at eye level
            player.value.add(camera.value);
            camera.value.position.set(0, playerConfig.height * 0.8, 0);
            camera.value.rotation.set(0, 0, 0);
            
            // Initialize camera rotation
            cameraRotation.value.set(0, 0, 0);
            
            // Create ray visualizations
            rayLines.value = createRayVisualizations(scene.value, player.value);
            
            // Set up collision handling using imported function
            setupCollisionHandling(physicsWorld.value);
          }
        }
      } catch (worldError) {
        console.error("Error creating physics world:", worldError);
        errorMessage.value = "Error creating physics world: " + worldError.message;
        return; // Don't proceed if we can't create the physics world
      }
    }
    
    // Check if game canvas is available
    if (!gameCanvas.value) {
      errorMessage.value = "Game canvas not found";
      console.error(errorMessage.value);
      return;
    }
    
    // Set started state
    started.value = true;

    // Try to request pointer lock
    gameCanvas.value.requestPointerLock();
      
    // Add event listener for pointer lock errors
    document.addEventListener('pointerlockerror', (e) => {
      console.warn('Pointer lock error, continuing without mouse control:', e);
      // Continue with game anyway
      if (!clock.running) {
        clock.start();
        animate();
      }
    }, { once: true });
    
    // Always start the animation loop regardless of pointer lock status
    if (!clock.running) {
      clock.start();
      console.log("Starting animation loop");
      animate();
    }
  } catch (e) {
    errorMessage.value = "Error starting game: " + e.message;
    console.error("Error starting game:", e);
  }
};

// Update the animate function to use only imported physics module functions
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
        // Process collision events after physics step using the imported physics module
        processCollisionEvents(physicsWorld.value, playerBody.value, debugInfo, groundCollisions.value, lastGroundContact);
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
    
    // Update physics and player using the imported physics module
    checkGrounded(
      playerBody.value, 
      physicsWorld.value, 
      rayDir, 
      leftFootPos, 
      rightFootPos, 
      centerFootPos, 
      leftFootHit, 
      rightFootHit, 
      centerFootHit, 
      isGrounded, 
      wasGrounded, 
      gravity, 
      groundCollisions.value, 
      lastGroundContact, 
      debugInfo, 
      playerConfig.height, 
      playerConfig.radius,
      frameCount
    );
    
    // Align player to surface when grounded using imported function
    if (isGrounded.value) {
      alignPlayerToSurface(
        playerBody.value, 
        player.value, 
        isGrounded.value, 
        new THREE.Vector3().subVectors(gravity.center, new THREE.Vector3(
          playerBody.value.translation().x,
          playerBody.value.translation().y,
          playerBody.value.translation().z
        )).normalize(), 
        centerFootHit.value, 
        leftFootHit.value, 
        rightFootHit.value, 
        lastGroundNormal
      );
    }
    
    // Handle all movement using the imported physics module
    handleAllMovement(
      playerBody.value,
      physicsWorld.value,
      scene.value,
      isGrounded.value,
      keys,
      gravity,
      jumpInProgress,
      jumpTime,
      playerConfig.jumpDuration,
      playerConfig.jumpForce,
      lastGroundNormal,
      playerConfig.walkSpeed,
      playerConfig.runSpeed,
      isMoving,
      currentSpeed,
      frameCount,
      deltaTime
    );
    
    // Update visual transform after physics
    playerFacing.value = updatePlayerTransform(player.value, playerBody.value, cameraRotation.value);
    
    // Reset camera for airborne transition
    resetCameraForAirborne(player.value, playerBody.value, cameraRotation.value, wasGrounded.value, isGrounded.value);
    
    // Update all dynamic physics objects (rocks, moving platforms, etc.)
    if (scene.value && movingPlatform.value && movingPlatformBody.value) {
      updateDynamicObjects(scene.value, movingPlatform.value, movingPlatformBody.value);
    }
    
    // Update ray visualizations
    if (player.value && rayDir.value && rayLines.value) {
      updateRayVisualizations(
        player.value,
        rayLines.value,
        leftFootPos.value,
        rightFootPos.value,
        centerFootPos.value,
        rayDir.value,
        2.0,
        leftFootHit.value,
        rightFootHit.value,
        centerFootHit.value
      );
    }
    
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
    
    // Create Three.js scene using the scene module
    scene.value = createScene();
    
    // Create camera
    camera.value = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.value.position.set(0, playerConfig.height, 0);
    
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
    
    // Create game objects if physics is ready
    if (physicsWorld.value) {
      // Create planet and platform using the scene module
      const planetData = createPlanet(scene.value, physicsWorld.value, debugInfo);
      if (planetData) {
        planet.value = planetData.planet;
        gravity.center.copy(planetData.center);
        
        // Add features to the planet after it's created
        addPlanetFeatures(scene.value, physicsWorld.value, gravity.center);
      }
      
      const platformObjects = createPlatform(scene.value, physicsWorld.value, debugInfo);
      if (platformObjects) {
        platform.value = platformObjects.platform;
        movingPlatform.value = platformObjects.movingPlatform;
        movingPlatformBody.value = platformObjects.movingPlatformBody;
      }
      
      const playerData = createPlayer(scene.value, physicsWorld.value, debugInfo);
      if (playerData) {
        player.value = playerData.player;
        playerBody.value = playerData.playerBody;
        
        // Add camera to player at eye level
        player.value.add(camera.value);
        camera.value.position.set(0, playerConfig.height * 0.8, 0);
        camera.value.rotation.set(0, 0, 0);
        
        // Initialize camera rotation
        cameraRotation.value.set(0, 0, 0);
        
        // Create ray visualizations
        rayLines.value = createRayVisualizations(scene.value, player.value);
        
        // Set up collision handling using imported function
        setupCollisionHandling(physicsWorld.value);
      }
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

// Add missing player collider handle to debugInfo initialization
debugInfo.playerColliderHandle = null;

// Add collision tracking variables near other state variables
const groundCollisions = shallowRef(new Set()); // Track which colliders we're touching
const lastGroundContact = ref(0); // Track when we last had ground contact

// Add the missing updateDetachedCamera function before updatePlayerTransform
const updateDetachedCamera = () => {
  if (!isCameraDetached.value || !camera.value || !player.value) return;
  
  // Get player's current world position
  const playerWorldPos = new THREE.Vector3();
  player.value.getWorldPosition(playerWorldPos);
  
  // Create an orbit-like camera that follows the player
  // Calculate the camera position in an orbit
  const cameraDistance = 15; // Distance from player
  const cameraHeight = 8;   // Height above player
  
  // Update camera position based on WASD input for camera control (only when detached)
  if (keys.forward) {
    // Move camera closer
    detachedCameraAngle.value += 0;
  }
  if (keys.backward) {
    // Move camera farther
    detachedCameraAngle.value += 0;
  }
  // Remove A/D camera controls - these should only be for movement
  
  // Calculate camera position on a circle around player
  const cameraX = playerWorldPos.x + Math.sin(detachedCameraAngle.value) * cameraDistance;
  const cameraZ = playerWorldPos.z + Math.cos(detachedCameraAngle.value) * cameraDistance;
  const cameraY = playerWorldPos.y + cameraHeight;
  
  camera.value.position.set(cameraX, cameraY, cameraZ);
  
  // Make camera look at player
  camera.value.lookAt(playerWorldPos);
};

// Add detachedCameraAngle declaration near the top with other state variables
const detachedCameraAngle = ref(0);

// Add the toggleCameraAttachment function after the onKeyUp function
const toggleCameraAttachment = () => {
  // Toggle the camera attachment state
  isCameraDetached.value = !isCameraDetached.value;
  
  if (isCameraDetached.value) {
    // Remove camera from player when detaching
    if (player.value && camera.value) {
      // Store current world position before removing
      const worldPos = new THREE.Vector3();
      camera.value.getWorldPosition(worldPos);
      
      // Store current rotation
      const worldRot = new THREE.Euler();
      camera.value.getWorldQuaternion(new THREE.Quaternion().setFromEuler(worldRot));
      
      // Remove from player and add to scene
      player.value.remove(camera.value);
      scene.value.add(camera.value);
      
      // Position the camera at the same world position
      camera.value.position.copy(worldPos);
      camera.value.rotation.copy(worldRot);
      
      // Move camera back for better view
      const cameraOffset = new THREE.Vector3(0, 5, 15);
      camera.value.position.add(cameraOffset);
      
      console.log("Camera detached from player");
    }
  } else {
    // Reattach camera to player
    if (player.value && camera.value) {
      // Remove from scene
      scene.value.remove(camera.value);
      
      // Add back to player
      player.value.add(camera.value);
      
      // Reset camera position relative to player
      camera.value.position.set(0, playerConfig.height * 0.8, 0);
      camera.value.rotation.set(cameraRotation.value.x, 0, 0);
      
      console.log("Camera reattached to player");
    }
  }
};

// Removed duplicate handleAllMovement function and other duplicated functions
// Now using imports from physics.js and player.js modules

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

// Add onBeforeUnmount to clean up resources
onBeforeUnmount(() => {
  // Remove event listeners
  window.removeEventListener('resize', onResize);
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup', onKeyUp);
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('pointerlockchange', onPointerLockChange);
  
  // Clean up physics world
  if (physicsWorld.value) {
    // Clean up any rapier resources if needed
  }
  
  // Clean up renderer
  if (renderer.value) {
    renderer.value.dispose();
  }
  
  console.log("Game resources cleaned up");
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