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
  tail.castShadow = true;  // Add shadow casting
  tail.receiveShadow = true;  // Add shadow receiving
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
  
  const landingGear = {}; // Store gear references
  
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
    gearGroup.userData.baseY = -1; // Store base Y position for animation
    heliGroup.add(gearGroup);
    
    landingGear[side] = gearGroup; // Store reference
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
  tailGear.userData.baseY = -0.7; // Store base Y position
  heliGroup.add(tailGear);
  
  landingGear.tail = tailGear; // Store reference
  
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
  
  // Create weapon pylons
  const weaponPylons = createWeaponPylons();
  heliGroup.add(weaponPylons.group);
  
  // Create aircraft lights
  const lightsData = createAircraftLights();
  lightsData.group.children.forEach(light => heliGroup.add(light));
  
  // Store references to parts in userData for physics system
  heliGroup.userData.fuselage = fuselage;
  heliGroup.userData.tail = tail;
  heliGroup.userData.stabilizer = stabilizer;
  heliGroup.userData.pilotCockpit = pilotCockpit;
  heliGroup.userData.gunnerCockpit = gunnerCockpit;
  heliGroup.userData.turret = turret;
  heliGroup.userData.mainRotor = mainRotorGroup;
  heliGroup.userData.tailRotor = tailRotorGroup;
  heliGroup.userData.rocketPods = weaponPylons.rocketPods;
  heliGroup.userData.gunMount = weaponPylons.gunMount;
  heliGroup.userData.lights = lightsData.lights;
  heliGroup.userData.landingGear = landingGear; // Use the populated landingGear object
  
  return heliGroup;
}

function createWeaponPylons() {
  const pylonsGroup = new THREE.Group();
  const pylonMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.3
  });
  
  // Wing stubs for weapons
  const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.5);
  const wings = new THREE.Mesh(wingGeometry, pylonMaterial);
  wings.position.set(0, -0.5, 0.5);
  pylonsGroup.add(wings);
  
  // M230 Chain Gun
  const gunMount = new THREE.Group();
  const gunBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.3),
    pylonMaterial
  );
  gunMount.add(gunBase);
  
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 1),
    pylonMaterial
  );
  gunBarrel.position.z = 0.5;
  gunBarrel.rotation.x = Math.PI / 2;
  gunMount.add(gunBarrel);
  
  gunMount.position.set(0, -0.8, 2.5);
  pylonsGroup.add(gunMount);
  
  // Rocket pods
  const rocketPods = [];
  for (let side of [-1, 1]) {
    const podGroup = new THREE.Group();
    
    // Pod housing
    const podGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5);
    const pod = new THREE.Mesh(podGeometry, pylonMaterial);
    pod.rotation.x = Math.PI / 2;
    podGroup.add(pod);
    
    // Visible rockets
    const rocketGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.2);
    const rocketMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.7
    });
    
    // Create 19 rockets per pod (hexagonal pattern)
    for (let i = 0; i < 19; i++) {
      const angle = (i / 19) * Math.PI * 2;
      const radius = i === 0 ? 0 : 0.15;
      const rocket = new THREE.Mesh(rocketGeometry, rocketMaterial);
      rocket.position.x = 0.75;
      rocket.position.y = Math.cos(angle) * radius;
      rocket.position.z = Math.sin(angle) * radius;
      rocket.rotation.z = Math.PI / 2;
      podGroup.add(rocket);
    }
    
    podGroup.position.set(side * 1.5, -0.8, 0.5);
    pylonsGroup.add(podGroup);
    rocketPods.push(podGroup);
  }
  
  return {
    group: pylonsGroup,
    gunMount: gunMount,
    rocketPods: rocketPods
  };
}

function createAircraftLights() {
  const lightsGroup = new THREE.Group();
  const lights = {};
  
  // Navigation lights - red on left (port), green on right (starboard)
  const navRedGeometry = new THREE.SphereGeometry(0.08, 8, 6);
  const navRedMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1.0
  });
  lights.navigationRed = new THREE.Mesh(navRedGeometry, navRedMaterial);
  lights.navigationRed.position.set(-1.5, -0.5, 0.5);
  lightsGroup.add(lights.navigationRed);
  
  // Add red point light
  const redPointLight = new THREE.PointLight(0xff0000, 0.8, 12);
  redPointLight.position.set(-1.5, -0.5, 0.5);
  lightsGroup.add(redPointLight);
  lights.navigationRed.userData.pointLight = redPointLight;
  
  const navGreenGeometry = new THREE.SphereGeometry(0.08, 8, 6);
  const navGreenMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 1.0
  });
  lights.navigationGreen = new THREE.Mesh(navGreenGeometry, navGreenMaterial);
  lights.navigationGreen.position.set(1.5, -0.5, 0.5);
  lightsGroup.add(lights.navigationGreen);
  
  // Add green point light
  const greenPointLight = new THREE.PointLight(0x00ff00, 0.8, 12);
  greenPointLight.position.set(1.5, -0.5, 0.5);
  lightsGroup.add(greenPointLight);
  lights.navigationGreen.userData.pointLight = greenPointLight;
  
  // White strobe lights on tail - match plane's exact setup
  const strobeGeometry = new THREE.SphereGeometry(0.08, 8, 6);
  const strobeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.0
  });
  lights.strobeWhite = new THREE.Mesh(strobeGeometry, strobeMaterial);
  lights.strobeWhite.position.set(0, 1.0, -8);
  lightsGroup.add(lights.strobeWhite);
  
  // Add white strobe point light - match plane's setup exactly
  const strobePointLight = new THREE.PointLight(0xffffff, 2, 20);
  strobePointLight.position.copy(lights.strobeWhite.position);
  lightsGroup.add(strobePointLight);
  lights.strobeWhite.userData.pointLight = strobePointLight;
  
  // Anti-collision beacon (red, rotating) - on top of main rotor
  const beaconGeometry = new THREE.SphereGeometry(0.1, 8, 6);
  const beaconMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1.5
  });
  lights.antiCollisionRed = new THREE.Mesh(beaconGeometry, beaconMaterial);
  lights.antiCollisionRed.position.set(0, 2, 0);
  lightsGroup.add(lights.antiCollisionRed);
  
  // Add anti-collision point light
  const beaconPointLight = new THREE.PointLight(0xff0000, 2, 20);
  beaconPointLight.position.set(0, 2, 0);
  lightsGroup.add(beaconPointLight);
  lights.antiCollisionRed.userData.pointLight = beaconPointLight;
  
  // Search light (white, directional)
  const searchGeometry = new THREE.SphereGeometry(0.12, 8, 6);
  const searchMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1.0
  });
  lights.searchLight = new THREE.Mesh(searchGeometry, searchMaterial);
  lights.searchLight.position.set(0, -1.2, 2);
  lightsGroup.add(lights.searchLight);
  
  // Add search light spotlight
  const searchSpotLight = new THREE.SpotLight(0xffffff, 3, 60, Math.PI / 4, 0.5);
  searchSpotLight.position.set(0, -1.2, 2);
  searchSpotLight.target.position.set(0, -5, 10);
  lightsGroup.add(searchSpotLight);
  lightsGroup.add(searchSpotLight.target);
  lights.searchLight.userData.spotLight = searchSpotLight;
  
  return {
    group: lightsGroup,
    lights: lights
  };
}
