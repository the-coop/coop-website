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
      gravity: null,  // Add gravity vector visualization
      movement: null,  // Add movement direction visualization
      velocity: null,  // Add velocity vector visualization
      intended: null    // Add intended movement direction visualization
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
      interact: false,
      toggleCamera: false,
      crouch: false,
      landingGear: false,
      fireGun: false,
      fireMissile: false,
      toggleLights: false,
      deployFlares: false,      // Add F key for flares
      changePerspective: false  // Add P key for disassembly
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    this.wasTogglingCamera = false; // Track toggle camera state
    
    // Third-person controller
    this.tpController = null;
    
    // Vehicle state
    this.isInVehicle = false;
    this.currentVehicle = null;
    this.vehicleExitCooldown = 0; // Add cooldown timer
    
    // Camera state before entering vehicle
    this.cameraStateBeforeVehicle = {
      isThirdPerson: false
    };
    
    // Debug visualization state
    this.debugVisualsEnabled = false;
    
    // Add slope tolerance settings
    this.maxSlopeAngle = 45; // Maximum slope angle in degrees that player can align to
    this.slopeAngleThreshold = Math.cos(this.maxSlopeAngle * Math.PI / 180); // Convert to dot product threshold
    
    // Add terrain sampling settings
    this.terrainSampling = {
      enabled: true,
      sampleRadius: 0.3, // Radius around player to sample
      sampleCount: 8, // Number of samples in a circle
      maxSampleDistance: 1.0, // Max ray distance for samples
      movementAnticipation: 0.5, // How far ahead to look for terrain
      slopeInfluence: 0.7 // How much slope affects movement direction (0-1)
    };
    
    // Terrain analysis results
    this.terrainAnalysis = {
      samples: [],
      averageNormal: new THREE.Vector3(0, 1, 0),
      movementNormal: new THREE.Vector3(0, 1, 0),
      forwardSlope: 0,
      rightSlope: 0
    };
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
    
    // Add camera to player - adjusted position for better weapon centering
    this.mesh.add(this.scene.camera);
    this.scene.camera.position.set(0, this.height * 0.4, 0);  // Changed from offset position to centered
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Force camera matrix update
    this.scene.camera.updateMatrix();
    this.scene.camera.updateMatrixWorld(true);
    
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
    this.rayLines.movement = createRayLine(rayMaterial);  // Movement direction
    this.rayLines.velocity = createRayLine(rayMaterial);  // Velocity vector
    this.rayLines.intended = createRayLine(rayMaterial);  // Intended movement direction
    
    // Add to scene instead of player mesh for world-space visualization
    this.scene.scene.add(this.rayLines.left);
    this.scene.scene.add(this.rayLines.right);
    this.scene.scene.add(this.rayLines.center);
    this.scene.scene.add(this.rayLines.facing);
    this.scene.scene.add(this.rayLines.gravity);
    this.scene.scene.add(this.rayLines.movement);
    this.scene.scene.add(this.rayLines.velocity);
    this.scene.scene.add(this.rayLines.intended);
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
      this.lastGroundNormal.set(0, 1, 0); // Reset to default
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
    
    // Cast rays - reduced distance to prevent false positives
    const maxRayDistance = 0.3; // Reduced from 0.5
    this.leftFootHit = this.physics.castRay(this.leftFootPos, this.rayDir, maxRayDistance, this.colliderHandle);
    this.rightFootHit = this.physics.castRay(this.rightFootPos, this.rayDir, maxRayDistance, this.colliderHandle);
    this.centerFootHit = this.physics.castRay(this.centerFootPos, this.rayDir, maxRayDistance, this.colliderHandle);
    
    // Primary grounding check: ray hits
    const hasRayHits = this.leftFootHit || this.rightFootHit || this.centerFootHit;
    
    // Secondary checks with stricter conditions
    const hasGroundCollisions = this.physics.groundCollisions.size > 0;
    const downwardVelocity = velocity.dot(gravityDir);
    
    // Stricter velocity check - must be very close to zero
    const lowDownwardVelocity = Math.abs(downwardVelocity) < 0.5;
    
    // Only use collision-based grounding if we have ray hits OR very low velocity
    if (hasRayHits) {
      // Ray hits are most reliable
      this.isGrounded = true;
    } else if (hasGroundCollisions && lowDownwardVelocity && this.wasGrounded) {
      // Only trust collisions if we were just grounded and nearly stationary
      this.isGrounded = true;
    } else {
      // Not grounded
      this.isGrounded = false;
    }
    
    // Clear ground collisions when airborne to prevent sticking
    if (!this.isGrounded && !hasRayHits) {
      this.physics.groundCollisions.clear();
    }
    
    // Handle transitions
    if (this.wasGrounded && !this.isGrounded) {
      this.resetCameraForAirborne();
    }
    
    // Extract and store ground normal only if we have actual ray hits
    if (hasRayHits) {
      let surfaceNormal = null;
      
      // Extract surface normal from ray hit
      const extractNormal = (hit) => {
        if (!hit || !hit.normal) return null;
        return new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
      };
      
      // Priority: center hit, then average of foot hits
      if (this.centerFootHit) {
        surfaceNormal = extractNormal(this.centerFootHit);
      }
      
      if (!surfaceNormal && (this.leftFootHit || this.rightFootHit)) {
        surfaceNormal = new THREE.Vector3(0, 0, 0);
        let normalCount = 0;
        
        if (this.leftFootHit) {
          const leftNormal = extractNormal(this.leftFootHit);
          if (leftNormal) {
            surfaceNormal.add(leftNormal);
            normalCount++;
          }
        }
        
        if (this.rightFootHit) {
          const rightNormal = extractNormal(this.rightFootHit);
          if (rightNormal) {
            surfaceNormal.add(rightNormal);
            normalCount++;
          }
        }
        
        if (normalCount > 0) {
          surfaceNormal.divideScalar(normalCount).normalize();
        } else {
          surfaceNormal = null;
        }
      }
      
      if (surfaceNormal) {
        // Store the actual detected surface normal
        this.lastGroundNormal.copy(surfaceNormal);
      }
    } else if (!this.isGrounded) {
      // When not grounded and no ray hits, reset to gravity-based up
      this.lastGroundNormal.copy(gravityDir.clone().multiplyScalar(-1));
    }
    // If grounded but no ray hits (collision-based grounding), keep last known normal
    
    // Update last ground contact time only if we have ray hits
    if (hasRayHits) {
      this.physics.lastGroundContact = currentTime;
    }
  }

  alignToSurface(gravityDirection) {
    if (!this.isGrounded || !this.body) return;
    
    // Check if we're in multiplayer or sandbox mode where planet alignment should be active
    const shouldAlignToPlanet = this.scene.gameMode === 'multiplayer' || this.scene.gameMode === 'sandbox';
    
    if (!shouldAlignToPlanet) {
      // For other modes, check slope angle before aligning
      const upDir = gravityDirection.clone().multiplyScalar(-1);
      const slopeDotProduct = this.lastGroundNormal.dot(upDir);
      
      // Only align if surface is not too steep
      if (slopeDotProduct >= this.slopeAngleThreshold) {
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
      }
      // If too steep, maintain current orientation or align to gravity
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

  // Add method to sample terrain around player
  sampleTerrainAroundPlayer() {
    if (!this.body || !this.terrainSampling.enabled) return;
    
    const playerPos = this.getPosition();
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    // Clear previous samples
    this.terrainAnalysis.samples = [];
    
    // Get gravity direction for ray casting
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    // Sample in a circle around the player
    const angleStep = (Math.PI * 2) / this.terrainSampling.sampleCount;
    
    for (let i = 0; i < this.terrainSampling.sampleCount; i++) {
      const angle = i * angleStep;
      
      // Create sample position in local space
      const localOffset = new THREE.Vector3(
        Math.cos(angle) * this.terrainSampling.sampleRadius,
        -this.height * 0.5, // Start from feet level
        Math.sin(angle) * this.terrainSampling.sampleRadius
      );
      
      // Transform to world space
      const worldOffset = localOffset.clone().applyQuaternion(playerQuat);
      const samplePos = playerPos.clone().add(worldOffset);
      
      // Cast ray downward
      const hit = this.physics.castRay(
        samplePos,
        gravityDir,
        this.terrainSampling.maxSampleDistance,
        this.colliderHandle
      );
      
      if (hit && hit.toi !== undefined) {
        // Calculate hit point from ray origin, direction and distance
        const hitPoint = samplePos.clone().add(gravityDir.clone().multiplyScalar(hit.toi));
        
        // Get normal, handling both direct normal property and nested structure
        let normal;
        if (hit.normal) {
          normal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
        } else if (hit.hitNormal) {
          normal = new THREE.Vector3(hit.hitNormal.x, hit.hitNormal.y, hit.hitNormal.z);
        } else {
          // Fallback to gravity-based up direction
          normal = gravityDir.clone().multiplyScalar(-1);
        }
        
        this.terrainAnalysis.samples.push({
          position: hitPoint,
          normal: normal,
          distance: hit.toi,
          angle: angle
        });
      }
    }
    
    // Analyze samples to determine terrain characteristics
    this.analyzeTerrainSamples();
  }

  // Analyze terrain samples to determine slope
  analyzeTerrainSamples() {
    if (this.terrainAnalysis.samples.length < 3) {
      // Not enough samples, use last ground normal
      this.terrainAnalysis.averageNormal.copy(this.lastGroundNormal);
      return;
    }
    
    // Calculate average normal
    const avgNormal = new THREE.Vector3(0, 0, 0);
    this.terrainAnalysis.samples.forEach(sample => {
      avgNormal.add(sample.normal);
    });
    avgNormal.divideScalar(this.terrainAnalysis.samples.length).normalize();
    this.terrainAnalysis.averageNormal.copy(avgNormal);
    
    // Calculate directional slopes
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    // Get forward and right samples
    const forwardSamples = this.terrainAnalysis.samples.filter(s => 
      Math.cos(s.angle) > 0.7 // Forward hemisphere
    );
    const rightSamples = this.terrainAnalysis.samples.filter(s => 
      Math.sin(s.angle) > 0.7 // Right hemisphere
    );
    
    // Calculate forward slope
    if (forwardSamples.length > 0) {
      const forwardNormal = new THREE.Vector3(0, 0, 0);
      forwardSamples.forEach(s => forwardNormal.add(s.normal));
      forwardNormal.normalize();
      
      const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
      const forwardProjected = localForward.clone()
        .projectOnPlane(forwardNormal)
        .normalize();
      
      this.terrainAnalysis.forwardSlope = localForward.dot(forwardProjected);
    }
    
    // Calculate right slope
    if (rightSamples.length > 0) {
      const rightNormal = new THREE.Vector3(0, 0, 0);
      rightSamples.forEach(s => rightNormal.add(s.normal));
      rightNormal.normalize();
      
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
      const rightProjected = localRight.clone()
        .projectOnPlane(rightNormal)
        .normalize();
      
      this.terrainAnalysis.rightSlope = localRight.dot(rightProjected);
    }
  }

  // Get anticipated terrain normal in movement direction
  getAnticipatedTerrainNormal(moveDir) {
    if (!this.body || moveDir.length() < 0.1) return this.lastGroundNormal;
    
    const playerPos = this.getPosition();
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    // Look ahead in movement direction
    const lookAheadDistance = this.terrainSampling.movementAnticipation;
    const lookAheadPos = playerPos.clone().add(
      moveDir.clone().normalize().multiplyScalar(lookAheadDistance)
    );
    
    // Cast ray from look-ahead position
    const hit = this.physics.castRay(
      lookAheadPos,
      gravityDir,
      this.height,
      this.colliderHandle
    );
    
    if (hit && hit.toi !== undefined) {
      // Get normal from hit
      let anticipatedNormal;
      if (hit.normal) {
        anticipatedNormal = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
      } else if (hit.hitNormal) {
        anticipatedNormal = new THREE.Vector3(hit.hitNormal.x, hit.hitNormal.y, hit.hitNormal.z);
      } else {
        return this.lastGroundNormal;
      }
      
      // Blend with current ground normal based on slope influence
      return this.lastGroundNormal.clone().lerp(
        anticipatedNormal,
        this.terrainSampling.slopeInfluence
      ).normalize();
    }
    
    return this.lastGroundNormal;
  }

  // Override handleMovement to use terrain-aware movement
  handleMovement(deltaTime) {
    if (!this.body) return;
    
    // Don't handle player movement if in vehicle
    if (this.isInVehicle) return;
    
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
      const buoyancyStrength = gravityStrength * 0.3;
      // Buoyancy is opposite to gravity direction
      buoyancyImpulse = gravityDir.clone().multiplyScalar(-buoyancyStrength * mass * deltaTime);
    }
    
    // Sample terrain if grounded
    if (this.isGrounded && !this.isSwimming) {
      this.sampleTerrainAroundPlayer();
    }
    
    // Align to surface when grounded
    if (this.isGrounded && (this.centerFootHit || this.leftFootHit || this.rightFootHit)) {
      this.alignToSurface(gravityDir);
      this.adjustPositionToGround(gravityDir);
    }
    
    // Handle airborne roll with Q/E keys
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
        
        // Roll around the local forward axis
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
    
    const speed = this.keys.run ? this.runSpeed : this.walkSpeed;
    
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    // Get base movement vectors from player orientation
    let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    
    // Build movement direction WITHOUT normalizing first
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, moveForward * speed);
    moveDir.addScaledVector(right, moveRight * speed);
    
    // Get effective ground normal for surface alignment
    let effectiveGroundNormal = null;
    
    if (this.isGrounded) {
      // First priority: use terrain analysis average normal if available
      if (this.terrainAnalysis.samples.length > 0) {
        effectiveGroundNormal = this.terrainAnalysis.averageNormal.clone();
      } 
      // Second priority: use last detected ground normal from ray hits
      else if (this.lastGroundNormal) {
        effectiveGroundNormal = this.lastGroundNormal.clone();
      }
      
      // If moving, check for anticipated terrain
      if (moveDir.length() > 0.1 && effectiveGroundNormal) {
        const anticipatedNormal = this.getAnticipatedTerrainNormal(moveDir.clone().normalize());
        // Blend current and anticipated normals
        effectiveGroundNormal.lerp(anticipatedNormal, 0.5).normalize();
      }
    }
    
    // Project movement onto surface if grounded
    if (this.isGrounded && effectiveGroundNormal && moveDir.length() > 0.01) {
      // Remove the component of movement that goes into/away from the surface
      const movementAlongNormal = moveDir.dot(effectiveGroundNormal);
      moveDir.sub(effectiveGroundNormal.clone().multiplyScalar(movementAlongNormal));
      
      // Special handling for steep slopes
      const gravityUp = gravityDir.clone().multiplyScalar(-1);
      const slopeAngle = Math.acos(effectiveGroundNormal.dot(gravityUp));
      const steepSlope = slopeAngle > (30 * Math.PI / 180); // Slopes > 30 degrees
      
      if (steepSlope && moveForward < 0) {
        // When moving backward down a steep slope, add sliding component
        const slopeDown = gravityDir.clone().projectOnPlane(effectiveGroundNormal).normalize();
        const slideComponent = slopeDown.multiplyScalar(speed * 0.2 * Math.sin(slopeAngle));
        moveDir.add(slideComponent);
      }
    }
    
    // Now we can normalize if diagonal movement is too fast
    const moveSpeed = moveDir.length();
    if (moveSpeed > speed) {
      moveDir.normalize().multiplyScalar(speed);
    }
    
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
      
      // Apply movement force
      newVelX += moveDir.x * groundAccel * deltaTime;
      newVelY += moveDir.y * groundAccel * deltaTime;
      newVelZ += moveDir.z * groundAccel * deltaTime;
      
      // Only apply surface adhesion if we have confirmed ray hits
      if ((this.centerFootHit || this.leftFootHit || this.rightFootHit) && 
          effectiveGroundNormal && moveDir.length() > 0.01) {
        const gravityUp = gravityDir.clone().multiplyScalar(-1);
        const slopeAngle = Math.acos(effectiveGroundNormal.dot(gravityUp));
        
        if (slopeAngle > 0.1) { // More than ~5 degrees
          // Add a component that keeps us on the surface
          const stickStrength = Math.min(slopeAngle * 1.5, 1.0);
          const stickToSurface = effectiveGroundNormal.clone().multiplyScalar(-stickStrength * 2.0);
          newVelX += stickToSurface.x * deltaTime;
          newVelY += stickToSurface.y * deltaTime;
          newVelZ += stickToSurface.z * deltaTime;
        }
      }
      
      // Apply friction/damping
      const isMoving = Math.abs(moveForward) > 0.01 || Math.abs(moveRight) > 0.01;
      if (!isMoving) {
        // Stronger damping when not moving
        newVelX *= 0.8;
        newVelY *= 0.95;
        newVelZ *= 0.8;
      } else {
        // Less damping when moving, but still constrain to surface
        if (effectiveGroundNormal) {
          // Project velocity onto surface to remove any "floating" component
          const vel = new THREE.Vector3(newVelX, newVelY, newVelZ);
          const velAlongNormal = vel.dot(effectiveGroundNormal);
          
          // Only dampen velocity moving away from surface, not along it
          if (velAlongNormal > 0.5) {
            vel.sub(effectiveGroundNormal.clone().multiplyScalar(velAlongNormal * 0.9));
            newVelX = vel.x;
            newVelY = vel.y;
            newVelZ = vel.z;
          }
        }
      }
      
      // Clamp maximum ground speed
      const vel = new THREE.Vector3(newVelX, newVelY, newVelZ);
      const velMagnitude = vel.length();
      if (velMagnitude > speed * 1.5) {
        vel.normalize().multiplyScalar(speed * 1.5);
        newVelX = vel.x;
        newVelY = vel.y;
        newVelZ = vel.z;
      }
      
      // Additional constraint: ensure we're not moving too fast away from surface
      if (effectiveGroundNormal) {
        const upwardSpeed = vel.dot(effectiveGroundNormal);
        if (upwardSpeed > 2.0) { // Limit upward speed on slopes
          vel.sub(effectiveGroundNormal.clone().multiplyScalar(upwardSpeed - 2.0));
          newVelX = vel.x;
          newVelY = vel.y;
          newVelZ = vel.z;
        }
      }
    } else if (this.isSwimming) {
      // Swimming movement
      const swimControl = 3.0;
      newVelX += moveDir.x * swimControl * deltaTime;
      newVelY += moveDir.y * swimControl * deltaTime;
      newVelZ += moveDir.z * swimControl * deltaTime;
      
      // Add vertical swimming controls
      if (this.keys.jump) {
        const upForce = gravityDir.clone().multiplyScalar(-8.0 * deltaTime);
        newVelX += upForce.x;
        newVelY += upForce.y;
        newVelZ += upForce.z;
      }
      
      // Apply water drag
      newVelX *= 0.85;
      newVelY *= 0.85;
      newVelZ *= 0.85;
      
      // Clamp swimming speed
      const swimVel = new THREE.Vector3(newVelX, newVelY, newVelZ);
      const swimSpeed = swimVel.length();
      const maxSwimSpeed = this.walkSpeed * 0.5;
      if (swimSpeed > maxSwimSpeed) {
        swimVel.normalize().multiplyScalar(maxSwimSpeed);
        newVelX = swimVel.x;
        newVelY = swimVel.y;
        newVelZ = swimVel.z;
      }
    } else {
      // Air movement
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
  
  // Add helper method to check if a surface is walkable
  isSurfaceWalkable(surfaceNormal) {
    const playerPos = this.getPosition();
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    
    const slopeDotProduct = surfaceNormal.dot(upDir);
    return slopeDotProduct >= this.slopeAngleThreshold;
  }

  // Add method to get current slope angle in degrees
  getCurrentSlopeAngle() {
    if (!this.isGrounded) return 0;
    
    // Get the actual detected ground normal
    let groundNormal = null;
    
    // First priority: use terrain analysis average normal if available (most accurate)
    if (this.terrainAnalysis.samples.length > 0) {
      groundNormal = this.terrainAnalysis.averageNormal;
    } 
    // Second priority: use the detected normal from ray hits
    else if (this.centerFootHit || this.leftFootHit || this.rightFootHit) {
      // Get normal from the closest hit
      let closestHit = null;
      let closestDistance = Infinity;
      
      if (this.centerFootHit && this.centerFootHit.toi < closestDistance) {
        closestHit = this.centerFootHit;
        closestDistance = this.centerFootHit.toi;
      }
      if (this.leftFootHit && this.leftFootHit.toi < closestDistance) {
        closestHit = this.leftFootHit;
        closestDistance = this.leftFootHit.toi;
      }
      if (this.rightFootHit && this.rightFootHit.toi < closestDistance) {
        closestHit = this.rightFootHit;
        closestDistance = this.rightFootHit.toi;
      }
      
      // Extract normal from the hit
      if (closestHit) {
        if (closestHit.normal) {
          groundNormal = new THREE.Vector3(
            closestHit.normal.x,
            closestHit.normal.y,
            closestHit.normal.z
          );
        } else if (closestHit.hitNormal) {
          groundNormal = new THREE.Vector3(
            closestHit.hitNormal.x,
            closestHit.hitNormal.y,
            closestHit.hitNormal.z
          );
        }
      }
    }
    // Third priority: use lastGroundNormal if available
    else if (this.lastGroundNormal) {
      groundNormal = this.lastGroundNormal.clone();
    }
    
    // If we still don't have a ground normal, return 0
    if (!groundNormal) return 0;
    
    // The slope angle is the angle between the surface normal and straight up (0,1,0)
    // In a typical flat world, "up" is (0,1,0)
    // But in our spherical world, we need to consider local "up" based on gravity
    
    // Get the local "up" direction (opposite of gravity at this position)
    const playerPos = this.getPosition();
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    const localUp = gravityDir.clone().multiplyScalar(-1);
    
    // Calculate angle between ground normal and local up
    const dotProduct = groundNormal.dot(localUp);
    // Clamp to valid range for acos
    const clampedDot = Math.max(-1, Math.min(1, dotProduct));
    const angleRadians = Math.acos(clampedDot);
    
    return angleRadians * 180 / Math.PI;
  }

  // Add method to toggle camera
  toggleCamera() {
    if (this.isInVehicle) {
      // Don't toggle camera while in vehicle
      console.log('Cannot toggle camera while in vehicle');
      return;
    }
    
    if (this.tpController) {
      this.tpController.toggle();
      
      // Hide/show weapons based on camera mode
      if (window.weaponSystem) {
        window.weaponSystem.setVisible(!this.tpController.isActive);
      }
    }
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
    
    // Force mesh matrix update
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
    
    // Simple camera rotation like reference
    if (this.isGrounded) {
      this.scene.camera.rotation.x = this.cameraRotation.x;
      this.scene.camera.rotation.y = this.cameraRotation.y;
      this.scene.camera.rotation.z = 0;
    } else {
      this.scene.camera.rotation.set(0, 0, 0);
    }
    
    // Force camera matrix update after rotation changes
    this.scene.camera.updateMatrix();
    this.scene.camera.updateMatrixWorld(true);
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

  // Add terrain sample visualization to debug rays
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
    
    // Update facing ray - keep at player center
    const playerWorldPos = this.mesh.position.clone();
    const facingDir = this.getFacing();
    updateRayLine(
      this.rayLines.facing,
      playerWorldPos,
      playerWorldPos.clone().add(facingDir.multiplyScalar(3))
    );
    
    // Update gravity ray - keep at player center
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerWorldPos)
      .normalize();
    updateRayLine(
      this.rayLines.gravity,
      playerWorldPos,
      playerWorldPos.clone().add(gravityDir.multiplyScalar(5))
    );
    
    // Get the ground normal
    const groundNormal = this.isGrounded ? this.lastGroundNormal.clone() : null;
    
    // Determine which foot position to use for movement visualization
    let movementOrigin = this.centerFootPos.clone();
    
    // If grounded, use the hit point from the closest ray
    if (this.isGrounded) {
      // Find the closest hit
      let closestHit = null;
      let closestDistance = Infinity;
      let closestRayOrigin = this.centerFootPos.clone();
      
      if (this.centerFootHit && this.centerFootHit.toi < closestDistance) {
        closestHit = this.centerFootHit;
        closestDistance = this.centerFootHit.toi;
        closestRayOrigin = this.centerFootPos.clone();
      }
      if (this.leftFootHit && this.leftFootHit.toi < closestDistance) {
        closestHit = this.leftFootHit;
        closestDistance = this.leftFootHit.toi;
        closestRayOrigin = this.leftFootPos.clone();
      }
      if (this.rightFootHit && this.rightFootHit.toi < closestDistance) {
        closestHit = this.rightFootHit;
        closestDistance = this.rightFootHit.toi;
        closestRayOrigin = this.rightFootPos.clone();
      }
      
      // If we have a hit, calculate the actual hit point
      if (closestHit && closestHit.toi !== undefined) {
        // Calculate hit point from ray origin + direction * distance
        movementOrigin = closestRayOrigin.add(this.rayDir.clone().multiplyScalar(closestHit.toi));
        
        // Offset slightly above ground to make lines visible
        if (groundNormal) {
          movementOrigin.add(groundNormal.clone().multiplyScalar(0.05));
        }
      }
    }
    
    // Helper function to project movement onto surface
    const projectOntoSurface = (inputDir, surfaceNormal) => {
      // Project the input direction onto the surface plane
      const normalComponent = inputDir.dot(surfaceNormal);
      return inputDir.clone().sub(surfaceNormal.clone().multiplyScalar(normalComponent)).normalize();
    };
    
    // Update movement input visualization (green/yellow)
    const moveInput = new THREE.Vector3();
    if (this.keys.forward) moveInput.z -= 1;
    if (this.keys.backward) moveInput.z += 1;
    if (this.keys.left) moveInput.x -= 1;
    if (this.keys.right) moveInput.x += 1;
    
    if (moveInput.length() > 0) {
      moveInput.normalize();
      const playerQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      moveInput.applyQuaternion(playerQuat);
      
      // Project movement based on grounded state
      let projectedMovement;
      if (this.isGrounded && groundNormal) {
        // When grounded, project onto the actual surface normal
        projectedMovement = projectOntoSurface(moveInput, groundNormal);
      } else {
        // When airborne, use raw movement direction
        projectedMovement = moveInput.clone();
      }
      
      const moveDistance = 2.0;
      updateRayLine(
        this.rayLines.movement,
        movementOrigin,
        movementOrigin.clone().add(projectedMovement.multiplyScalar(moveDistance))
      );
      this.rayLines.movement.visible = true;
      
      // Update color to indicate if grounded (yellow) or airborne (green)
      this.rayLines.movement.material.color.setHex(this.isGrounded ? 0xffff00 : 0x00ff00);
    } else {
      this.rayLines.movement.visible = false;
    }
    
    // Update velocity visualization (blue/cyan)
    const velocityRapier = this.body.linvel();
    const velocity = new THREE.Vector3(velocityRapier.x, velocityRapier.y, velocityRapier.z);
    
    if (velocity.length() > 0.1) {
      const velocityScale = Math.min(velocity.length() * 0.2, 5);
      const velocityDir = velocity.clone().normalize();
      
      // Project velocity onto surface if grounded
      let projectedVelocity;
      if (this.isGrounded && groundNormal) {
        projectedVelocity = projectOntoSurface(velocityDir, groundNormal);
      } else {
        projectedVelocity = velocityDir.clone();
      }
      
      updateRayLine(
        this.rayLines.velocity,
        movementOrigin,
        movementOrigin.clone().add(projectedVelocity.multiplyScalar(velocityScale))
      );
      this.rayLines.velocity.visible = true;
      
      // Update color - cyan for grounded, blue for airborne
      this.rayLines.velocity.material.color.setHex(this.isGrounded ? 0x00ffff : 0x0088ff);
    } else {
      this.rayLines.velocity.visible = false;
    }
    
    // Update intended movement visualization (white) - this shows what handleMovement actually does
    const intendedInput = new THREE.Vector3();
    if (this.keys.forward) intendedInput.z -= 1;
    if (this.keys.backward) intendedInput.z += 1;
    if (this.keys.left) intendedInput.x -= 1;
    if (this.keys.right) intendedInput.x += 1;
    
    if (intendedInput.length() > 0.1) {
      intendedInput.normalize();
      
      // Apply player rotation
      const playerQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      // Calculate forward and right vectors
      let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
      let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
      
      // This mirrors the actual movement calculation in handleMovement
      // Get the effective ground normal (either current or anticipated)
      let effectiveGroundNormal = this.lastGroundNormal;
      if (this.isGrounded && this.terrainAnalysis.averageNormal) {
        // Use the terrain analysis normal if available
        effectiveGroundNormal = this.terrainAnalysis.averageNormal;
      }
      
      if (this.isGrounded && effectiveGroundNormal) {
        forward.projectOnPlane(effectiveGroundNormal).normalize();
        right.projectOnPlane(effectiveGroundNormal).normalize();
      }
      
      // Build actual movement direction
      const speed = this.keys.run ? this.runSpeed : this.walkSpeed;
      const moveForward = (this.keys.forward ? 1 : 0) + (this.keys.backward ? -1 : 0);
      const moveRight = (this.keys.right ? 1 : 0) + (this.keys.left ? -1 : 0);
      
      const actualMoveDir = new THREE.Vector3();
      actualMoveDir.addScaledVector(forward, moveForward);
      actualMoveDir.addScaledVector(right, moveRight);
      
      if (actualMoveDir.length() > 0) {
        actualMoveDir.normalize();
        
        const intendedDistance = 3.0;
        updateRayLine(
          this.rayLines.intended,
          movementOrigin,
          movementOrigin.clone().add(actualMoveDir.multiplyScalar(intendedDistance))
        );
        this.rayLines.intended.visible = true;
        
        // White color for intended movement
        this.rayLines.intended.material.color.setHex(0xffffff);
      } else {
        this.rayLines.intended.visible = false;
      }
    } else {
      this.rayLines.intended.visible = false;
    }
    
    // Update ray colors based on hits
    this.rayLines.left.material.color.setHex(this.leftFootHit ? 0xff0000 : 0x00ff00);
    this.rayLines.right.material.color.setHex(this.rightFootHit ? 0xff0000 : 0x00ff00);
    this.rayLines.center.material.color.setHex(this.centerFootHit ? 0xff0000 : 0x00ff00);
    
    // Add ground normal visualization when grounded
    if (this.isGrounded && groundNormal && this.rayLines.gravity.visible) {
      // Show ground normal as a purple line
      if (!this.rayLines.groundNormal) {
        const normalMaterial = new THREE.LineBasicMaterial({ 
          color: 0xff00ff,
          opacity: 0.8,
          transparent: true,
          linewidth: 2
        });
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 2);
        this.rayLines.groundNormal = new THREE.Line(geometry, normalMaterial);
        this.scene.scene.add(this.rayLines.groundNormal);
      }
      
      this.rayLines.groundNormal.visible = true;
      updateRayLine(
        this.rayLines.groundNormal,
        movementOrigin,
        movementOrigin.clone().add(groundNormal.clone().multiplyScalar(2))
      );
      
      // Show local up direction (opposite of gravity) as orange for comparison
      if (!this.rayLines.gravityPlaneNormal) {
        const gravityPlaneMaterial = new THREE.LineBasicMaterial({ 
          color: 0xff8800,
          opacity: 0.8,
          transparent: true,
          linewidth: 2
        });
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 2);
        this.rayLines.gravityPlaneNormal = new THREE.Line(geometry, gravityPlaneMaterial);
        this.scene.scene.add(this.rayLines.gravityPlaneNormal);
      }
      
      const localGravityDir = new THREE.Vector3()
        .subVectors(this.physics.gravity.center, movementOrigin)
        .normalize();
      const localUp = localGravityDir.clone().multiplyScalar(-1);
      
      this.rayLines.gravityPlaneNormal.visible = true;
      updateRayLine(
        this.rayLines.gravityPlaneNormal,
        movementOrigin,
        movementOrigin.clone().add(localUp.clone().multiplyScalar(1.5))
      );
    } else {
      if (this.rayLines.groundNormal) {
        this.rayLines.groundNormal.visible = false;
      }
      if (this.rayLines.gravityPlaneNormal) {
        this.rayLines.gravityPlaneNormal.visible = false;
      }
    }
    
    // Add terrain sample visualization
    if (this.debugVisualsEnabled && this.isGrounded && this.terrainAnalysis.samples.length > 0) {
      // Create sample point visualizations if needed
      if (!this.terrainSampleHelpers) {
        this.terrainSampleHelpers = [];
        const sampleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        const sampleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        
        for (let i = 0; i < this.terrainSampling.sampleCount; i++) {
          const helper = new THREE.Mesh(sampleGeometry, sampleMaterial);
          helper.visible = false;
          this.scene.scene.add(helper);
          this.terrainSampleHelpers.push(helper);
        }
      }
      
      // Update sample positions
      this.terrainAnalysis.samples.forEach((sample, index) => {
        if (this.terrainSampleHelpers[index]) {
          this.terrainSampleHelpers[index].position.copy(sample.position);
          this.terrainSampleHelpers[index].visible = true;
        }
      });
      
      // Hide unused helpers
      for (let i = this.terrainAnalysis.samples.length; i < this.terrainSampleHelpers.length; i++) {
        this.terrainSampleHelpers[i].visible = false;
      }
      
      // Show average normal if different from last ground normal
      if (!this.rayLines.averageNormal) {
        const avgNormalMaterial = new THREE.LineBasicMaterial({ 
          color: 0x00ff00,
          opacity: 0.8,
          transparent: true,
          linewidth: 2
        });
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 2);
        this.rayLines.averageNormal = new THREE.Line(geometry, avgNormalMaterial);
        this.scene.scene.add(this.rayLines.averageNormal);
      }
      
      this.rayLines.averageNormal.visible = true;
      updateRayLine(
        this.rayLines.averageNormal,
        movementOrigin,
        movementOrigin.clone().add(this.terrainAnalysis.averageNormal.clone().multiplyScalar(1.5))
      );
    } else {
      if (this.terrainSampleHelpers) {
        this.terrainSampleHelpers.forEach(helper => helper.visible = false);
      }
      if (this.rayLines.averageNormal) {
        this.rayLines.averageNormal.visible = false;
      }
    }
  }
  
  checkNearbyVehicles() {
    if (!this.scene || !this.body) return null;
    
    // Don't check for vehicles if we're in exit cooldown
    if (this.vehicleExitCooldown && Date.now() < this.vehicleExitCooldown) {
      return null;
    }
    
    const playerPos = this.getPosition();
    let nearestVehicle = null;
    let nearestDistance = 5.0; // Interaction range
    
    // Check all dynamic objects for vehicles
    this.scene.dynamicObjects.forEach((obj, id) => {
      if (obj.type === 'vehicle' || obj.type === 'plane' || obj.type === 'helicopter') {
        const vehicle = obj.controller;
        if (!vehicle || vehicle.isOccupied) return;
        
        const vehiclePos = vehicle.getPosition();
        const distance = playerPos.distanceTo(vehiclePos);
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestVehicle = vehicle;
        }
      }
    });
    
    // Also check vehicles collection
    this.scene.vehicles.forEach((vehicle, id) => {
      if (vehicle.isOccupied) return;
      
      const vehiclePos = vehicle.getPosition();
      const distance = playerPos.distanceTo(vehiclePos);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestVehicle = vehicle;
      }
    });
    
    return nearestVehicle;
  }

  // Add main update method
  update(deltaTime) {
    if (!this.body) return;
    
    // Check grounded state
    this.checkGrounded();
    
    // Handle movement
    this.handleMovement(deltaTime);
    
    // Update transform
    this.updateTransform();
    
    // Update debug visualizations if enabled
    if (this.debugVisualsEnabled) {
      this.updateRayVisualizations();
    }
    
    // Update third-person controller if active
    if (this.tpController && this.tpController.isActive) {
      this.tpController.update(deltaTime);
    }
    
    // Handle vehicle interaction
    if (this.keys.interact && !this.wasInteracting && !this.isInVehicle) {
      const nearbyVehicle = this.checkNearbyVehicles();
      if (nearbyVehicle) {
        this.requestEnterVehicle(nearbyVehicle);
      }
    } else if (this.keys.interact && !this.wasInteracting && this.isInVehicle) {
      this.requestExitVehicle();
    }
    this.wasInteracting = this.keys.interact;
    
    // Handle camera toggle
    if (this.keys.toggleCamera && !this.wasTogglingCamera) {
      this.toggleCamera();
    }
    this.wasTogglingCamera = this.keys.toggleCamera;
    
    // Update vehicle exit cooldown
    if (this.vehicleExitCooldown > 0) {
      this.vehicleExitCooldown = Math.max(0, this.vehicleExitCooldown - deltaTime * 1000);
    }
  }

  // Add network state getter
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

  // Add mouse handler
  handleMouseMove(event) {
    if (!this.body || this.isInVehicle) return;
    
    const sensitivity = 0.002;
    const deltaX = event.movementX * sensitivity;
    const deltaY = event.movementY * sensitivity;
    
    // If third person camera is active, let it handle the mouse
    if (this.tpController && this.tpController.isActive) {
      this.tpController.handleMouseMove(event);
      return;
    }
    
    // Apply yaw rotation to body
    if (deltaX !== 0) {
      const currentRotation = this.body.rotation();
      const currentQuat = new THREE.Quaternion(
        currentRotation.x,
        currentRotation.y,
        currentRotation.z,
        currentRotation.w
      );
      
      const upVector = this.getUpDirection();
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, -deltaX);
      currentQuat.premultiply(yawQuat);
      
      this.body.setRotation({
        x: currentQuat.x,
        y: currentQuat.y,
        z: currentQuat.z,
        w: currentQuat.w
      });
    }
    
    // Apply pitch to camera only when grounded
    if (this.isGrounded) {
      this.cameraRotation.x -= deltaY;
      this.cameraRotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.cameraRotation.x));
    }
  }

  // Add vehicle enter/exit methods
  enterVehicle(vehicle) {
    if (!vehicle || this.isInVehicle) return;
    
    console.log('Entering vehicle:', vehicle);
    
    // Store camera state
    this.cameraStateBeforeVehicle.isThirdPerson = this.tpController?.isActive || false;
    
    // Force third person view for vehicles
    if (this.tpController && !this.tpController.isActive) {
      this.tpController.toggle();
    }
    
    // Hide player mesh
    if (this.mesh) {
      this.mesh.visible = false;
    }
    
    // Disable player physics
    if (this.body) {
      this.body.setEnabled(false);
    }
    
    // Set vehicle state
    this.isInVehicle = true;
    this.currentVehicle = vehicle;
    vehicle.isOccupied = true;
    vehicle.currentDriver = this;
    
    // Update camera to follow vehicle
    if (this.tpController) {
      this.tpController.setTarget(vehicle.chassisMesh || vehicle.mesh);
    }
  }

  exitVehicle() {
    if (!this.isInVehicle || !this.currentVehicle) return;
    
    console.log('Exiting vehicle');
    
    const vehicle = this.currentVehicle;
    
    // Get exit position (slightly above and to the side of vehicle)
    const vehiclePos = vehicle.getPosition();
    const exitOffset = new THREE.Vector3(2, 2, 0);
    const exitPosition = vehiclePos.clone().add(exitOffset);
    
    // Re-enable player physics and move to exit position
    if (this.body) {
      this.body.setEnabled(true);
      this.body.setTranslation({
        x: exitPosition.x,
        y: exitPosition.y,
        z: exitPosition.z
      });
      
      // Reset velocity
      this.body.setLinvel({ x: 0, y: 0, z: 0 });
    }
    
    // Show player mesh
    if (this.mesh) {
      this.mesh.visible = true;
    }
    
    // Clear vehicle state
    vehicle.isOccupied = false;
    vehicle.currentDriver = null;
    this.isInVehicle = false;
    this.currentVehicle = null;
    
    // Restore camera state
    if (this.tpController) {
      this.tpController.setTarget(this.mesh);
      
      // Restore previous camera mode
      if (!this.cameraStateBeforeVehicle.isThirdPerson && this.tpController.isActive) {
        this.tpController.toggle();
      }
    }
    
    // Set exit cooldown to prevent immediate re-entry
    this.vehicleExitCooldown = 1000; // 1 second cooldown
  }

  // Clean up terrain helpers in destroy method
  destroy() {
    // Clean up ray lines
    if (this.rayLines) {
      Object.values(this.rayLines).forEach(line => {
        if (line) {
          this.scene.scene.remove(line);
          if (line.geometry) line.geometry.dispose();
          if (line.material) line.material.dispose();
        }
      });
    }
    
    // Clean up terrain sample helpers
    if (this.terrainSampleHelpers) {
      this.terrainSampleHelpers.forEach(helper => {
        this.scene.scene.remove(helper);
        if (helper.geometry) helper.geometry.dispose();
        if (helper.material) helper.material.dispose();
      });
      this.terrainSampleHelpers = null;
    }
    
    // Clean up third-person controller
    if (this.tpController) {
      this.tpController.destroy();
      this.tpController = null;
    }
    
    // Remove mesh
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
      this.mesh = null;
    }
    
    // Remove physics
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
      this.collider = null;
    }
    
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
      this.body = null;
    }
  }
}
