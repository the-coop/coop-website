import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Create player function
export const createPlayer = (scene, physicsWorld, camera, debugInfo, playerHeight, playerRadius) => {
  if (!scene || !physicsWorld) {
    console.error("Scene or physics world not initialized");
    return null;
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
    
    const playerBody = physicsWorld.createRigidBody(playerBodyDesc);
    
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
    
    const playerCollider = physicsWorld.createCollider(playerColliderDesc, playerBody);
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
    const player = new THREE.Mesh(playerGeometry, playerMaterial);
    scene.add(player);
    
    // Add camera to player at eye level
    player.add(camera);
    camera.position.set(0, playerHeight * 0.8, 0);
    camera.rotation.set(0, 0, 0);
    
    console.log("Player created successfully at position:", spawnHeight);
    
    return { player, playerBody };
  } catch (e) {
    console.error("Error creating player:", e);
    return null;
  }
};

// Create ray visualizations for grounding detection
export const createRayVisualizations = (scene, player) => {
  if (!scene || !player) {
    console.error("Scene or player not initialized");
    return null;
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
    const leftRayLine = createRayLine();
    const rightRayLine = createRayLine();
    const centerRayLine = createRayLine();
    const facingLine = createRayLine(facingMaterial);
    
    // Add rays to player instead of scene so they move with the player
    player.add(leftRayLine);
    player.add(rightRayLine);
    player.add(centerRayLine);
    player.add(facingLine);
    
    console.log("Ray visualizations created and attached to player");
    
    return { leftRayLine, rightRayLine, centerRayLine, facingLine };
  } catch (e) {
    console.error("Error creating ray visualizations:", e);
    return null;
  }
};

// Update ray visualizations
export const updateRayVisualizations = (rayLines, leftFoot, rightFoot, centerFoot, rayDirection, rayLength, leftFootHit, rightFootHit, centerFootHit, player) => {
  const { leftRayLine, rightRayLine, centerRayLine, facingLine } = rayLines;
  
  if (!leftRayLine || !rightRayLine || !centerRayLine || !facingLine || !player) return;
  
  try {
    // Convert world positions to local positions relative to player
    const worldToLocal = player.worldToLocal.bind(player);
    
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
    
    updateRayGeometry(leftRayLine, leftFootLocal, leftEndLocal);
    updateRayGeometry(rightRayLine, rightFootLocal, rightEndLocal);
    updateRayGeometry(centerRayLine, centerFootLocal, centerEndLocal);
    
    // Update facing direction line - show forward direction from player center
    const playerCenter = new THREE.Vector3(0, 0, 0); // Local center
    const facingEndLocal = new THREE.Vector3(0, 0, -3); // 3 units forward in local space
    updateRayGeometry(facingLine, playerCenter, facingEndLocal);
    
    // Update colors based on hits
    leftRayLine.material.color.setHex(leftFootHit ? 0xff0000 : 0x00ff00);
    rightRayLine.material.color.setHex(rightFootHit ? 0xff0000 : 0x00ff00);
    centerRayLine.material.color.setHex(centerFootHit ? 0xff0000 : 0x00ff00);
  } catch (e) {
    console.error("Error updating ray visualizations:", e);
  }
};

// Setup collision handling
export const setupCollisionHandling = (physicsWorld) => {
  if (!physicsWorld) {
    console.error("Physics world not initialized for collision handling");
    return;
  }
  
  try {
    console.log("Setting up collision event handling");
    
    // Enable collision events for the physics world
    physicsWorld.eventQueue = new RAPIER.EventQueue(true);
    
    console.log("Collision handling setup complete");
  } catch (e) {
    console.error("Error setting up collision handling:", e);
  }
};
