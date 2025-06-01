import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createPlayerModel, createWeaponModel, createNameTag } from './models/player.js';

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
    
    // Add last known server state
    this.lastServerPosition = new THREE.Vector3();
    this.lastServerRotation = new THREE.Quaternion();
    this.lastServerVelocity = new THREE.Vector3();
    
    // Dynamic interpolation based on movement state
    this.baseInterpolationFactor = 0.2;
    this.interpolationFactor = this.baseInterpolationFactor;
    
    // Add prediction settings
    this.enablePrediction = true;
    this.predictionTime = 0.1; // 100ms prediction
    
    // Grounded state
    this.isGrounded = false;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    this.wasGrounded = false; // Track grounded state transitions
    
    // Network state tracking
    this.lastUpdateTime = performance.now();
    this.timeSinceLastUpdate = 0;
    
    // Weapon visualization
    this.currentWeapon = null;
    this.weaponModel = null;
    this.weaponOffset = new THREE.Vector3(0.3, -0.2, -0.4);
    
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
    
    // Create visual mesh using the model
    this.mesh = createPlayerModel(this.radius, this.height);
    this.scene.scene.add(this.mesh);
    
    // Add name tag
    this.createNameTag();
    
    console.log(`Remote player ${this.id} created at`, position);
  }

  createNameTag() {
    const nameTag = createNameTag(`Player ${this.id.substring(0, 8)}`);
    nameTag.position.y = this.height * 0.7;
    this.mesh.add(nameTag);
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
    
    // Store last server state
    if (state.position) {
      this.lastServerPosition.copy(this.targetPosition);
      this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    }
    
    if (state.rotation) {
      this.lastServerRotation.copy(this.targetRotation);
      this.targetRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    }
    
    // Update velocity
    if (state.velocity) {
      this.lastServerVelocity.copy(this.targetVelocity);
      this.targetVelocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
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
    const speed = this.targetVelocity.length();
    if (!this.isGrounded || this.isSwimming) {
      // Use faster interpolation when falling or swimming
      this.interpolationFactor = 0.4;
    } else if (speed > 5.0) {
      // Faster interpolation for running
      this.interpolationFactor = 0.3;
    } else {
      // Normal interpolation for walking/standing
      this.interpolationFactor = this.baseInterpolationFactor;
    }
    
    // Update weapon if provided
    if (state.weapon !== undefined && state.weapon !== this.currentWeapon) {
      this.updateWeaponModel(state.weapon);
    }
  }

  updateWeaponModel(weaponName) {
    // Remove previous weapon model
    if (this.weaponModel) {
      this.mesh.remove(this.weaponModel);
      if (this.weaponModel.geometry) this.weaponModel.geometry.dispose();
      if (this.weaponModel.material) this.weaponModel.material.dispose();
      this.weaponModel = null;
    }
    
    this.currentWeapon = weaponName;
    
    // Don't show anything for hands
    if (!weaponName || weaponName === 'hands') return;
    
    // Create weapon model
    this.weaponModel = createWeaponModel(weaponName);
    if (!this.weaponModel) return;
    
    // Attach to player mesh
    this.mesh.add(this.weaponModel);
    
    // Position at player's side/front
    this.weaponModel.position.copy(this.weaponOffset);
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
    
    // Clean up weapon model
    if (this.weaponModel) {
      if (this.weaponModel.geometry) this.weaponModel.geometry.dispose();
      if (this.weaponModel.material) this.weaponModel.material.dispose();
    }
    
    console.log(`Remote player ${this.id} destroyed`);
  }

  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Get gravity direction for this position
    const position = this.body.translation();
    const gravityDir = this.physics.getGravityDirection(position);
    
    // Check grounded state
    this.checkGrounded();
    
    // Align to surface if grounded
    if (this.isGrounded) {
      this.alignToSurface(gravityDir);
    }
    
    // Interpolate position
    const currentPos = this.body.translation();
    const current = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    
    // Calculate predicted position if enabled
    let targetPos = this.targetPosition.clone();
    if (this.enablePrediction && this.targetVelocity.length() > 0.1) {
      const predictionOffset = this.targetVelocity.clone().multiplyScalar(this.predictionTime);
      targetPos.add(predictionOffset);
    }
    
    // Smooth interpolation
    current.lerp(targetPos, this.interpolationFactor);
    
    // Update physics body position
    this.body.setTranslation({
      x: current.x,
      y: current.y,
      z: current.z
    });
    
    // Update visual mesh
    this.mesh.position.copy(current);
    
    // Interpolate rotation
    const currentRot = this.body.rotation();
    const currentQuat = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
    currentQuat.slerp(this.targetRotation, this.interpolationFactor);
    
    this.body.setRotation({
      x: currentQuat.x,
      y: currentQuat.y,
      z: currentQuat.z,
      w: currentQuat.w
    });
    
    this.mesh.quaternion.copy(currentQuat);
    
    // Update velocity for physics simulation
    this.currentVelocity.lerp(this.targetVelocity, this.interpolationFactor);
    this.body.setLinvel({
      x: this.currentVelocity.x,
      y: this.currentVelocity.y,
      z: this.currentVelocity.z
    });
    
    // Apply gravity if not grounded
    if (!this.isGrounded) {
      this.physics.applyGravityToBody(this.body, deltaTime);
    }
    
    // Update weapon position if exists
    if (this.weaponModel) {
      // Could add weapon sway or animation here
    }
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

  updateNetworkPlayer(playerId, state) {
    const player = this.players.get(playerId);
    if (!player) return;
    
    // Update swimming state if provided
    if (state.isSwimming !== undefined) {
      player.isSwimming = state.isSwimming;
    }
    
    // Update target position and rotation
    if (state.position) {
      player.targetPosition.set(state.position.x, state.position.y, state.position.z);
    }
    
    if (state.rotation) {
      player.targetRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    }
    
    // Update velocity
    if (state.velocity) {
      player.targetVelocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
      
      // For falling or fast movement, apply velocity directly to physics body
      const speed = player.targetVelocity.length();
      if (!state.isGrounded || speed > 5.0) {
        player.body.setLinvel({
          x: state.velocity.x,
          y: state.velocity.y,
          z: state.velocity.z
        });
      }
    }
    
    // Update grounded state from server
    if (state.isGrounded !== undefined) {
      player.isGrounded = state.isGrounded;
    }
  }

  updateAllNetworkPlayers(deltaTime) {
    for (const [playerId, player] of this.players) {
      if (!player.body) continue;
      
      // Check if player is swimming
      const pos = player.body.translation();
      const position = new THREE.Vector3(pos.x, pos.y, pos.z);
      const isInWater = this.physics.scene && this.physics.scene.isPositionInWater && 
                        this.physics.scene.isPositionInWater(position);
      
      // Update swimming state from network or physics
      if (isInWater || player.isSwimming) {
        player.isSwimming = true;
        
        // Apply buoyancy for swimming players
        const gravityDir = new THREE.Vector3()
          .subVectors(this.physics.gravity.center, position)
          .normalize();
        
        // Reset forces first
        player.body.resetForces(true);
        
        // Apply buoyancy
        const mass = player.body.mass();
        const buoyancyStrength = this.physics.gravity.strength * 0.3;
        const buoyancyForce = gravityDir.multiplyScalar(-buoyancyStrength * mass);
        
        player.body.applyImpulse({
          x: buoyancyForce.x * deltaTime,
          y: buoyancyForce.y * deltaTime,
          z: buoyancyForce.z * deltaTime
        });
        
        // Apply water drag
        const velocity = player.body.linvel();
        player.body.applyImpulse({
          x: -velocity.x * 3.0 * deltaTime,
          y: -velocity.y * 3.0 * deltaTime,
          z: -velocity.z * 3.0 * deltaTime
        });
      } else {
        player.isSwimming = false;
        // Apply normal gravity
        this.physics.applyGravityToBody(player.body, deltaTime);
      }
      
      // Apply movement forces
      this.physics.applyMovementForces(player.body, player.movement, player.isGrounded, deltaTime);
    }
  }
}
