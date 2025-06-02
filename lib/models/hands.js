import * as THREE from 'three';

export function createHandsModel() {
  const handsGroup = new THREE.Group();
  handsGroup.name = 'Hands';
  
  // Create simple hand representations
  const handGeometry = new THREE.BoxGeometry(0.08, 0.05, 0.12);
  const handMaterial = new THREE.MeshStandardMaterial({
    color: 0xfdbcb4,
    roughness: 0.7,
    metalness: 0.0
  });
  
  // Left hand
  const leftHand = new THREE.Mesh(handGeometry, handMaterial);
  leftHand.position.set(-0.15, -0.1, -0.2);
  leftHand.rotation.set(0.2, 0.3, -0.2);
  leftHand.castShadow = true;
  leftHand.receiveShadow = true;
  leftHand.name = 'LeftHand';
  handsGroup.add(leftHand);
  
  // Right hand  
  const rightHand = new THREE.Mesh(handGeometry, handMaterial.clone());
  rightHand.position.set(0.15, -0.1, -0.2);
  rightHand.rotation.set(0.2, -0.3, 0.2);
  rightHand.castShadow = true;
  rightHand.receiveShadow = true;
  rightHand.name = 'RightHand';
  handsGroup.add(rightHand);
  
  // Add simple fingers
  const fingerGeometry = new THREE.BoxGeometry(0.015, 0.015, 0.03);
  
  // Left hand fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, handMaterial.clone());
    finger.position.set(
      -0.15 + (i - 1.5) * 0.02,
      -0.125,
      -0.26
    );
    finger.rotation.set(0.3, 0.3, -0.2);
    finger.castShadow = true;
    finger.name = `LeftFinger${i}`;
    handsGroup.add(finger);
  }
  
  // Right hand fingers
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(fingerGeometry, handMaterial.clone());
    finger.position.set(
      0.15 + (i - 1.5) * 0.02,
      -0.125,
      -0.26
    );
    finger.rotation.set(0.3, -0.3, 0.2);
    finger.castShadow = true;
    finger.name = `RightFinger${i}`;
    handsGroup.add(finger);
  }
  
  // Add thumbs
  const thumbGeometry = new THREE.BoxGeometry(0.018, 0.018, 0.025);
  
  // Left thumb
  const leftThumb = new THREE.Mesh(thumbGeometry, handMaterial.clone());
  leftThumb.position.set(-0.10, -0.10, -0.22);
  leftThumb.rotation.set(0.1, -0.5, 0.3);
  leftThumb.castShadow = true;
  leftThumb.name = 'LeftThumb';
  handsGroup.add(leftThumb);
  
  // Right thumb
  const rightThumb = new THREE.Mesh(thumbGeometry, handMaterial.clone());
  rightThumb.position.set(0.10, -0.10, -0.22);
  rightThumb.rotation.set(0.1, 0.5, -0.3);
  rightThumb.castShadow = true;
  rightThumb.name = 'RightThumb';
  handsGroup.add(rightThumb);
  
  return handsGroup;
}
