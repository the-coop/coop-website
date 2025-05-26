import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Add collision tracking variables
let groundCollisions = new Set(); // Track which colliders we're touching
let lastGroundContact = 0; // Track when we last had ground contact

// Process collision events
export const processCollisionEvents = (physicsWorld, debugInfo) => {
  if (!physicsWorld?.eventQueue) return;
  
  try {
    physicsWorld.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
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
          groundCollisions.add(otherColliderHandle);
          lastGroundContact = currentTime;
          
          console.log("Collision started with handle:", otherColliderHandle, "Total collisions:", groundCollisions.size);
        } else {
          // Collision ended - remove from ground collisions
          groundCollisions.delete(otherColliderHandle);
          
          console.log("Collision ended with handle:", otherColliderHandle, "Remaining collisions:", groundCollisions.size);
        }
      }
    });
  } catch (e) {
    console.error("Error processing collision events:", e);
  }
};

// Check if player is grounded
export const checkGrounded = (
  playerBody, 
  physicsWorld, 
  gravity, 
  playerRadius, 
  playerHeight,
  rayDir,
  leftFootPos,
  rightFootPos,
  centerFootPos,
  frameCount
) => {
  if (!playerBody || !physicsWorld) return { isGrounded: false, leftFootHit: null, rightFootHit: null, centerFootHit: null };
  
  try {
    // Get player position for ray casting
    const playerTranslation = playerBody.translation();
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
    rayDir.copy(gravityDir);
    
    // Update foot positions for ray casting
    const playerQuat = new THREE.Quaternion(
      playerBody.rotation().x,
      playerBody.rotation().y,
      playerBody.rotation().z,
      playerBody.rotation().w
    );
    
    const footOffset = playerRadius * 0.8;
    const footLevel = -playerHeight * 0.5; // Bottom of capsule
    
    // Calculate foot positions at bottom of capsule
    const leftOffset = new THREE.Vector3(-footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const rightOffset = new THREE.Vector3(footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const centerOffset = new THREE.Vector3(0, footLevel, 0).applyQuaternion(playerQuat);
    
    leftFootPos.copy(playerPos).add(leftOffset);
    rightFootPos.copy(playerPos).add(rightOffset);
    centerFootPos.copy(playerPos).add(centerOffset);
    
    // Cast rays for grounding detection using gravity direction
    const castGroundingRay = (footPos) => {
      const footRay = new RAPIER.Ray(
        { x: footPos.x, y: footPos.y, z: footPos.z },
        { x: rayDir.x, y: rayDir.y, z: rayDir.z }
      );
      
      return physicsWorld.castRay(
        footRay,
        0.5, // Slightly longer distance for better surface detection
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        (colliderHandle) => {
          // Exclude player's own collider
          return colliderHandle !== debugInfo.playerColliderHandle;
        }
      );
    };
    
    // Update foot hits for grounding
    const leftFootHit = castGroundingRay(leftFootPos);
    const rightFootHit = castGroundingRay(rightFootPos);
    const centerFootHit = castGroundingRay(centerFootPos);
    
    // Get current velocity
    const velocityRapier = playerBody.linvel();
    const velocity = new THREE.Vector3(velocityRapier.x, velocityRapier.y, velocityRapier.z);
    
    // Determine grounding based on multiple criteria
    const currentTime = performance.now();
    const hasGroundCollisions = groundCollisions.size > 0;
    const hasRayHits = leftFootHit || rightFootHit || centerFootHit;
    const lowDownwardVelocity = velocity.dot(gravityDir) < 2.0; // Check velocity relative to gravity
    const recentGroundContact = (currentTime - lastGroundContact) < 200; // 200ms grace period
    
    // We're grounded if we have collisions or ray hits with appropriate velocity
    const isGrounded = (hasGroundCollisions && lowDownwardVelocity) || 
                      (hasRayHits && lowDownwardVelocity) ||
                      (recentGroundContact && Math.abs(velocity.dot(gravityDir)) < 0.5);
    
    // If we have collisions or ray hits, update last ground contact time
    if (hasGroundCollisions || hasRayHits) {
      lastGroundContact = currentTime;
    }
    
    // Debug logging every 60 frames (1 second at 60fps)
    if (frameCount % 60 === 0) {
      console.log("Ground check - Collisions:", groundCollisions.size, 
                  "Ray hits:", hasRayHits, 
                  "Grounded:", isGrounded,
                  "Player pos:", playerPos.x.toFixed(1), playerPos.y.toFixed(1), playerPos.z.toFixed(1));
    }
    
    return { 
      isGrounded, 
      leftFootHit, 
      rightFootHit, 
      centerFootHit,
      gravityDir
    };
  } catch (e) {
    console.error("Error checking grounded state:", e);
    return { isGrounded: false, leftFootHit: null, rightFootHit: null, centerFootHit: null };
  }
};

// Align player to surface normal
export const alignPlayerToSurface = (playerBody, player, gravityDirection, centerFootHit, leftFootHit, rightFootHit, lastGroundNormal) => {
  if (!playerBody || !player) return;
  
  try {
    // Get the best surface normal from ray hits
    let surfaceNormal = null;
    
    // Priority: center hit, then average of left/right hits
    if (centerFootHit && centerFootHit.normal) {
      surfaceNormal = new THREE.Vector3(
        centerFootHit.normal.x,
        centerFootHit.normal.y,
        centerFootHit.normal.z
      );
    } else if (leftFootHit?.normal || rightFootHit?.normal) {
      // Average the normals if we have multiple hits
      surfaceNormal = new THREE.Vector3(0, 0, 0);
      let normalCount = 0;
      
      if (leftFootHit?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          leftFootHit.normal.x,
          leftFootHit.normal.y,
          leftFootHit.normal.z
        ));
        normalCount++;
      }
      
      if (rightFootHit?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          rightFootHit.normal.x,
          rightFootHit.normal.y,
          rightFootHit.normal.z
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
      playerBody.rotation().x,
      playerBody.rotation().y,
      playerBody.rotation().z,
      playerBody.rotation().w
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
    playerBody.setRotation({
      x: currentPlayerQuat.x,
      y: currentPlayerQuat.y,
      z: currentPlayerQuat.z,
      w: currentPlayerQuat.w
    });
    
    // Update visual mesh to match
    player.quaternion.copy(currentPlayerQuat);
    
    // Update last ground normal for reference
    if (lastGroundNormal) {
      lastGroundNormal.copy(surfaceNormal);
    }
    
  } catch (e) {
    console.error("Error aligning player to surface:", e);
  }
};

// Handle all movement including gravity and input
export const handleAllMovement = (
  playerBody,
  scene,
  keys,
  gravity,
  cameraRotation,
  isGrounded,
  lastGroundNormal,
  jumpInProgress,
  jumpTime,
  jumpDuration,
  jumpForce,
  walkSpeed,
  runSpeed,
  frameCount,
  deltaTime
) => {
  if (!playerBody) return { jumpInProgress: jumpInProgress.value, jumpTime: jumpTime.value };
  
  try {
    const velocity = playerBody.linvel();
    const playerTranslation = playerBody.translation();
    const playerPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
    
    // Calculate planet-centered gravity
    const gravityDir = new THREE.Vector3()
      .subVectors(gravity.center, playerPos)
      .normalize();
    
    const gravityStrength = gravity.strength;
    
    // Apply custom gravity force
    const gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * deltaTime);
    
    // Apply planet gravity to ALL dynamic bodies (rocks, etc.)
    if (scene) {
      scene.traverse((child) => {
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
    if (!isGrounded && playerBody) {
      const rollSensitivity = 2.0; // Radians per second
      let rollDelta = 0;
      
      if (keys.rollLeft) rollDelta -= rollSensitivity * deltaTime;
      if (keys.rollRight) rollDelta += rollSensitivity * deltaTime;
      
      if (Math.abs(rollDelta) > 0.001) {
        // Get current player quaternion
        const currentPlayerQuat = new THREE.Quaternion(
          playerBody.rotation().x,
          playerBody.rotation().y,
          playerBody.rotation().z,
          playerBody.rotation().w
        );
        
        // Create roll rotation around local forward axis (Z-axis)
        const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(localForward, rollDelta);
        
        // Apply roll rotation to player body
        currentPlayerQuat.premultiply(rollQuat);
        
        // Update player body rotation
        playerBody.setRotation({
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
    
    // Always use player body rotation for movement direction (both grounded and airborne)
    const playerQuat = new THREE.Quaternion(
      playerBody.rotation().x,
      playerBody.rotation().y,
      playerBody.rotation().z,
      playerBody.rotation().w
    );
    
    let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    
    // If grounded, project movement onto surface plane
    if (isGrounded && lastGroundNormal) {
      const surfaceNormal = lastGroundNormal;
      
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
    if (isGrounded) {
      // Ground movement
      const groundAccel = 100.0; // Increased acceleration
      newVelX += moveDir.x * groundAccel * deltaTime;
      newVelY += moveDir.y * groundAccel * deltaTime; // Include Y for slopes
      newVelZ += moveDir.z * groundAccel * deltaTime;
      
      // Apply ground friction when not moving
      if (moveLength === 0) {
        newVelX *= 0.8;
        newVelY *= 0.95;
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
      const airControl = 1.0; // Limited air movement
      newVelX += moveDir.x * airControl * deltaTime;
      newVelY += moveDir.y * airControl * deltaTime; // Allow Y movement when airborne
      newVelZ += moveDir.z * airControl * deltaTime;
      
      // Apply stronger air resistance to reduce horizontal movement while falling
      newVelX *= 0.95; // Increased resistance
      newVelY *= 0.98; // Slightly less air resistance on Y
      newVelZ *= 0.95; // Increased resistance
    }
    
    // Handle jumping - jump against gravity direction
    let newJumpInProgress = jumpInProgress;
    let newJumpTime = jumpTime;
    
    if (keys.jump && isGrounded && !jumpInProgress) {
      const jumpVector = gravityDir.clone().multiplyScalar(-jumpForce);
      newVelX += jumpVector.x;
      newVelY += jumpVector.y;
      newVelZ += jumpVector.z;
      newJumpInProgress = true;
      newJumpTime = 0;
      console.log("Jump initiated against gravity direction with force:", jumpForce);
    }
    
    // Update jump progress
    if (newJumpInProgress) {
      newJumpTime += deltaTime;
      if (newJumpTime >= jumpDuration || isGrounded) {
        newJumpInProgress = false;
      }
    }
    
    // Update the new velocity to player
    playerBody.setLinvel({
      x: newVelX,
      y: newVelY,
      z: newVelZ
    });
    
    // Debug logging for movement
    if (frameCount % 60 === 0 && (moveLength > 0 || !isGrounded)) {
      const rollState = keys.rollLeft ? "L" : (keys.rollRight ? "R" : "-");
      console.log("Movement - Gravity dir:", gravityDir.x.toFixed(2), gravityDir.y.toFixed(2), gravityDir.z.toFixed(2),
                  "Vel:", newVelX.toFixed(2), newVelY.toFixed(2), newVelZ.toFixed(2),
                  "Grounded:", isGrounded, "Roll:", rollState);
    }
    
    return { 
      jumpInProgress: newJumpInProgress, 
      jumpTime: newJumpTime,
      isMoving: moveLength > 0,
      currentSpeed: Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z)
    };
  } catch (e) {
    console.error("Error in handleAllMovement:", e);
    return { jumpInProgress: jumpInProgress, jumpTime: jumpTime };
  }
};

// Update player visual transform
export const updatePlayerTransform = (playerBody, player, camera, isGrounded, cameraRotation) => {
  if (!playerBody || !player || !camera) return;
  
  try {
    // Update player mesh position from physics body
    const position = playerBody.translation();
    player.position.set(position.x, position.y, position.z);
    
    // Always sync visual rotation with physics body rotation
    const physicsQuat = new THREE.Quaternion(
      playerBody.rotation().x,
      playerBody.rotation().y,
      playerBody.rotation().z,
      playerBody.rotation().w
    );
    player.quaternion.copy(physicsQuat);
    
    // Update camera rotation - when airborne, camera should follow player body exactly
    if (isGrounded) {
      // When grounded, use camera rotation for pitch, player handles yaw
      camera.rotation.x = cameraRotation.x;
      camera.rotation.y = cameraRotation.y;
      camera.rotation.z = 0;
    } else {
      // When airborne, camera rotation should be 0 since player body handles all rotation
      camera.rotation.x = 0;
      camera.rotation.y = 0;
      camera.rotation.z = 0;
    }
    
    // Calculate facing direction from physics body rotation
    const playerFacing = new THREE.Vector3(0, 0, -1).applyQuaternion(physicsQuat);
    
    return { playerFacing };
  } catch (e) {
    console.error("Error updating player transform:", e);
    return { playerFacing: new THREE.Vector3(0, 0, -1) };
  }
};

// Apply input locally for client-side prediction
export const applyInputLocally = (input, deltaTime) => {
  // This function would contain the same movement logic as handleAllMovement
  // but specifically for applying a single input frame
  // For now, we'll leave it as a placeholder since the main movement is handled elsewhere
  console.log("Applying input locally:", input);
};
