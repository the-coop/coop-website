import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// Initialize physics engine and world
export async function initPhysics() {
  try {
    console.log("Initializing Rapier physics engine...");
    
    await RAPIER.init({
      locateFile: (path) => {
        console.log("Locating Rapier file:", path);
        return `https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.11.2/${path}`;
      }
    });
    
    console.log("Rapier physics engine initialized successfully");
    
    // Create a physics world with no gravity (we'll apply custom planet gravity)
    const gravityVec = { x: 0, y: 0, z: 0 };
    const physicsWorld = new RAPIER.World(gravityVec);
    console.log("Physics world created with disabled gravity:", gravityVec);
    
    return physicsWorld;
  } catch (error) {
    console.error("Error initializing physics:", error);
    throw error;
  }
}

// Set up collision event handling
export function setupCollisionHandling(physicsWorld) {
  if (!physicsWorld) return;
  
  try {
    // Set up collision event handling
    physicsWorld.eventQueue = new RAPIER.EventQueue(true);
    
    console.log("Collision event handling set up successfully");
    
    // Also set up contact force events for additional detection
    physicsWorld.contactForceEventQueue = new RAPIER.EventQueue(true);
    
  } catch (e) {
    console.error("Error setting up collision handling:", e);
  }
}

// Process collision events for grounding detection
export function processCollisionEvents(physicsWorld, playerBody, debugInfo, groundCollisions, lastGroundContact) {
  if (!physicsWorld?.eventQueue || !playerBody) return;
  
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
          lastGroundContact.value = currentTime;
          
          console.log("Collision started with handle:", otherColliderHandle, "Total collisions:", groundCollisions.size);
        } else {
          // Collision ended - remove from ground collisions
          groundCollisions.delete(otherColliderHandle);
          
          console.log("Collision ended with handle:", otherColliderHandle, "Remaining collisions:", groundCollisions.size);
        }
      }
    });
    
    // Process contact force events if available
    if (physicsWorld.contactForceEventQueue) {
      physicsWorld.contactForceEventQueue.drainContactForceEvents((event) => {
        // Contact force events can help with grounding detection
        if (debugInfo.playerColliderHandle && 
            (event.collider1() === debugInfo.playerColliderHandle || 
             event.collider2() === debugInfo.playerColliderHandle)) {
          lastGroundContact.value = performance.now();
        }
      });
    }
  } catch (e) {
    console.error("Error processing collision events:", e);
  }
}

// Check if player is grounded using ray casting and collision info
export function checkGrounded(
  playerBody, 
  physicsWorld, 
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
  groundCollisions, 
  lastGroundContact, 
  debugInfo, 
  playerHeight, 
  playerRadius,
  frameCount
) {
  if (!playerBody || !physicsWorld) return false;
  
  try {
    // Store previous grounded state
    wasGrounded.value = isGrounded.value;
    
    // Ground detection based on collision events and velocity
    const currentTime = performance.now();
    const velocityRapier = playerBody.linvel();
    
    // Convert RAPIER velocity to THREE.js Vector3
    const velocity = new THREE.Vector3(velocityRapier.x, velocityRapier.y, velocityRapier.z);
    
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
    rayDir.value.copy(gravityDir);
    
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
    
    leftFootPos.value.copy(playerPos).add(leftOffset);
    rightFootPos.value.copy(playerPos).add(rightOffset);
    centerFootPos.value.copy(playerPos).add(centerOffset);
    
    // Cast rays for grounding detection using gravity direction
    const castGroundingRay = (footPos) => {
      const footRay = new RAPIER.Ray(
        { x: footPos.x, y: footPos.y, z: footPos.z },
        { x: rayDir.value.x, y: rayDir.value.y, z: rayDir.value.z }
      );
      
      return physicsWorld.castRay(
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
    const hasGroundCollisions = groundCollisions.size > 0;
    const hasRayHits = leftFootHit.value || rightFootHit.value || centerFootHit.value;
    const lowDownwardVelocity = velocity.dot(gravityDir) < 2.0; // Check velocity relative to gravity
    const recentGroundContact = (currentTime - lastGroundContact.value) < 200; // 200ms grace period
    
    // We're grounded if we have collisions or ray hits with appropriate velocity
    const groundedState = (hasGroundCollisions && lowDownwardVelocity) || 
                         (hasRayHits && lowDownwardVelocity) ||
                         (recentGroundContact && Math.abs(velocity.dot(gravityDir)) < 0.5);
    
    isGrounded.value = groundedState;
    
    // If we have collisions or ray hits, update last ground contact time
    if (hasGroundCollisions || hasRayHits) {
      lastGroundContact.value = currentTime;
    }
    
    // Debug logging every 60 frames
    if (frameCount.value % 60 === 0) {
      console.log("Ground check - Collisions:", groundCollisions.size, 
                  "Ray hits:", hasRayHits, 
                  "Grounded:", isGrounded.value,
                  "Player pos:", playerPos.x.toFixed(1), playerPos.y.toFixed(1), playerPos.z.toFixed(1));
    }
    
    return groundedState;
  } catch (e) {
    console.error("Error checking grounded state:", e);
    return false;
  }
}

// Align player rotation to surface normal when grounded
export function alignPlayerToSurface(playerBody, player, isGrounded, gravityDirection, centerFootHit, leftFootHit, rightFootHit, lastGroundNormal) {
  if (!playerBody || !player) return;
  
  try {
    // Only align to surface when grounded
    if (!isGrounded) return;
    
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
      lastGroundNormal.value.copy(surfaceNormal);
    }
    
    // Adjust player position for feet contact
    const centerFootHitValue = centerFootHit || leftFootHit || rightFootHit;
    if (centerFootHitValue && centerFootHitValue.toi !== undefined) {
      // Calculate where the feet should be based on the ray hit
      const hitPoint = new THREE.Vector3(
        centerFootHitValue.point.x,
        centerFootHitValue.point.y,
        centerFootHitValue.point.z
      );
      
      // Calculate the offset from current player center to where it should be
      const playerTranslation = playerBody.translation();
      const currentPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
      
      // The player center should be playerHeight/2 units away from the contact point
      // in the opposite direction of gravity
      const upDir = gravityDirection.clone().multiplyScalar(-1);
      const playerHeight = player.geometry.parameters.height + player.geometry.parameters.radius * 2;
      const targetPlayerCenter = hitPoint.clone().add(upDir.clone().multiplyScalar(playerHeight * 0.5));
      
      // Apply a small offset to prevent sinking into terrain
      targetPlayerCenter.add(upDir.clone().multiplyScalar(0.05));
      
      // Calculate correction vector
      const correction = targetPlayerCenter.clone().sub(currentPos);
      
      // Only apply correction if it's significant but not too large
      if (correction.length() > 0.01 && correction.length() < 2.0) {
        // Apply partial correction to avoid jitter
        correction.multiplyScalar(0.3);
        playerBody.setTranslation({
          x: currentPos.x + correction.x,
          y: currentPos.y + correction.y,
          z: currentPos.z + correction.z
        });
      }
    }
  } catch (e) {
    console.error("Error aligning player to surface:", e);
  }
}

// Handle player movement, including walking, jumping, and planet gravity
export function handleAllMovement(
  playerBody,
  physicsWorld,
  scene,
  isGrounded,
  keys,
  gravity,
  jumpInProgress,
  jumpTime,
  jumpDuration,
  jumpForce,
  lastGroundNormal,
  walkSpeed,
  runSpeed,
  isMoving,
  currentSpeed,
  frameCount,
  deltaTime
) {
  if (!playerBody || !physicsWorld) return;
  
  try {
    const velocity = playerBody.linvel();
    const playerTranslation = playerBody.translation();
    const playerPos = new THREE.Vector3(
      playerTranslation.x,
      playerTranslation.y,
      playerTranslation.z
    );
    
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
    
    // Update isMoving and currentSpeed for UI
    isMoving.value = moveLength > 0;
    currentSpeed.value = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    
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
    if (isGrounded && lastGroundNormal.value) {
      const surfaceNormal = lastGroundNormal.value;
      
      // Project forward and right onto the surface plane
      forward.projectOnPlane(surfaceNormal).normalize();
      right.projectOnPlane(surfaceNormal).normalize();
    }
    
    // Calculate final movement vector in world space
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, moveForward);
    moveDir.addScaledVector(right, moveRight);
    
    // Start with current velocity and apply planet gravity
    let newVelX = velocity.x + gravityForce.x;
    let newVelY = velocity.y + gravityForce.y;
    let newVelZ = velocity.z + gravityForce.z;
    
    // Apply movement forces
    if (isGrounded) {
      // Ground movement
      const groundAccel = 100.0; // Faster acceleration
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
      const airControl = 1.0; // Very limited air movement
      newVelX += moveDir.x * airControl * deltaTime;
      newVelY += moveDir.y * airControl * deltaTime;
      newVelZ += moveDir.z * airControl * deltaTime;
      
      // Apply stronger air resistance
      newVelX *= 0.95;
      newVelY *= 0.98; // Slightly less air resistance on Y
      newVelZ *= 0.95;
    }
    
    // Handle jumping - jump against gravity direction
    if (keys.jump && isGrounded && !jumpInProgress.value) {
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
      if (jumpTime.value >= jumpDuration || isGrounded) {
        jumpInProgress.value = false;
      }
    }
    
    // Update the new velocity to player
    playerBody.setLinvel({
      x: newVelX,
      y: newVelY,
      z: newVelZ
    });
    
    // Debug logging for movement
    if (frameCount.value % 60 === 0 && (moveLength > 0 || !isGrounded)) {
      const rollState = keys.rollLeft ? "L" : (keys.rollRight ? "R" : "-");
      console.log("Movement - Gravity dir:", gravityDir.x.toFixed(2), gravityDir.y.toFixed(2), gravityDir.z.toFixed(2),
                  "Distance to planet:", distanceToPlanet.toFixed(1),
                  "Vel:", newVelX.toFixed(2), newVelY.toFixed(2), newVelZ.toFixed(2),
                  "Grounded:", isGrounded, "Roll:", rollState);
    }
  } catch (e) {
    console.error("Error in handleAllMovement:", e);
  }
}

// Utility function to project a vector onto a plane
export function projectVectorOntoPlane(vector, planeNormal) {
  const dot = vector.dot(planeNormal);
  return vector.clone().sub(planeNormal.clone().multiplyScalar(dot));
}

// Get the ground normal based on player position and ray hits
export function getGroundNormal(playerBody, gravity, centerFootHit) {
  // Get player position
  const playerTranslation = playerBody.translation();
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
  
  if (centerFootHit && centerFootHit.normal) {
    groundNormal = new THREE.Vector3(
      centerFootHit.normal.x,
      centerFootHit.normal.y,
      centerFootHit.normal.z
    );
  }
  
  // Up vector is the ground normal
  const upVector = groundNormal.clone();
  
  return { groundNormal, upVector, gravityDir, playerPos };
}
