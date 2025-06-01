import * as THREE from 'three';

export function createHelicopterModel() {
  const heliGroup = new THREE.Group();
  
  // Main body (fuselage)
  const bodyGeometry = new THREE.BoxGeometry(2, 1.5, 5);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a5a2a,
    roughness: 0.6,
    metalness: 0.4
  });
  const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  heliGroup.add(bodyMesh);
  
  // Cockpit
  const cockpitGeometry = new THREE.SphereGeometry(1.2, 8, 6);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x333366,
    roughness: 0.1,
    metalness: 0.5,
    transparent: true,
    opacity: 0.8
  });
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.set(0, 0.3, -2);
  cockpit.scale.set(0.8, 0.7, 1.2);
  heliGroup.add(cockpit);
  
  // Tail boom
  const tailGeometry = new THREE.CylinderGeometry(0.4, 0.6, 6, 8);
  const tailMesh = new THREE.Mesh(tailGeometry, bodyMaterial);
  tailMesh.rotation.z = Math.PI / 2;
  tailMesh.position.set(5, 0.3, 0);
  heliGroup.add(tailMesh);
  
  // Tail fin
  const finGeometry = new THREE.BoxGeometry(0.2, 2, 1);
  const finMesh = new THREE.Mesh(finGeometry, bodyMaterial);
  finMesh.position.set(7, 1, 0);
  heliGroup.add(finMesh);
  
  // Main rotor mast
  const mastGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5);
  const mastMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.7,
    metalness: 0.8
  });
  const mast = new THREE.Mesh(mastGeometry, mastMaterial);
  mast.position.y = 1.2;
  heliGroup.add(mast);
  
  // Main rotor
  const mainRotorGroup = new THREE.Group();
  const bladeLength = 8;
  const bladeGeometry = new THREE.BoxGeometry(bladeLength, 0.1, 0.5);
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.6,
    metalness: 0.4
  });
  
  // Create 4 main rotor blades
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade.rotation.y = (i / 4) * Math.PI * 2;
    mainRotorGroup.add(blade);
  }
  
  mainRotorGroup.position.y = 2;
  heliGroup.add(mainRotorGroup);
  
  // Tail rotor
  const tailRotorGroup = new THREE.Group();
  const tailBladeGeometry = new THREE.BoxGeometry(2, 0.05, 0.2);
  
  // Create 4 tail rotor blades
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(tailBladeGeometry, bladeMaterial);
    blade.rotation.z = (i / 4) * Math.PI * 2;
    tailRotorGroup.add(blade);
  }
  
  tailRotorGroup.position.set(7.5, 1, 0);
  tailRotorGroup.rotation.y = Math.PI / 2;
  heliGroup.add(tailRotorGroup);
  
  // Landing skids
  const skidGeometry = new THREE.CylinderGeometry(0.1, 0.1, 5);
  const skidMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.8,
    metalness: 0.6
  });
  
  const leftSkid = new THREE.Mesh(skidGeometry, skidMaterial);
  leftSkid.rotation.z = Math.PI / 2;
  leftSkid.position.set(0, -1.2, -1);
  heliGroup.add(leftSkid);
  
  const rightSkid = new THREE.Mesh(skidGeometry, skidMaterial);
  rightSkid.rotation.z = Math.PI / 2;
  rightSkid.position.set(0, -1.2, 1);
  heliGroup.add(rightSkid);
  
  // Connect skids to body
  const strutGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);
  for (let i = -1; i <= 1; i += 2) {
    for (let j = -1; j <= 1; j += 2) {
      const strut = new THREE.Mesh(strutGeometry, skidMaterial);
      strut.position.set(i * 1.5, -0.6, j);
      heliGroup.add(strut);
    }
  }
  
  // Store rotor references
  heliGroup.userData.mainRotor = mainRotorGroup;
  heliGroup.userData.tailRotor = tailRotorGroup;
  
  return heliGroup;
}
