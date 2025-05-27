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
    
    // State interpolation
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Quaternion();
    this.interpolationFactor = 0.2;
    
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

  updateState(state) {
    if (!this.body || !this.mesh) return;
    
    // Update target position and rotation
    if (state.position) {
      this.targetPosition.set(state.position.x, state.position.y, state.position.z);
    }
    
    if (state.rotation) {
      this.targetRotation.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    }
    
    // Set velocity directly if provided
    if (state.velocity) {
      this.body.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
  }

  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Apply gravity
    this.physics.applyGravityToBody(this.body, deltaTime);
    
    // Interpolate position
    const currentPos = this.body.translation();
    const currentPosition = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
    
    // Calculate interpolated position
    const lerpedPosition = currentPosition.lerp(this.targetPosition, this.interpolationFactor);
    
    // Set body position
    this.body.setTranslation({
      x: lerpedPosition.x,
      y: lerpedPosition.y,
      z: lerpedPosition.z
    });
    
    // Update mesh position
    this.mesh.position.copy(lerpedPosition);
    
    // Interpolate rotation
    const currentQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    currentQuat.slerp(this.targetRotation, this.interpolationFactor);
    
    // Set body rotation
    this.body.setRotation({
      x: currentQuat.x,
      y: currentQuat.y,
      z: currentQuat.z,
      w: currentQuat.w
    });
    
    // Update mesh rotation
    this.mesh.quaternion.copy(currentQuat);
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
