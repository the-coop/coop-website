import * as THREE from 'three';

export function createPlaneModel() {
  const planeGroup = new THREE.Group();
  
  // Fuselage
  const fuselageGeometry = new THREE.CylinderGeometry(0.8, 1.2, 8, 8);
  const fuselageMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.3,
    metalness: 0.7
  });
  const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
  fuselage.rotation.z = Math.PI / 2;
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  planeGroup.add(fuselage);
  
  // Cockpit
  const cockpitGeometry = new THREE.SphereGeometry(0.8, 8, 8);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x333366,
    roughness: 0.1,
    metalness: 0.5,
    transparent: true,
    opacity: 0.8
  });
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.x = -2;
  cockpit.scale.set(1.5, 0.8, 0.8);
  planeGroup.add(cockpit);
  
  // Main wings
  const wingGeometry = new THREE.BoxGeometry(12, 0.2, 2);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.4,
    metalness: 0.6
  });
  const wings = new THREE.Mesh(wingGeometry, wingMaterial);
  wings.castShadow = true;
  wings.receiveShadow = true;
  planeGroup.add(wings);
  
  // Tail
  const tailGeometry = new THREE.BoxGeometry(0.3, 3, 1.5);
  const tail = new THREE.Mesh(tailGeometry, wingMaterial);
  tail.position.set(3.5, 1, 0);
  planeGroup.add(tail);
  
  // Horizontal stabilizer
  const stabilizerGeometry = new THREE.BoxGeometry(4, 0.2, 1);
  const stabilizer = new THREE.Mesh(stabilizerGeometry, wingMaterial);
  stabilizer.position.set(3.5, 2, 0);
  planeGroup.add(stabilizer);
  
  // Engine
  const engineGeometry = new THREE.CylinderGeometry(0.3, 0.5, 1.5, 8);
  const engineMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.7,
    metalness: 0.8
  });
  const engine = new THREE.Mesh(engineGeometry, engineMaterial);
  engine.rotation.z = Math.PI / 2;
  engine.position.x = -3.5;
  planeGroup.add(engine);
  
  // Propeller
  const propellerGroup = new THREE.Group();
  const bladeGeometry = new THREE.BoxGeometry(0.2, 3, 0.5);
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    roughness: 0.5,
    metalness: 0.7
  });
  
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.rotation.x = (i / 3) * Math.PI * 2;
    propellerGroup.add(blade);
  }
  
  propellerGroup.position.x = -4.3;
  planeGroup.add(propellerGroup);
  
  // Store propeller reference
  planeGroup.userData.propeller = propellerGroup;
  
  // Landing gear wheels
  const wheelRadius = 0.3;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.2, 8);
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2
  });
  
  // Front wheel
  const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  frontWheel.rotation.z = Math.PI / 2;
  frontWheel.position.set(-2, -1.2, 0);
  planeGroup.add(frontWheel);
  
  // Rear wheels
  const leftWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.set(1, -1.2, -2);
  planeGroup.add(leftWheel);
  
  const rightWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
  rightWheel.rotation.z = Math.PI / 2;
  rightWheel.position.set(1, -1.2, 2);
  planeGroup.add(rightWheel);
  
  return planeGroup;
}
