import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class TPController {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    
    // Camera settings
    this.cameraDistance = 8;
    this.cameraHeight = 4;
    this.cameraLookAheadDistance = 2;
    this.cameraSmoothness = 0.1;
    
    // Player properties
    this.height = 1.8;
    this.radius = 0.4;
    this.moveSpeed = 5.0;
    this.runSpeed = 10.0;
    this.jumpVelocity = 8.0;
    
    // State
    this.isGrounded = false;
    this.isMoving = false;
    this.isRunning = false;
    this.currentSpeed = 0;
    
    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      run: false
    };
    
    // Movement
    this.moveDirection = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    
    // Camera
    this.cameraTarget = new THREE.Vector3();
    this.cameraOffset = new THREE.Vector3();
    
    // Physics
    this.body = null;
    this.collider = null;
    
    // Mesh
    this.mesh = null;
    
    // Mouse look
    this.horizontalRotation = 0;
    this.verticalRotation = 0;
    this.mouseSensitivity = 0.002;
  }
  
  create(position) {
    // Create physics body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.95,
      angularDamping: 1.0,
      lockRotations: true
    });
    
    // Create collider
    const colliderDesc = this.physics.createCapsuleCollider(
      this.height / 2 - this.radius,
      this.radius,
      {
        friction: 0.5,
        restitution: 0.0,
        density: 1.0
      }
    );
    
    this.collider = this.physics.world.createCollider(colliderDesc, this.body);
    
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
    
    // Set up camera
    this.setupCamera();
    
    console.log('Third Person Controller created at', position);
  }
  
  setupCamera() {
    // Position camera behind and above player
    this.updateCameraPosition(0);
  }
  
  updateCameraPosition(deltaTime) {
    if (!this.scene.camera || !this.mesh) return;
    
    const playerPos = this.mesh.position;
    
    // Calculate desired camera position based on player rotation
    const cameraOffsetX = Math.sin(this.horizontalRotation) * this.cameraDistance;
    const cameraOffsetZ = Math.cos(this.horizontalRotation) * this.cameraDistance;
    
    const desiredCameraPos = new THREE.Vector3(
      playerPos.x + cameraOffsetX,
      playerPos.y + this.cameraHeight,
      playerPos.z + cameraOffsetZ
    );
    
    // Smooth camera movement
    this.scene.camera.position.lerp(desiredCameraPos, this.cameraSmoothness);
    
    // Look at a point slightly ahead of the player
    const lookTarget = new THREE.Vector3(
      playerPos.x - Math.sin(this.horizontalRotation) * this.cameraLookAheadDistance,
      playerPos.y + this.height * 0.5,
      playerPos.z - Math.cos(this.horizontalRotation) * this.cameraLookAheadDistance
    );
    
    this.scene.camera.lookAt(lookTarget);
  }
  
  handleMouseMove(event) {
    if (!document.pointerLockElement) return;
    
    // Update rotation based on mouse movement
    this.horizontalRotation -= event.movementX * this.mouseSensitivity;
    this.verticalRotation -= event.movementY * this.mouseSensitivity;
    
    // Clamp vertical rotation
    this.verticalRotation = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.verticalRotation));
  }
  
  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Check grounded state
    this.checkGrounded();
    
    // Calculate movement
    this.updateMovement(deltaTime);
    
    // Apply physics
    this.applyPhysics(deltaTime);
    
    // Update visual position
    const pos = this.body.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    
    // Update mesh rotation to face movement direction
    if (this.isMoving) {
      const targetRotation = Math.atan2(
        this.moveDirection.x,
        this.moveDirection.z
      );
      
      // Smoothly rotate mesh
      const currentRotation = this.mesh.rotation.y;
      let rotationDiff = targetRotation - currentRotation;
      
      // Normalize rotation difference to [-PI, PI]
      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
      
      this.mesh.rotation.y += rotationDiff * 0.1;
    }
    
    // Update camera
    this.updateCameraPosition(deltaTime);
  }
  
  updateMovement(deltaTime) {
    // Reset movement
    this.moveDirection.set(0, 0, 0);
    
    // Calculate movement direction based on camera orientation
    const forward = new THREE.Vector3(
      -Math.sin(this.horizontalRotation),
      0,
      -Math.cos(this.horizontalRotation)
    );
    const right = new THREE.Vector3(
      Math.cos(this.horizontalRotation),
      0,
      -Math.sin(this.horizontalRotation)
    );
    
    // Apply input
    if (this.keys.forward) this.moveDirection.add(forward);
    if (this.keys.backward) this.moveDirection.sub(forward);
    if (this.keys.left) this.moveDirection.sub(right);
    if (this.keys.right) this.moveDirection.add(right);
    
    // Normalize and apply speed
    if (this.moveDirection.length() > 0) {
      this.moveDirection.normalize();
      this.isMoving = true;
      this.isRunning = this.keys.run;
      this.currentSpeed = this.isRunning ? this.runSpeed : this.moveSpeed;
    } else {
      this.isMoving = false;
      this.currentSpeed = 0;
    }
  }
  
  applyPhysics(deltaTime) {
    if (!this.body) return;
    
    // Get current velocity
    const vel = this.body.linvel();
    
    // Apply movement
    if (this.isMoving) {
      this.body.applyImpulse({
        x: this.moveDirection.x * this.currentSpeed * deltaTime * 50,
        y: 0,
        z: this.moveDirection.z * this.currentSpeed * deltaTime * 50
      });
    }
    
    // Apply drag
    this.body.applyImpulse({
      x: -vel.x * 10 * deltaTime,
      y: 0,
      z: -vel.z * 10 * deltaTime
    });
    
    // Jump
    if (this.keys.jump && this.isGrounded) {
      this.body.applyImpulse({
        x: 0,
        y: this.jumpVelocity * this.body.mass(),
        z: 0
      });
    }
  }
  
  checkGrounded() {
    if (!this.collider || !this.body) return;
    
    const position = this.body.translation();
    const rayOrigin = new THREE.Vector3(position.x, position.y, position.z);
    const rayDir = new THREE.Vector3(0, -1, 0);
    const maxDistance = 0.1;
    
    const hit = this.physics.castRay(
      rayOrigin,
      rayDir,
      maxDistance,
      this.collider.handle
    );
    
    this.isGrounded = hit !== null;
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
    return new THREE.Vector3(
      -Math.sin(this.mesh.rotation.y),
      0,
      -Math.cos(this.mesh.rotation.y)
    );
  }
  
  tryJump() {
    // Jump is handled in applyPhysics
  }
  
  dispose() {
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
