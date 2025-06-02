import * as THREE from 'three';

export function createPistolModel() {
  const pistolGroup = new THREE.Group();
  
  const gunMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7
  });
  
  // Main body/slide
  const slideGeometry = new THREE.BoxGeometry(0.04, 0.12, 0.25);
  const slide = new THREE.Mesh(slideGeometry, gunMaterial);
  pistolGroup.add(slide);
  
  // Grip
  const gripGeometry = new THREE.BoxGeometry(0.03, 0.1, 0.08);
  const grip = new THREE.Mesh(gripGeometry, gunMaterial);
  grip.position.set(0, -0.07, 0.05);
  grip.rotation.z = -0.2;
  pistolGroup.add(grip);
  
  // Trigger guard
  const guardGeometry = new THREE.TorusGeometry(0.025, 0.005, 4, 8, Math.PI);
  const triggerGuard = new THREE.Mesh(guardGeometry, gunMaterial);
  triggerGuard.position.set(0, -0.04, -0.02);
  triggerGuard.rotation.z = Math.PI;
  pistolGroup.add(triggerGuard);
  
  // Barrel
  const barrelGeometry = new THREE.CylinderGeometry(0.015, 0.01, 0.08);
  const barrel = new THREE.Mesh(barrelGeometry, gunMaterial);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -0.15);
  pistolGroup.add(barrel);
  
  // Sight
  const sightGeometry = new THREE.BoxGeometry(0.01, 0.02, 0.01);
  const frontSight = new THREE.Mesh(sightGeometry, gunMaterial);
  frontSight.position.set(0, 0.07, -0.1);
  pistolGroup.add(frontSight);
  
  const rearSight = new THREE.Mesh(sightGeometry, gunMaterial);
  rearSight.position.set(0, 0.07, 0.1);
  pistolGroup.add(rearSight);
  
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
