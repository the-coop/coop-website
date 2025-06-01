import * as THREE from 'three';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Plane properties - ADJUSTED FOR REALISTIC TAKEOFF
    this.maxThrust = 100.0;      // Reduced from 120.0 - less acceleration
    this.liftCoefficient = 1.8;  // Reduced from 2.5 - more realistic
    this.dragCoefficient = 0.06; // Increased from 0.04 - more drag
    this.inducedDragFactor = 0.02; // New - drag from lift generation
    this.groundDragCoefficient = 0.15; // New - rolling resistance
    this.stallAngle = 20;        // Reduced from 25 - more realistic stall
    this.criticalAngle = 15;     // New - best lift angle
    this.minSpeed = 20;          // Increased from 15 - higher minimum
    this.takeoffSpeed = 35;      // Increased from 25 - more realistic
    
    // Wing properties
    this.wingArea = 15.0;        // Approximate wing area
    this.aspectRatio = 8.0;      // Wing aspect ratio
    
    // Control sensitivity
    this.pitchSensitivity = 1.5;  // Increased from 1.2
    this.rollSensitivity = 2.0;   // Increased from 1.8
    this.yawSensitivity = 0.8;    // Increased from 0.5
    
    // Ground effect parameters
    this.groundEffectHeight = 5.0; // Height at which ground effect starts
    this.groundEffectMultiplier = 1.5; // Extra lift near ground
    
    // Flight state
    this.throttle = 0;
    this.isStalling = false;
    
    // Control surfaces - INITIALIZE THIS!
    this.controlSurfaces = {
      elevator: 0,    // Pitch control (-1 to 1)
      aileron: 0,     // Roll control (-1 to 1)
      rudder: 0       // Yaw control (-1 to 1)
    };
    
    // Physics
    this.body = null;
    this.collider = null;
    
    // Visual
    this.mesh = null;
    
    // Player state
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Control state
    this.controls = {
      throttleUp: false,
      throttleDown: false,
      pitchUp: false,
      pitchDown: false,
      rollLeft: false,
      rollRight: false,
      yawLeft: false,
      yawRight: false,
      interact: false
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    this.wasTogglingGear = false;
    this.wasTogglingLights = false; // Add toggle lights state
    
    // Aircraft lights
    this.lights = {
      navigationRed: null,
      navigationGreen: null,
      strobeWhite: null,
      landingLight: null
    };
    this.lightAnimationTime = 0;
    this.lightsEnabled = true; // Add lights enabled state
    
    // Landing gear state
    this.landingGearExtended = true;
    this.landingGearTransition = 0;
    
    // Visual components
    this.landingGear = {
      nose: null,
      left: null,
      right: null
    };
    
    // Afterburner effects - MUST BE INITIALIZED BEFORE create()
    this.afterburnerEffects = {
      leftEngine: null,
      rightEngine: null,
      leftFlame: null,
      rightFlame: null,
      leftGlow: null,
      rightGlow: null,
      particles: []
    };
    
    // Weapon state
    this.weaponCooldown = 0;
    this.guns = []; // Store gun positions for dual firing
    this.missileCooldown = 0;
    this.currentMissiles = 6; // F-16 typically carries 6 missiles
    this.missilePylons = []; // Store missile pylon references
    
    // Create the plane
    this.create(position);
  }
  
  create(position) {
    // Create F-16 Fighting Falcon
    this.mesh = new THREE.Group();
    
    // Main fuselage (longer and more streamlined)
    const fuselageGeometry = new THREE.CylinderGeometry(0.8, 0.4, 8, 12);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b8b8b,
      metalness: 0.8,
      roughness: 0.2
    });
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.rotation.x = Math.PI / 2;
    this.mesh.add(fuselage);
    
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
    this.mesh.add(cockpit);
    
    // Nose cone
    const noseGeometry = new THREE.ConeGeometry(0.4, 1.5, 8);
    const nose = new THREE.Mesh(noseGeometry, fuselageMaterial);
    nose.position.z = 4.75;
    nose.rotation.x = Math.PI / 2; // Point forward instead of backward
    this.mesh.add(nose);
    
    // Main wings (delta wing configuration)
    const wingGeometry = new THREE.BoxGeometry(8, 0.15, 3);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x7a7a7a,
      metalness: 0.7,
      roughness: 0.3
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.z = -0.5;
    this.mesh.add(wings);
    
    // Wing tips
    const wingtipGeometry = new THREE.BoxGeometry(0.3, 0.8, 0.8);
    const wingtipMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.6,
      roughness: 0.4
    });
    
    const leftWingtip = new THREE.Mesh(wingtipGeometry, wingtipMaterial);
    leftWingtip.position.set(-4, 0, -0.5);
    this.mesh.add(leftWingtip);
    
    const rightWingtip = new THREE.Mesh(wingtipGeometry, wingtipMaterial);
    rightWingtip.position.set(4, 0, -0.5);
    this.mesh.add(rightWingtip);
    
    // Vertical stabilizer
    const vstabGeometry = new THREE.BoxGeometry(0.15, 3, 2);
    const vstab = new THREE.Mesh(vstabGeometry, wingMaterial);
    vstab.position.z = -3;
    vstab.position.y = 1;
    this.mesh.add(vstab);
    
    // Horizontal stabilizers
    const hstabGeometry = new THREE.BoxGeometry(3, 0.1, 1.2);
    const hstab = new THREE.Mesh(hstabGeometry, wingMaterial);
    hstab.position.z = -3.5;
    hstab.position.y = 0.3;
    this.mesh.add(hstab);
    
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
    this.mesh.add(intake);
    
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
    this.mesh.add(nozzle);
    
    // Afterburner glow (initially invisible)
    const afterburnerGeometry = new THREE.ConeGeometry(0.6, 2, 8);
    const afterburnerMaterial = new THREE.MeshBasicMaterial({
      color: 0x0066ff,
      transparent: true,
      opacity: 0,
      emissive: 0x0066ff,
      emissiveIntensity: 0
    });
    this.afterburner = new THREE.Mesh(afterburnerGeometry, afterburnerMaterial);
    this.afterburner.position.z = -6;
    this.afterburner.rotation.x = Math.PI / 2;
    this.mesh.add(this.afterburner);
    
    // Wing-mounted guns (M61 Vulcan positions)
    this.guns = [];
    
    // Left wing gun
    const leftGunGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
    const gunMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.3
    });
    const leftGun = new THREE.Mesh(leftGunGeometry, gunMaterial);
    leftGun.position.set(-2, -0.2, 2);
    leftGun.rotation.x = Math.PI / 2;
    this.mesh.add(leftGun);
    this.guns.push(leftGun);
    
    // Right wing gun  
    const rightGun = new THREE.Mesh(leftGunGeometry, gunMaterial);
    rightGun.position.set(2, -0.2, 2);
    rightGun.rotation.x = Math.PI / 2;
    this.mesh.add(rightGun);
    this.guns.push(rightGun);
    
    // Add missile pylons under wings
    this.missilePylons = [];
    const pylonPositions = [
      { x: -3, y: -0.3, z: -0.5 },
      { x: 3, y: -0.3, z: -0.5 },
      { x: -2, y: -0.3, z: -0.5 },
      { x: 2, y: -0.3, z: -0.5 }
    ];
    
    pylonPositions.forEach(pos => {
      const pylonGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.5);
      const pylonMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.7
      });
      const pylon = new THREE.Mesh(pylonGeometry, pylonMaterial);
      pylon.position.set(pos.x, pos.y, pos.z);
      this.mesh.add(pylon);
      this.missilePylons.push(pylon);
    });
    
    // Create landing gear
    this.createLandingGear();
    
    // Create aircraft lights
    this.createAircraftLights();
    
    // Create afterburner effects
    this.createAfterburnerEffects();
    
    // Position and add to scene
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Create physics
    this.createPhysics(position);
    
    // Store reference on mesh for interaction
    this.mesh.userData.planeController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
    
    console.log('F-16 created at', position);
  }
  
  createLandingGear() {
    const gearMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.4
    });
    
    // Main landing gear (tricycle configuration)
    this.landingGear = {
      nose: new THREE.Group(),
      left: new THREE.Group(),
      right: new THREE.Group()
    };
    
    // Nose gear
    const noseStrut = new THREE.CylinderGeometry(0.05, 0.05, 0.8);
    const noseStrutMesh = new THREE.Mesh(noseStrut, gearMaterial);
    this.landingGear.nose.add(noseStrutMesh);
    
    const noseWheel = new THREE.CylinderGeometry(0.15, 0.15, 0.08);
    const noseWheelMesh = new THREE.Mesh(noseWheel, gearMaterial);
    noseWheelMesh.rotation.z = Math.PI / 2;
    noseWheelMesh.position.y = -0.4;
    this.landingGear.nose.add(noseWheelMesh);
    
    this.landingGear.nose.position.set(0, -0.5, 3);
    this.landingGear.nose.userData.baseY = -0.5;
    this.mesh.add(this.landingGear.nose);
    
    // Main gear (left and right)
    ['left', 'right'].forEach((side, index) => {
      const strut = new THREE.CylinderGeometry(0.08, 0.08, 1);
      const strutMesh = new THREE.Mesh(strut, gearMaterial);
      this.landingGear[side].add(strutMesh);
      
      const wheel = new THREE.CylinderGeometry(0.25, 0.25, 0.12);
      const wheelMesh = new THREE.Mesh(wheel, gearMaterial);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.position.y = -0.5;
      this.landingGear[side].add(wheelMesh);
      
      const xPos = index === 0 ? -1.5 : 1.5;
      this.landingGear[side].position.set(xPos, -0.6, -0.5);
      this.landingGear[side].userData.baseY = -0.6;
      this.mesh.add(this.landingGear[side]);
    });
  }

  createAircraftLights() {
    // Navigation lights - red on left wingtip, green on right wingtip
    const navRedGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    const navRedMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.0
    });
    this.lights.navigationRed = new THREE.Mesh(navRedGeometry, navRedMaterial);
    this.lights.navigationRed.position.set(-4, 0, -0.5);
    this.mesh.add(this.lights.navigationRed);
    
    // Add red point light
    const redPointLight = new THREE.PointLight(0xff0000, 1, 15);
    redPointLight.position.set(-4, 0, -0.5);
    this.mesh.add(redPointLight);
    this.lights.navigationRed.userData.pointLight = redPointLight;
    
    const navGreenGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    const navGreenMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0
    });
    this.lights.navigationGreen = new THREE.Mesh(navGreenGeometry, navGreenMaterial);
    this.lights.navigationGreen.position.set(4, 0, -0.5);
    this.mesh.add(this.lights.navigationGreen);
    
    // Add green point light
    const greenPointLight = new THREE.PointLight(0x00ff00, 1, 15);
    greenPointLight.position.set(4, 0, -0.5);
    this.mesh.add(greenPointLight);
    this.lights.navigationGreen.userData.pointLight = greenPointLight;
    
    // White strobe on tail
    const strobeGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const strobeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0
    });
    this.lights.strobeWhite = new THREE.Mesh(strobeGeometry, strobeMaterial);
    this.lights.strobeWhite.position.set(0, 2.5, -3);
    this.mesh.add(this.lights.strobeWhite);
    
    // Add white strobe point light
    const strobePointLight = new THREE.PointLight(0xffffff, 2, 20);
    strobePointLight.position.set(0, 2.5, -3);
    this.mesh.add(strobePointLight);
    this.lights.strobeWhite.userData.pointLight = strobePointLight;
    
    // Landing light under nose
    const landingGeometry = new THREE.SphereGeometry(0.12, 8, 6);
    const landingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0
    });
    this.lights.landingLight = new THREE.Mesh(landingGeometry, landingMaterial);
    this.lights.landingLight.position.set(0, -0.8, 3);
    this.mesh.add(this.lights.landingLight);
    
    // Add landing light spotlight
    const landingSpotLight = new THREE.SpotLight(0xffffff, 4, 80, Math.PI / 6, 0.3);
    landingSpotLight.position.set(0, -0.8, 3);
    landingSpotLight.target.position.set(0, -10, 20);
    this.mesh.add(landingSpotLight);
    this.mesh.add(landingSpotLight.target);
    this.lights.landingLight.userData.spotLight = landingSpotLight;
  }
  
  createPhysics(position) {
    // Create rigid body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.1,
      angularDamping: 0.5
    });
    
    // Create collider
    this.collider = this.physics.createBoxCollider(
      new THREE.Vector3(5, 1, 3),
      {
        density: 0.5,
        friction: 0.3,
        restitution: 0.2
      }
    );
    
    this.physics.world.createCollider(this.collider, this.body);
  }
  
  toggleLights() {
    this.lightsEnabled = !this.lightsEnabled;
    console.log(`Aircraft lights ${this.lightsEnabled ? 'ON' : 'OFF'}`);
    
    // Immediately update light visibility
    if (this.lights.navigationRed) {
      this.lights.navigationRed.visible = this.lightsEnabled;
    }
    if (this.lights.navigationGreen) {
      this.lights.navigationGreen.visible = this.lightsEnabled;
    }
    if (this.lights.strobeWhite) {
      this.lights.strobeWhite.visible = this.lightsEnabled;
    }
    if (this.lights.landingLight) {
      this.lights.landingLight.visible = this.lightsEnabled;
    }
  }

  updateAircraftLights(deltaTime) {
    this.lightAnimationTime += deltaTime;
    
    // Only animate if lights are enabled
    if (!this.lightsEnabled) return;
    
    // Navigation lights - steady on
    if (this.lights.navigationRed) {
      this.lights.navigationRed.material.emissiveIntensity = 1.0;
      if (this.lights.navigationRed.userData.pointLight) {
        this.lights.navigationRed.userData.pointLight.intensity = 1.0;
      }
    }
    
    if (this.lights.navigationGreen) {
      this.lights.navigationGreen.material.emissiveIntensity = 1.0;
      if (this.lights.navigationGreen.userData.pointLight) {
        this.lights.navigationGreen.userData.pointLight.intensity = 1.0;
      }
    }
    
    // White strobe - quick flash pattern every 1.5 seconds
    if (this.lights.strobeWhite) {
      const strobeTime = this.lightAnimationTime % 1.5;
      let strobeIntensity = 0.1;
      
      if (strobeTime < 0.1) {
        strobeIntensity = 2.0;
      }
      
      this.lights.strobeWhite.material.emissiveIntensity = strobeIntensity;
      if (this.lights.strobeWhite.userData.pointLight) {
        this.lights.strobeWhite.userData.pointLight.intensity = strobeIntensity * 2;
      }
    }
    
    // Landing light - brighter when landing gear is down
    if (this.lights.landingLight) {
      const landingIntensity = this.landingGearExtended ? 1.0 : 0.3;
      this.lights.landingLight.material.emissiveIntensity = landingIntensity;
      
      if (this.lights.landingLight.userData.spotLight) {
        this.lights.landingLight.userData.spotLight.intensity = landingIntensity * 4;
      }
    }
  }
  
  createAfterburnerEffects() {
    // Engine positions (behind the wings)
    const enginePositions = [
      { x: -1.5, y: 0, z: -3 },  // Left engine
      { x: 1.5, y: 0, z: -3 }    // Right engine
    ];
    
    enginePositions.forEach((pos, index) => {
      // Create engine exhaust cone (flame)
      const flameGeometry = new THREE.ConeGeometry(0.3, 2, 8);
      const flameMaterial = new THREE.MeshBasicMaterial({
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
      flame.scale.set(1, 0, 1); // Start with no flame
      this.mesh.add(flame);
      
      // Create glow effect
      const glowGeometry = new THREE.SphereGeometry(0.5, 8, 6);
      const glowMaterial = new THREE.MeshBasicMaterial({
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
      this.mesh.add(glow);
      
      // Create point light for engine
      const engineLight = new THREE.PointLight(0xff4400, 0, 10);
      engineLight.position.set(pos.x, pos.y, pos.z);
      this.mesh.add(engineLight);
      
      // Store references
      if (index === 0) {
        this.afterburnerEffects.leftFlame = flame;
        this.afterburnerEffects.leftGlow = glow;
        this.afterburnerEffects.leftEngine = engineLight;
      } else {
        this.afterburnerEffects.rightFlame = flame;
        this.afterburnerEffects.rightGlow = glow;
        this.afterburnerEffects.rightEngine = engineLight;
      }
    });
  }

  updateAfterburnerEffects(deltaTime) {
    // Scale effects based on throttle
    const throttleEffect = this.throttle * this.throttle; // Square for more dramatic effect
    const pulseTime = Date.now() * 0.01;
    const pulseFactor = 0.9 + Math.sin(pulseTime) * 0.1;
    
    // Update flame effects
    [this.afterburnerEffects.leftFlame, this.afterburnerEffects.rightFlame].forEach(flame => {
      if (flame) {
        // Scale flame based on throttle
        flame.scale.set(
          0.5 + throttleEffect * 0.5,
          throttleEffect * 1.5,
          0.5 + throttleEffect * 0.5
        );
        
        // Adjust opacity
        flame.material.opacity = throttleEffect * 0.8;
        
        // Color shift based on throttle (orange to blue-white at max)
        if (this.throttle > 0.8) {
          const highThrottleFactor = (this.throttle - 0.8) / 0.2;
          flame.material.color.setRGB(
            1,
            0.3 + highThrottleFactor * 0.7,
            highThrottleFactor * 0.8
          );
        } else {
          flame.material.color.setHex(0xff4400);
        }
        
        // Add flicker
        flame.material.emissiveIntensity = 2 + pulseFactor * throttleEffect;
      }
    });
    
    // Update glow effects
    [this.afterburnerEffects.leftGlow, this.afterburnerEffects.rightGlow].forEach(glow => {
      if (glow) {
        const glowScale = throttleEffect * pulseFactor;
        glow.scale.set(glowScale, glowScale, glowScale);
        glow.material.opacity = throttleEffect * 0.6;
        
        // Color shift for glow too
        if (this.throttle > 0.8) {
          const highThrottleFactor = (this.throttle - 0.8) / 0.2;
          glow.material.color.setRGB(
            1,
            0.4 + highThrottleFactor * 0.6,
            highThrottleFactor * 0.6
          );
        }
      }
    });
    
    // Update engine lights
    [this.afterburnerEffects.leftEngine, this.afterburnerEffects.rightEngine].forEach(light => {
      if (light) {
        light.intensity = throttleEffect * 3 * pulseFactor;
        
        // Color shift for light
        if (this.throttle > 0.8) {
          const highThrottleFactor = (this.throttle - 0.8) / 0.2;
          light.color.setRGB(
            1,
            0.3 + highThrottleFactor * 0.7,
            highThrottleFactor * 0.8
          );
        } else {
          light.color.setHex(0xff4400);
        }
      }
    });
    
    // Create exhaust particles at high throttle
    if (this.throttle > 0.5 && Math.random() < this.throttle) {
      this.createExhaustParticle();
    }
    
    // Update and clean up particles
    this.afterburnerEffects.particles = this.afterburnerEffects.particles.filter(particle => {
      particle.age += deltaTime;
      
      // Update particle
      const ageRatio = particle.age / particle.maxAge;
      particle.mesh.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
      particle.velocity.multiplyScalar(0.98); // Drag
      
      // Fade out
      particle.mesh.material.opacity = (1 - ageRatio) * 0.5;
      particle.mesh.scale.multiplyScalar(1 - deltaTime * 0.5);
      
      // Remove old particles
      if (particle.age > particle.maxAge) {
        this.scene.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        particle.mesh.material.dispose();
        return false;
      }
      
      return true;
    });
  }

  createExhaustParticle() {
    // Limit particle count
    if (this.afterburnerEffects.particles.length > 50) return;
    
    const particleGeometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.1, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: this.throttle > 0.8 ? 0x8888ff : 0xff6600,
      emissive: this.throttle > 0.8 ? 0x4444ff : 0xff4400,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Random engine position
    const engineX = Math.random() < 0.5 ? -1.5 : 1.5;
    const worldPos = new THREE.Vector3(engineX, 0, -3);
    worldPos.applyQuaternion(this.mesh.quaternion);
    worldPos.add(this.mesh.position);
    
    particle.position.copy(worldPos);
    
    // Get backward direction with some randomness
    const backward = new THREE.Vector3(0, 0, -1);
    backward.applyQuaternion(this.mesh.quaternion);
    
    // Add some spread
    const spread = 0.2;
    backward.x += (Math.random() - 0.5) * spread;
    backward.y += (Math.random() - 0.5) * spread;
    backward.normalize();
    
    const particleSpeed = 10 + Math.random() * 5;
    
    this.scene.scene.add(particle);
    
    this.afterburnerEffects.particles.push({
      mesh: particle,
      velocity: backward.multiplyScalar(particleSpeed),
      age: 0,
      maxAge: 0.5 + Math.random() * 0.5
    });
  }

  toggleLandingGear() {
    // Only allow retraction when airborne
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    const hit = this.physics.castRay(playerPos, gravityDir, 2.0, this.collider.handle);
    const isGrounded = hit !== null && hit.toi < 1.5;
    
    if (!this.landingGearExtended || !isGrounded) {
      this.landingGearExtended = !this.landingGearExtended;
    }
  }
  
  updateLandingGear(deltaTime) {
    const targetTransition = this.landingGearExtended ? 1 : 0;
    const transitionSpeed = 2.0;
    
    if (this.landingGearTransition !== targetTransition) {
      const delta = targetTransition - this.landingGearTransition;
      const change = Math.sign(delta) * Math.min(Math.abs(delta), deltaTime * transitionSpeed);
      this.landingGearTransition += change;
      
      // Update gear positions
      const gearOffset = (1 - this.landingGearTransition) * 0.5;
      
      Object.values(this.landingGear).forEach(gear => {
        if (gear && gear.userData.baseY !== undefined) {
          gear.position.y = gear.userData.baseY + gearOffset;
        }
      });
    }
  }
  
  getPosition() {
    if (!this.body) return new THREE.Vector3();
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }
  
  getVelocity() {
    if (!this.body) return new THREE.Vector3();
    const vel = this.body.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }
  
  enterPlane(player) {
    if (this.isOccupied) return false;
    
    this.isOccupied = true;
    this.currentPlayer = player;
    this.wasInteracting = true;
    
    // Remove camera from its current parent
    if (this.scene.camera.parent) {
      this.scene.camera.parent.remove(this.scene.camera);
    }
    
    // Attach camera to plane
    this.mesh.add(this.scene.camera);
    
    // Position camera behind and above plane, facing forward (like helicopter)
    this.scene.camera.position.set(0, 3, -10);
    this.scene.camera.rotation.set(-0.1, Math.PI, 0); // Slight downward tilt, rotated 180 degrees to face forward
    
    return true;
  }
  
  exitPlane() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    const planePos = this.getPosition();
    const exitPosition = new THREE.Vector3(
      planePos.x + 3,
      planePos.y,
      planePos.z
    );
    
    // Remove camera from plane
    if (this.mesh.children.includes(this.scene.camera)) {
      this.mesh.remove(this.scene.camera);
    }
    
    const player = this.currentPlayer;
    
    // Clear state
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Reset controls
    this.throttle = 0;
    this.controlSurfaces.elevator = 0;
    this.controlSurfaces.aileron = 0;
    this.controlSurfaces.rudder = 0;
    
    return {
      exitPosition: exitPosition,
      player: player
    };
  }
  
  fireGun(deltaTime) {
    if (this.weaponCooldown > 0) return;
    
    // Fire from both wing guns
    this.guns.forEach((gun, index) => {
      const muzzlePos = new THREE.Vector3();
      gun.getWorldPosition(muzzlePos);
      muzzlePos.add(new THREE.Vector3(0, 0, 0.6).applyQuaternion(this.mesh.quaternion));
      
      // Get forward direction
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(this.mesh.quaternion);
      
      // Create enhanced muzzle flash for each gun
      const flashGroup = new THREE.Group();
      flashGroup.position.copy(muzzlePos);
      
      // Randomize flash appearance
      const flashVariant = Math.random();
      
      if (flashVariant < 0.33) {
        // Cross pattern
        for (let i = 0; i < 4; i++) {
          const flashGeometry = new THREE.PlaneGeometry(0.6, 0.15);
          const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.95,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
          });
          const flashPlane = new THREE.Mesh(flashGeometry, flashMaterial);
          flashPlane.rotation.z = (i / 4) * Math.PI + index * 0.2; // Offset for each gun
          flashGroup.add(flashPlane);
        }
      } else if (flashVariant < 0.66) {
        // Double cone
        const coneGeometry = new THREE.ConeGeometry(0.25, 0.8, 5);
        const coneMaterial = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending
        });
        const cone1 = new THREE.Mesh(coneGeometry, coneMaterial);
        cone1.rotation.x = -Math.PI / 2;
        flashGroup.add(cone1);
        
        const cone2 = new THREE.Mesh(coneGeometry, coneMaterial.clone());
        cone2.rotation.x = -Math.PI / 2;
        cone2.scale.set(0.6, 0.6, 0.6);
        cone2.material.color.setHex(0xffffff);
        flashGroup.add(cone2);
      } else {
        // Ring burst
        const ringGeometry = new THREE.RingGeometry(0.1, 0.4, 8);
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        flashGroup.add(ring);
        
        // Add inner flash
        const innerGeometry = new THREE.CircleGeometry(0.2, 6);
        const innerMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1.0,
          blending: THREE.AdditiveBlending
        });
        const inner = new THREE.Mesh(innerGeometry, innerMaterial);
        flashGroup.add(inner);
      }
      
      // Orient toward firing direction
      flashGroup.lookAt(muzzlePos.clone().add(forward));
      this.scene.scene.add(flashGroup);
      
      // Create muzzle flash light with varying color
      const lightColor = Math.random() > 0.5 ? 0xffaa00 : 0xffff00;
      const flash = new THREE.PointLight(lightColor, 3 + Math.random(), 8);
      flash.position.copy(muzzlePos);
      this.scene.scene.add(flash);
      
      // Create tracer
      const tracerGeometry = new THREE.CylinderGeometry(0.02, 0.02, 3);
      const tracerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        emissive: 0xffaa00,
        emissiveIntensity: 2
      });
      const tracer = new THREE.Mesh(tracerGeometry, tracerMaterial);
      tracer.position.copy(muzzlePos);
      tracer.quaternion.copy(this.mesh.quaternion);
      tracer.rotateX(Math.PI / 2);
      
      this.scene.scene.add(tracer);
      
      // Animate removal
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / 80; // 80ms duration
        
        if (progress >= 1) {
          this.scene.scene.remove(flash);
          this.scene.scene.remove(flashGroup);
          this.scene.scene.remove(tracer);
          flashGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          tracerGeometry.dispose();
          tracerMaterial.dispose();
          return;
        }
        
        // Animate effects
        flash.intensity = (3 + Math.random()) * (1 - progress);
        flashGroup.scale.setScalar(1 + progress * 0.5);
        flashGroup.children.forEach(child => {
          if (child.material) {
            child.material.opacity *= (1 - progress * 0.3);
          }
        });
        
        requestAnimationFrame(animate);
      };
      
      animate();
    });
    
    this.weaponCooldown = 0.1; // 10 rounds per second
    
    console.log('Firing wing guns');
  }
  
  fireMissile() {
    if (this.missileCooldown > 0 || this.currentMissiles <= 0) return;
    
    this.currentMissiles--;
    
    // Alternate between pylons
    const pylonIndex = this.currentMissiles % 2;
    const pylon = this.missilePylons[pylonIndex];
    
    // Get launch position
    const launchPos = new THREE.Vector3();
    pylon.getWorldPosition(launchPos);
    
    // Create missile with physics and guidance similar to helicopter
    const missileBody = this.physics.createDynamicBody(launchPos, {
      linearDamping: 0.02,
      angularDamping: 0.8
    });
    
    const missileCollider = this.physics.createBoxCollider(
      new THREE.Vector3(0.06, 0.06, 0.4),
      {
        density: 1.0,
        friction: 0.1,
        restitution: 0.1
      }
    );
    
    this.physics.world.createCollider(missileCollider, missileBody);
    
    // Create visual missile
    const missileGroup = new THREE.Group();
    const missileGeometry = new THREE.CylinderGeometry(0.08, 0.06, 0.8);
    const missileMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.8
    });
    const missileMesh = new THREE.Mesh(missileGeometry, missileMaterial);
    missileMesh.rotation.x = Math.PI / 2;
    missileGroup.add(missileMesh);
    
    // Add fins and warhead like helicopter missile
    const finGeometry = new THREE.BoxGeometry(0.02, 0.12, 0.06);
    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.7
    });
    
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeometry, finMaterial);
      const angle = (i / 4) * Math.PI * 2;
      fin.position.x = Math.cos(angle) * 0.06;
      fin.position.y = Math.sin(angle) * 0.06;
      fin.position.z = -0.25;
      missileGroup.add(fin);
    }
    
    this.scene.scene.add(missileGroup);
    
    // Launch with plane velocity
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    const planeVel = this.getVelocity();
    const launchVelocity = forward.multiplyScalar(100).add(planeVel);
    
    missileBody.setLinvel({
      x: launchVelocity.x,
      y: launchVelocity.y,
      z: launchVelocity.z
    });
    
    const rotation = this.body.rotation();
    missileBody.setRotation(rotation);
    
    // Similar guidance system as helicopter
    const missile = {
      body: missileBody,
      mesh: missileGroup,
      age: 0,
      maxAge: 15,
      thrust: 50,
      guidanceActive: true
    };
    
    const updateMissile = () => {
      if (!missile.body) return;
      
      const pos = missile.body.translation();
      missile.mesh.position.set(pos.x, pos.y, pos.z);
      
      const rot = missile.body.rotation();
      missile.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      
      // Apply thrust
      const missileForward = new THREE.Vector3(0, 0, 1);
      missileForward.applyQuaternion(missile.mesh.quaternion);
      const thrustForce = missileForward.multiplyScalar(missile.thrust);
      
      missile.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
      
      // Apply gravity
      this.physics.applyGravityToBody(missile.body, 0.016);
      
      missile.age += 0.016;
      
      if (missile.age < missile.maxAge) {
        requestAnimationFrame(updateMissile);
      } else {
        this.scene.scene.remove(missile.mesh);
        missileGroup.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.physics.world.removeRigidBody(missile.body);
      }
    };
    
    updateMissile();
    
    this.missileCooldown = 2.0; // 2 second cooldown between missiles
    
    console.log(`Missile fired! ${this.currentMissiles} remaining`);
  }
  
  handleControls(deltaTime) {
    // Update throttle
    if (this.controls.throttleUp) {
      this.throttle = Math.min(this.throttle + deltaTime * 0.5, 1.0);
    } else if (this.controls.throttleDown) {
      this.throttle = Math.max(this.throttle - deltaTime * 0.5, 0);
    }
    
    // Control surface deflections with smooth transitions
    const controlRate = 3.0; // How fast controls respond
    
    // Elevator (pitch)
    let targetElevator = 0;
    if (this.controls.pitchUp) targetElevator = -1;
    else if (this.controls.pitchDown) targetElevator = 1;
    
    this.controlSurfaces.elevator += (targetElevator - this.controlSurfaces.elevator) * deltaTime * controlRate;
    
    // Ailerons (roll)
    let targetAileron = 0;
    if (this.controls.rollLeft) targetAileron = -1;
    else if (this.controls.rollRight) targetAileron = 1;
    
    this.controlSurfaces.aileron += (targetAileron - this.controlSurfaces.aileron) * deltaTime * controlRate;
    
    // Rudder (yaw)
    let targetRudder = 0;
    if (this.controls.yawLeft) targetRudder = -1;
    else if (this.controls.yawRight) targetRudder = 1;
    
    this.controlSurfaces.rudder += (targetRudder - this.controlSurfaces.rudder) * deltaTime * controlRate;
    
    // Clamp control surfaces
    this.controlSurfaces.elevator = Math.max(-1, Math.min(1, this.controlSurfaces.elevator));
    this.controlSurfaces.aileron = Math.max(-1, Math.min(1, this.controlSurfaces.aileron));
    this.controlSurfaces.rudder = Math.max(-1, Math.min(1, this.controlSurfaces.rudder));
  }

  update(deltaTime) {
    if (!this.body) return;
    
    // Clamp deltaTime to prevent instability
    deltaTime = Math.min(deltaTime, 0.05);
    
    // Update aircraft lights
    this.updateAircraftLights(deltaTime);
    
    // Update afterburner effects
    this.updateAfterburnerEffects(deltaTime);
    
    // Map player keys to plane controls when occupied
    if (this.isOccupied && this.keys) {
      this.controls.throttleUp = this.keys.run;
      this.controls.throttleDown = this.keys.crouch;
      this.controls.pitchUp = this.keys.forward;
      this.controls.pitchDown = this.keys.backward;
      this.controls.rollLeft = this.keys.left;
      this.controls.rollRight = this.keys.right;
      this.controls.yawLeft = this.keys.rollLeft;
      this.controls.yawRight = this.keys.rollRight;
      this.controls.interact = this.keys.interact;
      
      // Handle landing gear toggle
      if (this.keys.landingGear && !this.wasTogglingGear) {
        this.toggleLandingGear();
      }
      this.wasTogglingGear = this.keys.landingGear;
      
      // Handle lights toggle
      if (this.keys.toggleLights && !this.wasTogglingLights) {
        this.toggleLights();
      }
      this.wasTogglingLights = this.keys.toggleLights;
    }
    
    // Handle exit input
    if (this.isOccupied && this.keys) {
      if (this.keys.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.keys.interact) {
        this.wasInteracting = false;
      }
    }
    
    // Handle controls
    this.handleControls(deltaTime);
    
    // Apply physics
    this.applyAerodynamics(deltaTime);
    
    // Update mesh position/rotation
    const pos = this.body.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    
    const rot = this.body.rotation();
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }
  
  getFlightData() {
    if (!this.body) return null;
    
    const position = this.body.translation();
    const velocity = this.body.linvel();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    const positionVec = new THREE.Vector3(position.x, position.y, position.z);
    const gravityCenter = this.physics.gravity.center;
    const altitude = positionVec.distanceTo(gravityCenter);
    
    const velocityVec = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const airspeed = velocityVec.length();
    
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, positionVec)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    const verticalSpeed = velocityVec.dot(upDir);
    
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    
    const forwardHorizontal = forward.clone()
      .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
      .normalize();
    const heading = Math.atan2(forwardHorizontal.x, forwardHorizontal.z) * (180 / Math.PI);
    
    const pitch = Math.asin(forward.dot(upDir)) * (180 / Math.PI);
    
    const rightHorizontal = right.clone()
      .sub(upDir.clone().multiplyScalar(right.dot(upDir)));
    const roll = Math.atan2(right.dot(gravityDir), rightHorizontal.length()) * (180 / Math.PI);
    
    return {
      altitude: Math.round(altitude),
      airspeed: Math.round(airspeed * 10) / 10,
      verticalSpeed: Math.round(verticalSpeed * 10) / 10,
      heading: Math.round((heading + 360) % 360),
      pitch: Math.round(pitch),
      roll: Math.round(roll),
      throttle: Math.round(this.throttle * 100),
      isGrounded: false,
      stallWarning: this.isStalling,
      gravityDir: gravityDir
    };
  }
  
  applyAerodynamics(deltaTime) {
    const velocity = this.body.linvel();
    const mass = this.body.mass();
    
    // Calculate gravity info
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    
    // Prevent NaN by checking velocity
    if (isNaN(velocity.x) || isNaN(velocity.y) || isNaN(velocity.z)) {
      console.warn('NaN velocity detected, resetting to zero');
      this.body.setLinvel({ x: 0, y: 0, z: 0 });
      return;
    }
    
    // Apply gravity
    const gravityStrength = this.physics.gravity.strength;
    const gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * mass);
    this.body.addForce({
      x: gravityForce.x,
      y: gravityForce.y,
      z: gravityForce.z
    });
    
    // Get current rotation
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Get local axes
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate airspeed and velocity vector
    const airspeedVector = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const airspeed = airspeedVector.length();
    
    // Apply thrust
    if (this.throttle > 0) {
      const thrustMagnitude = this.throttle * this.maxThrust * mass;
      const thrustForce = forward.clone().multiplyScalar(thrustMagnitude);
      
      this.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
    }
    
    // Calculate angle of attack properly
    let angleOfAttack = 0;
    let liftDirection = up.clone();
    
    if (airspeed > 1) {
      // Get velocity relative to plane
      const relativeVelocity = airspeedVector.clone().normalize();
      
      // Calculate angle between velocity and forward direction
      const dot = forward.dot(relativeVelocity);
      const clampedDot = Math.max(-1, Math.min(1, dot));
      angleOfAttack = Math.acos(clampedDot);
      
      // Determine sign of angle of attack
      const velocityInPlaneFrame = relativeVelocity.clone();
      const upComponent = velocityInPlaneFrame.dot(up);
      if (upComponent < 0) {
        angleOfAttack = -angleOfAttack;
      }
      
      // Convert to degrees for calculations
      angleOfAttack = angleOfAttack * (180 / Math.PI);
      
      // Calculate lift direction - perpendicular to relative velocity in the plane of wings
      // This ensures lift is always perpendicular to airflow
      if (Math.abs(relativeVelocity.dot(up)) < 0.99) {
        liftDirection = new THREE.Vector3()
          .crossVectors(relativeVelocity, right)
          .normalize();
      }
    }
    
    // Check for stall - but not if landing gear is extended
    this.isStalling = this.landingGearExtended ? false : Math.abs(angleOfAttack) > this.stallAngle;
    
    // Calculate lift with proper physics
    if (airspeed > this.minSpeed) {
      // Lift coefficient varies with angle of attack
      let Cl = 0;
      
      if (!this.isStalling) {
        // Linear approximation of lift coefficient
        // Maximum at critical angle, zero at 0 degrees
        const normalizedAngle = Math.abs(angleOfAttack) / this.criticalAngle;
        Cl = this.liftCoefficient * Math.sin(normalizedAngle * Math.PI / 2);
        
        // Reduce lift at very high angles (approaching stall) - but not with gear down
        if (!this.landingGearExtended && Math.abs(angleOfAttack) > this.criticalAngle) {
          const stallFactor = 1 - ((Math.abs(angleOfAttack) - this.criticalAngle) / 
                                  (this.stallAngle - this.criticalAngle));
          Cl *= Math.max(0.3, stallFactor);
        }
      } else {
        // Stalled - drastically reduced lift (won't happen with gear down)
        Cl = this.liftCoefficient * 0.2;
      }
      
      // Lift equation: L = 0.5 * ρ * V² * S * Cl
      // Simplified with density = 1
      const liftMagnitude = 0.5 * airspeed * airspeed * this.wingArea * Cl * 0.01;
      
      // Ground effect - extra lift when close to ground
      const groundDistance = this.checkGroundDistance(playerPos, gravityDir);
      if (groundDistance < this.groundEffectHeight && groundDistance > 0) {
        const groundEffectFactor = 1 + (this.groundEffectMultiplier - 1) * 
          (1 - groundDistance / this.groundEffectHeight);
        liftMagnitude *= groundEffectFactor;
      }
      
      const liftForce = liftDirection.multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
      
      // Induced drag - drag created by lift generation
      if (liftMagnitude > 0) {
        const inducedDrag = this.inducedDragFactor * liftMagnitude * liftMagnitude / 
                           (airspeed * airspeed);
        const inducedDragForce = airspeedVector.clone()
          .normalize()
          .multiplyScalar(-inducedDrag);
        
        this.body.addForce({
          x: inducedDragForce.x,
          y: inducedDragForce.y,
          z: inducedDragForce.z
        });
      }
    }
    
    // Apply drag
    if (airspeed > 0.1) {
      // Check if on ground for different drag calculation
      const onGround = this.checkGroundDistance(playerPos, gravityDir) < 1.0;
      
      let dragCoeff = this.dragCoefficient;
      if (onGround && airspeed < this.takeoffSpeed) {
        // Higher drag on ground (rolling resistance)
        dragCoeff = this.groundDragCoefficient;
      }
      
      // Drag equation: D = 0.5 * ρ * V² * S * Cd
      const dragMagnitude = 0.5 * dragCoeff * airspeed * airspeed * this.wingArea * 0.01;
      const dragForce = airspeedVector.clone().normalize().multiplyScalar(-dragMagnitude);
      
      this.body.addForce({
        x: dragForce.x,
        y: dragForce.y,
        z: dragForce.z
      });
    }
    
    // Apply control surfaces (reduced effectiveness at low speed)
    const controlSpeed = Math.max(5, this.minSpeed * 0.5);
    if (airspeed > controlSpeed) {
      const controlEffectiveness = Math.min(1.0, (airspeed - controlSpeed) / 
                                           (this.takeoffSpeed - controlSpeed));
      
      // Control effectiveness also depends on dynamic pressure
      const dynamicPressure = 0.5 * airspeed * airspeed;
      const controlForce = dynamicPressure * 0.01;
      
      // Pitch control
      if (this.controlSurfaces.elevator !== 0) {
        const pitchTorque = right.clone().multiplyScalar(
          this.controlSurfaces.elevator * this.pitchSensitivity * 
          controlEffectiveness * controlForce
        );
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Roll control
      if (this.controlSurfaces.aileron !== 0) {
        const rollTorque = forward.clone().multiplyScalar(
          this.controlSurfaces.aileron * this.rollSensitivity * 
          controlEffectiveness * controlForce
        );
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Yaw control (rudder) - less effective than other controls
      if (this.controlSurfaces.rudder !== 0) {
        const yawTorque = up.clone().multiplyScalar(
          this.controlSurfaces.rudder * this.yawSensitivity * 
          controlEffectiveness * controlForce * 0.5
        );
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
    }
    
    // Angular damping for stability
    const angVel = this.body.angvel();
    const angularDamping = {
      x: -angVel.x * 2.0,
      y: -angVel.y * 2.0,
      z: -angVel.z * 2.0
    };
    this.body.addTorque(angularDamping);
  }

  // Add ground distance check for ground effect
  checkGroundDistance(position, gravityDir) {
    const rayOrigin = position.clone();
    const rayDir = gravityDir;
    const maxDistance = this.groundEffectHeight * 2;
    
    const hit = this.physics.castRay(
      rayOrigin,
      rayDir,
      maxDistance,
      this.collider.handle
    );
    
    return hit ? hit.toi : maxDistance;
  }
}
