import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TPController } from './TPController.js';

export class FPSController {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    
    // Player properties
    this.height = 1.8;
    this.radius = 0.4;
    this.walkSpeed = 8;
    this.runSpeed = 16;
    this.jumpForce = 8;
    
    // State
    this.isGrounded = false;
    this.wasGrounded = false;
    this.isSwimming = false; // Add swimming state
    this.wasSwimming = false; // Add previous swimming state for debugging
    this.jumpInProgress = false;
    this.jumpTime = 0;
    this.jumpDuration = 0.5;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    this.hasResetCameraForAirborne = false; // Add flag to prevent repeated resets
    
    // Physics objects
    this.body = null;
    this.collider = null;
    this.colliderHandle = null;
    
    // Visual objects
    this.mesh = null;
    
    // Ray casting
    this.rayDir = new THREE.Vector3(0, -1, 0);
    this.leftFootPos = new THREE.Vector3();
    this.rightFootPos = new THREE.Vector3();
    this.centerFootPos = new THREE.Vector3();
    this.leftFootHit = null;
    this.rightFootHit = null;
    this.centerFootHit = null;
    
    // Debug visualization
    this.rayLines = {
      left: null,
      right: null,
      center: null,
      facing: null,
      gravity: null  // Add gravity vector visualization
    };
    
    // Camera rotation (pitch only when grounded)
    this.cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    
    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      run: false,
      rollLeft: false,
      rollRight: false,
      interact: false  // Add interact key (U)
    };
    
    // Third-person controller
    this.tpController = null;
    
    // Vehicle state
    this.currentVehicle = null;
    this.isInVehicle = false;
    
    // Debug visualization state
    this.debugVisualsEnabled = false;
  }

  create(spawnPosition = new THREE.Vector3(0, 35, 0)) {
    // Create physics body
    this.body = this.physics.createDynamicBody(spawnPosition, {
      linearDamping: 0.1,
      angularDamping: 1.0,
      canSleep: false,
      lockRotations: true
    });
    
    // Create collider
    const colliderDesc = this.physics.createCapsuleCollider(
      this.height / 2 - this.radius,
      this.radius,
      {
        friction: 0.0,
        restitution: 0.0,
        density: 1.0,
        activeCollisionTypes: RAPIER.ActiveCollisionTypes.DEFAULT,
        activeEvents: RAPIER.ActiveEvents.COLLISION_EVENTS
      }
    );
    
    this.collider = this.physics.world.createCollider(colliderDesc, this.body);
    this.colliderHandle = this.collider.handle;
    
    // Create visual mesh
    const geometry = new THREE.CapsuleGeometry(
      this.radius,
      this.height - this.radius * 2,
      8, 8
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0xff9900,
      transparent: true,
      opacity: 0.7
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.scene.add(this.mesh);
    
    // Add camera to player
    this.mesh.add(this.scene.camera);
    this.scene.camera.position.set(0, this.height * 0.8, 0);
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Create ray visualizations
    this.createRayVisualizations();
    
    // Create third-person controller after mesh is created
    this.tpController = new TPController(this.scene, this);
    
    return this.mesh;
  }

  createRayVisualizations() {
    const rayMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00,
      opacity: 0.5,
      transparent: true
    });
    
    const facingMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff0000,
      opacity: 0.8,
      transparent: true,
      linewidth: 3
    });
    
    const gravityMaterial = new THREE.LineBasicMaterial({ 
      color: 0x0088ff,
      opacity: 0.8,
      transparent: true,
      linewidth: 3
    });
    
    const createRayLine = (material) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setDrawRange(0, 2);
      const line = new THREE.Line(geometry, material.clone());
      line.visible = false; // Start hidden
      return line;
    };
    
    this.rayLines.left = createRayLine(rayMaterial);
    this.rayLines.right = createRayLine(rayMaterial);
    this.rayLines.center = createRayLine(rayMaterial);
    this.rayLines.facing = createRayLine(facingMaterial);
    this.rayLines.gravity = createRayLine(gravityMaterial);
    
    // Add to scene instead of player mesh for world-space visualization
    this.scene.scene.add(this.rayLines.left);
    this.scene.scene.add(this.rayLines.right);
    this.scene.scene.add(this.rayLines.center);
    this.scene.scene.add(this.rayLines.facing);
    this.scene.scene.add(this.rayLines.gravity);
  }

  checkGrounded() {
    if (!this.body) return;
    
    this.wasGrounded = this.isGrounded;
    
    const currentTime = performance.now();
    const velocityRapier = this.body.linvel();
    const velocity = new THREE.Vector3(velocityRapier.x, velocityRapier.y, velocityRapier.z);
    
    const playerTranslation = this.body.translation();
    const playerPos = new THREE.Vector3(
      playerTranslation.x,
      playerTranslation.y,
      playerTranslation.z
    );
    
    // Check if swimming first
    this.isSwimming = this.physics.isPositionInWater(playerPos);
    
    // If swimming, not grounded
    if (this.isSwimming) {
      this.isGrounded = false;
      return;
    }
    
    // Calculate gravity direction
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    this.rayDir.copy(gravityDir);
    
    // Update foot positions
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    const footOffset = this.radius * 0.8;
    const footLevel = -this.height * 0.5;
    
    const leftOffset = new THREE.Vector3(-footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const rightOffset = new THREE.Vector3(footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const centerOffset = new THREE.Vector3(0, footLevel, 0).applyQuaternion(playerQuat);
    
    this.leftFootPos.copy(playerPos).add(leftOffset);
    this.rightFootPos.copy(playerPos).add(rightOffset);
    this.centerFootPos.copy(playerPos).add(centerOffset);
    
    // Cast rays
    this.leftFootHit = this.physics.castRay(this.leftFootPos, this.rayDir, 0.5, this.colliderHandle);
    this.rightFootHit = this.physics.castRay(this.rightFootPos, this.rayDir, 0.5, this.colliderHandle);
    this.centerFootHit = this.physics.castRay(this.centerFootPos, this.rayDir, 0.5, this.colliderHandle);
    
    // Determine grounding
    const hasGroundCollisions = this.physics.groundCollisions.size > 0;
    const hasRayHits = this.leftFootHit || this.rightFootHit || this.centerFootHit;
    const lowDownwardVelocity = velocity.dot(gravityDir) < 2.0;
    const recentGroundContact = (currentTime - this.physics.lastGroundContact) < 200;
    
    this.isGrounded = (hasGroundCollisions && lowDownwardVelocity) || 
                     (hasRayHits && lowDownwardVelocity) ||
                     (recentGroundContact && Math.abs(velocity.dot(gravityDir)) < 0.5);
    
    // Handle transitions
    if (this.wasGrounded && !this.isGrounded) {
      this.resetCameraForAirborne();
    }
    
    // Store ground normal if we have hits
    if (this.isGrounded && (this.centerFootHit || this.leftFootHit || this.rightFootHit)) {
      let surfaceNormal = null;
      
      if (this.centerFootHit?.normal) {
        surfaceNormal = new THREE.Vector3(
          this.centerFootHit.normal.x,
          this.centerFootHit.normal.y,
          this.centerFootHit.normal.z
        );
      } else if (this.leftFootHit?.normal || this.rightFootHit?.normal) {
        surfaceNormal = new THREE.Vector3(0, 0, 0);
        let normalCount = 0;
        
        if (this.leftFootHit?.normal) {
          surfaceNormal.add(new THREE.Vector3(
            this.leftFootHit.normal.x,
            this.leftFootHit.normal.y,
            this.leftFootHit.normal.z
          ));
          normalCount++;
        }
        
        if (this.rightFootHit?.normal) {
          surfaceNormal.add(new THREE.Vector3(
            this.rightFootHit.normal.x,
            this.rightFootHit.normal.y,
            this.rightFootHit.normal.z
          ));
          normalCount++;
        }
        
        if (normalCount > 0) {
          surfaceNormal.divideScalar(normalCount).normalize();
        }
      }
      
      if (surfaceNormal) {
        this.lastGroundNormal.copy(surfaceNormal);
      }
    }
    
    if (hasGroundCollisions || hasRayHits) {
      this.physics.lastGroundContact = currentTime;
    }
  }

  alignToSurface(gravityDirection) {
    if (!this.isGrounded || !this.body) return;
    
    // Check if we're in multiplayer or sandbox mode where planet alignment should be active
    const shouldAlignToPlanet = this.scene.gameMode === 'multiplayer' || this.scene.gameMode === 'sandbox';
    
    if (!shouldAlignToPlanet) {
      // For other modes, use the existing alignment logic
      const currentPlayerQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      const lerpFactor = this.wasGrounded ? 0.15 : 0.05;
      const alignedQuat = this.physics.calculateSurfaceAlignment(
        currentPlayerQuat,
        this.lastGroundNormal,
        lerpFactor
      );
      
      this.body.setRotation({
        x: alignedQuat.x,
        y: alignedQuat.y,
        z: alignedQuat.z,
        w: alignedQuat.w
      });
      
      this.mesh.quaternion.copy(alignedQuat);
      return;
    }
    
    // For multiplayer/sandbox: align player so their up vector matches the opposite of gravity
    const currentPlayerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    // The player's desired up direction is opposite to gravity
    const desiredUp = gravityDirection.clone().multiplyScalar(-1).normalize();
    
    // Get the player's current forward direction
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
    
    // Project the forward direction onto the plane perpendicular to desired up
    const projectedForward = currentForward.clone()
      .sub(desiredUp.clone().multiplyScalar(currentForward.dot(desiredUp)))
      .normalize();
    
    // If the forward direction is too aligned with up (looking straight up/down), use a fallback
    if (projectedForward.lengthSq() < 0.1) {
      // Use the world forward as a fallback, projected onto the surface
      const worldForward = new THREE.Vector3(0, 0, -1);
      projectedForward.copy(worldForward)
        .sub(desiredUp.clone().multiplyScalar(worldForward.dot(desiredUp)))
        .normalize();
    }
    
    // Calculate right vector
    const right = new THREE.Vector3().crossVectors(projectedForward, desiredUp).normalize();
    
    // Recalculate forward to ensure orthogonality
    const alignedForward = new THREE.Vector3().crossVectors(desiredUp, right).normalize();
    
    // Build rotation matrix from basis vectors
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(right, desiredUp, alignedForward.multiplyScalar(-1));
    
    // Convert to quaternion
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    
    // Smooth interpolation
    const lerpFactor = this.wasGrounded ? 0.15 : 0.05; // Slower when just landing
    currentPlayerQuat.slerp(targetQuat, lerpFactor);
    
    // Apply the rotation
    this.body.setRotation({
      x: currentPlayerQuat.x,
      y: currentPlayerQuat.y,
      z: currentPlayerQuat.z,
      w: currentPlayerQuat.w
    });
    
    this.mesh.quaternion.copy(currentPlayerQuat);
  }

  adjustPositionToGround(gravityDir) {
    const closestHit = this.centerFootHit || this.leftFootHit || this.rightFootHit;
    if (!closestHit) return;
    
    // Use physics manager's position adjustment
    this.physics.adjustPositionToGround(
      this.body,
      closestHit,
      this.height,
      gravityDir,
      0.3 // adjustment strength
    );
  }

  getUpDirection() {
    // Delegate to physics manager
    const position = this.body.translation();
    return this.physics.getUpDirection(position);
  }

  resetCameraForAirborne() {
    if (!this.mesh || !this.body || !this.wasGrounded || this.isGrounded) return;
    
    const currentPlayerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    if (Math.abs(this.cameraRotation.x) > 0.01) {
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, this.cameraRotation.x);
      
      currentPlayerQuat.premultiply(pitchQuat);
      
      this.body.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
    }
    
    this.cameraRotation.x = 0;
    this.cameraRotation.y = 0;
    this.cameraRotation.z = 0;
  }

  handleMovement(deltaTime) {
    // Handle vehicle interaction with U key
    if (this.keys.interact && !this.wasInteracting) {
      this.wasInteracting = true;
      
      if (this.isInVehicle) {
        // Try to exit vehicle
        this.requestExitVehicle();
      } else {
        // Try to enter nearby vehicle
        const nearbyVehicle = this.checkForNearbyVehicle();
        if (nearbyVehicle) {
          this.requestEnterVehicle(nearbyVehicle);
        }
      }
    } else if (!this.keys.interact) {
      this.wasInteracting = false;
    }
    
    if (this.isInVehicle && this.currentVehicle) {
      // Vehicle is controlled by its own update method
      return;
    }
    
    if (!this.body) return;
    
    const velocity = this.body.linvel();
    const playerTranslation = this.body.translation();
    const playerPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
    
    // Check if swimming
    this.isSwimming = this.physics.isPositionInWater(playerPos);
    
    // Debug log swimming state changes
    if (this.isSwimming !== this.wasSwimming) {
      console.log('Swimming state changed:', this.isSwimming);
      this.wasSwimming = this.isSwimming;
    }
    
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    const gravityStrength = this.physics.gravity.strength;
    
    // Apply forces based on swimming state
    let gravityForce;
    let buoyancyImpulse = new THREE.Vector3(0, 0, 0);
    
    if (!this.isSwimming) {
      gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * deltaTime);
    } else {
      // When swimming, no gravity but calculate buoyancy
      gravityForce = new THREE.Vector3(0, 0, 0);
      
      // Reset forces to prevent any gravity accumulation
      this.body.resetForces(true);
      
      // Calculate buoyancy impulse to add to velocity
      const mass = this.body.mass();
      const buoyancyStrength = gravityStrength * 0.3; // Increased from 0.2 to 0.3 for more noticeable effect
      // Buoyancy is opposite to gravity direction
      buoyancyImpulse = gravityDir.clone().multiplyScalar(-buoyancyStrength * mass * deltaTime);
    }
    
    // Align to surface when grounded
    if (this.isGrounded && (this.centerFootHit || this.leftFootHit || this.rightFootHit)) {
      this.alignToSurface(gravityDir);
      this.adjustPositionToGround(gravityDir);
    }
    
    // Handle airborne roll - using forward axis like reference
    if (!this.isGrounded && this.body) {
      const rollSensitivity = 2.0;
      let rollDelta = 0;
      
      if (this.keys.rollLeft) rollDelta -= rollSensitivity * deltaTime;
      if (this.keys.rollRight) rollDelta += rollSensitivity * deltaTime;
      
      if (Math.abs(rollDelta) > 0.001) {
        const currentPlayerQuat = new THREE.Quaternion(
          this.body.rotation().x,
          this.body.rotation().y,
          this.body.rotation().z,
          this.body.rotation().w
        );
        
        const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(localForward, rollDelta);
        
        currentPlayerQuat.premultiply(rollQuat);
        
        this.body.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
      }
    }
    
    // Calculate movement
    let moveForward = 0;
    let moveRight = 0;
    
    if (this.keys.forward) moveForward += 1;
    if (this.keys.backward) moveForward -= 1;
    if (this.keys.left) moveRight -= 1;
    if (this.keys.right) moveRight += 1;
    
    const moveLength = Math.sqrt(moveForward * moveForward + moveRight * moveRight);
    if (moveLength > 0) {
      moveForward /= moveLength;
      moveRight /= moveLength;
    }
    
    const speed = this.keys.run ? this.runSpeed : this.walkSpeed;
    moveForward *= speed;
    moveRight *= speed;
    
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    
    if (this.isGrounded && this.lastGroundNormal) {
      forward.projectOnPlane(this.lastGroundNormal).normalize();
      right.projectOnPlane(this.lastGroundNormal).normalize();
    }
    
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, moveForward);
    moveDir.addScaledVector(right, moveRight);
    
    let newVelX = velocity.x;
    let newVelY = velocity.y;
    let newVelZ = velocity.z;
    
    // Add gravity or buoyancy to velocity
    if (!this.isSwimming) {
      newVelX += gravityForce.x;
      newVelY += gravityForce.y;
      newVelZ += gravityForce.z;
    } else {
      // Add buoyancy impulse to velocity
      newVelX += buoyancyImpulse.x;
      newVelY += buoyancyImpulse.y;
      newVelZ += buoyancyImpulse.z;
    }
    
    if (this.isGrounded) {
      const groundAccel = 100.0;
      newVelX += moveDir.x * groundAccel * deltaTime;
      newVelY += moveDir.y * groundAccel * deltaTime;
      newVelZ += moveDir.z * groundAccel * deltaTime;
      
      if (moveLength === 0) {
        newVelX *= 0.8;
        newVelY *= 0.95;
        newVelZ *= 0.8;
      }
      
      const vel = new THREE.Vector3(newVelX, newVelY, newVelZ);
      const velMagnitude = vel.length();
      if (velMagnitude > speed * 1.5) {
        vel.normalize().multiplyScalar(speed * 1.5);
        newVelX = vel.x;
        newVelY = vel.y;
        newVelZ = vel.z;
      }
    } else if (this.isSwimming) {
      // Swimming movement (slower than ground/air movement)
      const swimControl = 3.0;
      newVelX += moveDir.x * swimControl * deltaTime;
      newVelY += moveDir.y * swimControl * deltaTime;
      newVelZ += moveDir.z * swimControl * deltaTime;
      
      // Add vertical swimming controls
      if (this.keys.jump) {
        // Swim up - opposite of gravity
        const upForce = gravityDir.clone().multiplyScalar(-8.0 * deltaTime);
        newVelX += upForce.x;
        newVelY += upForce.y;
        newVelZ += upForce.z;
      }
      
      // Apply water drag to final velocity
      newVelX *= 0.85; // Reduced from 0.9 for more drag
      newVelY *= 0.85;
      newVelZ *= 0.85;
      
      // Clamp swimming speed to prevent too fast movement
      const swimVel = new THREE.Vector3(newVelX, newVelY, newVelZ);
      const swimSpeed = swimVel.length();
      const maxSwimSpeed = this.walkSpeed * 0.5; // Half of walk speed
      if (swimSpeed > maxSwimSpeed) {
        swimVel.normalize().multiplyScalar(maxSwimSpeed);
        newVelX = swimVel.x;
        newVelY = swimVel.y;
        newVelZ = swimVel.z;
      }
    } else {
      // Reduced air control like reference
      const airControl = 1.0;
      newVelX += moveDir.x * airControl * deltaTime;
      newVelY += moveDir.y * airControl * deltaTime;
      newVelZ += moveDir.z * airControl * deltaTime;
      
      // Higher damping for less air movement
      newVelX *= 0.95;
      newVelY *= 0.98;
      newVelZ *= 0.95;
    }
    
    // Handle jumping (not allowed when swimming)
    if (this.keys.jump && this.isGrounded && !this.jumpInProgress && !this.isSwimming) {
      const jumpVector = gravityDir.clone().multiplyScalar(-this.jumpForce);
      newVelX += jumpVector.x;
      newVelY += jumpVector.y;
      newVelZ += jumpVector.z;
      this.jumpInProgress = true;
      this.jumpTime = 0;
    }
    
    if (this.jumpInProgress) {
      this.jumpTime += deltaTime;
      if (this.jumpTime >= this.jumpDuration || this.isGrounded) {
        this.jumpInProgress = false;
      }
    }
    
    this.body.setLinvel({
      x: newVelX,
      y: newVelY,
      z: newVelZ
    });
  }

  calculateMovement(deltaTime) {
    const movement = new THREE.Vector3();
    
    // Get current rotation for movement direction
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Calculate forward/right vectors based on body rotation
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    
    // Calculate movement input
    if (this.keys.forward) movement.add(forward);
    if (this.keys.backward) movement.sub(forward);
    if (this.keys.left) movement.sub(right);
    if (this.keys.right) movement.add(right);
    
    // Project movement onto surface normal for better planet movement
    const up = this.getUpDirection();
    const movementMagnitude = movement.length();
    
    if (movementMagnitude > 0) {
      // Remove vertical component relative to gravity
      const verticalComponent = movement.dot(up);
      movement.sub(up.clone().multiplyScalar(verticalComponent));
      
      // Normalize and apply speed
      movement.normalize();
      const speed = this.keys.run ? this.runSpeed : this.walkSpeed;
      movement.multiplyScalar(speed);
    }
    
    return movement;
  }

  updateTransform() {
    if (!this.body || !this.mesh) return;
    
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
    
    const physicsQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    this.mesh.quaternion.copy(physicsQuat);
    
    // Simple camera rotation like reference
    if (this.isGrounded) {
      this.scene.camera.rotation.x = this.cameraRotation.x;
      this.scene.camera.rotation.y = this.cameraRotation.y;
      this.scene.camera.rotation.z = 0;
    } else {
      this.scene.camera.rotation.set(0, 0, 0);
    }
  }

  setDebugVisualsEnabled(enabled) {
    this.debugVisualsEnabled = enabled;
    
    // Update visibility of all ray lines
    if (this.rayLines) {
      Object.values(this.rayLines).forEach(line => {
        if (line) {
          line.visible = enabled;
        }
      });
    }
    
    // Hide/show facing direction helper if it exists
    if (this.facingHelper) {
      this.facingHelper.visible = enabled;
    }
  }

  updateRayVisualizations() {
    if (!this.mesh || !this.body) return;
    
    // Only update if debug visuals are enabled
    if (!this.debugVisualsEnabled) return;
    
    // Update left foot ray
    const updateRayLine = (rayLine, startPos, endPos) => {
      const positions = rayLine.geometry.attributes.position.array;
      positions[0] = startPos.x;
      positions[1] = startPos.y;
      positions[2] = startPos.z;
      positions[3] = endPos.x;
      positions[4] = endPos.y;
      positions[5] = endPos.z;
      rayLine.geometry.attributes.position.needsUpdate = true;
    };
    
    const rayLength = 2.0;
    
    // Update foot rays
    updateRayLine(
      this.rayLines.left,
      this.leftFootPos,
      this.leftFootPos.clone().add(this.rayDir.clone().multiplyScalar(rayLength))
    );
    
    updateRayLine(
      this.rayLines.right,
      this.rightFootPos,
      this.rightFootPos.clone().add(this.rayDir.clone().multiplyScalar(rayLength))
    );
    
    updateRayLine(
      this.rayLines.center,
      this.centerFootPos,
      this.centerFootPos.clone().add(this.rayDir.clone().multiplyScalar(rayLength))
    );
    
    // Update facing ray
    const playerWorldPos = this.mesh.position.clone();
    const facingDir = this.getFacing();
    updateRayLine(
      this.rayLines.facing,
      playerWorldPos,
      playerWorldPos.clone().add(facingDir.multiplyScalar(3))
    );
    
    // Update gravity ray
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerWorldPos)
      .normalize();
    updateRayLine(
      this.rayLines.gravity,
      playerWorldPos,
      playerWorldPos.clone().add(gravityDir.multiplyScalar(5))
    );
    
    // Update ray colors based on hits
    this.rayLines.left.material.color.setHex(this.leftFootHit ? 0xff0000 : 0x00ff00);
    this.rayLines.right.material.color.setHex(this.rightFootHit ? 0xff0000 : 0x00ff00);
    this.rayLines.center.material.color.setHex(this.centerFootHit ? 0xff0000 : 0x00ff00);
  }

  handleMouseMove(event, lookSensitivity = 0.001, yawSensitivity = 0.002) {
    // Pass to third-person controller if active
    if (this.tpController && this.tpController.isActive) {
      this.tpController.handleMouseMove(event);
      return;
    }
    
    if (!this.body) return;
    
    // Get current rotation safely
    let currentRotation;
    try {
      currentRotation = this.body.rotation();
    } catch (e) {
      console.warn('Failed to get body rotation:', e);
      return;
    }
    
    const currentPlayerQuat = new THREE.Quaternion(
      currentRotation.x,
      currentRotation.y,
      currentRotation.z,
      currentRotation.w
    );
    
    if (this.isGrounded) {
      // Camera pitch
      this.cameraRotation.x -= event.movementY * lookSensitivity;
      this.cameraRotation.x = Math.max(
        -Math.PI / 2 + 0.01, 
        Math.min(Math.PI / 2 - 0.01, this.cameraRotation.x)
      );
      
      // Player yaw - use gravity-based up vector for planet alignment in multiplayer/sandbox
      let upVector;
      const shouldAlignToPlanet = this.scene.gameMode === 'multiplayer' || this.scene.gameMode === 'sandbox';
      
      if (shouldAlignToPlanet) {
        // Use the opposite of gravity direction as up
        const playerPos = this.getPosition();
        const gravityDir = new THREE.Vector3()
          .subVectors(this.physics.gravity.center, playerPos)
          .normalize();
        upVector = gravityDir.clone().multiplyScalar(-1);
      } else {
        // Use surface normal for other modes
        upVector = this.lastGroundNormal.clone();
        if (upVector.lengthSq() < 0.1) {
          upVector = this.getUpDirection();
        }
      }
      
      const yawDelta = -event.movementX * yawSensitivity;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, yawDelta);
      
      currentPlayerQuat.premultiply(yawQuat);
      
      try {
        this.body.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
      } catch (e) {
        console.warn('Failed to set body rotation:', e);
      }
      
      this.cameraRotation.y = 0;
    } else {
      // Airborne - full 3D rotation
      // Get the player's current local axes
      const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentPlayerQuat);
      
      // Pitch around local right axis
      const pitchDelta = -event.movementY * lookSensitivity;
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, pitchDelta);
      
      // Yaw around local up axis for true 6DOF rotation
      const yawDelta = -event.movementX * yawSensitivity;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(localUp, yawDelta);
      
      // Apply rotations in order: first pitch, then yaw
      currentPlayerQuat.premultiply(pitchQuat);
      currentPlayerQuat.premultiply(yawQuat);
      
      try {
        this.body.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
      } catch (e) {
        console.warn('Failed to set body rotation:', e);
      }
      
      this.cameraRotation.x = 0;
      this.cameraRotation.y = 0;
    }
  }

  // Add method to toggle camera
  toggleCamera() {
    if (this.tpController) {
      this.tpController.toggle();
    }
  }

  // Add method to check for nearby vehicles
  checkForNearbyVehicle() {
    if (!this.mesh || !this.scene) return null;
    
    const playerPos = this.getPosition();
    let closestVehicle = null;
    let closestDistance = 5.0; // Interaction range
    
    // Check all vehicles in the scene
    this.scene.vehicles.forEach((vehicle, id) => {
      if (!vehicle.chassisBody) return;
      
      const vehiclePos = vehicle.getPosition();
      const distance = playerPos.distanceTo(vehiclePos);
      
      if (distance < closestDistance && !vehicle.isOccupied) {
        closestDistance = distance;
        closestVehicle = vehicle;
      }
    });
    
    // Also check dynamic objects for vehicles
    this.scene.dynamicObjects.forEach((obj, id) => {
      if (obj.type === 'vehicle' && obj.controller && !obj.controller.isOccupied) {
        const vehiclePos = obj.controller.getPosition();
        const distance = playerPos.distanceTo(vehiclePos);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestVehicle = obj.controller;
        }
      }
    });
    
    return closestVehicle;
  }
  
  // Add method to enter vehicle
  enterVehicle(vehicle) {
    if (!vehicle || this.isInVehicle) return false;
    
    const success = vehicle.enterCar(this);
    if (success) {
      this.isInVehicle = true;
      this.currentVehicle = vehicle;
      
      // Hide player mesh
      if (this.mesh) {
        this.mesh.visible = false;
      }
      
      // Disable player physics body
      if (this.body) {
        this.body.setEnabled(false);
      }
      
      console.log('Player entered vehicle');
      return true;
    }
    
    return false;
  }
  
  // Add method to exit vehicle
  exitVehicle() {
    if (!this.isInVehicle || !this.currentVehicle) return false;
    
    const result = this.currentVehicle.exitCar();
    if (result) {
      // Restore player at exit position
      if (this.body) {
        this.body.setEnabled(true);
        this.body.setTranslation({
          x: result.exitPosition.x,
          y: result.exitPosition.y,
          z: result.exitPosition.z
        });
      }
      
      // Show player mesh
      if (this.mesh) {
        this.mesh.visible = true;
        this.mesh.position.copy(result.exitPosition);
      }
      
      this.isInVehicle = false;
      this.currentVehicle = null;
      
      console.log('Player exited vehicle');
      return true;
    }
    
    return false;
  }
  
  // Remove any direct network sending methods if they exist
  // The controller should only provide state, not send it
  
  getNetworkState() {
    if (!this.body) return null;
    
    const position = this.body.translation();
    const rotation = this.body.rotation();
    const velocity = this.body.linvel();
    
    return {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      isGrounded: this.isGrounded,
      isSwimming: this.isSwimming
    };
  }

  destroy() {
    // Clean up ray visualizations
    if (this.rayLines) {
      Object.values(this.rayLines).forEach(line => {
        if (line) {
          this.scene.scene.remove(line);
          if (line.geometry) line.geometry.dispose();
          if (line.material) line.material.dispose();
        }
      });
    }
    
    // Clean up physics
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
    
    // Clean up mesh
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
    
    // Clean up third-person controller
    if (this.tpController) {
      this.tpController.deactivate();
      this.tpController = null;
    }
  }
  
  // Add the update method
  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Skip regular update if in vehicle
    if (this.isInVehicle) {
      // Just update debug visuals if needed
      if (this.showDebugVisuals) {
        this.updateDebugVisuals();
      }
      return;
    }
    
    this.checkGrounded();
    this.handleMovement(deltaTime);
    this.updateTransform();
    
    // Only update ray visualizations if debug is enabled
    if (this.debugVisualsEnabled) {
      this.updateRayVisualizations();
    }
    
    // Update third-person camera if active
    if (this.tpController) {
      this.tpController.update();
    }
  }
  
  // Add missing methods before the update method
  getPosition() {
    if (!this.body) return new THREE.Vector3();
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  getVelocity() {
    if (!this.body) return new THREE.Vector3();
    const vel = this.body.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }

  getSpeed() {
    return this.getVelocity().length();
  }

  getFacing() {
    if (!this.body) return new THREE.Vector3(0, 0, -1);
    
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Get forward direction from quaternion
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(quaternion);
    
    return forward;
  }

  // Add vehicle interaction methods
  requestEnterVehicle(vehicle) {
    if (!vehicle || this.isInVehicle) return;
    
    // In multiplayer, send request to server
    if (this.scene.gameMode === 'multiplayer' && this.scene.wsManager) {
      this.scene.wsManager.sendPlayerAction('enter_vehicle', {
        vehicle_id: vehicle.id
      });
    } else {
      // In single player, enter directly
      this.enterVehicle(vehicle);
    }
  }

  requestExitVehicle() {
    if (!this.isInVehicle || !this.currentVehicle) return;
    
    // In multiplayer, send request to server
    if (this.scene.gameMode === 'multiplayer' && this.scene.wsManager) {
      this.scene.wsManager.sendPlayerAction('exit_vehicle');
    } else {
      // In single player, exit directly
      this.exitVehicle();
    }
  }
}
