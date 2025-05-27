import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Player configuration
export const playerConfig = {
  height: 1.8,
  radius: 0.4,
  walkSpeed: 8,
  runSpeed: 16,
  jumpForce: 8,
  jumpDuration: 0.5,
  spawnHeight: 35 // Spawn above platform surface
};

// Create player mesh and physics body
export function createPlayer(scene, physicsWorld, debugInfo) {
  if (!scene || !physicsWorld) {
    console.error("Scene or physics world not initialized");
    return null;
  }
  
  try {
    console.log("Creating player...");
    
    // Create player physics body as DYNAMIC with locked rotations
    const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, playerConfig.spawnHeight, 0)
      .setLinearDamping(0.1)
      .setAngularDamping(1.0)
      .setCanSleep(false)
      .lockRotations();
    
    const playerBody = physicsWorld.createRigidBody(playerBodyDesc);
    
    // Create player collider
    const playerColliderDesc = RAPIER.ColliderDesc.capsule(
      playerConfig.height / 2 - playerConfig.radius,
      playerConfig.radius
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
      playerConfig.radius,
      playerConfig.height - playerConfig.radius * 2,
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
    
    console.log("Player created successfully at position:", playerConfig.spawnHeight);
    
    return { player, playerBody, playerCollider };
  } catch (e) {
    console.error("Error creating player:", e);
    return null;
  }
}

// Update player visual transform to match physics body
export function updatePlayerTransform(player, playerBody, cameraRotation) {
  if (!player || !playerBody) return;
  
  try {
    // Get physics body transform
    const position = playerBody.translation();
    const rotation = playerBody.rotation();
    
    // Update mesh position
    player.position.set(position.x, position.y, position.z);
    
    // Update mesh rotation from physics body
    player.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Update player facing direction for debug
    const playerFacing = new THREE.Vector3(0, 0, -1);
    
    // When grounded, facing is based on player body rotation + camera yaw
    const playerQuat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Create camera yaw rotation
    const cameraYawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), 
      cameraRotation.y
    );
    
    // Combine player and camera rotation for facing direction
    const combinedQuat = playerQuat.clone().multiply(cameraYawQuat);
    playerFacing.applyQuaternion(combinedQuat);
    
    return playerFacing;
  } catch (e) {
    console.error("Error updating player transform:", e);
    return new THREE.Vector3(0, 0, -1);
  }
}

// Create ray visualizations for debugging
export function createRayVisualizations(scene, player) {
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
}

// Update ray visualizations
export function updateRayVisualizations(
  player,
  rayLines,
  leftFoot,
  rightFoot,
  centerFoot,
  rayDirection,
  rayLength,
  leftFootHit,
  rightFootHit,
  centerFootHit
) {
  if (!player || !rayLines) return;
  
  const { leftRayLine, rightRayLine, centerRayLine, facingLine } = rayLines;
  if (!leftRayLine || !rightRayLine || !centerRayLine || !facingLine) return;
  
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
}

// Handle mouse movement for player/camera rotation
export function handleMouseMovement(
  event,
  playerBody,
  cameraRotation,
  isGrounded,
  lastGroundNormal,
  lookSensitivity = 0.001,
  yawSensitivity = 0.002
) {
  if (!playerBody) return;
  
  try {
    if (isGrounded) {
      // When grounded, only allow camera pitch and player yaw
      
      // Update camera pitch with limits
      cameraRotation.x -= event.movementY * lookSensitivity;
      cameraRotation.x = Math.max(
        -Math.PI / 2 + 0.01, 
        Math.min(Math.PI / 2 - 0.01, cameraRotation.x)
      );
      
      // Rotate the player body for yaw
      const currentPlayerQuat = new THREE.Quaternion(
        playerBody.rotation().x,
        playerBody.rotation().y,
        playerBody.rotation().z,
        playerBody.rotation().w
      );
      
      // Create yaw rotation around the up vector (surface normal)
      let upVector = new THREE.Vector3(0, 1, 0);
      if (lastGroundNormal) {
        upVector = lastGroundNormal.clone();
      }
      
      const yawDelta = -event.movementX * yawSensitivity;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, yawDelta);
      
      // Apply yaw rotation to player body
      currentPlayerQuat.premultiply(yawQuat);
      
      // Update player body rotation
      playerBody.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
      
      // Keep camera yaw at 0 since player body is now handling the yaw
      cameraRotation.y = 0;
    } else {
      // When airborne, rotate the entire player capsule
      const currentPlayerQuat = new THREE.Quaternion(
        playerBody.rotation().x,
        playerBody.rotation().y,
        playerBody.rotation().z,
        playerBody.rotation().w
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
      playerBody.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
      
      // Keep camera rotation at 0 since player body handles all rotation
      cameraRotation.x = 0;
      cameraRotation.y = 0;
    }
  } catch (e) {
    console.error("Error in mouse movement:", e);
  }
}

// Reset camera for airborne transition
export function resetCameraForAirborne(player, playerBody, cameraRotation, wasGrounded, isGrounded) {
  // When transitioning from grounded to airborne, transfer camera pitch to player rotation
  if (player && playerBody && wasGrounded && !isGrounded) {
    console.log("Transitioning to airborne - transferring camera rotation to player body");
    
    // Get current player quaternion
    const currentPlayerQuat = new THREE.Quaternion(
      playerBody.rotation().x,
      playerBody.rotation().y,
      playerBody.rotation().z,
      playerBody.rotation().w
    );
    
    // Apply current camera pitch to player rotation around local right axis
    if (Math.abs(cameraRotation.x) > 0.01) {
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, cameraRotation.x);
      
      currentPlayerQuat.premultiply(pitchQuat);
      
      // Update player body with new rotation
      playerBody.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
    }
    
    // Reset camera rotation since player body now handles all rotation
    cameraRotation.x = 0;
    cameraRotation.y = 0;
    cameraRotation.z = 0;
  }
}
