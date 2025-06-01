import * as THREE from 'three';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Aircraft properties
    this.maxThrust = 60.0;
    this.maxTorque = 15.0;
    this.stallSpeed = 5.0;
    
    // Control limits
    this.maxPitch = 0.8;
    this.maxRoll = 1.2;
    this.maxYaw = 0.6;
    
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
    this.wasFiringMissile = false;
    
    // Add grounding state
    this.isGrounded = false;
    
    // Add landing gear state
    this.landingGearExtended = true;
    this.landingGearTransition = 0;
    
    // Add weapon state
    this.weaponCooldown = 0;
    this.missileCooldown = 0;
    this.missiles = [];
    this.maxMissiles = 4;
    this.currentMissiles = this.maxMissiles;
    
    // Visual components
    this.landingGear = {
      main: null,
      nose: null
    };
    
    // Create the plane
    this.create(position);
  }
  
  create(position) {
    // Create fighter jet
    this.mesh = new THREE.Group();
    
    // Main fuselage
    const fuselageGeometry = new THREE.CylinderGeometry(0.8, 0.4, 8);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x404040,
      metalness: 0.7,
      roughness: 0.3
    });
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.rotation.z = Math.PI / 2; // Align with forward direction
    this.mesh.add(fuselage);
    
    // Cockpit
    const cockpitGeometry = new THREE.SphereGeometry(0.6, 8, 6);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.8
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.scale.set(1, 0.7, 1.5);
    cockpit.position.set(0, 0.3, 1.5);
    this.mesh.add(cockpit);
    
    // Wings
    const wingGeometry = new THREE.BoxGeometry(8, 0.3, 2.5);
    const wing = new THREE.Mesh(wingGeometry, fuselageMaterial);
    wing.position.set(0, -0.2, 0);
    this.mesh.add(wing);
    
    // Tail
    const tailGeometry = new THREE.BoxGeometry(0.3, 3, 1.5);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.position.set(0, 0.5, -3.5);
    this.mesh.add(tail);
    
    // Horizontal stabilizer
    const stabilizerGeometry = new THREE.BoxGeometry(3, 0.2, 1);
    const stabilizer = new THREE.Mesh(stabilizerGeometry, fuselageMaterial);
    stabilizer.position.set(0, 0, -3.5);
    this.mesh.add(stabilizer);
    
    // Create weapons
    this.createWeapons();
    
    // Create landing gear
    this.createLandingGear();
    
    // Create propeller
    this.createPropeller();
    
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
    
    console.log('Fighter jet created at', position);
  }
  
  createWeapons() {
    const weaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.3
    });
    
    // Wing-mounted guns
    this.guns = [];
    for (let side of [-1, 1]) {
      const gunGroup = new THREE.Group();
      
      // Gun barrel
      const barrelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 1.2);
      const barrel = new THREE.Mesh(barrelGeometry, weaponMaterial);
      barrel.rotation.z = Math.PI / 2;
      barrel.position.x = 0.6;
      gunGroup.add(barrel);
      
      // Gun housing
      const housingGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.4);
      const housing = new THREE.Mesh(housingGeometry, weaponMaterial);
      gunGroup.add(housing);
      
      gunGroup.position.set(side * 3, -0.3, 0.5);
      this.mesh.add(gunGroup);
      this.guns.push(gunGroup);
    }
    
    // Missile pylons
    this.missilePylons = [];
    for (let side of [-1, 1]) {
      const pylonGroup = new THREE.Group();
      
      // Pylon structure
      const pylonGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.3);
      const pylon = new THREE.Mesh(pylonGeometry, weaponMaterial);
      pylonGroup.add(pylon);
      
      // Missiles
      for (let i = 0; i < 2; i++) {
        const missileGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.8);
        const missileMaterial = new THREE.MeshStandardMaterial({
          color: 0x666666,
          metalness: 0.7
        });
        const missile = new THREE.Mesh(missileGeometry, missileMaterial);
        missile.rotation.z = Math.PI / 2;
        missile.position.set(0.4, (i - 0.5) * 0.3, 0);
        pylonGroup.add(missile);
      }
      
      pylonGroup.position.set(side * 2.5, -0.4, -0.5);
      this.mesh.add(pylonGroup);
      this.missilePylons.push(pylonGroup);
    }
  }
  
  createLandingGear() {
    const gearMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.8,
      roughness: 0.4
    });
    
    // Main landing gear
    const mainGear = new THREE.Group();
    const strutGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);
    const strut = new THREE.Mesh(strutGeometry, gearMaterial);
    mainGear.add(strut);
    
    const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.1);
    const wheel = new THREE.Mesh(wheelGeometry, gearMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = -0.5;
    mainGear.add(wheel);
    
    mainGear.position.set(0, -1, -0.5);
    this.landingGear.main = mainGear;
    this.mesh.add(mainGear);
    
    // Nose gear
    const noseGear = new THREE.Group();
    const noseStrut = new THREE.Mesh(strutGeometry, gearMaterial);
    noseStrut.scale.set(0.8, 0.8, 0.8);
    noseGear.add(noseStrut);
    
    const noseWheel = new THREE.Mesh(wheelGeometry, gearMaterial);
    noseWheel.rotation.z = Math.PI / 2;
    noseWheel.position.y = -0.4;
    noseWheel.scale.set(0.8, 0.8, 0.8);
    noseGear.add(noseWheel);
    
    noseGear.position.set(0, -0.8, 2.5);
    this.landingGear.nose = noseGear;
    this.mesh.add(noseGear);
  }
  
  createPropeller() {
    this.propeller = new THREE.Group();
    
    // Propeller hub
    const hubGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.2);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.rotation.z = Math.PI / 2;
    this.propeller.add(hub);
    
    // Propeller blades
    const bladeGeometry = new THREE.BoxGeometry(0.02, 1.5, 0.1);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7
    });
    
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = (i / 3) * Math.PI * 2;
      this.propeller.add(blade);
    }
    
    this.propeller.position.set(0, 0, 4);
    this.mesh.add(this.propeller);
  }
  
  createAircraftLights() {
    // Navigation lights
    const navRedGeometry = new THREE.SphereGeometry(0.05, 8, 6);
    const navRedMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.0
    });
    this.lights.navigationRed = new THREE.Mesh(navRedGeometry, navRedMaterial);
    this.lights.navigationRed.position.set(-4, 0, 0); // Left wingtip
    this.mesh.add(this.lights.navigationRed);
    
    const navGreenMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0
    });
    this.lights.navigationGreen = new THREE.Mesh(navRedGeometry, navGreenMaterial);
    this.lights.navigationGreen.position.set(4, 0, 0); // Right wingtip
    this.mesh.add(this.lights.navigationGreen);
    
    // Strobe light
    const strobeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0
    });
    this.lights.strobeWhite = new THREE.Mesh(navRedGeometry, strobeMaterial);
    this.lights.strobeWhite.position.set(0, 1, -3); // Top of tail
    this.mesh.add(this.lights.strobeWhite);
    
    // Landing light
    const landingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0
    });
    this.lights.landingLight = new THREE.Mesh(navRedGeometry, landingMaterial);
    this.lights.landingLight.position.set(0, -0.5, 2.5); // Nose gear area
    this.mesh.add(this.lights.landingLight);
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
  
  updateAircraftLights(deltaTime) {
    this.lightAnimationTime += deltaTime;
    
    // Strobe pattern
    if (this.lights.strobeWhite) {
      const strobeTime = this.lightAnimationTime % 1.5;
      const strobeIntensity = strobeTime < 0.1 ? 2.0 : 0.2;
      this.lights.strobeWhite.material.emissiveIntensity = strobeIntensity;
    }
    
    // Landing light based on gear
    if (this.lights.landingLight) {
      this.lights.landingLight.material.emissiveIntensity = this.landingGearExtended ? 1.0 : 0.3;
    }
  }
  
  fireGun(deltaTime) {
    if (this.weaponCooldown > 0) return;
    
    // Fire from both wing guns
    this.guns.forEach((gun, index) => {
      const muzzlePos = new THREE.Vector3();
      gun.getWorldPosition(muzzlePos);
      muzzlePos.add(new THREE.Vector3(0.6, 0, 0).applyQuaternion(this.mesh.quaternion));
      
      // Get forward direction
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(this.mesh.quaternion);
      
      // Create muzzle flash
      const flash = new THREE.PointLight(0xffaa00, 2, 5);
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
      
      // Remove effects
      setTimeout(() => {
        this.scene.scene.remove(flash);
        this.scene.scene.remove(tracer);
        tracerGeometry.dispose();
        tracerMaterial.dispose();
      }, 80);
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
    
    // Update aircraft lights
    this.updateAircraftLights(deltaTime);
    
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
