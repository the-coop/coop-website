import * as THREE from 'three';

export class TPController {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.isActive = false;
    
    // Camera settings
    this.distance = 15;
    this.height = 8;
    this.angle = 0;
    
    // Mouse control
    this.mouseSensitivity = 0.005;
    
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
    if (!this.isActive) return;
    
    // Rotate camera around player
    this.angle -= event.movementX * this.mouseSensitivity;
  }

  updateCameraPosition() {
    if (!this.isActive || !this.scene.camera || !this.player.mesh) return;
    
    // Get player's world position
    const playerWorldPos = new THREE.Vector3();
    this.player.mesh.getWorldPosition(playerWorldPos);
    
    // Calculate camera position in orbit around player
    const cameraX = playerWorldPos.x + Math.sin(this.angle) * this.distance;
    const cameraZ = playerWorldPos.z + Math.cos(this.angle) * this.distance;
    const cameraY = playerWorldPos.y + this.height;
    
    this.scene.camera.position.set(cameraX, cameraY, cameraZ);
    
    // Make camera look at player
    this.scene.camera.lookAt(playerWorldPos);
  }

  update() {
    if (!this.isActive) return;
    this.updateCameraPosition();
  }
}
