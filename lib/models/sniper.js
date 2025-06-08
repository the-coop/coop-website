import * as THREE from 'three';

export function createSniperModel() {
  const group = new THREE.Group();
  
  // Long barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8);
  const barrelMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.1
  });
  const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.x = 0.6;
  group.add(barrel);
  
  // Muzzle brake
  const muzzleGeometry = new THREE.CylinderGeometry(0.06, 0.05, 0.15, 8);
  const muzzle = new THREE.Mesh(muzzleGeometry, barrelMaterial);
  muzzle.rotation.z = Math.PI / 2;
  muzzle.position.x = 1.65;
  group.add(muzzle);
  
  // Receiver
  const receiverGeometry = new THREE.BoxGeometry(0.4, 0.15, 0.1);
  const receiverMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.3
  });
  const receiver = new THREE.Mesh(receiverGeometry, receiverMaterial);
  receiver.position.x = -0.2;
  group.add(receiver);
  
  // Stock
  const stockGeometry = new THREE.BoxGeometry(0.5, 0.12, 0.08);
  const stockMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3c28,
    metalness: 0.2,
    roughness: 0.8
  });
  const stock = new THREE.Mesh(stockGeometry, stockMaterial);
  stock.position.x = -0.65;
  group.add(stock);
  
  // Cheek rest
  const cheekRestGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.06);
  const cheekRest = new THREE.Mesh(cheekRestGeometry, stockMaterial);
  cheekRest.position.set(-0.6, 0.08, 0);
  group.add(cheekRest);
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.06, 0.2, 0.06);
  const grip = new THREE.Mesh(gripGeometry, stockMaterial);
  grip.position.set(-0.15, -0.15, 0);
  grip.rotation.z = 0.2;
  group.add(grip);
  
  // Magazine
  const magGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.06);
  const magazine = new THREE.Mesh(magGeometry, receiverMaterial);
  magazine.position.set(-0.1, -0.1, 0);
  group.add(magazine);
  
  // Scope
  const scopeBodyGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8);
  const scopeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.8,
    roughness: 0.2
  });
  const scopeBody = new THREE.Mesh(scopeBodyGeometry, scopeMaterial);
  scopeBody.rotation.z = Math.PI / 2;
  scopeBody.position.set(0, 0.15, 0);
  group.add(scopeBody);
  
  // Scope lenses
  const lensGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8);
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: 0x4444ff,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.3
  });
  
  const frontLens = new THREE.Mesh(lensGeometry, lensMaterial);
  frontLens.rotation.z = Math.PI / 2;
  frontLens.position.set(0.2, 0.15, 0);
  group.add(frontLens);
  
  const rearLens = new THREE.Mesh(lensGeometry, lensMaterial);
  rearLens.rotation.z = Math.PI / 2;
  rearLens.position.set(-0.2, 0.15, 0);
  group.add(rearLens);
  
  // Scope mounts
  const mountGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.08);
  const mount1 = new THREE.Mesh(mountGeometry, receiverMaterial);
  mount1.position.set(-0.1, 0.08, 0);
  group.add(mount1);
  
  const mount2 = new THREE.Mesh(mountGeometry, receiverMaterial);
  mount2.position.set(0.1, 0.08, 0);
  group.add(mount2);
  
  // Bipod (folded)
  const bipodGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6);
  const bipodMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.7
  });
  
  const bipod1 = new THREE.Mesh(bipodGeometry, bipodMaterial);
  bipod1.position.set(0.8, -0.05, 0.03);
  bipod1.rotation.z = -0.3;
  group.add(bipod1);
  
  const bipod2 = new THREE.Mesh(bipodGeometry, bipodMaterial);
  bipod2.position.set(0.8, -0.05, -0.03);
  bipod2.rotation.z = -0.3;
  group.add(bipod2);
  
  // Trigger
  const triggerGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.02);
  const trigger = new THREE.Mesh(triggerGeometry, receiverMaterial);
  trigger.position.set(-0.1, -0.06, 0);
  group.add(trigger);
  
  return group;
}
