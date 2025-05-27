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
    
    // Mouse control
    this.mouseSensitivity = 0.002;
    this.verticalSensitivity = 0.001;
    
    // Vertical angle limits
    this.minVerticalAngle = -Math.PI / 3; // -60 degrees
    this.maxVerticalAngle = Math.PI / 3;   // 60 degrees
    
    // Original camera parent reference
    this.originalParent = null;
    this.originalCameraPos = new THREE.Vector3();
    this.originalCameraRot = new THREE.Euler();
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
      
      // Determine up vector based on grounding
      let upVector = new THREE.Vector3(0, 1, 0);
      if (this.player.lastGroundNormal) {
        upVector = this.player.lastGroundNormal.clone();
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
      // When airborne - apply both pitch and yaw to player
      // Pitch rotation
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const pitchDelta = -event.movementY * this.verticalSensitivity;
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, pitchDelta);
      
      // Yaw rotation
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentPlayerQuat);
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
    
    // Get player's forward direction (negative Z in local space)
    const playerForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    const playerRight = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    const playerUp = new THREE.Vector3(0, 1, 0).applyQuaternion(playerQuat);
    
    // Calculate camera offset based on vertical angle
    const horizontalDistance = this.distance * Math.cos(this.verticalAngle);
    const verticalOffset = this.distance * Math.sin(this.verticalAngle);
    
    // Position camera behind player
    const cameraOffset = new THREE.Vector3()
      .addScaledVector(playerForward, -horizontalDistance)
      .addScaledVector(playerUp, this.height + verticalOffset);
    
    // Set camera position
    this.scene.camera.position.copy(playerWorldPos).add(cameraOffset);
    
    // Make camera look at a point in front of the player
    const lookAtOffset = new THREE.Vector3()
      .addScaledVector(playerUp, this.height * 0.5);
    const lookAtPoint = playerWorldPos.clone().add(lookAtOffset);
    
    this.scene.camera.lookAt(lookAtPoint);
  }

  update() {
    if (!this.isActive) return;
    this.updateCameraPosition();
  }
}
