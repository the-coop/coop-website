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
    
    // Original camera parent reference
    this.originalParent = null;
  }

  activate() {
    if (this.isActive || !this.player.mesh || !this.scene.camera) return;
    
    // Store current world position
    const worldPos = new THREE.Vector3();
    this.scene.camera.getWorldPosition(worldPos);
    
    // Store rotation
    const worldRot = new THREE.Euler();
    this.scene.camera.getWorldQuaternion(new THREE.Quaternion().setFromEuler(worldRot));
    
    // Remove from player and add to scene
    this.originalParent = this.scene.camera.parent;
    this.player.mesh.remove(this.scene.camera);
    this.scene.scene.add(this.scene.camera);
    
    // Position camera
    this.scene.camera.position.copy(worldPos);
    this.scene.camera.rotation.copy(worldRot);
    
    // Move camera back for better view
    const cameraOffset = new THREE.Vector3(0, 5, 15);
    this.scene.camera.position.add(cameraOffset);
    
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
    this.scene.camera.position.set(0, this.player.height * 0.8, 0);
    this.scene.camera.rotation.set(this.player.cameraRotation.x, 0, 0);
    
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

  update() {
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
}
