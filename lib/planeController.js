import * as THREE from 'three';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Aircraft properties
    this.maxThrust = 60.0;
    this.maxTorque = 15.0;
    this.stallSpeed = 25;
    this.maxSpeed = 200;
    
    // Flight state
    this.throttle = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    
    // Physics
    this.body = null;
    this.collider = null;
    
    // Visual
    this.mesh = null;
    this.propeller = null;
    
    // Aircraft lights
    this.lights = {
      navigationRed: null,
      navigationGreen: null,
      strobeWhite: null,
      landingLight: null
    };
    this.lightAnimationTime = 0;
    
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
    
    // Add grounding state
    this.isGrounded = false;
    
    // Add landing gear state
    this.landingGearExtended = true;
    this.landingGearTransition = 0;
    
    // Add weapon state
    this.weaponCooldown = 0;
    this.guns = []; // Store gun positions for dual firing
    
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
    
    // Create landing gear
    this.createLandingGear();
    
    // Create aircraft lights
    this.createAircraftLights();
    
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

  updateAircraftLights(deltaTime) {
    this.lightAnimationTime += deltaTime;
    
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
  
  createPhysics(position) {
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.3,
      angularDamping: 2.0
    });
    
    const fuselageCollider = this.physics.createBoxCollider(
      new THREE.Vector3(0.8, 0.8, 4),
      {
        density: 0.5,
        friction: 0.3,
        restitution: 0.2
      }
    );
    
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
  }
  
  checkGrounded() {
    if (!this.collider || !this.body) return false;
    
    const position = this.body.translation();
    const planePos = new THREE.Vector3(position.x, position.y, position.z);
    
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, planePos)
      .normalize();
    
    const hit = this.physics.castRay(
      planePos,
      gravityDir,
      2.0,
      this.collider.handle
    );
    
    this.isGrounded = hit !== null && hit.toi < 1.5;
    return this.isGrounded;
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
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Update aircraft lights animation
    this.updateAircraftLights(deltaTime);
    
    // Handle exit input when occupied - wait for key release
    if (this.isOccupied && this.keys) {
      // Check for exit key with proper release detection
      if (this.keys.interact && !this.wasInteracting) {
        console.log('Plane controller triggering exit');
        
        // Trigger exit through the player
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          this.currentPlayer.exitVehicle();
        }
      }
      
      // Update interaction state
      this.wasInteracting = this.keys.interact;
    }
    
    // Map player keys to plane controls when occupied
    if (this.isOccupied && this.keys) {
      // Throttle controls
      this.controls.throttleUp = this.keys.run;
      this.controls.throttleDown = this.keys.crouch;
      
      // Flight controls - FIXED: Correct directions
      this.controls.pitchUp = this.keys.backward;    // S key - pitch up (nose up)
      this.controls.pitchDown = this.keys.forward;   // W key - pitch down (nose down)
      this.controls.rollLeft = this.keys.left;       // A key - roll left
      this.controls.rollRight = this.keys.right;     // D key - roll right
      this.controls.yawLeft = this.keys.rollLeft;    // Q key - yaw left
      this.controls.yawRight = this.keys.rollRight;  // E key - yaw right
      
      // Weapon controls
      if (this.keys.fireGun) {
        this.fireGun(deltaTime);
      }
      if (this.keys.fireMissile && !this.wasFiringMissile) {
        this.fireMissile();
      }
      this.wasFiringMissile = this.keys.fireMissile;
      
      // Exit control
      this.controls.interact = this.keys.interact;
    }
    
    // Update weapon cooldowns
    if (this.weaponCooldown > 0) {
      this.weaponCooldown -= deltaTime;
    }
    if (this.missileCooldown > 0) {
      this.missileCooldown -= deltaTime;
    }
    
    // Check grounding
    this.checkGrounded();
    
    // Handle exit input when occupied
    if (this.isOccupied && this.keys) {
      if (this.keys.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          console.log('Plane controller triggering exit');
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.keys.interact) {
        this.wasInteracting = false;
      }
      
      // Update throttle
      if (this.controls.throttleUp) {
        this.throttle = Math.min(this.throttle + deltaTime * 0.8, 1.0);
      } else if (this.controls.throttleDown) {
        this.throttle = Math.max(this.throttle - deltaTime * 0.8, 0);
      }
    }
    
    // Handle controls
    this.handleControls(deltaTime);
    
    // Apply physics
    this.applyAerodynamics(deltaTime);
    
    // Update rotor animations
    if (this.propeller) {
      this.propeller.rotation.z += this.throttle * deltaTime * 50;
    }
    
    // Update mesh position/rotation
    const pos = this.body.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    
    const rot = this.body.rotation();
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    
    // Update camera if occupied
    if (this.isOccupied && this.currentPlayer) {
      this.updateCamera();
    }
  }
  
  handleControls(deltaTime) {
    if (this.throttle < 0.1) return;
    
    const controlEffectiveness = Math.min(this.throttle, 1.0);
    
    // FIXED: Correct control directions
    if (this.controls.pitchUp) {
      this.pitch = Math.min(this.pitch + deltaTime * 2, this.maxPitch);
    } else if (this.controls.pitchDown) {
      this.pitch = Math.max(this.pitch - deltaTime * 2, -this.maxPitch);
    } else {
      this.pitch *= 0.9;
    }
    
    if (this.controls.rollLeft) {
      this.roll = Math.min(this.roll + deltaTime * 3, this.maxRoll);
    } else if (this.controls.rollRight) {
      this.roll = Math.max(this.roll - deltaTime * 3, -this.maxRoll);
    } else {
      this.roll *= 0.9;
    }
    
    if (this.controls.yawLeft) {
      this.yaw = Math.min(this.yaw + deltaTime * 2, this.maxYaw);
    } else if (this.controls.yawRight) {
      this.yaw = Math.max(this.yaw - deltaTime * 2, -this.maxYaw);
    } else {
      this.yaw *= 0.9;
    }
  }
  
  applyAerodynamics(deltaTime) {
    const velocity = this.body.linvel();
    const mass = this.body.mass();
    
    // Get gravity
    const position = this.body.translation();
    const planePos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, planePos)
      .normalize();
    const gravityStrength = this.physics.gravity.strength;
    
    // Apply gravity
    const gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * mass);
    this.body.addForce({
      x: gravityForce.x,
      y: gravityForce.y,
      z: gravityForce.z
    });
    
    // Get current rotation and local axes
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Apply thrust
    if (this.throttle > 0.1) {
      const thrustMagnitude = this.throttle * this.maxThrust * mass;
      const thrustForce = forward.clone().multiplyScalar(thrustMagnitude);
      
      this.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
    }
    
    // Apply control torques
    if (!this.isGrounded && this.throttle > 0.1) {
      // FIXED: Apply torques in correct directions
      if (this.pitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.pitch * this.maxTorque);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      if (this.roll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.roll * this.maxTorque);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      if (this.yaw !== 0) {
        const yawTorque = up.clone().multiplyScalar(this.yaw * this.maxTorque * 0.5);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply damping
      const angVel = this.body.angvel();
      const dampingTorque = {
        x: -angVel.x * 3.0,
        y: -angVel.y * 3.0,
        z: -angVel.z * 3.0
      };
      this.body.addTorque(dampingTorque);
    }
  }
  
  updateCamera() {
    if (!this.scene.camera || !this.mesh) return;
    
    // Simple camera shake for engine vibration
    if (this.throttle > 0.1) {
      const shakeIntensity = this.throttle * 0.01;
      const time = Date.now() * 0.02;
      
      const shakeX = Math.sin(time * 1.3) * shakeIntensity;
      const shakeY = Math.sin(time * 1.7) * shakeIntensity;
      
      this.scene.camera.position.x = shakeX;
      this.scene.camera.position.y = 10 + shakeY;
      this.scene.camera.position.z = -30;
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
    
    if (this.scene.camera.parent) {
      this.scene.camera.parent.remove(this.scene.camera);
    }
    
    this.mesh.add(this.scene.camera);
    this.scene.camera.position.set(0, 10, -30);
    this.scene.camera.rotation.set(-0.1, Math.PI, 0);
    
    console.log('Player entered plane');
    return true;
  }
  
  exitPlane() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    const planePos = this.getPosition();
    const planeRotation = this.body.rotation();
    const planeQuat = new THREE.Quaternion(planeRotation.x, planeRotation.y, planeRotation.z, planeRotation.w);
    
    const rightDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat);
    const exitDistance = 6;
    
    const exitPosition = new THREE.Vector3(
      planePos.x + rightDirection.x * exitDistance,
      planePos.y,
      planePos.z + rightDirection.z * exitDistance
    );
    
    if (this.mesh.children.includes(this.scene.camera)) {
      this.mesh.remove(this.scene.camera);
    }
    
    const player = this.currentPlayer;
    
    this.isOccupied = false;
    this.currentPlayer = null;
    
    this.throttle = 0.3; // Keep engine running
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    
    console.log('Player exited plane');
    
    return {
      exitPosition: exitPosition,
      player: player
    };
  }
  
  destroy() {
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
    
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
    
    console.log('Plane destroyed');
  }
  
  getFlightData() {
    if (!this.body) return null;
    
    const position = this.body.translation();
    const velocity = this.body.linvel();
    const positionVec = new THREE.Vector3(position.x, position.y, position.z);
    
    const gravityCenter = this.physics.gravity.center;
    const altitude = positionVec.distanceTo(gravityCenter);
    
    const velocityVec = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const airspeed = velocityVec.length();
    
    return {
      altitude: Math.round(altitude),
      airspeed: Math.round(airspeed * 10) / 10,
      throttle: Math.round(this.throttle * 100),
      isGrounded: this.isGrounded,
      stallWarning: airspeed < this.stallSpeed && !this.isGrounded
    };
  }
}
