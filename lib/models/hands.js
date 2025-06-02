import * as THREE from 'three';

export function createHandsModel() {
  const handsGroup = new THREE.Group();
  handsGroup.name = 'Hands';
  
  // Hand material
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xfdbcb4,
    roughness: 0.7,
    metalness: 0.0
  });
  
  // Left hand
  const leftHandGeometry = new THREE.BoxGeometry(0.12, 0.06, 0.18);
  const leftHand = new THREE.Mesh(leftHandGeometry, skinMaterial);
  leftHand.position.set(-0.15, -0.1, -0.3);
  leftHand.rotation.set(0.3, 0.2, -0.2);
  handsGroup.add(leftHand);
  
  // Right hand
  const rightHandGeometry = new THREE.BoxGeometry(0.12, 0.06, 0.18);
  const rightHand = new THREE.Mesh(rightHandGeometry, skinMaterial);
  rightHand.position.set(0.15, -0.1, -0.3);
  rightHand.rotation.set(0.3, -0.2, 0.2);
  handsGroup.add(rightHand);
  
  // Add simple fingers
  const fingerGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.06);
  
  // Left hand fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
    finger.position.set(-0.15 + (i - 1.5) * 0.03, -0.12, -0.4);
    finger.rotation.set(0.4, 0.2, -0.2);
    handsGroup.add(finger);
  }
  
  // Right hand fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
    finger.position.set(0.15 + (i - 1.5) * 0.03, -0.12, -0.4);
    finger.rotation.set(0.4, -0.2, 0.2);
    handsGroup.add(finger);
  }
  
  // Thumbs
  const thumbGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.04);
  
  const leftThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
  leftThumb.position.set(-0.08, -0.08, -0.32);
  leftThumb.rotation.set(0.2, -0.5, -0.3);
  handsGroup.add(leftThumb);
  
  const rightThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
  rightThumb.position.set(0.08, -0.08, -0.32);
  rightThumb.rotation.set(0.2, 0.5, 0.3);
  handsGroup.add(rightThumb);
  
  return handsGroup;
}
