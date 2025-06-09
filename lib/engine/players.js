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

    // Add gravity and alignment state
    this.gravityCenter = new THREE.Vector3(0, -250, 0); // Match server gravity center
    this.surfaceNormal = new THREE.Vector3(0, 1, 0);
    this.alignedUp = new THREE.Vector3(0, 1, 0);
    
    // Create the player
    this.create(initialPosition);
  }

  create(position) {
    // Check if physics world is ready
    if (!this.physics.world) {
      console.error('Physics world not ready for remote player creation');
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
    
    // Set initial position for mesh
    this.mesh.position.copy(position);
    
    // Add name tag
    this.createNameTag();
    
    // Force initial update to sync visual with physics
    this.update(0);
    
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
    
    // Calculate gravity direction - use physics gravity center
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    // Cast ray downward from feet in gravity direction
    const rayOrigin = playerPos.clone();
    const footOffset = gravityDir.clone().multiplyScalar(-this.height * 0.5);
    rayOrigin.add(footOffset);
    
    const maxRayDistance = 0.3;
    const hit = this.physics.castRay(rayOrigin, gravityDir, maxRayDistance, this.colliderHandle);
    
    this.isGrounded = hit !== null;
    
    if (hit && hit.normal) {
      this.lastGroundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    } else if (!this.isGrounded) {
      // When not grounded, use gravity-based up
      this.lastGroundNormal.copy(gravityDir.clone().multiplyScalar(-1));
    }
    
    return this.isGrounded;
  }

  alignToSurface(gravityDirection) {
    if (!this.isGrounded || !this.body) return;
    
    // Check if we're in multiplayer or sandbox mode
    const shouldAlignToPlanet = this.scene.gameMode === 'multiplayer' || this.scene.gameMode === 'sandbox';
    
    if (!shouldAlignToPlanet) {
      // For other modes, don't align remote players to surface
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
    this.alignedUp.copy(desiredUp);
    
    // Get current forward direction
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentQuat);
    
    // Project forward onto plane perpendicular to desired up
    const projectedForward = currentForward.clone()
      .sub(desiredUp.clone().multiplyScalar(currentForward.dot(desiredUp)))
      .normalize();
    
    if (projectedForward.lengthSq() < 0.1) {
      // Use a fallback forward
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
    
    // Smooth interpolation
    const lerpFactor = 0.15;
    currentQuat.slerp(targetQuat, lerpFactor);
    
    // Apply the rotation
    this.body.setRotation({
      x: currentQuat.x,
      y: currentQuat.y,
      z: currentQuat.z,
      w: currentQuat.w
    });
    
    this.mesh.quaternion.copy(currentQuat);
  }

  updateState(state) {
    if (!state) return;
    
    // Update target values for interpolation
    if (state.position) {
      this.targetPosition.set(state.position.x, state.position.y, state.position.z);
      
      // Store as last known server position
      this.lastServerPosition.copy(this.targetPosition);
    }
    
    if (state.rotation) {
      this.targetRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
      this.lastServerRotation.copy(this.targetRotation);
    }
    
    if (state.velocity) {
      this.targetVelocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
      this.lastServerVelocity.copy(this.targetVelocity);
    }
    
    // Update grounded and swimming states from server
    if (state.isGrounded !== undefined) {
      this.isGrounded = state.isGrounded;
    }
    
    if (state.isSwimming !== undefined) {
      this.isSwimming = state.isSwimming;
    }
    
    // Update physics body immediately for better synchronization
    if (this.body && this.enablePhysics) {
      // Set position directly for more accurate updates
      this.body.setTranslation({
        x: this.targetPosition.x,
        y: this.targetPosition.y,
        z: this.targetPosition.z
      });
      
      // Set rotation
      this.body.setRotation({
        x: this.targetRotation.x,
        y: this.targetRotation.y,
        z: this.targetRotation.z,
        w: this.targetRotation.w
      });
      
      // Set velocity
      this.body.setLinvel({
        x: this.targetVelocity.x,
        y: this.targetVelocity.y,
        z: this.targetVelocity.z
      });
    }
    
    // Update weapon if provided
    if (state.currentWeapon !== undefined) {
      this.updateWeaponModel(state.currentWeapon);
    }
    
    // Update last update time
    this.lastUpdateTime = performance.now();
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
    if (!this.body || !this.mesh) return;
    
    // Get current physics state
    const currentPos = this.body.translation();
    const playerPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    
    // Check grounded state with proper gravity
    this.checkGrounded();
    
    // Get gravity direction for alignment
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    // Apply gravity based on swimming state from server
    if (!this.isGrounded && !this.isSwimming) {
      const currentVel = this.body.linvel();
      const gravityStrength = this.physics.gravity.strength || 25.0;
      const gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * deltaTime);
      
      this.body.setLinvel({
        x: currentVel.x + gravityForce.x,
        y: currentVel.y + gravityForce.y,
        z: currentVel.z + gravityForce.z
      });
    }
    
    // Apply surface alignment if grounded
    if (this.isGrounded) {
      this.alignToSurface(gravityDir);
      
      // Apply friction when grounded
      const currentVel = this.body.linvel();
      this.body.setLinvel({
        x: currentVel.x * 0.9,
        y: currentVel.y * 0.95,
        z: currentVel.z * 0.9
      });
    }
    
    // For swimming, apply buoyancy (trust server state)
    if (this.isSwimming) {
      const currentVel = this.body.linvel();
      const mass = this.body.mass();
      const buoyancyForce = gravityDir.clone().multiplyScalar(-this.physics.gravity.strength * 0.3 * mass * deltaTime);
      
      this.body.applyImpulse({
        x: buoyancyForce.x,
        y: buoyancyForce.y,
        z: buoyancyForce.z
      });
      
      // Apply water drag
      this.body.setLinvel({
        x: currentVel.x * 0.85,
        y: currentVel.y * 0.85,
        z: currentVel.z * 0.85
      });
    }
    
    // Update visual mesh to match physics body
    const pos = this.body.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    
    const rot = this.body.rotation();
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
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
    if (this.players.has(id)) {
      console.warn(`Player ${id} already exists`);
      return;
    }
    
    console.log(`Adding remote player ${id} at position:`, initialPosition);
    
    const player = new RemotePlayer(id, this.scene, this.physics, initialPosition);
    this.players.set(id, player);
    
    // If we have an initial rotation, update it
    if (initialRotation) {
      player.updateState({
        position: initialPosition,
        rotation: initialRotation,
        velocity: new THREE.Vector3(),
        isGrounded: true,
        isSwimming: false
      });
    }
    
    console.log(`Remote player ${id} added. Total players: ${this.players.size}`);
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    
    console.log(`Removing player: ${id}`);
    player.destroy();
    this.players.delete(id);
  }

  updatePlayer(id, state) {
    const player = this.players.get(id);
    if (!player) {
      console.warn(`Trying to update non-existent player: ${id}`);
      return;
    }
    
    // Pass the full state to the player
    player.updateState(state);
  }

  update(deltaTime) {
    // Update all remote players
    for (const [id, player] of this.players) {
      if (id !== this.localPlayerId) {
        player.update(deltaTime);
      }
    }
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
    for (const [id, player] of this.players) {
      if (id !== this.localPlayerId) {
        player.update(deltaTime);
      }
    }
  }
}
