import * as THREE from 'three';

export function createGrenadeLauncherModel() {
  const group = new THREE.Group();
  
  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.7,
    roughness: 0.3
  });
  
  const drumMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.2
  });
  
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8B4513,
    metalness: 0.1,
    roughness: 0.8
  });
  
  // Main barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8);
  const barrel = new THREE.Mesh(barrelGeometry, bodyMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.25;
  group.add(barrel);
  
  // Muzzle
  const muzzleGeometry = new THREE.CylinderGeometry(0.07, 0.06, 0.1, 8);
  const muzzle = new THREE.Mesh(muzzleGeometry, bodyMaterial);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.z = -0.55;
  group.add(muzzle);
  
  // Revolving cylinder drum
  const drumGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.2, 8);
  const drum = new THREE.Mesh(drumGeometry, drumMaterial);
  drum.rotation.x = Math.PI / 2;
  drum.position.z = 0;
  group.add(drum);
  
  // Grenade chambers (6 visible holes)
  const chamberGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6);
  const chamberMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.1
  });
  
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const chamber = new THREE.Mesh(chamberGeometry, chamberMaterial);
    chamber.rotation.x = Math.PI / 2;
    chamber.position.set(
      Math.cos(angle) * 0.07,
      Math.sin(angle) * 0.07,
      0
    );
    group.add(chamber);
  }
  
  // Stock
  const stockGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.35);
  const stock = new THREE.Mesh(stockGeometry, woodMaterial);
  stock.position.set(0, -0.05, 0.35);
  group.add(stock);
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.08, 0.16, 0.1);
  const grip = new THREE.Mesh(gripGeometry, woodMaterial);
  grip.position.set(0, -0.1, 0.1);
  grip.rotation.z = -0.3;
  group.add(grip);
  
  // Trigger guard
  const triggerGuardGeometry = new THREE.TorusGeometry(0.05, 0.01, 4, 8, Math.PI);
  const triggerGuard = new THREE.Mesh(triggerGuardGeometry, bodyMaterial);
  triggerGuard.position.set(0, -0.08, 0.05);
  triggerGuard.rotation.z = Math.PI;
  group.add(triggerGuard);
  
  // Trigger
  const triggerGeometry = new THREE.BoxGeometry(0.02, 0.05, 0.03);
  const trigger = new THREE.Mesh(triggerGeometry, bodyMaterial);
  trigger.position.set(0, -0.06, 0.05);
  group.add(trigger);
  
  // Front grip
  const frontGripGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.12);
  const frontGrip = new THREE.Mesh(frontGripGeometry, bodyMaterial);
  frontGrip.position.set(0, -0.08, -0.2);
  group.add(frontGrip);
  
  // Sight
  const sightGeometry = new THREE.BoxGeometry(0.04, 0.06, 0.02);
  const sight = new THREE.Mesh(sightGeometry, bodyMaterial);
  sight.position.set(0, 0.09, -0.1);
  group.add(sight);
  
  // Sight posts
  const postGeometry = new THREE.BoxGeometry(0.015, 0.04, 0.015);
  const leftPost = new THREE.Mesh(postGeometry, bodyMaterial);
  leftPost.position.set(-0.015, 0.11, -0.1);
  group.add(leftPost);
  
  const rightPost = new THREE.Mesh(postGeometry, bodyMaterial);
  rightPost.position.set(0.015, 0.11, -0.1);
  group.add(rightPost);
  
  // Store drum reference for rotation animation
  group.userData.drum = drum;
  
  return group;
}
