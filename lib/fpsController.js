import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PlaneController } from './planeController.js';
import { WeaponSystem } from './weaponSystem.js';

export class FPSController {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    
    // Player properties
    this.height = 1.8;
    this.radius = 0.4;
    this.walkSpeed = 5.0;
    this.runSpeed = 10.0;
    this.jumpVelocity = 8.0;
    this.swimSpeed = 3.0;
    
    // State
    this.isGrounded = false;
    this.isSwimming = false;
    this.isOnLadder = false;
    this.isInVehicle = false;
    this.isMoving = false;
    this.currentSpeed = 0;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    
    // Movement
    this.moveVector = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    
    // Camera
    this.camera = null;
    this.pitch = 0;
    this.yaw = 0;
    this.mouseSensitivity = 0.002;
    
    // Physics
    this.body = null;
    this.collider = null;
    this.colliderHandle = null;
    
    // Mesh
    this.mesh = null;
    
    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      run: false
    };
    
    // Vehicle state
    this.currentVehicle = null;
    
    // Ladder state
    this.currentLadder = null;
    
    // Weapon system
    this.weaponSystem = null;
    this.weaponMesh = null;
    this.weaponOffset = new THREE.Vector3();
    this.weaponRotation = new THREE.Euler();
    
    // Third person weapon display
    this.thirdPersonWeaponMesh = null;
  }
  
  create(position) {
    // Create physics body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.1,
      angularDamping: 1.0,
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
      color: 0x0066cc,
      roughness: 0.7,
      metalness: 0.1
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Create camera
    this.camera = this.scene.camera;
    if (this.camera) {
      this.mesh.add(this.camera);
      this.camera.position.set(0, this.height * 0.8, 0);
    }
    
    // Create weapon system
    this.weaponSystem = new WeaponSystem(this.scene, this.physics);
    
    // Attach initial weapon (hands) to camera
    this.updateWeaponDisplay();
    
    console.log('FPS Controller created at', position);
  }
  
  updateWeaponDisplay() {
    // Remove old weapon mesh
    if (this.weaponMesh) {
      this.camera.remove(this.weaponMesh);
      this.weaponMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.weaponMesh = null;
    }
    
    if (this.thirdPersonWeaponMesh) {
      this.mesh.remove(this.thirdPersonWeaponMesh);
      this.thirdPersonWeaponMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      this.thirdPersonWeaponMesh = null;
    }
    
    // Get current weapon model
    const weaponModel = this.weaponSystem.getCurrentWeaponModel();
    if (!weaponModel) return;
    
    const weaponInfo = this.weaponSystem.getCurrentWeaponInfo();
    
    // First person weapon (attached to camera)
    this.weaponMesh = weaponModel.clone();
    this.weaponMesh.position.copy(weaponInfo.holdOffset);
    this.weaponMesh.rotation.copy(weaponInfo.holdRotation);
    this.camera.add(this.weaponMesh);
    
    // Third person weapon (visible to others)
    this.thirdPersonWeaponMesh = weaponModel.clone();
    // Position it as if held in right hand
    this.thirdPersonWeaponMesh.position.set(0.2, 0.5, -0.2);
    this.thirdPersonWeaponMesh.rotation.copy(weaponInfo.holdRotation);
    this.thirdPersonWeaponMesh.scale.setScalar(1.2); // Slightly larger for visibility
    this.mesh.add(this.thirdPersonWeaponMesh);
  }
  
  checkNearbyWeaponPickup() {
    if (!this.scene || !this.body || !this.weaponSystem) return null;
    
    const playerPos = this.getPosition();
    let nearestPickup = null;
    let nearestDistance = 3.0; // Interaction range for weapons
    
    // Check all weapon pickups
    this.weaponSystem.weaponPickups.forEach((pickup, id) => {
      const distance = playerPos.distanceTo(pickup.position);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPickup = pickup;
      }
    });
    
    return nearestPickup;
  }
  
  tryPickupWeapon() {
    const nearbyPickup = this.checkNearbyWeaponPickup();
    if (!nearbyPickup) return false;
    
    if (this.weaponSystem.pickupWeapon(nearbyPickup.id, this)) {
      this.updateWeaponDisplay();
      return true;
    }
    
    return false;
  }
  
  switchWeapon(slot) {
    if (!this.weaponSystem) return false;
    
    if (this.weaponSystem.switchToSlot(slot)) {
      this.updateWeaponDisplay();
      return true;
    }
    
    return false;
  }
  
  fireWeapon() {
    if (!this.weaponSystem) return false;
    
    return this.weaponSystem.fire();
  }
  
  reloadWeapon() {
    if (!this.weaponSystem) return false;
    
    return this.weaponSystem.reload();
  }
  
  handleMouseMove(event) {
    if (!document.pointerLockElement) return;
    
    // Update yaw and pitch
    this.yaw -= event.movementX * this.mouseSensitivity;
    this.pitch -= event.movementY * this.mouseSensitivity;
    
    // Clamp pitch
    this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    
    // Apply rotation to body (yaw only)
    if (this.body) {
      const quat = new THREE.Quaternion();
      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.body.setRotation({
        x: quat.x,
        y: quat.y,
        z: quat.z,
        w: quat.w
      });
    }
    
    // Apply pitch to camera
    if (this.camera) {
      this.camera.rotation.x = this.pitch;
    }
  }
  
  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Update weapon system
    if (this.weaponSystem) {
      this.weaponSystem.updatePickups(deltaTime);
    }
    
    // Check swimming state
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    this.isSwimming = this.physics.isPositionInWater(playerPos);
    
    // Check grounded state
    this.checkGrounded();
    
    // Apply movement
    this.updateMovement(deltaTime);
    
    // Apply physics
    if (!this.isSwimming) {
      this.physics.applyGravityToBody(this.body, deltaTime);
    }
    
    // Update visual position
    const pos = this.body.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    
    // Update visual rotation
    const rot = this.body.rotation();
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }
  
  updateMovement(deltaTime) {
    // Calculate movement direction
    this.moveVector.set(0, 0, 0);
    
    if (this.keys.forward) this.moveVector.z -= 1;
    if (this.keys.backward) this.moveVector.z += 1;
    if (this.keys.left) this.moveVector.x -= 1;
    if (this.keys.right) this.moveVector.x += 1;
    
    if (this.moveVector.length() > 0) {
      this.moveVector.normalize();
      this.isMoving = true;
      
      // Apply rotation to movement
      this.moveVector.applyQuaternion(this.mesh.quaternion);
      
      // Set speed
      this.currentSpeed = this.keys.run ? this.runSpeed : this.walkSpeed;
      if (this.isSwimming) this.currentSpeed = this.swimSpeed;
      
      // Apply movement
      const movement = this.moveVector.multiplyScalar(this.currentSpeed * deltaTime * 50);
      this.body.applyImpulse({
        x: movement.x,
        y: 0,
        z: movement.z
      });
    } else {
      this.isMoving = false;
      this.currentSpeed = 0;
    }
    
    // Apply drag
    const vel = this.body.linvel();
    const dragForce = this.isSwimming ? 5 : 10;
    this.body.applyImpulse({
      x: -vel.x * dragForce * deltaTime,
      y: 0,
      z: -vel.z * dragForce * deltaTime
    });
  }
  
  checkGrounded() {
    if (!this.collider || !this.body) return;
    
    const result = this.physics.checkGrounded(
      this.body,
      this.colliderHandle,
      this.height,
      this.radius
    );
    
    if (result) {
      this.isGrounded = result.isGrounded;
      if (result.surfaceNormal) {
        this.lastGroundNormal = result.surfaceNormal;
      }
    }
  }
  
  tryJump() {
    if (!this.isGrounded || this.isSwimming) return;
    
    this.body.applyImpulse({
      x: 0,
      y: this.jumpVelocity * this.body.mass(),
      z: 0
    });
  }
  
  tryEnterVehicle() {
    // Implementation depends on vehicle system
    console.log('Try enter vehicle - not implemented');
  }
  
  exitVehicle() {
    // Implementation depends on vehicle system
    console.log('Exit vehicle - not implemented');
  }
  
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
  
  getFacing() {
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.mesh.quaternion);
    return forward;
  }
  
  getNetworkState() {
    if (!this.body) return null;
    
    const pos = this.body.translation();
    const rot = this.body.rotation();
    const vel = this.body.linvel();
    
    // Add weapon state
    const weaponState = this.weaponSystem ? this.weaponSystem.getInventoryState() : null;
    
    return {
      position: { x: pos.x, y: pos.y, z: pos.z },
      rotation: { x: rot.x, y: rot.y, z: rot.z, w: rot.w },
      velocity: { x: vel.x, y: vel.y, z: vel.z },
      isGrounded: this.isGrounded,
      isInVehicle: this.isInVehicle,
      isOnLadder: this.isOnLadder,
      isSwimming: this.isSwimming,
      vehicleId: this.currentVehicle?.objectId || this.currentVehicle?.id,
      ladderId: this.currentLadder?.id,
      weaponState: weaponState
    };
  }
  
  updateWeaponFromNetwork(weaponState) {
    if (!this.weaponSystem || !weaponState) return;
    
    // Update inventory
    weaponState.slots.forEach((slot, index) => {
      this.weaponSystem.inventory[index] = slot;
    });
    
    // Switch to current slot
    if (this.weaponSystem.currentSlot !== weaponState.currentSlot) {
      this.weaponSystem.switchToSlot(weaponState.currentSlot);
      this.updateWeaponDisplay();
    }
  }
  
  dispose() {
    if (this.weaponMesh) {
      this.camera.remove(this.weaponMesh);
      this.weaponMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    if (this.thirdPersonWeaponMesh) {
      this.mesh.remove(this.thirdPersonWeaponMesh);
      this.thirdPersonWeaponMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    if (this.weaponSystem) {
      this.weaponSystem.clear();
    }
    
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
    
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
  }
}
