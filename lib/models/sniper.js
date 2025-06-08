import * as THREE from 'three';

export function createSniperModel() {
  const group = new THREE.Group();
  
  // Materials
  const barrelMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.1
  });
  
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.3
  });
  
  const scopeMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.8,
    roughness: 0.2
  });
  
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: 0x4444aa,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7
  });
  
  // Long barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
  const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.4;
  group.add(barrel);
  
  // Muzzle brake
  const muzzleGeometry = new THREE.CylinderGeometry(0.03, 0.02, 0.08, 8);
  const muzzle = new THREE.Mesh(muzzleGeometry, barrelMaterial);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.z = -1.04;
  group.add(muzzle);
  
  // Receiver
  const receiverGeometry = new THREE.BoxGeometry(0.08, 0.1, 0.4);
  const receiver = new THREE.Mesh(receiverGeometry, bodyMaterial);
  receiver.position.z = 0.2;
  group.add(receiver);
  
  // Bolt
  const boltGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.1);
  const bolt = new THREE.Mesh(boltGeometry, barrelMaterial);
  bolt.rotation.z = Math.PI / 2;
  bolt.position.set(0.05, 0.03, 0.25);
  group.add(bolt);
  
  // Bolt handle
  const boltHandleGeometry = new THREE.SphereGeometry(0.02, 6, 6);
  const boltHandle = new THREE.Mesh(boltHandleGeometry, barrelMaterial);
  boltHandle.position.set(0.08, 0.03, 0.25);
  group.add(boltHandle);
  
  // Magazine
  const magazineGeometry = new THREE.BoxGeometry(0.06, 0.08, 0.12);
  const magazine = new THREE.Mesh(magazineGeometry, bodyMaterial);
  magazine.position.set(0, -0.08, 0.15);
  group.add(magazine);
  
  // Stock
  const stockGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.5);
  const stock = new THREE.Mesh(stockGeometry, bodyMaterial);
  stock.position.set(0, -0.02, 0.6);
  group.add(stock);
  
  // Cheek rest
  const cheekRestGeometry = new THREE.BoxGeometry(0.08, 0.04, 0.15);
  const cheekRest = new THREE.Mesh(cheekRestGeometry, bodyMaterial);
  cheekRest.position.set(0, 0.06, 0.55);
  group.add(cheekRest);
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.06, 0.14, 0.08);
  const grip = new THREE.Mesh(gripGeometry, bodyMaterial);
  grip.position.set(0, -0.1, 0.35);
  grip.rotation.z = -0.3;
  group.add(grip);
  
  // Trigger guard
  const triggerGuardGeometry = new THREE.TorusGeometry(0.04, 0.008, 4, 8, Math.PI);
  const triggerGuard = new THREE.Mesh(triggerGuardGeometry, bodyMaterial);
  triggerGuard.position.set(0, -0.08, 0.3);
  triggerGuard.rotation.z = Math.PI;
  group.add(triggerGuard);
  
  // Trigger
  const triggerGeometry = new THREE.BoxGeometry(0.015, 0.04, 0.025);
  const trigger = new THREE.Mesh(triggerGeometry, bodyMaterial);
  trigger.position.set(0, -0.06, 0.3);
  group.add(trigger);
  
  // Scope mount
  const mountGeometry = new THREE.BoxGeometry(0.06, 0.02, 0.2);
  const scopeMount = new THREE.Mesh(mountGeometry, bodyMaterial);
  scopeMount.position.set(0, 0.06, 0.1);
  group.add(scopeMount);
  
  // Scope body
  const scopeGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
  const scope = new THREE.Mesh(scopeGeometry, scopeMaterial);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.12, 0.05);
  group.add(scope);
  
  // Scope front lens
  const frontLensGeometry = new THREE.CylinderGeometry(0.045, 0.04, 0.02, 8);
  const frontLens = new THREE.Mesh(frontLensGeometry, scopeMaterial);
  frontLens.rotation.x = Math.PI / 2;
  frontLens.position.set(0, 0.12, -0.12);
  group.add(frontLens);
  
  // Scope rear lens
  const rearLensGeometry = new THREE.CylinderGeometry(0.04, 0.035, 0.02, 8);
  const rearLens = new THREE.Mesh(rearLensGeometry, scopeMaterial);
  rearLens.rotation.x = Math.PI / 2;
  rearLens.position.set(0, 0.12, 0.22);
  group.add(rearLens);
  
  // Lens glass
  const lensGeometry = new THREE.CircleGeometry(0.038, 16);
  const frontGlass = new THREE.Mesh(lensGeometry, lensMaterial);
  frontGlass.rotation.y = Math.PI / 2;
  frontGlass.position.set(0, 0.12, -0.13);
  group.add(frontGlass);
  
  const rearGlass = new THREE.Mesh(lensGeometry, lensMaterial);
  rearGlass.rotation.y = -Math.PI / 2;
  rearGlass.position.set(0, 0.12, 0.23);
  group.add(rearGlass);
  
  // Scope adjustment knobs
  const knobGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.025, 6);
  const topKnob = new THREE.Mesh(knobGeometry, scopeMaterial);
  topKnob.position.set(0, 0.155, 0.05);
  group.add(topKnob);
  
  const sideKnob = new THREE.Mesh(knobGeometry, scopeMaterial);
  sideKnob.rotation.z = Math.PI / 2;
  sideKnob.position.set(0.045, 0.12, 0.05);
  group.add(sideKnob);
  
  // Bipod (folded)
  const bipodGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.25);
  const leftBipod = new THREE.Mesh(bipodGeometry, bodyMaterial);
  leftBipod.position.set(-0.03, -0.02, -0.3);
  leftBipod.rotation.x = 0.3;
  group.add(leftBipod);
  
  const rightBipod = new THREE.Mesh(bipodGeometry, bodyMaterial);
  rightBipod.position.set(0.03, -0.02, -0.3);
  rightBipod.rotation.x = 0.3;
  group.add(rightBipod);
  
  return group;
}
