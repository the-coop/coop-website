import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createPlayerModel, createWeaponModel, createNameTag } from '../models/player.js';

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
    
    // Add physics simulation flag
    this.enablePhysics = true;

    // Create the player
    this.create(initialPosition);
  }

  create(position) {
    // Check if physics world is ready
    if (!this.physics.world) {
      console.error('Physics world not initialized for remote player creation');
      return;
    }
    
    // Create dynamic physics body for network players
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.1,
      angularDamping: 1.0,
      canSleep: false,
      lockRotations: true
    });
    
    // Create capsule collider matching local player
    const colliderDesc = this.physics.RAPIER.ColliderDesc.capsule(
      this.height / 2 - this.radius,
      this.radius
    )
    .setFriction(0.0)
    .setRestitution(0.0)
    .setDensity(1.0)
    .setActiveCollisionTypes(this.physics.RAPIER.ActiveCollisionTypes.DEFAULT)
    .setActiveEvents(this.physics.RAPIER.ActiveEvents.COLLISION_EVENTS);
    
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
    if (!this.body) return;
    
    const currentPos = this.body.translation();
    const playerPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    
    // Calculate gravity direction
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    // Cast ray downward from feet
    const rayOrigin = playerPos.clone();
    rayOrigin.add(gravityDir.clone().multiplyScalar(-this.height * 0.5));
    
    const maxRayDistance = 0.3;
    const hit = this.physics.castRay(rayOrigin, gravityDir, maxRayDistance, this.colliderHandle);
    
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
    if (!this.mesh || !this.body) return;
    
    // Store server state
    this.lastServerPosition.set(state.position.x, state.position.y, state.position.z);
    this.targetPosition.copy(this.lastServerPosition);
    
    if (state.rotation) {
      this.lastServerRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
      this.targetRotation.copy(this.lastServerRotation);
    }
    
    if (state.velocity) {
      this.lastServerVelocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
      this.targetVelocity.copy(this.lastServerVelocity);
    }
    
    // Don't directly set position/rotation for dynamic bodies
    // Let physics simulation handle it with velocity
    if (state.velocity) {
      this.body.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
    
    // Update grounded state
    if (state.isGrounded !== undefined) {
      this.isGrounded = state.isGrounded;
    }
    
    // Update swimming state
    if (state.isSwimming !== undefined) {
      this.isSwimming = state.isSwimming;
    }
    
    // Update weapon model if it changed
    if (state.weapon && state.weapon !== this.currentWeapon) {
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
    
    // Don't show anything if no weapon
    if (!weaponName) return;
    
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
    if (!this.mesh || !this.body) return;
    
    // Get current physics state
    const currentPos = this.body.translation();
    const currentVel = this.body.linvel();
    
    // Calculate gravity direction from current position
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z))
      .normalize();
    
    const gravityStrength = this.physics.gravity.strength;
    
    // Apply gravity force
    if (!this.isGrounded && !this.isSwimming) {
      // Apply gravity as acceleration
      const gravityAccel = gravityDir.multiplyScalar(gravityStrength);
      
      this.body.setLinvel({
        x: currentVel.x + gravityAccel.x * deltaTime,
        y: currentVel.y + gravityAccel.y * deltaTime,
        z: currentVel.z + gravityAccel.z * deltaTime
      });
    }
    
    // Update mesh position from physics body
    this.mesh.position.set(currentPos.x, currentPos.y, currentPos.z);
    
    // Update rotation if we have a target
    const currentRot = this.body.rotation();
    if (this.targetRotation) {
      const currentQuat = new THREE.Quaternion(currentRot.x, currentRot.y, currentRot.z, currentRot.w);
      currentQuat.slerp(this.targetRotation, 0.1);
      
      this.body.setRotation({
        x: currentQuat.x,
        y: currentQuat.y,
        z: currentQuat.z,
        w: currentQuat.w
      });
      
      this.mesh.quaternion.copy(currentQuat);
    }
    
    // Update mesh matrix
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
    
    // Update name tag position if it exists
    if (this.nameTag) {
      this.nameTag.position.copy(this.mesh.position);
      this.nameTag.position.y += this.height + 0.5;
      
      // Make name tag face camera
      if (this.scene.camera) {
        this.nameTag.lookAt(this.scene.camera.position);
      }
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
    // Prevent duplicate players
    if (this.players.has(id)) {
      console.warn(`Player ${id} already exists, skipping creation`);
      return this.players.get(id);
    }
    
    // Don't create a remote player for the local player
    if (id === this.localPlayerId) {
      console.warn(`Attempting to create remote player for local player ${id}, skipping`);
      return null;
    }
    
    console.log(`Adding new player: ${id} at position:`, initialPosition);
    
    const player = new RemotePlayer(id, this.scene, this.physics, initialPosition);
    player.create(initialPosition);
    
    if (initialRotation) {
      player.mesh.quaternion.set(
        initialRotation.x,
        initialRotation.y,
        initialRotation.z,
        initialRotation.w
      );
    }
    
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    
    console.log(`Removing player: ${id}`);
    player.destroy();
    this.players.delete(id);
  }

  updatePlayer(id, state) {
    // Don't update local player
    if (id === this.localPlayerId) return;
    
    const player = this.players.get(id);
    if (!player) {
      console.warn(`Player ${id} not found for update`);
      return;
    }
    
    player.updateState(state);
  }

  update(deltaTime) {
    // Update all remote players
    this.players.forEach((player, id) => {
      if (id !== this.localPlayerId) {
        player.update(deltaTime);
      }
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
    if (!player || playerId === this.localPlayerId) return;
    
    player.updateState(state);
  }

  updateAllNetworkPlayers(deltaTime) {
    // This method is now redundant since update() handles it
    // But keep it for compatibility
    this.update(deltaTime);
  }
}
