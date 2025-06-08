import * as THREE from 'three';

export function createRocketLauncherModel() {
  const group = new THREE.Group();
  
  // Main tube
  const tubeGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1.5, 8);
  const tubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x556b2f,
    metalness: 0.6,
    roughness: 0.4
  });
  const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
  tube.rotation.z = Math.PI / 2;
  tube.position.x = 0.3;
  group.add(tube);
  
  // Front shield/blast guard
  const shieldGeometry = new THREE.CylinderGeometry(0.2, 0.15, 0.1, 8);
  const shieldMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.3
  });
  const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
  shield.rotation.z = Math.PI / 2;
  shield.position.x = 1.0;
  group.add(shield);
  
  // Rear exhaust
  const exhaustGeometry = new THREE.CylinderGeometry(0.15, 0.18, 0.2, 8);
  const exhaust = new THREE.Mesh(exhaustGeometry, shieldMaterial);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.x = -0.45;
  group.add(exhaust);
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.08, 0.25, 0.08);
  const gripMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.3,
    roughness: 0.7
  });
  const grip = new THREE.Mesh(gripGeometry, gripMaterial);
  grip.position.set(0.1, -0.18, 0);
  grip.rotation.z = 0.1;
  group.add(grip);
  
  // Front grip
  const frontGripGeometry = new THREE.BoxGeometry(0.06, 0.15, 0.06);
  const frontGrip = new THREE.Mesh(frontGripGeometry, gripMaterial);
  frontGrip.position.set(0.6, -0.12, 0);
  group.add(frontGrip);
  
  // Scope mount
  const mountGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.08);
  const mount = new THREE.Mesh(mountGeometry, shieldMaterial);
  mount.position.set(0.3, 0.14, 0);
  group.add(mount);
  
  // Simple scope
  const scopeGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8);
  const scope = new THREE.Mesh(scopeGeometry, shieldMaterial);
  scope.rotation.z = Math.PI / 2;
  scope.position.set(0.3, 0.2, 0);
  group.add(scope);
  
  // Trigger assembly
  const triggerGeometry = new THREE.BoxGeometry(0.02, 0.04, 0.02);
  const trigger = new THREE.Mesh(triggerGeometry, shieldMaterial);
  trigger.position.set(0.1, -0.06, 0);
  group.add(trigger);
  
  return group;
}
