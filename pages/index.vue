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
const movingPlatform = shallowRef(null); // Add moving platform reference
const movingPlatformBody = shallowRef(null); // Add moving platform body reference
const clock = new THREE.Clock();

// Debug visualization objects
const leftRayLine = shallowRef(null);
const rightRayLine = shallowRef(null);
const centerRayLine = shallowRef(null);
const facingLine = shallowRef(null); // Add facing direction line

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

// Modify the startGame function to handle physics initialization more carefully
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
        // Create with standard gravity first
        const gravityVec = { x: 0, y: 0, z: 0 };
        physicsWorld.value = new RAPIER.World(gravityVec);
        console.log("Physics world created successfully");
        
        // Create necessary game objects if they don't exist
        if (!platform.value) createPlatform();
        if (!player.value) createPlayer();
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

// Add collision event handling after createPlayer function
const setupCollisionHandling = () => {
  if (!physicsWorld.value) return;
  
  try {
    // Set up collision event handling
    physicsWorld.value.eventQueue = new RAPIER.EventQueue(true);
    
    console.log("Collision event handling set up successfully");
    
    // Also set up contact force events for additional detection
    physicsWorld.value.contactForceEventQueue = new RAPIER.EventQueue(true);
    
  } catch (e) {
    console.error("Error setting up collision handling:", e);
  }
};

// Modify the animate function to include better collision processing
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
        // Process collision events after physics step
        processCollisionEvents();
        
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
    checkGrounded();
    
    // Handle all movement in one place including gravity
    handleAllMovement(deltaTime);
    
    // Update visual transform after physics
    updatePlayerTransform();
    
    // Update all dynamic physics objects (rocks, etc.)
    updateDynamicObjects();
    
    // Update ray visualizations
    if (player.value && rayDir.value) {
      updateRayVisualizations(
        leftFootPos.value.clone(), 
        rightFootPos.value.clone(), 
        centerFootPos.value.clone(), 
        rayDir.value, 
        2.0  // Shorter rays for grounding
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
      createPlanet();
      createPlatform();
      createPlayer();
      createRayVisualizations();
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

// Add missing createPlanet function
const createPlanet = () => {
  if (!scene.value || !physicsWorld.value) {
    console.error("Scene or physics world not initialized");
    return;
  }
  
  try {
    console.log("Creating planet-like terrain...");
    
    const planetRadius = 200;
    const terrainHeight = 30; // Maximum height variation
    const planetY = -250; // Planet center position
    
    // Create planet physics body first
    const planetBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(0, planetY, 0);
    
    const planetBody = physicsWorld.value.createRigidBody(planetBodyDesc);
    
    // Create visual geometry - we'll use an icosahedron as base for more natural terrain
    const subdivisions = 5; // Higher = smoother sphere
    const icosahedronGeometry = new THREE.IcosahedronGeometry(planetRadius, subdivisions);
    
    // Get vertex positions and create height map
    const positions = icosahedronGeometry.attributes.position.array;
    const vertex = new THREE.Vector3();
    
    // Apply terrain displacement to each vertex
    for (let i = 0; i < positions.length; i += 3) {
      vertex.set(positions[i], positions[i + 1], positions[i + 2]);
      
      // Get the normalized direction from center
      const dir = vertex.clone().normalize();
      
      // Calculate spherical coordinates for noise
      const theta = Math.atan2(vertex.x, vertex.z);
      const phi = Math.acos(vertex.y / vertex.length());
      
      // Generate height using multiple octaves of noise for realistic terrain
      let height = 0;
      
      // Continental shelf - large scale features
      height += Math.sin(theta * 1.5) * Math.cos(phi * 2) * 0.3;
      height += Math.cos(theta * 1.2) * Math.sin(phi * 1.8) * 0.25;
      
      // Mountain ranges
      const mountainNoise = Math.sin(theta * 4) * Math.cos(phi * 3);
      if (mountainNoise > 0.3) {
        height += mountainNoise * 0.5;
      }
      
      // Hills and valleys
      height += Math.sin(theta * 8) * Math.cos(phi * 6) * 0.15;
      height += Math.cos(theta * 10) * Math.sin(phi * 8) * 0.1;
      
      // Small details
      height += Math.sin(theta * 20) * Math.cos(phi * 15) * 0.05;
      
      // Create some flat areas (plains)
      if (Math.abs(height) < 0.1) {
        height *= 0.3; // Flatten areas that are already relatively flat
      }
      
      // Normalize and apply height
      height = (height + 1) * 0.5;
      const finalRadius = planetRadius + (height * terrainHeight) - terrainHeight * 0.3; // Offset to have both valleys and peaks
      
      // Update vertex position
      const newPos = dir.multiplyScalar(finalRadius);
      positions[i] = newPos.x;
      positions[i + 1] = newPos.y;
      positions[i + 2] = newPos.z;
    }
    
    // Update geometry
    icosahedronGeometry.attributes.position.needsUpdate = true;
    icosahedronGeometry.computeVertexNormals();
    
    // Create the visual mesh
    const planetMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a7c4a,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true, // Gives a more terrain-like appearance
      wireframe: false
    });
    
    planet.value = new THREE.Mesh(icosahedronGeometry, planetMaterial);
    planet.value.position.set(0, planetY, 0);
    planet.value.receiveShadow = true;
    planet.value.castShadow = true;
    scene.value.add(planet.value);
    
    // Create collision mesh - handle both indexed and non-indexed geometries
    let indices;
    
    // Check if geometry has an index
    if (icosahedronGeometry.index) {
      indices = icosahedronGeometry.index.array;
    } else {
      // Create indices for non-indexed geometry
      // For non-indexed geometry, every 3 vertices form a triangle
      const vertexCount = positions.length / 3;
      indices = new Uint32Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
      }
    }
    
    console.log("Creating planet collider with", positions.length / 3, "vertices and", indices.length / 3, "triangles");
    
    // Create a trimesh collider for the entire planet surface
    const colliderVertices = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      colliderVertices[i] = positions[i];
    }
    
    // Create trimesh collider
    const trimeshDesc = RAPIER.ColliderDesc.trimesh(
      colliderVertices,
      indices
    )
    .setFriction(0.8)
    .setRestitution(0.1);
    
    const planetCollider = physicsWorld.value.createCollider(trimeshDesc, planetBody);
    
    if (debugInfo) {
      debugInfo.planetHandle = planetCollider.handle;
    }
    
    console.log("Planet terrain created with trimesh collider, handle:", planetCollider.handle);
    
    // Update gravity center to match planet center
    gravity.center.set(0, planetY, 0);
    
    // Don't override player spawn position here - let the platform be the spawn area
    // Remove the player respawn code from createPlanet
    
    // Add some visual features to the planet
    addPlanetFeatures();
    
    return planet.value;
  } catch (e) {
    console.error("Error creating planet terrain:", e);
    return null;
  }
};

// Add function to create additional planet features
const addPlanetFeatures = () => {
  if (!scene.value || !planet.value || !physicsWorld.value) return;
  
  // Create pushable rocks with physics
  for (let i = 0; i < 20; i++) {
    // Random position on sphere surface
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.cos(phi);
    const z = Math.sin(phi) * Math.sin(theta);
    
    // Place at planet radius plus a bit
    const radius = 205; // Slightly above average terrain
    const rockPos = new THREE.Vector3(x * radius, y * radius, z * radius);
    
    // Add planet position offset since rocks are in world space
    rockPos.add(new THREE.Vector3(0, -250, 0)); // Planet Y position
    
    // Random scale
    const scale = 0.5 + Math.random() * 1.5;
    
    createPushableRock(rockPos, scale);
  }
};

// Add new function to create pushable rocks
const createPushableRock = (position, scale = 1.0) => {
  if (!scene.value || !physicsWorld.value) return;
  
  try {
    // Create rock geometry and material
    const rockGeometry = new THREE.DodecahedronGeometry(2 * scale, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      roughness: 1,
      metalness: 0
    });
    
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.copy(position);
    
    // Random rotation
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.value.add(rock);
    
    // Create physics body for the rock
    const rockBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({
        x: rock.quaternion.x,
        y: rock.quaternion.y,
        z: rock.quaternion.z,
        w: rock.quaternion.w
      })
      .setLinearDamping(0.4)
      .setAngularDamping(0.4)
      .setCanSleep(true);
    
    const rockBody = physicsWorld.value.createRigidBody(rockBodyDesc);
    
    // Create collider - using sphere for better rolling
    const rockColliderDesc = RAPIER.ColliderDesc.ball(2 * scale)
      .setDensity(0.3) // Reduced from 1.2 to 0.3 for much lighter rocks
      .setFriction(0.8)
      .setRestitution(0.4); // Increased from 0.2 to 0.4 for more bounce
    
    const rockCollider = physicsWorld.value.createCollider(rockColliderDesc, rockBody);
    
    // Store the body reference on the mesh for animation updates
    rock.userData.physicsBody = rockBody;
    
    console.log("Created pushable rock at", position.x.toFixed(1), position.y.toFixed(1), position.z.toFixed(1));
    
    return rock;
  } catch (e) {
    console.error("Error creating pushable rock:", e);
    return null;
  }
};

// Add missing player collider handle to debugInfo initialization
debugInfo.playerColliderHandle = null;

// Rewrite the createPlayer function to use dynamic body with rotation locks
const createPlayer = () => {
  if (!scene.value || !physicsWorld.value) {
    console.error("Scene or physics world not initialized");
    return;
  }
  
  try {
    console.log("Creating player...");
    
    // Position player above the platform
    // Platform is at y=30 with height 3, so surface is at y=31.5
    const spawnHeight = 35; // Spawn 3.5 units above platform surface
    
    // Create player physics body as DYNAMIC with locked rotations
    const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, spawnHeight, 0)
      .setLinearDamping(0.1)
      .setAngularDamping(1.0)
      .setCanSleep(false) // Prevent sleeping to ensure continuous collision detection
      .lockRotations(); // Lock rotations - we'll manually control them with setRotation
    
    playerBody.value = physicsWorld.value.createRigidBody(playerBodyDesc);
    
    // Create player collider
    const playerColliderDesc = RAPIER.ColliderDesc.capsule(
      playerHeight / 2 - playerRadius,
      playerRadius
    )
    .setFriction(0.0)
    .setRestitution(0.0)
    .setDensity(1.0)
    .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    const playerCollider = physicsWorld.value.createCollider(playerColliderDesc, playerBody.value);
    console.log("Player collider created with locked rotations:", playerCollider.handle);
    
    // Store the player collider handle for collision filtering
    if (debugInfo) {
      debugInfo.playerColliderHandle = playerCollider.handle;
    }
    
    // Create player visual mesh
    const playerGeometry = new THREE.CapsuleGeometry(
      playerRadius,
      playerHeight - playerRadius * 2,
      8, 8
    );
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff9900,
      transparent: true,
      opacity: 0.7
    });
    
    // Create the mesh and add it to the scene
    player.value = new THREE.Mesh(playerGeometry, playerMaterial);
    scene.value.add(player.value);
    
    // Add camera to player at eye level
    player.value.add(camera.value);
    camera.value.position.set(0, playerHeight * 0.8, 0);
    camera.value.rotation.set(0, 0, 0);
    
    // Initialize camera rotation
    cameraRotation.value.set(0, 0, 0);
    
    // Create ray visualizations
    createRayVisualizations();
    
    // Set up collision handling
    setupCollisionHandling();
    
    console.log("Player created successfully at position:", spawnHeight);
  } catch (e) {
    console.error("Error creating player:", e);
  }
};

// Add collision tracking variables near other state variables
const groundCollisions = shallowRef(new Set()); // Track which colliders we're touching
const lastGroundContact = ref(0); // Track when we last had ground contact

// Add function to process collision events
const processCollisionEvents = () => {
  if (!physicsWorld.value?.eventQueue || !playerBody.value) return;
  
  try {
    physicsWorld.value.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      // Check if one of the colliders belongs to the player
      let playerColliderHandle = null;
      let otherColliderHandle = null;
      
      if (debugInfo.playerColliderHandle) {
        if (handle1 === debugInfo.playerColliderHandle) {
          playerColliderHandle = handle1;
          otherColliderHandle = handle2;
        } else if (handle2 === debugInfo.playerColliderHandle) {
          playerColliderHandle = handle2;
          otherColliderHandle = handle1;
        }
      }
      
      if (playerColliderHandle) {
        const currentTime = performance.now();
        
        if (started) {
          // Collision started - add to ground collisions
          groundCollisions.value.add(otherColliderHandle);
          lastGroundContact.value = currentTime;
          
          console.log("Collision started with handle:", otherColliderHandle, "Total collisions:", groundCollisions.value.size);
        } else {
          // Collision ended - remove from ground collisions
          groundCollisions.value.delete(otherColliderHandle);
          
          console.log("Collision ended with handle:", otherColliderHandle, "Remaining collisions:", groundCollisions.value.size);
        }
      }
    });
  } catch (e) {
    console.error("Error processing collision events:", e);
  }
};

// Replace the checkGrounded function with improved collision and ray-based detection
const checkGrounded = () => {
  if (!playerBody.value || !physicsWorld.value) return;
  
  try {
    // Check collision-based grounding
    wasGrounded.value = isGrounded.value;
    
    // Ground detection based on collision events and velocity
    const currentTime = performance.now();
    const velocityRapier = playerBody.value.linvel();
    
    // Convert RAPIER velocity to THREE.js Vector3
    const velocity = new THREE.Vector3(velocityRapier.x, velocityRapier.y, velocityRapier.z);
    
    // Get player position for ray casting
    const playerTranslation = playerBody.value.translation();
    const playerPos = new THREE.Vector3(
      playerTranslation.x,
      playerTranslation.y,
      playerTranslation.z
    );
    
    // Calculate gravity direction from planet center to player for ray casting
    const gravityDir = new THREE.Vector3()
      .subVectors(gravity.center, playerPos)
      .normalize();
    
    // Update ray direction to match gravity
    rayDir.value.copy(gravityDir);
    
    // Update foot positions for ray casting
    const playerQuat = new THREE.Quaternion(
      playerBody.value.rotation().x,
      playerBody.value.rotation().y,
      playerBody.value.rotation().z,
      playerBody.value.rotation().w
    );
    
    const footOffset = playerRadius * 0.8;
    const footLevel = -playerHeight * 0.5; // Bottom of capsule
    
    // Calculate foot positions at bottom of capsule
    const leftOffset = new THREE.Vector3(-footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const rightOffset = new THREE.Vector3(footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const centerOffset = new THREE.Vector3(0, footLevel, 0).applyQuaternion(playerQuat);
    
    leftFootPos.value.copy(playerPos).add(leftOffset);
    rightFootPos.value.copy(playerPos).add(rightOffset);
    centerFootPos.value.copy(playerPos).add(centerOffset);
    
    // Cast rays for grounding detection using gravity direction
    const castGroundingRay = (footPos) => {
      const footRay = new RAPIER.Ray(
        { x: footPos.x, y: footPos.y, z: footPos.z },
        { x: rayDir.value.x, y: rayDir.value.y, z: rayDir.value.z }
      );
      
      return physicsWorld.value.castRay(
        footRay,
        0.5, // Slightly longer distance for better surface detection
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        (colliderHandle) => {
          if (debugInfo.playerColliderHandle && colliderHandle === debugInfo.playerColliderHandle) {
            return false;
          }
          return true;
        }
      );
    };
    
    // Update foot hits for grounding
    leftFootHit.value = castGroundingRay(leftFootPos.value);
    rightFootHit.value = castGroundingRay(rightFootPos.value);
    centerFootHit.value = castGroundingRay(centerFootPos.value);
    
    // Determine grounding based on multiple criteria
    const hasGroundCollisions = groundCollisions.value.size > 0;
    const hasRayHits = leftFootHit.value || rightFootHit.value || centerFootHit.value;
    const lowDownwardVelocity = velocity.dot(gravityDir) < 2.0; // Check velocity relative to gravity
    const recentGroundContact = (currentTime - lastGroundContact.value) < 200; // 200ms grace period
    
    // We're grounded if we have collisions or ray hits with appropriate velocity
    isGrounded.value = (hasGroundCollisions && lowDownwardVelocity) || 
                      (hasRayHits && lowDownwardVelocity) ||
                      (recentGroundContact && Math.abs(velocity.dot(gravityDir)) < 0.5);
    
    // Handle transition from grounded to airborne
    if (wasGrounded.value && !isGrounded.value) {
      resetCameraForAirborne();
    }
    
    // If we have collisions or ray hits, update last ground contact time
    if (hasGroundCollisions || hasRayHits) {
      lastGroundContact.value = currentTime;
    }
    
    // Align player to surface when grounded AND adjust position so feet touch ground
    if (isGrounded.value && (centerFootHit.value || leftFootHit.value || rightFootHit.value)) {
      alignPlayerToSurface(gravityDir);
      
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
        // The player center should be playerHeight/2 units away from the contact point
        // in the opposite direction of gravity
        const upDir = gravityDir.clone().multiplyScalar(-1);
        const targetPlayerCenter = hitPoint.clone().add(upDir.clone().multiplyScalar(playerHeight * 0.5));
        
        // Apply a small offset to prevent sinking into terrain
        targetPlayerCenter.add(upDir.clone().multiplyScalar(0.05));
        
        // Smoothly move player to correct position
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
    
    // Log grounding state changes
    if (isGrounded.value !== wasGrounded.value) {
      if (isGrounded.value) {
        console.log("Player became grounded - Collisions:", groundCollisions.value.size, "Ray hits:", hasRayHits);
      } else {
        console.log("Player became airborne - Collisions:", groundCollisions.value.size, "Ray hits:", hasRayHits);
      }
    }
    
    // Debug logging every 60 frames (1 second at 60fps)
    if (frameCount.value % 60 === 0) {
      console.log("Ground check - Collisions:", groundCollisions.value.size, 
                  "Ray hits:", hasRayHits, 
                  "Grounded:", isGrounded.value,
                  "Player pos:", playerPos.x.toFixed(1), playerPos.y.toFixed(1), playerPos.z.toFixed(1));
    }
  } catch (e) {
    console.error("Error checking grounded state:", e);
  }
};

// Add function to align player to surface normal
const alignPlayerToSurface = (gravityDirection) => {
  if (!playerBody.value || !player.value) return;
  
  try {
    // Only align to surface when grounded
    if (!isGrounded.value) return;
    
    // Get the best surface normal from ray hits
    let surfaceNormal = null;
    
    // Priority: center hit, then average of left/right hits
    if (centerFootHit.value && centerFootHit.value.normal) {
      surfaceNormal = new THREE.Vector3(
        centerFootHit.value.normal.x,
        centerFootHit.value.normal.y,
        centerFootHit.value.normal.z
      );
    } else if (leftFootHit.value?.normal || rightFootHit.value?.normal) {
      // Average the normals if we have multiple hits
      surfaceNormal = new THREE.Vector3(0, 0, 0);
      let normalCount = 0;
      
      if (leftFootHit.value?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          leftFootHit.value.normal.x,
          leftFootHit.value.normal.y,
          leftFootHit.value.normal.z
        ));
        normalCount++;
      }
      
      if (rightFootHit.value?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          rightFootHit.value.normal.x,
          rightFootHit.value.normal.y,
          rightFootHit.value.normal.z
        ));
        normalCount++;
      }
      
      if (normalCount > 0) {
        surfaceNormal.divideScalar(normalCount).normalize();
      } else {
        surfaceNormal = null;
      }
    }
    
    // If no surface normal found, use opposite of gravity direction
    if (!surfaceNormal) {
      surfaceNormal = gravityDirection.clone().multiplyScalar(-1);
    }
    
    // Get current player rotation to preserve yaw
    const currentPlayerQuat = new THREE.Quaternion(
      playerBody.value.rotation().x,
      playerBody.value.rotation().y,
      playerBody.value.rotation().z,
      playerBody.value.rotation().w
    );
    
    // Extract current forward direction from player rotation
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
    
    // Project current forward onto the surface plane to preserve yaw
    const projectedForward = currentForward.clone()
      .sub(surfaceNormal.clone().multiplyScalar(currentForward.dot(surfaceNormal)))
      .normalize();
    
    // If projected forward is too small, use a default direction
    if (projectedForward.lengthSq() < 0.1) {
      const worldForward = new THREE.Vector3(0, 0, -1);
      projectedForward.copy(worldForward)
        .sub(surfaceNormal.clone().multiplyScalar(worldForward.dot(surfaceNormal)))
        .normalize();
      
      if (projectedForward.lengthSq() < 0.1) {
        projectedForward.set(1, 0, 0).projectOnPlane(surfaceNormal).normalize();
      }
    }
    
    // Create rotation that aligns capsule Y-axis with surface normal while preserving yaw
    const right = new THREE.Vector3().crossVectors(projectedForward, surfaceNormal).normalize();
    const alignedForward = new THREE.Vector3().crossVectors(surfaceNormal, right).normalize();
    
    // Build rotation matrix
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(right, surfaceNormal, alignedForward.multiplyScalar(-1));
    
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    
    // Smoothly interpolate rotation when grounded
    const lerpFactor = 0.15;
    currentPlayerQuat.slerp(targetQuat, lerpFactor);
    
    // Update physics body rotation
    playerBody.value.setRotation({
      x: currentPlayerQuat.x,
      y: currentPlayerQuat.y,
      z: currentPlayerQuat.z,
      w: currentPlayerQuat.w
    });
    
    // Update visual mesh to match
    player.value.quaternion.copy(currentPlayerQuat);
    
    // Update last ground normal for reference
    if (lastGroundNormal && lastGroundNormal.value) {
      lastGroundNormal.value.copy(surfaceNormal);
    }
    
  } catch (e) {
    console.error("Error aligning player to surface:", e);
  }
};

// Add the missing updatePlayerTransform function
const updatePlayerTransform = () => {
  if (!playerBody.value || !player.value || !camera.value) return;
  
  try {
    // Update player mesh position from physics body
    const position = playerBody.value.translation();
    player.value.position.set(position.x, position.y, position.z);
    
    // Always sync visual rotation with physics body rotation
    const physicsQuat = new THREE.Quaternion(
      playerBody.value.rotation().x,
      playerBody.value.rotation().y,
      playerBody.value.rotation().z,
      playerBody.value.rotation().w
    );
    player.value.quaternion.copy(physicsQuat);
    
    // Update facing direction from physics body rotation
    playerFacing.value.set(0, 0, -1).applyQuaternion(physicsQuat);
    
    // Update camera rotation - when airborne, camera should follow player body exactly
    if (isGrounded.value) {
      // When grounded, use camera rotation for pitch, player handles yaw
      camera.value.rotation.x = cameraRotation.value.x;
      camera.value.rotation.y = cameraRotation.value.y;
      camera.value.rotation.z = 0;
    } else {
      // When airborne, camera rotation should be 0 since player body handles all rotation
      camera.value.rotation.x = 0;
      camera.value.rotation.y = 0;
      camera.value.rotation.z = 0;
    }
  } catch (e) {
    console.error("Error updating player transform:", e);
  }
};

// Add the missing handleAllMovement function before the animate function
const handleAllMovement = (deltaTime) => {
  if (!playerBody.value || !physicsWorld.value) return;
  
  try {
    const velocity = playerBody.value.linvel();
    const playerTranslation = playerBody.value.translation();
    const playerPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
    
    // Calculate planet-centered gravity
    const gravityDir = new THREE.Vector3()
      .subVectors(gravity.center, playerPos)
      .normalize();
    
    // Calculate distance for gravity falloff (optional)
    const distanceToPlanet = playerPos.distanceTo(gravity.center);
    const gravityStrength = gravity.strength;
    
    // Apply custom gravity force
    const gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * deltaTime);
    
    // Apply planet gravity to ALL dynamic bodies (rocks, etc.)
    if (scene.value) {
      scene.value.traverse((child) => {
        if (child.isMesh && child.userData.physicsBody) {
          const body = child.userData.physicsBody;
          
          // Get object position
          const objTranslation = body.translation();
          const objPos = new THREE.Vector3(objTranslation.x, objTranslation.y, objTranslation.z);
          
          // Calculate gravity direction for this object
          const objGravityDir = new THREE.Vector3()
            .subVectors(gravity.center, objPos)
            .normalize();
          
          // Apply gravity force to this object
          const objGravityForce = objGravityDir.clone().multiplyScalar(gravityStrength * deltaTime);
          const objVelocity = body.linvel();
          
          body.setLinvel({
            x: objVelocity.x + objGravityForce.x,
            y: objVelocity.y + objGravityForce.y,
            z: objVelocity.z + objGravityForce.z
          });
        }
      });
    }
    
    // Handle roll input when airborne (Q and E keys for 6DOF)
    if (!isGrounded.value && playerBody.value) {
      const rollSensitivity = 2.0; // Radians per second
      let rollDelta = 0;
      
      if (keys.rollLeft) rollDelta -= rollSensitivity * deltaTime;
      if (keys.rollRight) rollDelta += rollSensitivity * deltaTime;
      
      if (Math.abs(rollDelta) > 0.001) {
        // Get current player quaternion
        const currentPlayerQuat = new THREE.Quaternion(
          playerBody.value.rotation().x,
          playerBody.value.rotation().y,
          playerBody.value.rotation().z,
          playerBody.value.rotation().w
        );
        
        // Create roll rotation around local forward axis (Z-axis)
        const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(localForward, rollDelta);
        
        // Apply roll rotation to player body
        currentPlayerQuat.premultiply(rollQuat);
        
        // Update player body rotation
        playerBody.value.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
      }
    }
    
    // Calculate movement input
    let moveForward = 0;
    let moveRight = 0;
    
    if (keys.forward) moveForward += 1;
    if (keys.backward) moveForward -= 1;
    if (keys.left) moveRight -= 1;
    if (keys.right) moveRight += 1;
    
    // Normalize movement vector
    const moveLength = Math.sqrt(moveForward * moveForward + moveRight * moveRight);
    if (moveLength > 0) {
      moveForward /= moveLength;
      moveRight /= moveLength;
    }
    
    // Apply speed
    const speed = keys.run ? runSpeed : walkSpeed;
    moveForward *= speed;
    moveRight *= speed;
    
    // Update isMoving and currentSpeed for UI
    isMoving.value = moveLength > 0;
    currentSpeed.value = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    
    // Always use player body rotation for movement direction (both grounded and airborne)
    const playerQuat = new THREE.Quaternion(
      playerBody.value.rotation().x,
      playerBody.value.rotation().y,
      playerBody.value.rotation().z,
      playerBody.value.rotation().w
    );
    
    let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    
    // If grounded, project movement onto surface plane
    if (isGrounded.value && lastGroundNormal.value) {
      const surfaceNormal = lastGroundNormal.value;
      
      // Project forward and right onto the surface plane
      forward.projectOnPlane(surfaceNormal).normalize();
      right.projectOnPlane(surfaceNormal).normalize();
    }
    
    // Calculate final movement vector in world space
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, moveForward);
    moveDir.addScaledVector(right, moveRight);
    
    // Start with current velocity and apply planet gravity (already applied above)
    let newVelX = velocity.x + gravityForce.x;
    let newVelY = velocity.y + gravityForce.y;
    let newVelZ = velocity.z + gravityForce.z;
    
    // Apply movement forces
    if (isGrounded.value) {
      // Ground movement
      const groundAccel = 100.0; // Increased from 50.0 to 100.0 for faster acceleration
      newVelX += moveDir.x * groundAccel * deltaTime;
      newVelY += moveDir.y * groundAccel * deltaTime; // Include Y for slopes
      newVelZ += moveDir.z * groundAccel * deltaTime;
      
      // Apply ground friction when not moving
      if (moveLength === 0) {
        newVelX *= 0.8;
        newVelY *= 0.95; // Less friction on Y to allow sliding on slopes
        newVelZ *= 0.8;
      }
      
      // Clamp to max speed
      const vel = new THREE.Vector3(newVelX, newVelY, newVelZ);
      const velMagnitude = vel.length();
      if (velMagnitude > speed * 1.5) { // Allow some overspeed
        vel.normalize().multiplyScalar(speed * 1.5);
        newVelX = vel.x;
        newVelY = vel.y;
        newVelZ = vel.z;
      }
    } else {
      // Air movement - minimal control for realistic falling
      const airControl = 1.0; // Reduced from 5.0 to 1.0 for very limited air movement
      newVelX += moveDir.x * airControl * deltaTime;
      newVelY += moveDir.y * airControl * deltaTime; // Allow Y movement when airborne
      newVelZ += moveDir.z * airControl * deltaTime;
      
      // Apply stronger air resistance to reduce horizontal movement while falling
      newVelX *= 0.95; // Increased resistance from 0.99 to 0.95
      newVelY *= 0.98; // Slightly less air resistance on Y
      newVelZ *= 0.95; // Increased resistance from 0.99 to 0.95
    }
    
    // Handle jumping - jump against gravity direction
    if (keys.jump && isGrounded.value && !jumpInProgress.value) {
      const jumpVector = gravityDir.clone().multiplyScalar(-jumpForce);
      newVelX += jumpVector.x;
      newVelY += jumpVector.y;
      newVelZ += jumpVector.z;
      jumpInProgress.value = true;
      jumpTime.value = 0;
      console.log("Jump initiated against gravity direction with force:", jumpForce);
    }
    
    // Update jump progress
    if (jumpInProgress.value) {
      jumpTime.value += deltaTime;
      if (jumpTime.value >= jumpDuration || isGrounded.value) {
        jumpInProgress.value = false;
      }
    }
    
    // Update the new velocity to player
    playerBody.value.setLinvel({
      x: newVelX,
      y: newVelY,
      z: newVelZ
    });
    
    // Debug logging for movement
    if (frameCount.value % 60 === 0 && (moveLength > 0 || !isGrounded.value)) {
      const rollState = keys.rollLeft ? "L" : (keys.rollRight ? "R" : "-");
      console.log("Movement - Gravity dir:", gravityDir.x.toFixed(2), gravityDir.y.toFixed(2), gravityDir.z.toFixed(2),
                  "Distance to planet:", distanceToPlanet.toFixed(1),
                  "Vel:", newVelX.toFixed(2), newVelY.toFixed(2), newVelZ.toFixed(2),
                  "Grounded:", isGrounded.value, "Roll:", rollState);
    }
  } catch (e) {
    console.error("Error in handleAllMovement:", e);
  }
};

// Add missing createPlatform function
const createPlatform = () => {
  if (!scene.value || !physicsWorld.value) {
    console.error("Scene or physics world not initialized");
    return;
  }
  
  try {
    console.log("Creating platform with test geometry...");
    
    // Main platform
    const platformWidth = 50;
    const platformHeight = 3;
    const platformDepth = 50;
    const platformGeometry = new THREE.BoxGeometry(
      platformWidth, platformHeight, platformDepth
    );
    
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.7,
      metalness: 0.2
    });
    
    platform.value = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.value.position.set(0, 30, 0);
    platform.value.receiveShadow = true;
    platform.value.castShadow = true;
    scene.value.add(platform.value);
    
    // Create platform physics body
    const platformBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(
        platform.value.position.x,
        platform.value.position.y,
        platform.value.position.z
      );
    
    const platformBody = physicsWorld.value.createRigidBody(platformBodyDesc);
    const platformColliderDesc = RAPIER.ColliderDesc.cuboid(
      platformWidth / 2,
      platformHeight / 2,
      platformDepth / 2
    )
    .setFriction(0.8)  // Back to original value
    .setRestitution(0.2);  // Back to original value
    
    const platformCollider = physicsWorld.value.createCollider(platformColliderDesc, platformBody);
    
    if (debugInfo) {
      debugInfo.platformHandle = platformCollider.handle;
    }
    
    // Add a wall on the platform
    const wallWidth = 20;
    const wallHeight = 8;
    const wallDepth = 1;
    const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x4444aa,
      roughness: 0.5,
      metalness: 0.3
    });
    
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(10, 30 + platformHeight/2 + wallHeight/2, -15);
    wall.receiveShadow = true;
    wall.castShadow = true;
    scene.value.add(wall);
    
    // Create wall physics
    const wallBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(wall.position.x, wall.position.y, wall.position.z);
    
    const wallBody = physicsWorld.value.createRigidBody(wallBodyDesc);
    const wallColliderDesc = RAPIER.ColliderDesc.cuboid(
      wallWidth / 2,
      wallHeight / 2,
      wallDepth / 2
    )
    .setFriction(0.5)  // Back to original value
    .setRestitution(0.1);  // Back to original value
    
    const wallCollider = physicsWorld.value.createCollider(wallColliderDesc, wallBody);
    
    if (debugInfo) {
      debugInfo.wallHandle = wallCollider.handle;
    }
    
    // Add a ramp on the platform
    const rampWidth = 10;
    const rampHeight = 5;
    const rampDepth = 15;
    const rampAngle = Math.PI / 6; // 30 degrees
    
    // Create ramp using a rotated box
    const rampGeometry = new THREE.BoxGeometry(rampWidth, 1, rampDepth);
    const rampMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa4444,
      roughness: 0.6,
      metalness: 0.2
    });
    
    const ramp = new THREE.Mesh(rampGeometry, rampMaterial);
    ramp.position.set(-15, 30 + platformHeight/2 + rampHeight/2, 10);
    ramp.rotation.x = -rampAngle;
    ramp.receiveShadow = true;
    ramp.castShadow = true;
    scene.value.add(ramp);
    
    // Create ramp physics with proper rotation
    const rampBodyDesc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(ramp.position.x, ramp.position.y, ramp.position.z)
      .setRotation({ w: Math.cos(-rampAngle/2), x: Math.sin(-rampAngle/2), y: 0, z: 0 });
    
    const rampBody = physicsWorld.value.createRigidBody(rampBodyDesc);
    const rampColliderDesc = RAPIER.ColliderDesc.cuboid(
      rampWidth / 2,
      0.5, // Half thickness
      rampDepth / 2
    )
    .setFriction(0.7)  // Back to original value
    .setRestitution(0.1);  // Back to original value
    
    const rampCollider = physicsWorld.value.createCollider(rampColliderDesc, rampBody);
    
    if (debugInfo) {
      debugInfo.rampHandle = rampCollider.handle;
    }
    
    // Calculate where the ramp top ends - FIXED calculation
    const rampTopOffset = Math.sin(rampAngle) * rampDepth / 2;
    const rampTopHeight = ramp.position.y + rampTopOffset;
    const rampTopZ = ramp.position.z + Math.cos(rampAngle) * rampDepth / 2; // Changed from minus to plus
    
    // Create moving platform at the top of the ramp
    const movingPlatformWidth = 8;
    const movingPlatformHeight = 1;
    const movingPlatformDepth = 8;
    
    const movingPlatformGeometry = new THREE.BoxGeometry(
      movingPlatformWidth, movingPlatformHeight, movingPlatformDepth
    );
    const movingPlatformMaterial = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      roughness: 0.5,
      metalness: 0.3,
      emissive: 0x224488,
      emissiveIntensity: 0.2
    });
    
    movingPlatform.value = new THREE.Mesh(movingPlatformGeometry, movingPlatformMaterial);
    movingPlatform.value.position.set(
      -15, // Start at ramp X position
      rampTopHeight + movingPlatformHeight/2, // Position at ramp top
      rampTopZ + movingPlatformDepth/2 + 1 // Changed from minus to plus, and past the high edge
    );
    movingPlatform.value.receiveShadow = true;
    movingPlatform.value.castShadow = true;
    scene.value.add(movingPlatform.value);
    
    // Create KINEMATIC physics body for moving platform
    const movingPlatformBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(
        movingPlatform.value.position.x,
        movingPlatform.value.position.y,
        movingPlatform.value.position.z
      );
    
    movingPlatformBody.value = physicsWorld.value.createRigidBody(movingPlatformBodyDesc);
    
    const movingPlatformColliderDesc = RAPIER.ColliderDesc.cuboid(
      movingPlatformWidth / 2,
      movingPlatformHeight / 2,
      movingPlatformDepth / 2
    )
    .setFriction(12.0)  // Increased from 2.5 to 4.0 for better grip while still allowing walking
    .setRestitution(0.01);  // Keep minimal bounce
    
    physicsWorld.value.createCollider(movingPlatformColliderDesc, movingPlatformBody.value);
    
    // Store initial position for animation
    movingPlatform.value.userData = {
      initialX: movingPlatform.value.position.x,
      moveRange: 20, // Move 20 units side to side
      moveSpeed: 0.2 // Reduced from 0.5 to 0.2 for slower movement (complete cycle every 2π/0.2 ≈ 31 seconds)
    };
    
    console.log("Moving platform created at ramp top:", 
      movingPlatform.value.position.x, 
      movingPlatform.value.position.y, 
      movingPlatform.value.position.z);
    
    // Add a pushable rock at the edge of the platform for testing
    const rockOnPlatform = new THREE.Vector3(
      20, // Near the edge of the platform (platform width is 50, so edge is at ±25)
      30 + platformHeight/2 + 3, // Platform surface + rock radius + small offset
      20  // Also near the edge in Z direction
    );
    createPushableRock(rockOnPlatform, 1.5); // Slightly larger rock
    
    console.log("Platform with test geometry created successfully");
    
    return platform.value;
  } catch (e) {
    console.error("Error creating platform:", e);
    return null;
  }
};

// Add function to update dynamic objects
const updateDynamicObjects = () => {
  if (!scene.value) return;
  
  // Update moving platform
  if (movingPlatform.value && movingPlatformBody.value) {
    const time = performance.now() * 0.001; // Convert to seconds
    const userData = movingPlatform.value.userData;
    
    // Calculate new position using sine wave
    const offset = Math.sin(time * userData.moveSpeed) * userData.moveRange;
    const newX = userData.initialX + offset;
    
    // Update visual position
    movingPlatform.value.position.x = newX;
    
    // Update physics body position (kinematic bodies need explicit position updates)
    movingPlatformBody.value.setNextKinematicTranslation({
      x: newX,
      y: movingPlatform.value.position.y,
      z: movingPlatform.value.position.z
    });
  }
  
  // Update all meshes that have physics bodies
  scene.value.traverse((child) => {
    if (child.isMesh && child.userData.physicsBody) {
      const body = child.userData.physicsBody;
      
      // Update mesh position from physics body
      const position = body.translation();
      child.position.set(position.x, position.y, position.z);
      
      // Update mesh rotation from physics body
      const rotation = body.rotation();
      child.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  });
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
      camera.value.position.set(0, playerHeight * 0.8, 0);
      camera.value.rotation.set(cameraRotation.value.x, 0, 0);
      
      console.log("Camera reattached to player");
    }
  }
};

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

// Add missing createRayVisualizations function
const createRayVisualizations = () => {
  if (!scene.value || !player.value) {
    console.error("Scene or player not initialized");
    return;
  }
  
  try {
    // Create material for ray lines
    const rayMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00,
      opacity: 0.5,
      transparent: true
    });
    
    // Create material for facing direction line
    const facingMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff0000,
      opacity: 0.8,
      transparent: true,
      linewidth: 3
    });
    
    // Create ray line geometries with proper buffer attributes
    const createRayLine = (material = rayMaterial) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6); // 2 vertices * 3 components
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setDrawRange(0, 2);
      return new THREE.Line(geometry, material.clone());
    };
    
    // Create ray lines as children of the player so they follow automatically
    leftRayLine.value = createRayLine();
    rightRayLine.value = createRayLine();
    centerRayLine.value = createRayLine();
    facingLine.value = createRayLine(facingMaterial);
    
       
    // Add rays to player instead of scene so they move with the player
    player.value.add(leftRayLine.value);
    player.value.add(rightRayLine.value);
    player.value.add(centerRayLine.value);
    player.value.add(facingLine.value);
    
    
    console.log("Ray visualizations created and attached to player");
  } catch (e) {

    console.error("Error creating ray visualizations:", e);
  }
};

// Update the updateRayVisualizations function to work with local coordinates
const updateRayVisualizations = (leftFoot, rightFoot, centerFoot, rayDirection, rayLength) => {
  if (!leftRayLine.value || !rightRayLine.value || !centerRayLine.value || !facingLine.value || !player.value) return;
  
  try {
    // Convert world positions to local positions relative to player

    const worldToLocal = player.value.worldToLocal.bind(player.value);
    
    // Convert foot positions to local space
    const leftFootLocal = worldToLocal(leftFoot.clone());
    const rightFootLocal = worldToLocal(rightFoot.clone());
    const centerFootLocal = worldToLocal(centerFoot.clone());
    
    // Calculate end points in world space then convert to local
    const leftEndWorld = leftFoot.clone().add(rayDirection.clone().multiplyScalar(rayLength));
    const rightEndWorld = rightFoot.clone().add(rayDirection.clone().multiplyScalar(rayLength));
    const centerEndWorld = centerFoot.clone().add(rayDirection.clone().multiplyScalar(rayLength));
    
    const leftEndLocal = worldToLocal(leftEndWorld);
    const rightEndLocal = worldToLocal(rightEndWorld);
    const centerEndLocal = worldToLocal(centerEndWorld);
    
    // Update geometry positions in local space
    const updateRayGeometry = (rayLine, startLocal, endLocal) => {
      const positions = rayLine.geometry.attributes.position.array;
      positions[0] = startLocal.x;
      positions[1] = startLocal.y;
      positions[2] = startLocal.z;
      positions[3] = endLocal.x;
      positions[4] = endLocal.y;
      positions[5] = endLocal.z;
      rayLine.geometry.attributes.position.needsUpdate = true;
    };
    
    updateRayGeometry(leftRayLine.value, leftFootLocal, leftEndLocal);
    updateRayGeometry(rightRayLine.value, rightFootLocal, rightEndLocal);
    updateRayGeometry(centerRayLine.value, centerFootLocal, centerEndLocal);
    
    // Update facing direction line - show forward direction from player center
    const playerCenter = new THREE.Vector3(0, 0, 0); // Local center
    const facingEndLocal = new THREE.Vector3(0, 0, -3); // 3 units forward in local space
    updateRayGeometry(facingLine.value, playerCenter, facingEndLocal);
    
    // Update colors based on hits
    leftRayLine.value.material.color.setHex(leftFootHit.value ? 0xff0000 : 0x00ff00);
    rightRayLine.value.material.color.setHex(rightFootHit.value ? 0xff0000 : 0x00ff00);
    centerRayLine.value.material.color.setHex(centerFootHit.value ? 0xff0000 : 0x00ff00);
  } catch (e) {
    console.error("Error updating ray visualizations:", e);
  }
};
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