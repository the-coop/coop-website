import * as THREE from 'three';

export function createCarModel() {
  const carGroup = new THREE.Group();
  
  // Car body
  const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
  const bodyMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a5fb4,
    roughness: 0.3,
    metalness: 0.7
  });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.position.y = 0.4;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  carGroup.add(bodyMesh);
  
  // Cabin
  const cabinGeometry = new THREE.BoxGeometry(1.6, 0.8, 2);
  const cabinMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.8
  });
  const cabinMesh = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabinMesh.position.set(0, 1.0, -0.5);
  cabinMesh.castShadow = true;
  carGroup.add(cabinMesh);
  
  // Headlights
  const headlightGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 8);
  const headlightMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffaa,
    emissive: 0xffffaa,
    emissiveIntensity: 0.5
  });
  
  const leftHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
  leftHeadlight.rotation.z = Math.PI / 2;
  leftHeadlight.position.set(-0.55, 0.4, -2);
  carGroup.add(leftHeadlight);
  
  const rightHeadlight = new THREE.Mesh(headlightGeometry, headlightMaterial);
  rightHeadlight.rotation.z = Math.PI / 2;
  rightHeadlight.position.set(0.55, 0.4, -2);
  carGroup.add(rightHeadlight);
  
  // Tail lights
  const taillightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.3
  });
  
  const leftTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
  leftTaillight.rotation.z = Math.PI / 2;
  leftTaillight.position.set(-0.55, 0.4, 2);
  carGroup.add(leftTaillight);
  
  const rightTaillight = new THREE.Mesh(headlightGeometry, taillightMaterial);
  rightTaillight.rotation.z = Math.PI / 2;
  rightTaillight.position.set(0.55, 0.4, 2);
  carGroup.add(rightTaillight);
  
  return carGroup;
}

export function createWheelModel() {
  const wheelGroup = new THREE.Group();
  
  // Tire
  const tireGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  const tireMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x222222,
    roughness: 0.9,
    metalness: 0.1
  });
  const tireMesh = new THREE.Mesh(tireGeometry, tireMaterial);
  tireMesh.rotation.z = Math.PI / 2;
  tireMesh.castShadow = true;
  tireMesh.receiveShadow = true;
  wheelGroup.add(tireMesh);
  
  // Rim
  const rimGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.35, 8);
  const rimMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x888888,
    roughness: 0.3,
    metalness: 0.8
  });
  const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
  rimMesh.rotation.z = Math.PI / 2;
  wheelGroup.add(rimMesh);
  
  return wheelGroup;
}
