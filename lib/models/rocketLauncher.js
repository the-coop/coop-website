import * as THREE from 'three';

export function createRocketLauncherModel() {
  const group = new THREE.Group();
  
  // Materials
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x2F4F2F, // Dark green
    metalness: 0.8,
    roughness: 0.3
  });
  
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.2
  });
  
  const sightMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.7,
    roughness: 0.4
  });
  
  // Main tube (launcher body)
  const tubeGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1.0, 8);
  const mainTube = new THREE.Mesh(tubeGeometry, bodyMaterial);
  mainTube.rotation.x = Math.PI / 2;
  mainTube.position.z = 0.1;
  group.add(mainTube);
  
  // Front barrel
  const frontTubeGeometry = new THREE.CylinderGeometry(0.14, 0.12, 0.3, 8);
  const frontTube = new THREE.Mesh(frontTubeGeometry, bodyMaterial);
  frontTube.rotation.x = Math.PI / 2;
  frontTube.position.z = -0.55;
  group.add(frontTube);
  
  // Rear exhaust
  const exhaustGeometry = new THREE.CylinderGeometry(0.13, 0.15, 0.2, 8);
  const exhaust = new THREE.Mesh(exhaustGeometry, detailMaterial);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.z = 0.7;
  group.add(exhaust);
  
  // Trigger guard and grip
  const gripGeometry = new THREE.BoxGeometry(0.08, 0.18, 0.12);
  const grip = new THREE.Mesh(gripGeometry, detailMaterial);
  grip.position.set(0, -0.12, 0.1);
  grip.rotation.z = -0.2;
  group.add(grip);
  
  // Trigger
  const triggerGeometry = new THREE.BoxGeometry(0.02, 0.06, 0.04);
  const trigger = new THREE.Mesh(triggerGeometry, detailMaterial);
  trigger.position.set(0, -0.06, 0.05);
  group.add(trigger);
  
  // Shoulder rest
  const shoulderRestGeometry = new THREE.BoxGeometry(0.15, 0.08, 0.25);
  const shoulderRest = new THREE.Mesh(shoulderRestGeometry, bodyMaterial);
  shoulderRest.position.set(0, -0.05, 0.65);
  group.add(shoulderRest);
  
  // Top sight rail
  const railGeometry = new THREE.BoxGeometry(0.06, 0.03, 0.8);
  const topRail = new THREE.Mesh(railGeometry, detailMaterial);
  topRail.position.set(0, 0.13, 0.1);
  group.add(topRail);
  
  // Front sight
  const frontSightGeometry = new THREE.BoxGeometry(0.03, 0.08, 0.02);
  const frontSight = new THREE.Mesh(frontSightGeometry, sightMaterial);
  frontSight.position.set(0, 0.17, -0.4);
  group.add(frontSight);
  
  // Rear sight
  const rearSightGeometry = new THREE.BoxGeometry(0.08, 0.06, 0.02);
  const rearSight = new THREE.Mesh(rearSightGeometry, sightMaterial);
  rearSight.position.set(0, 0.16, 0.2);
  group.add(rearSight);
  
  // Sight notch
  const notchGeometry = new THREE.BoxGeometry(0.04, 0.03, 0.02);
  const notch = new THREE.Mesh(notchGeometry, detailMaterial);
  notch.position.set(0, 0.16, 0.2);
  group.add(notch);
  
  // Side handle
  const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.15);
  const handle = new THREE.Mesh(handleGeometry, detailMaterial);
  handle.position.set(-0.1, 0, -0.1);
  handle.rotation.z = Math.PI / 2;
  group.add(handle);
  
  // Handle grip
  const handleGripGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.08);
  const handleGrip = new THREE.Mesh(handleGripGeometry, detailMaterial);
  handleGrip.position.set(-0.16, 0, -0.1);
  group.add(handleGrip);
  
  // Rocket visible in chamber (optional)
  const rocketGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6);
  const rocketMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.8,
    roughness: 0.3
  });
  const rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);
  rocket.rotation.x = Math.PI / 2;
  rocket.position.z = -0.3;
  rocket.visible = false; // Can be toggled when loaded
  group.add(rocket);
  
  // Rocket fins
  const finGeometry = new THREE.BoxGeometry(0.15, 0.02, 0.05);
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(finGeometry, rocketMaterial);
    const angle = (i / 4) * Math.PI * 2;
    fin.position.set(
      Math.cos(angle) * 0.06,
      Math.sin(angle) * 0.06,
      -0.15
    );
    fin.rotation.z = angle;
    fin.visible = false;
    group.add(fin);
  }
  
  // Store rocket reference
  group.userData.rocket = rocket;
  
  return group;
}
