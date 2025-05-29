import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class RemotePlayer {
  constructor(id, scene, physics, initialPosition) {
    this.id = id;
    this.scene = scene;
    this.physics = physics;
    
    // Player properties (same as FPS controller)
    this.height = 1.8;
    this.radius = 0.4;
    
    // Visual and physics objects
    this.mesh = null;
    this.body = null;
    this.collider = null;
    this.colliderHandle = null;
    
    // State interpolation
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Quaternion();
    this.targetVelocity = new THREE.Vector3();
    this.currentVelocity = new THREE.Vector3();
    
    // Dynamic interpolation based on movement state
    this.baseInterpolationFactor = 0.2;
    this.interpolationFactor = this.baseInterpolationFactor;
    
    // Grounded state
    this.isGrounded = false;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    this.wasGrounded = false; // Track grounded state transitions
    
    // Network state tracking
    this.lastUpdateTime = performance.now();
    this.timeSinceLastUpdate = 0;
    
    // Create the player
    this.create(initialPosition);
  }

  create(position) {
    // Check if physics world is ready
    if (!this.physics.world) {
      console.error('Physics world not initialized for remote player creation');
      return;
    }
    
    // Create physics body with locked rotation like FPS controller
    this.body = this.physics.createDynamicBody(position, {
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
    
    // Create visual mesh with different color
    const geometry = new THREE.CapsuleGeometry(
      this.radius,
      this.height - this.radius * 2,
      8, 8
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00, // Green for other players
      roughness: 0.7,
      metalness: 0.1
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Add name tag
    this.createNameTag();
    
    console.log(`Remote player ${this.id} created at`, position);
  }

  createNameTag() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`Player ${this.id.substring(0, 8)}`, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      depthTest: true,
      depthWrite: false
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = this.height * 0.7;
    
    this.mesh.add(sprite);
  }

  getUpDirection() {
    // Delegate to physics manager
    const position = this.body.translation();
    return this.physics.getUpDirection(position);
  }

  checkGrounded() {
    if (!this.collider || !this.body) return false;
    
    // Use physics manager's ground detection (simplified for remote players)
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const up = this.physics.getUpDirection(position);
    
    // Simple single ray cast from center
    const rayDir = up.clone().multiplyScalar(-1);
    const rayOrigin = playerPos.clone();
    
    const maxDistance = 0.3;
    const hit = this.physics.castRay(
      rayOrigin,
      rayDir,
      maxDistance,
      this.colliderHandle
    );
    
    this.isGrounded = hit !== null;
    
    if (hit && hit.normal) {
      this.lastGroundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    }
    
    return this.isGrounded;
  }

  alignToSurface(gravityDirection) {
    if (!this.isGrounded || !this.body) return;
    
    // Check if we're in multiplayer or sandbox mode
    const shouldAlignToPlanet = this.scene.gameMode === 'multiplayer' || this.scene.gameMode === 'sandbox';
    
    if (!shouldAlignToPlanet) {
      // Use existing surface alignment for other modes
      const currentQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      const lerpFactor = 0.1;
      const alignedQuat = this.physics.calculateSurfaceAlignment(
        currentQuat,
        this.lastGroundNormal,
        lerpFactor
      );
      
      this.body.setRotation({
        x: alignedQuat.x,
        y: alignedQuat.y,
        z: alignedQuat.z,
        w: alignedQuat.w
      });
      return;
    }
    
    // For multiplayer/sandbox: align to planet gravity
    const currentQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    // The desired up direction is opposite to gravity
    const desiredUp = gravityDirection.clone().multiplyScalar(-1).normalize();
    
    // Get current forward direction
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuat);
    
    // Project forward onto plane perpendicular to desired up
    const projectedForward = currentForward.clone()
      .sub(desiredUp.clone().multiplyScalar(currentForward.dot(desiredUp)))
      .normalize();
    
    if (projectedForward.lengthSq() < 0.1) {
      const worldForward = new THREE.Vector3(0, 0, -1);
      projectedForward.copy(worldForward)
        .sub(desiredUp.clone().multiplyScalar(worldForward.dot(desiredUp)))
        .normalize();
    }
    
    // Calculate orthonormal basis
    const right = new THREE.Vector3().crossVectors(projectedForward, desiredUp).normalize();
    const alignedForward = new THREE.Vector3().crossVectors(desiredUp, right).normalize();
    
    // Build rotation matrix
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(right, desiredUp, alignedForward.multiplyScalar(-1));
    
    // Convert to quaternion
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    
    // Smooth interpolation for remote players
    const lerpFactor = 0.2; // Stronger alignment for remote players
    currentQuat.slerp(targetQuat, lerpFactor);
    
    this.body.setRotation({
      x: currentQuat.x,
      y: currentQuat.y,
      z: currentQuat.z,
      w: currentQuat.w
    });
  }

  updateState(state) {
    if (!this.body || !this.mesh) return;
    
    // Track time between updates
    const now = performance.now();
    this.timeSinceLastUpdate = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // Update target position and rotation
    if (state.position) {
      this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    }
    
    if (state.rotation) {
      this.targetRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    }
    
    // Update velocity
    if (state.velocity) {
      this.targetVelocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
      
      // For falling or fast movement, apply velocity directly to physics body
      const speed = this.targetVelocity.length();
      if (!state.isGrounded || speed > 5.0) {
        this.body.setLinvel({
          x: state.velocity.x,
          y: state.velocity.y,
          z: state.velocity.z
        });
      }
    }
    
    // Update grounded state from server
    if (state.isGrounded !== undefined) {
      this.isGrounded = state.isGrounded;
    }
    
    // Update swimming state from server
    if (state.isSwimming !== undefined) {
      this.isSwimming = state.isSwimming;
    }
    
    // Adjust interpolation based on movement state
    if (!this.isGrounded) {
      // Use faster interpolation when falling
      this.interpolationFactor = 0.5;
    } else if (this.targetVelocity.length() > 3.0) {
      // Faster interpolation for running
      this.interpolationFactor = 0.3;
    } else {
      // Normal interpolation for walking/standing
      this.interpolationFactor = this.baseInterpolationFactor;
    }
  }

  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Skip gravity if swimming (it will be handled by physics manager)
    if (!this.isSwimming) {
      // Apply gravity only if not swimming
      this.physics.applyGravityToBody(this.body, deltaTime);
    } else {
      // Apply buoyancy for swimming players
      this.body.resetForces(true);
      const mass = this.body.mass();
      const buoyancyForce = { x: 0, y: 5.0 * mass, z: 0 };
      this.body.applyImpulse(buoyancyForce);
    }
    
    // Check grounded state locally as well for smoother transitions
    this.wasGrounded = this.isGrounded;
    this.checkGrounded();
    
    // Get gravity direction
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    // Get current position and velocity
    const currentPos = this.body.translation();
    const currentPosition = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    const currentVel = this.body.linvel();
    this.currentVelocity.set(currentVel.x, currentVel.y, currentVel.z);
    
    // Calculate interpolated position with velocity prediction
    let interpolatedPosition;
    
    if (!this.isGrounded && this.targetVelocity.length() > 1.0) {
      // When falling, use velocity-based prediction
      const timeSinceUpdate = (performance.now() - this.lastUpdateTime) / 1000.0;
      const predictedOffset = this.targetVelocity.clone().multiplyScalar(timeSinceUpdate * 0.5);
      const predictedTarget = this.targetPosition.clone().add(predictedOffset);
      
      // Interpolate to predicted position
      interpolatedPosition = currentPosition.lerp(predictedTarget, this.interpolationFactor);
    } else {
      // Normal interpolation for grounded movement
      interpolatedPosition = currentPosition.lerp(this.targetPosition, this.interpolationFactor);
    }
    
    // Set body position
    this.body.setTranslation({
      x: interpolatedPosition.x,
      y: interpolatedPosition.y,
      z: interpolatedPosition.z
    });
    
    // Update mesh position to match body
    this.mesh.position.copy(interpolatedPosition);
    
    // Always interpolate rotation from server (includes Q/E rotations)
    const currentQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    // Use faster rotation interpolation when swimming or falling
    const rotationLerp = (this.isGrounded && !this.isSwimming) ? this.interpolationFactor : 
                         Math.min(this.interpolationFactor * 2, 0.8);
    
    // Interpolate towards target rotation
    currentQuat.slerp(this.targetRotation, rotationLerp);
    
    // Set body rotation
    this.body.setRotation({
      x: currentQuat.x,
      y: currentQuat.y,
      z: currentQuat.z,
      w: currentQuat.w
    });
    
    // Mesh always matches body
    this.mesh.quaternion.copy(currentQuat);
    
    // Apply planet alignment if grounded
    if (this.isGrounded) {
      this.alignToSurface(gravityDir);
      
      // Update mesh to match aligned body
      const alignedRotation = this.body.rotation();
      this.mesh.quaternion.set(
        alignedRotation.x,
        alignedRotation.y,
        alignedRotation.z,
        alignedRotation.w
      );
    }
  }

  destroy() {
    // Remove visual mesh
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
    
    // Remove physics body and collider
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
    
    console.log(`Remote player ${this.id} destroyed`);
  }
}

export class PlayerManager {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.players = new Map();
    this.localPlayerId = null;
  }

  setLocalPlayerId(id) {
    this.localPlayerId = id;
  }

  addPlayer(id, initialPosition = new THREE.Vector3(0, 35, 0), initialRotation = null) {
    if (id === this.localPlayerId) {
      console.log(`Not adding local player ${id} as remote player`);
      return;
    }
    
    if (this.players.has(id)) {
      console.log(`Player ${id} already exists, not adding again`);
      return;
    }
    
    console.log(`Adding remote player: ${id} at position:`, initialPosition);
    const player = new RemotePlayer(id, this.scene, this.physics, initialPosition);
    
    // Set initial rotation if provided
    if (initialRotation) {
      player.updateState({
        rotation: initialRotation
      });
    }
    
    this.players.set(id, player);
    console.log(`Added player, current count: ${this.players.size}`);
    
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (player) {
      console.log(`Removing remote player: ${id}`);
      player.destroy();
      this.players.delete(id);
    }
  }

  updatePlayer(id, state) {
    const player = this.players.get(id);
    if (player) {
      player.updateState(state);
    }
  }

  update(deltaTime) {
    // Update all remote players
    this.players.forEach(player => {
      player.update(deltaTime);
    });
  }

  clear() {
    // Remove all players
    this.players.forEach(player => {
      player.destroy();
    });
    this.players.clear();
  }

  getPlayerCount() {
    return this.players.size;
  }

  offsetAllPlayers(offset) {
    // Offset all remote players by the given amount
    this.players.forEach(player => {
      if (player.body && player.mesh) {
        const currentPos = player.body.translation();
        player.body.setTranslation({
          x: currentPos.x + offset.x,
          y: currentPos.y + offset.y,
          z: currentPos.z + offset.z
        });
        
        player.targetPosition.add(offset);
      }
    });
  }

  updateAllPositionsForNewOrigin() {
    // This would be called when server tells us our origin has changed
    // Remote player positions are already relative to our origin from server
    console.log('Updating all player positions for new origin');
  }
}
