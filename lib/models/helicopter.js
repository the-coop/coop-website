import * as THREE from 'three';

export function createHelicopterModel() {
  const heliGroup = new THREE.Group();
  
  // Main fuselage (Apache-style)
  const fuselageGeometry = new THREE.BoxGeometry(1.5, 1.5, 5);
  const fuselageMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d4a2b,
    metalness: 0.7,
    roughness: 0.3
  });
  const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
  fuselage.position.set(0, 0, 0); // Centered
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  heliGroup.add(fuselage);
  
  // Create tandem cockpits
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.8
  });
  
  // Pilot cockpit (rear)
  const pilotCockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 6),
    cockpitMaterial
  );
  pilotCockpit.scale.set(0.8, 0.6, 1.2);
  pilotCockpit.position.set(0, 0.5, 0.5);
  heliGroup.add(pilotCockpit);
  
  // Gunner cockpit (front)
  const gunnerCockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 8, 6),
    cockpitMaterial
  );
  gunnerCockpit.scale.set(0.8, 0.6, 1.2);
  gunnerCockpit.position.set(0, 0.3, 2);
  heliGroup.add(gunnerCockpit);
  
  // Tail boom
  const tailGeometry = new THREE.BoxGeometry(0.8, 0.8, 6);
  const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
  tail.position.set(0, 0, -5.5); // Just position it behind
  heliGroup.add(tail);
  
  // Vertical stabilizer
  const stabilizerGeometry = new THREE.BoxGeometry(0.1, 2, 1.5);
  const stabilizer = new THREE.Mesh(stabilizerGeometry, fuselageMaterial);
  stabilizer.position.set(0, 1, -8); // Position at tail
  heliGroup.add(stabilizer);
  
  // Main rotor
  const mainRotorGroup = new THREE.Group();
  
  // Main rotor mast
  const mastGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.5);
  const mastMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    metalness: 0.9,
    roughness: 0.1
  });
  const mainMast = new THREE.Mesh(mastGeometry, mastMaterial);
  mainRotorGroup.add(mainMast);
  
  // Main rotor blades (simplified as a disc for now)
  const rotorDiscGeometry = new THREE.CylinderGeometry(4, 4, 0.05, 16);
  const rotorDiscMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
    opacity: 0.3
  });
  const rotorDisc = new THREE.Mesh(rotorDiscGeometry, rotorDiscMaterial);
  mainRotorGroup.add(rotorDisc);
  
  // Add individual blade meshes for visual detail
  const bladeGeometry = new THREE.BoxGeometry(8, 0.05, 0.2);
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.3
  });
  
  // Create 2 main rotor blades (crossing)
  const blade1 = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade1.position.y = 0.1;
  mainRotorGroup.add(blade1);
  
  const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
  blade2.rotation.y = Math.PI / 2;
  blade2.position.y = 0.1;
  mainRotorGroup.add(blade2);
  
  mainRotorGroup.position.set(0, 1.5, 0);
  heliGroup.add(mainRotorGroup);
  
  // Tail rotor
  const tailRotorGroup = new THREE.Group();
  
  // Tail rotor hub
  const tailHubGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2);
  const tailHub = new THREE.Mesh(tailHubGeometry, mastMaterial);
  tailHub.rotation.z = Math.PI / 2;
  tailRotorGroup.add(tailHub);
  
  // Tail rotor disc
  const tailRotorDiscGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.02, 8);
  const tailRotorDisc = new THREE.Mesh(tailRotorDiscGeometry, rotorDiscMaterial);
  tailRotorDisc.rotation.z = Math.PI / 2;
  tailRotorGroup.add(tailRotorDisc);
  
  // Tail rotor blades
  const tailBladeGeometry = new THREE.BoxGeometry(1.5, 0.02, 0.1);
  const tailBlade1 = new THREE.Mesh(tailBladeGeometry, bladeMaterial);
  tailBlade1.rotation.z = Math.PI / 2;
  tailRotorGroup.add(tailBlade1);
  
  const tailBlade2 = new THREE.Mesh(tailBladeGeometry, bladeMaterial);
  tailBlade2.rotation.y = Math.PI / 2;
  tailBlade2.rotation.z = Math.PI / 2;
  tailRotorGroup.add(tailBlade2);
  
  tailRotorGroup.position.set(0.3, 0.5, -6);
  heliGroup.add(tailRotorGroup);
  
  // Add landing gear (wheels instead of skids for Apache style)
  const gearMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.8,
    roughness: 0.4
  });
  
  // Main wheels
  for (let side of ['left', 'right']) {
    const gearGroup = new THREE.Group();
    
    // Strut
    const strut = new THREE.CylinderGeometry(0.08, 0.08, 1);
    const strutMesh = new THREE.Mesh(strut, gearMaterial);
    gearGroup.add(strutMesh);
    
    // Wheel
    const wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.15);
    const wheelMesh = new THREE.Mesh(wheel, gearMaterial);
    wheelMesh.rotation.z = Math.PI / 2;
    wheelMesh.position.y = -0.5;
    gearGroup.add(wheelMesh);
    
    const xPos = side === 'left' ? -1 : 1;
    gearGroup.position.set(xPos, -1, 0);
    heliGroup.add(gearGroup);
  }
  
  // Tail wheel
  const tailGear = new THREE.Group();
  const tailStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.6),
    gearMaterial
  );
  tailGear.add(tailStrut);
  
  const tailWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.08),
    gearMaterial
  );
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.y = -0.3;
  tailGear.add(tailWheel);
  
  tailGear.position.set(0, -0.7, -5);
  heliGroup.add(tailGear);
  
  // Add sensor turret
  const turretGeometry = new THREE.SphereGeometry(0.3, 6, 6);
  const turretMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.2
  });
  const turret = new THREE.Mesh(turretGeometry, turretMaterial);
  turret.position.set(0, -0.8, 2.5);
  heliGroup.add(turret);
  
  // Store rotor references
  heliGroup.userData.mainRotor = mainRotorGroup;
  heliGroup.userData.tailRotor = tailRotorGroup;
  
  return heliGroup;
}
