import * as THREE from 'three';

export function createGrenadeLauncherModel() {
  const group = new THREE.Group();
  
  // Main body - thicker barrel for grenade launcher
  const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.7,
    roughness: 0.3
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.x = 0.3;
  group.add(body);
  
  // Revolving cylinder chamber
  const cylinderGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 8);
  const cylinderMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.2
  });
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
  cylinder.rotation.z = Math.PI / 2;
  cylinder.position.x = 0.1;
  group.add(cylinder);
  
  // Stock
  const stockGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.1);
  const stockMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.3,
    roughness: 0.7
  });
  const stock = new THREE.Mesh(stockGeometry, stockMaterial);
  stock.position.x = -0.35;
  group.add(stock);
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.08, 0.2, 0.08);
  const grip = new THREE.Mesh(gripGeometry, stockMaterial);
  grip.position.set(0, -0.15, 0);
  grip.rotation.z = 0.2;
  group.add(grip);
  
  // Trigger guard
  const guardGeometry = new THREE.TorusGeometry(0.05, 0.01, 8, 8, Math.PI);
  const guardMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8
  });
  const guard = new THREE.Mesh(guardGeometry, guardMaterial);
  guard.position.set(0.05, -0.08, 0);
  guard.rotation.z = Math.PI;
  group.add(guard);
  
  // Sight
  const sightGeometry = new THREE.BoxGeometry(0.04, 0.06, 0.04);
  const sight = new THREE.Mesh(sightGeometry, bodyMaterial);
  sight.position.set(0.3, 0.18, 0);
  group.add(sight);
  
  return group;
}
