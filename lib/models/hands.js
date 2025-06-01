import * as THREE from 'three';

export function createHandsModel() {
  const handGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.1);
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xffdbac,
    roughness: 0.8,
    metalness: 0
  });
  
  const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
  const rightHand = new THREE.Mesh(handGeometry, skinMaterial);
  
  leftHand.position.set(-0.15, 0, 0);
  rightHand.position.set(0.15, 0, 0);
  
  const handsGroup = new THREE.Group();
  handsGroup.add(leftHand);
  handsGroup.add(rightHand);
  
  return handsGroup;
}
