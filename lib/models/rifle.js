import * as THREE from 'three';

export function createRifleModel() {
  const rifleGroup = new THREE.Group();
  
  const gunMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7
  });
  
  // Stock
  const stockGeometry = new THREE.BoxGeometry(0.06, 0.1, 0.3);
  const stock = new THREE.Mesh(stockGeometry, gunMaterial);
  stock.position.z = 0.1;
  rifleGroup.add(stock);
  
  // Receiver
  const receiverGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.2);
  const receiver = new THREE.Mesh(receiverGeometry, gunMaterial);
  receiver.position.z = -0.1;
  rifleGroup.add(receiver);
  
  // Barrel
  const rifleBarrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
  const rifleBarrel = new THREE.Mesh(rifleBarrelGeometry, gunMaterial);
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.z = -0.45;
  rifleGroup.add(rifleBarrel);
  
  // Magazine
  const magGeometry = new THREE.BoxGeometry(0.03, 0.1, 0.05);
  const magazine = new THREE.Mesh(magGeometry, gunMaterial);
  magazine.position.set(0, -0.1, -0.05);
  rifleGroup.add(magazine);
  
  return rifleGroup;
}
