import * as THREE from 'three';

export function createPistolModel() {
  const pistolGroup = new THREE.Group();
  
  const gunMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7
  });
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.05, 0.15, 0.1);
  const grip = new THREE.Mesh(gripGeometry, gunMaterial);
  pistolGroup.add(grip);
  
  // Barrel
  const barrelGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.2);
  const barrel = new THREE.Mesh(barrelGeometry, gunMaterial);
  barrel.position.set(0, 0.05, -0.15);
  pistolGroup.add(barrel);
  
  // Trigger guard
  const guardGeometry = new THREE.TorusGeometry(0.03, 0.005, 4, 8, Math.PI);
  const guard = new THREE.Mesh(guardGeometry, gunMaterial);
  guard.position.set(0, -0.03, -0.02);
  guard.rotation.z = Math.PI;
  pistolGroup.add(guard);
  
  // Laser sight
  const laserSightGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1);
  const laserSightMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.2,
    metalness: 0.8
  });
  const laserSight = new THREE.Mesh(laserSightGeometry, laserSightMaterial);
  laserSight.rotation.x = Math.PI / 2;
  laserSight.position.set(0, -0.025, -0.1);
  pistolGroup.add(laserSight);
  
  // Laser beam
  const laserBeamGeometry = new THREE.CylinderGeometry(0.002, 0.002, 50);
  const laserBeamMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.5
  });
  const laserBeam = new THREE.Mesh(laserBeamGeometry, laserBeamMaterial);
  laserBeam.rotation.x = Math.PI / 2;
  laserBeam.position.set(0, -0.025, -25.1);
  pistolGroup.add(laserBeam);
  
  return pistolGroup;
}
