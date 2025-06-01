import * as THREE from 'three';

export function createCarModel() {
  const carGroup = new THREE.Group();
  
  // Car body
  const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x0066cc,
    metalness: 0.6,
    roughness: 0.4
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  carGroup.add(body);
  
  // Car roof
  const roofGeometry = new THREE.BoxGeometry(1.8, 0.6, 2.5);
  const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
  roof.position.set(0, 1.3, -0.3);
  roof.castShadow = true;
  carGroup.add(roof);
  
  // Windshield
  const windshieldMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7
  });
  const windshieldGeometry = new THREE.BoxGeometry(1.7, 0.5, 0.1);
  const windshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
  windshield.position.set(0, 1.2, 0.9);
  windshield.rotation.x = -0.3;
  carGroup.add(windshield);
  
  // Rear windshield
  const rearWindshield = new THREE.Mesh(windshieldGeometry, windshieldMaterial);
  rearWindshield.position.set(0, 1.2, -1.5);
  rearWindshield.rotation.x = 0.3;
  carGroup.add(rearWindshield);
  
  // Headlights
  const headlightGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8);
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.5
  });
  
  const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
  leftHeadlight.rotation.z = Math.PI / 2;
  leftHeadlight.position.set(-0.7, 0.5, 2);
  carGroup.add(leftHeadlight);
  
  const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
  rightHeadlight.rotation.z = Math.PI / 2;
  rightHeadlight.position.set(0.7, 0.5, 2);
  carGroup.add(rightHeadlight);
  
  // Tail lights
  const taillightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.3
  });
  
  const leftTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
  leftTaillight.rotation.z = Math.PI / 2;
  leftTaillight.position.set(-0.7, 0.5, -2);
  carGroup.add(leftTaillight);
  
  const rightTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
  rightTaillight.rotation.z = Math.PI / 2;
  rightTaillight.position.set(0.7, 0.5, -2);
  carGroup.add(rightTaillight);
  
  // Store headlights reference
  carGroup.userData.headlights = [leftHeadlight, rightHeadlight];
  carGroup.userData.taillights = [leftTaillight, rightTaillight];
  
  return carGroup;
}

export function createWheelModel(radius = 0.4) {
  const wheelGroup = new THREE.Group();
  
  // Tire
  const tireGeometry = new THREE.CylinderGeometry(radius, radius, radius * 0.5, 16);
  const tireMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9,
    metalness: 0.1
  });
  const tire = new THREE.Mesh(tireGeometry, tireMaterial);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheelGroup.add(tire);
  
  // Rim
  const rimGeometry = new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, radius * 0.6, 16);
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0x888888,
    metalness: 0.8,
    roughness: 0.2
  });
  const rim = new THREE.Mesh(rimGeometry, rimMaterial);
  rim.rotation.z = Math.PI / 2;
  wheelGroup.add(rim);
  
  return wheelGroup;
}
