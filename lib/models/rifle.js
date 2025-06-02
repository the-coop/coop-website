import * as THREE from 'three';

export function createRifleModel() {
  const rifleGroup = new THREE.Group();
  
  const gunMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7
  });
  
  // Receiver/Body
  const bodyGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.35);
  const body = new THREE.Mesh(bodyGeometry, gunMaterial);
  rifleGroup.add(body);
  
  // Barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.025, 0.02, 0.5);
  const barrel = new THREE.Mesh(barrelGeometry, gunMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, -0.4);
  rifleGroup.add(barrel);
  
  // Stock
  const stockGeometry = new THREE.BoxGeometry(0.06, 0.1, 0.2);
  const stock = new THREE.Mesh(stockGeometry, gunMaterial);
  stock.position.set(0, -0.02, 0.2);
  rifleGroup.add(stock);
  
  // Magazine
  const magGeometry = new THREE.BoxGeometry(0.04, 0.08, 0.08);
  const magazine = new THREE.Mesh(magGeometry, gunMaterial);
  magazine.position.set(0, -0.08, -0.05);
  rifleGroup.add(magazine);
  
  // Sight
  const sightGeometry = new THREE.BoxGeometry(0.02, 0.03, 0.05);
  const sight = new THREE.Mesh(sightGeometry, gunMaterial);
  sight.position.set(0, 0.08, -0.1);
  rifleGroup.add(sight);
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.04, 0.06, 0.04);
  const grip = new THREE.Mesh(gripGeometry, gunMaterial);
  grip.position.set(0, -0.06, 0.05);
  rifleGroup.add(grip);
  
  return rifleGroup;
}
