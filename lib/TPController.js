import * as THREE from 'three';

export class TPController {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.isActive = false;
    
    // Camera settings
    this.distance = 15;
    this.height = 5;
    this.verticalAngle = 0; // Pitch angle
    this.smoothness = 0.1; // Camera smoothing factor
    
    // Mouse control
    this.mouseSensitivity = 0.002;
    this.verticalSensitivity = 0.001;
    
    // Vertical angle limits
    this.minVerticalAngle = -Math.PI / 3; // -60 degrees
    this.maxVerticalAngle = Math.PI / 3;   // 60 degrees
    
    // Camera smoothing
    this.currentCameraPos = new THREE.Vector3();
    this.targetCameraPos = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this.targetLookAt = new THREE.Vector3();
    
    // Original camera parent reference
    this.originalParent = null;
    this.originalCameraPos = new THREE.Vector3();
    this.originalCameraRot = new THREE.Euler();
    
    // Collision detection for camera
    this.cameraCollisionDistance = 1.0;
  }

  activate() {
    if (this.isActive || !this.player.mesh || !this.scene.camera) return;
    
    // Store original camera state
    this.originalCameraPos.copy(this.scene.camera.position);
    this.originalCameraRot.copy(this.scene.camera.rotation);
    
    // Remove from player and add to scene
    this.originalParent = this.scene.camera.parent;
    if (this.originalParent) {
      this.originalParent.remove(this.scene.camera);
    }
    this.scene.scene.add(this.scene.camera);
    
    // Reset vertical angle
    this.verticalAngle = 0;
    
    // Initialize camera position for smooth transition
    const playerWorldPos = new THREE.Vector3();
    this.player.mesh.getWorldPosition(playerWorldPos);
    
    // Set initial positions behind player
    const playerQuat = new THREE.Quaternion(
      this.player.body.rotation().x,
      this.player.body.rotation().y,
      this.player.body.rotation().z,
      this.player.body.rotation().w
    );
    
    const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerQuat);
    this.currentCameraPos.copy(playerWorldPos)
      .add(backward.multiplyScalar(this.distance))
      .add(new THREE.Vector3(0, this.height, 0));
    
    this.currentLookAt.copy(playerWorldPos);
    this.scene.camera.position.copy(this.currentCameraPos);
    this.scene.camera.lookAt(this.currentLookAt);
    
    // Set initial camera position
    this.updateCameraPosition();
    
    this.isActive = true;
    console.log("Third-person camera activated");
  }

  deactivate() {
    if (!this.isActive || !this.player.mesh || !this.scene.camera) return;
    
    // Remove from scene
    this.scene.scene.remove(this.scene.camera);
    
    // Add back to player
    this.player.mesh.add(this.scene.camera);
    
    // Reset camera position relative to player
    this.scene.camera.position.copy(this.originalCameraPos);
    this.scene.camera.rotation.copy(this.originalCameraRot);
    
    this.isActive = false;
    console.log("Third-person camera deactivated");
  }

  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  handleMouseMove(event) {
    if (!this.isActive || !this.player.body) return;
    
    // Get current player quaternion
    const currentPlayerQuat = new THREE.Quaternion(
      this.player.body.rotation().x,
      this.player.body.rotation().y,
      this.player.body.rotation().z,
      this.player.body.rotation().w
    );
    
    if (this.player.isGrounded) {
      // When grounded - only rotate yaw
      const yawDelta = -event.movementX * this.mouseSensitivity;
      
      // Use the player's up direction (from last ground normal)
      let upVector = this.player.lastGroundNormal.clone();
      if (upVector.lengthSq() < 0.1) {
        upVector = this.player.getUpDirection();
      }
      
      // Apply yaw rotation to player
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, yawDelta);
      currentPlayerQuat.premultiply(yawQuat);
      
      // Update vertical angle for camera only
      this.verticalAngle -= event.movementY * this.verticalSensitivity;
      this.verticalAngle = Math.max(
        this.minVerticalAngle,
        Math.min(this.maxVerticalAngle, this.verticalAngle)
      );
    } else {
      // When airborne - full quaternion rotation (6DOF)
      // Get player's local axes
      const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentPlayerQuat);
      
      // Pitch rotation around local right axis
      const pitchDelta = -event.movementY * this.verticalSensitivity;
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, pitchDelta);
      
      // Yaw rotation around local up axis for true 6DOF
      const yawDelta = -event.movementX * this.mouseSensitivity;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(localUp, yawDelta);
      
      // Apply both rotations
      currentPlayerQuat.premultiply(pitchQuat);
      currentPlayerQuat.premultiply(yawQuat);
      
      // Reset vertical angle since player is rotating
      this.verticalAngle = 0;
    }
    
    // Set the new rotation
    this.player.body.setRotation({
      x: currentPlayerQuat.x,
      y: currentPlayerQuat.y,
      z: currentPlayerQuat.z,
      w: currentPlayerQuat.w
    });
  }

  checkCameraCollision(targetPos, playerPos) {
    if (!this.player.physics) return targetPos;
    
    // Cast ray from player to camera position
    const direction = new THREE.Vector3().subVectors(targetPos, playerPos).normalize();
    const distance = targetPos.distanceTo(playerPos);
    
    const hit = this.player.physics.castRay(
      playerPos,
      direction,
      distance,
      this.player.colliderHandle
    );
    
    if (hit && hit.toi > 0) {
      // Move camera closer to avoid collision
      const safeDistance = Math.max(hit.toi - this.cameraCollisionDistance, 3.0);
      return playerPos.clone().add(direction.multiplyScalar(safeDistance));
    }
    
    return targetPos;
  }

  updateCameraPosition() {
    if (!this.isActive || !this.scene.camera || !this.player.mesh || !this.player.body) return;
    
    // Get player's world position
    const playerWorldPos = new THREE.Vector3();
    this.player.mesh.getWorldPosition(playerWorldPos);
    
    // Get player's quaternion
    const playerQuat = new THREE.Quaternion(
      this.player.body.rotation().x,
      this.player.body.rotation().y,
      this.player.body.rotation().z,
      this.player.body.rotation().w
    );
    
    // Get player's local axes
    const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(playerQuat);
    
    // If grounded, use the surface normal as up
    if (this.player.isGrounded && this.player.lastGroundNormal.lengthSq() > 0.1) {
      const surfaceUp = this.player.lastGroundNormal.clone();
      
      // Recalculate forward to be perpendicular to surface
      const right = new THREE.Vector3().crossVectors(playerForward, surfaceUp).normalize();
      playerForward.crossVectors(surfaceUp, right).normalize();
      playerUp.copy(surfaceUp);
    }
    
    // Calculate camera offset based on vertical angle
    const horizontalDistance = this.distance * Math.cos(this.verticalAngle);
    const verticalOffset = this.distance * Math.sin(this.verticalAngle);
    
    // Position camera behind and above player
    this.targetCameraPos
      .copy(playerWorldPos)
      .addScaledVector(playerForward, -horizontalDistance)
      .addScaledVector(playerUp, this.height + verticalOffset);
    
    // Check for collisions
    const safePos = this.checkCameraCollision(this.targetCameraPos, playerWorldPos);
    this.targetCameraPos.copy(safePos);
    
    // Look at point slightly above player center
    this.targetLookAt
      .copy(playerWorldPos)
      .addScaledVector(playerUp, this.height * 0.3);
    
    // Smooth camera movement
    this.currentCameraPos.lerp(this.targetCameraPos, this.smoothness);
    this.currentLookAt.lerp(this.targetLookAt, this.smoothness * 2); // Faster look-at smoothing
    
    // Apply to camera
    this.scene.camera.position.copy(this.currentCameraPos);
    this.scene.camera.lookAt(this.currentLookAt);
  }

  update() {
    if (!this.isActive) return;
    this.updateCameraPosition();
  }
}
