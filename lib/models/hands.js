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
  
  // Left hand - adjusted position for better visibility
  const leftHandGeometry = new THREE.BoxGeometry(0.12, 0.06, 0.18);
  const leftHand = new THREE.Mesh(leftHandGeometry, skinMaterial);
  leftHand.position.set(-0.15, -0.15, -0.4); // Moved lower and forward
  leftHand.rotation.set(0.3, 0.2, -0.2);
  leftHand.name = 'LeftHandMesh';
  handsGroup.add(leftHand);
  
  // Right hand - adjusted position for better visibility
  const rightHandGeometry = new THREE.BoxGeometry(0.12, 0.06, 0.18);
  const rightHand = new THREE.Mesh(rightHandGeometry, skinMaterial);
  rightHand.position.set(0.15, -0.15, -0.4); // Moved lower and forward
  rightHand.rotation.set(0.3, -0.2, 0.2);
  rightHand.name = 'RightHandMesh';
  handsGroup.add(rightHand);
  
  // Add simple fingers
  const fingerGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.06);
  
  // Left hand fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
    finger.position.set(-0.15 + (i - 1.5) * 0.03, -0.17, -0.5);
    finger.rotation.set(0.4, 0.2, -0.2);
    finger.name = `LeftFinger${i}`;
    handsGroup.add(finger);
  }
  
  // Right hand fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, skinMaterial);
    finger.position.set(0.15 + (i - 1.5) * 0.03, -0.17, -0.5);
    finger.rotation.set(0.4, -0.2, 0.2);
    finger.name = `RightFinger${i}`;
    handsGroup.add(finger);
  }
  
  // Thumbs
  const thumbGeometry = new THREE.BoxGeometry(0.02, 0.02, 0.04);
  
  const leftThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
  leftThumb.position.set(-0.08, -0.13, -0.42);
  leftThumb.rotation.set(0.2, -0.5, -0.3);
  leftThumb.name = 'LeftThumb';
  handsGroup.add(leftThumb);
  
  const rightThumb = new THREE.Mesh(thumbGeometry, skinMaterial);
  rightThumb.position.set(0.08, -0.13, -0.42);
  rightThumb.rotation.set(0.2, 0.5, 0.3);
  rightThumb.name = 'RightThumb';
  handsGroup.add(rightThumb);
  
  // Make sure all meshes are visible
  handsGroup.traverse((child) => {
    if (child.isMesh) {
      child.visible = true;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return handsGroup;
}
