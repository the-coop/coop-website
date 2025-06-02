import * as THREE from 'three';

export function createPlaneModel() {
  const planeGroup = new THREE.Group();
  
  // Main fuselage (longer and more streamlined)
  const fuselageGeometry = new THREE.CylinderGeometry(0.8, 0.4, 8, 12);
  const fuselageMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b8b8b,
    metalness: 0.8,
    roughness: 0.2
  });
  const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
  fuselage.rotation.x = Math.PI / 2;
  planeGroup.add(fuselage);
  
  // Cockpit
  const cockpitGeometry = new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const cockpitMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: 0.7
  });
  const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
  cockpit.position.z = 1.5;
  cockpit.position.y = 0.2;
  planeGroup.add(cockpit);
  
  // Nose cone
  const noseGeometry = new THREE.ConeGeometry(0.4, 1.5, 8);
  const nose = new THREE.Mesh(noseGeometry, fuselageMaterial);
  nose.position.z = 4.75;
  nose.rotation.x = Math.PI / 2; // Point forward
  planeGroup.add(nose);
  
  // Main wings (delta wing configuration)
  const wingGeometry = new THREE.BoxGeometry(8, 0.15, 3);
  const wingMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a7a7a,
    metalness: 0.7,
    roughness: 0.3
  });
  const wings = new THREE.Mesh(wingGeometry, wingMaterial);
  wings.position.z = -0.5;
  wings.castShadow = true;
  wings.receiveShadow = true;
  planeGroup.add(wings);
  
  // Wing tips
  const wingtipGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.8);
  const wingtipMaterial = new THREE.MeshStandardMaterial({
    color: 0x666666,
    metalness: 0.6,
    roughness: 0.4
  });
  
  const leftWingtip = new THREE.Mesh(wingtipGeometry, wingtipMaterial);
  leftWingtip.position.set(-4, 0, -0.5);
  planeGroup.add(leftWingtip);
  
  const rightWingtip = new THREE.Mesh(wingtipGeometry, wingtipMaterial);
  rightWingtip.position.set(4, 0, -0.5);
  planeGroup.add(rightWingtip);
  
  // Vertical stabilizer
  const vstabGeometry = new THREE.BoxGeometry(0.15, 3, 2);
  const vstab = new THREE.Mesh(vstabGeometry, wingMaterial);
  vstab.position.z = -3;
  vstab.position.y = 1;
  planeGroup.add(vstab);
  
  // Horizontal stabilizers
  const hstabGeometry = new THREE.BoxGeometry(3, 0.1, 1.2);
  const hstab = new THREE.Mesh(hstabGeometry, wingMaterial);
  hstab.position.z = -3.5;
  hstab.position.y = 0.3;
  planeGroup.add(hstab);
  
  // Engine intake
  const intakeGeometry = new THREE.CylinderGeometry(0.6, 0.7, 1.5, 12);
  const intakeMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.9,
    roughness: 0.1
  });
  const intake = new THREE.Mesh(intakeGeometry, intakeMaterial);
  intake.position.z = 1;
  intake.position.y = -0.3;
  intake.rotation.x = Math.PI / 2;
  planeGroup.add(intake);
  
  // Engine nozzle
  const nozzleGeometry = new THREE.CylinderGeometry(0.5, 0.6, 1, 12);
  const nozzleMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    metalness: 0.8,
    roughness: 0.2
  });
  const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
  nozzle.position.z = -4.5;
  nozzle.rotation.x = Math.PI / 2;
  planeGroup.add(nozzle);
  
  // Afterburner glow (initially invisible)
  const afterburnerGeometry = new THREE.ConeGeometry(0.6, 2, 8);
  const afterburnerMaterial = new THREE.MeshStandardMaterial({
    color: 0x0066ff,
    transparent: true,
    opacity: 0,
    emissive: 0x0066ff,
    emissiveIntensity: 0
  });
  const afterburner = new THREE.Mesh(afterburnerGeometry, afterburnerMaterial);
  afterburner.position.z = -6;
  afterburner.rotation.x = Math.PI / 2;
  planeGroup.add(afterburner);
  
  // Store afterburner reference
  planeGroup.userData.afterburner = afterburner;
  
  // Wing-mounted guns
  const gunGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
  const gunMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.8,
    roughness: 0.3
  });
  
  const leftGun = new THREE.Mesh(gunGeometry, gunMaterial);
  leftGun.position.set(-2, -0.2, 2);
  leftGun.rotation.x = Math.PI / 2;
  planeGroup.add(leftGun);
  
  const rightGun = new THREE.Mesh(gunGeometry, gunMaterial);
  rightGun.position.set(2, -0.2, 2);
  rightGun.rotation.x = Math.PI / 2;
  planeGroup.add(rightGun);
  
  // Store gun references
  planeGroup.userData.guns = [leftGun, rightGun];
  
  // Missile pylons under wings
  const pylonGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.5);
  const pylonMaterial = new THREE.MeshStandardMaterial({
    color: 0x555555,
    metalness: 0.7
  });
  
  const missilePylons = [];
  const pylonPositions = [
    { x: -3, y: -0.3, z: -0.5 },
    { x: 3, y: -0.3, z: -0.5 },
    { x: -2, y: -0.3, z: -0.5 },
    { x: 2, y: -0.3, z: -0.5 }
  ];
  
  pylonPositions.forEach(pos => {
    const pylon = new THREE.Mesh(pylonGeometry, pylonMaterial);
    pylon.position.set(pos.x, pos.y, pos.z);
    planeGroup.add(pylon);
    missilePylons.push(pylon);
  });
  
  // Store missile pylon references
  planeGroup.userData.missilePylons = missilePylons;
  
  // Bomb pylons under fuselage
  const bombPylons = [];
  const bombPositions = [
    { x: -1, y: -0.8, z: 0 },
    { x: 1, y: -0.8, z: 0 },
    { x: -0.5, y: -0.8, z: -1 },
    { x: 0.5, y: -0.8, z: -1 }
  ];
  
  bombPositions.forEach((pos, i) => {
    if (i < 4) { // maxBombs = 4
      const pylon = new THREE.Mesh(pylonGeometry, wingMaterial);
      pylon.position.copy(pos);
      planeGroup.add(pylon);
      
      // Add bomb model
      const bombGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.8, 8);
      const bombMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.8,
        roughness: 0.3
      });
      const bomb = new THREE.Mesh(bombGeometry, bombMaterial);
      bomb.position.y = -0.4;
      bomb.rotation.x = Math.PI / 2;
      pylon.add(bomb);
      
      // Add fins
      const finGeometry = new THREE.BoxGeometry(0.3, 0.05, 0.1);
      for (let j = 0; j < 4; j++) {
        const fin = new THREE.Mesh(finGeometry, bombMaterial);
        const angle = (j / 4) * Math.PI * 2;
        fin.position.x = Math.cos(angle) * 0.1;
        fin.position.z = Math.sin(angle) * 0.1;
        fin.position.y = -0.3;
        fin.rotation.y = angle;
        bomb.add(fin);
      }
      
      pylon.userData.bomb = bomb;
      pylon.userData.loaded = true;
      bombPylons.push(pylon);
    }
  });
  
  // Store bomb pylon references
  planeGroup.userData.bombPylons = bombPylons;
  
  // Landing gear groups
  const gearMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    metalness: 0.7,
    roughness: 0.4
  });
  
  // Nose gear
  const noseGear = new THREE.Group();
  const noseStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.8),
    gearMaterial
  );
  noseGear.add(noseStrut);
  
  const noseWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.08),
    gearMaterial
  );
  noseWheel.rotation.z = Math.PI / 2;
  noseWheel.position.y = -0.4;
  noseGear.add(noseWheel);
  
  noseGear.position.set(0, -0.5, 3);
  noseGear.userData.baseY = -0.5;
  planeGroup.add(noseGear);
  
  // Main gear (left and right)
  const leftGear = new THREE.Group();
  const leftStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1),
    gearMaterial
  );
  leftGear.add(leftStrut);
  
  const leftWheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.12),
    gearMaterial
  );
  leftWheel.rotation.z = Math.PI / 2;
  leftWheel.position.y = -0.5;
  leftGear.add(leftWheel);
  
  leftGear.position.set(-1.5, -0.6, -0.5);
  leftGear.userData.baseY = -0.6;
  planeGroup.add(leftGear);
  
  const rightGear = leftGear.clone();
  rightGear.position.set(1.5, -0.6, -0.5);
  rightGear.userData.baseY = -0.6;
  planeGroup.add(rightGear);
  
  // Store landing gear references
  planeGroup.userData.landingGear = {
    nose: noseGear,
    left: leftGear,
    right: rightGear
  };
  
  // Navigation lights
  const navLightGeometry = new THREE.SphereGeometry(0.1, 8, 6);
  
  // Red on left wingtip
  const navRedMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1.0
  });
  const navRed = new THREE.Mesh(navLightGeometry, navRedMaterial);
  navRed.position.set(-4, 0, -0.5);
  planeGroup.add(navRed);
  
  // Green on right wingtip
  const navGreenMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff00,
    emissive: 0x00ff00,
    emissiveIntensity: 1.0
  });
  const navGreen = new THREE.Mesh(navLightGeometry, navGreenMaterial);
  navGreen.position.set(4, 0, -0.5);
  planeGroup.add(navGreen);
  
  // White strobe on tail
  const strobeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 2.0
  });
  const strobe = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 6),
    strobeMaterial
  );
  strobe.position.set(0, 2.5, -3);
  planeGroup.add(strobe);
  
  // Landing light under nose
  const landingLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    strobeMaterial.clone()
  );
  landingLight.position.set(0, -0.8, 3);
  planeGroup.add(landingLight);
  
  // Store light references
  planeGroup.userData.lights = {
    navigationRed: navRed,
    navigationGreen: navGreen,
    strobeWhite: strobe,
    landingLight: landingLight
  };
  
  // Afterburner effects
  const enginePositions = [
    { x: -1.5, y: 0, z: -3 },
    { x: 1.5, y: 0, z: -3 }
  ];
  
  const afterburnerEffects = {
    leftFlame: null,
    rightFlame: null,
    leftGlow: null,
    rightGlow: null
  };
  
  enginePositions.forEach((pos, index) => {
    // Create engine exhaust cone (flame)
    const flameGeometry = new THREE.ConeGeometry(0.3, 2, 8);
    const flameMaterial = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff4400,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.set(pos.x, pos.y, pos.z - 1);
    flame.rotation.x = Math.PI / 2;
    flame.scale.set(1, 0, 1);
    planeGroup.add(flame);
    
    // Create glow effect
    const glowGeometry = new THREE.SphereGeometry(0.5, 8, 6);
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(pos.x, pos.y, pos.z);
    glow.scale.set(0, 0, 0);
    planeGroup.add(glow);
    
    if (index === 0) {
      afterburnerEffects.leftFlame = flame;
      afterburnerEffects.leftGlow = glow;
    } else {
      afterburnerEffects.rightFlame = flame;
      afterburnerEffects.rightGlow = glow;
    }
  });
  
  // Store afterburner effect references
  planeGroup.userData.afterburnerEffects = afterburnerEffects;
  
  return planeGroup;
}
