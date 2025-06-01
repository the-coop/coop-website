import * as THREE from 'three';

export class HelicopterController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Helicopter properties - FURTHER INCREASED THRUST
    this.maxLiftForce = 80.0;  // Increased from 50.0
    this.maxTorque = 12.0;     // Increased from 10.0 for better control
    this.hoverThrottle = 0.55; // Reduced from 0.65 - less throttle needed to hover
    
    // Control limits - ADD THESE
    this.maxPitch = 0.5;    // radians - helicopters have less pitch range
    this.maxRoll = 0.5;     // radians - helicopters have less roll range
    this.maxYawRate = 2.0;  // radians per second - helicopters can yaw faster
    
    // Flight state
    this.collectivePitch = 0; // 0-1, main rotor collective
    this.cyclicPitch = 0;     // Forward/backward tilt
    this.cyclicRoll = 0;      // Left/right tilt
    this.tailRotorPitch = 0;  // Anti-torque
    
    // Physics
    this.body = null;
    this.collider = null;
    
    // Visual
    this.mesh = null;
    this.mainRotor = null;
    this.tailRotor = null;
    
    // Player state
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Control state
    this.controls = {
      throttleUp: false,
      throttleDown: false,
      pitchForward: false,
      pitchBackward: false,
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
    this.rocketCooldown = 0;
    this.rockets = [];
    this.maxRockets = 38; // Apache carries 38 rockets
    this.currentRockets = this.maxRockets;
    
    // Visual components
    this.landingGear = {
      left: null,
      right: null
    };
    
    // Create the helicopter
    this.create(position);
  }
  
  create(position) {
    // Create Apache-style attack helicopter
    this.mesh = new THREE.Group();
    
    // Main fuselage - FIX: No rotation needed, just position
    const fuselageGeometry = new THREE.BoxGeometry(1.5, 1.5, 5);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d4a2b,
      metalness: 0.7,
      roughness: 0.3
    });
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.position.set(0, 0, 0); // Centered
    this.mesh.add(fuselage);
    
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
    this.mesh.add(pilotCockpit);
    
    // Gunner cockpit (front)
    const gunnerCockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 8, 6),
      cockpitMaterial
    );
    gunnerCockpit.scale.set(0.8, 0.6, 1.2);
    gunnerCockpit.position.set(0, 0.3, 2);
    this.mesh.add(gunnerCockpit);
    
    // Tail boom - FIX: No rotation needed
    const tailGeometry = new THREE.BoxGeometry(0.8, 0.8, 6);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.position.set(0, 0, -5.5); // Just position it behind
    this.mesh.add(tail);
    
    // Vertical stabilizer - FIX: No rotation needed
    const stabilizerGeometry = new THREE.BoxGeometry(0.1, 2, 1.5);
    const stabilizer = new THREE.Mesh(stabilizerGeometry, fuselageMaterial);
    stabilizer.position.set(0, 1, -8); // Position at tail
    this.mesh.add(stabilizer);
    
    // Create weapons pylons
    this.createWeaponPylons();
    
    // Create landing gear (wheels instead of skids)
    this.createLandingGear();
    
    // Create rotors
    this.createRotors();
    
    // Add sensor turret
    const turretGeometry = new THREE.SphereGeometry(0.3, 6, 6);
    const turretMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.2
    });
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.set(0, -0.8, 2.5);
    this.mesh.add(turret);
    
    // Position and add to scene
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Create physics
    this.createPhysics(position);
    
    // Store reference on mesh for interaction
    this.mesh.userData.helicopterController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
    
    console.log('Apache helicopter created at', position);
  }
  
  createWeaponPylons() {
    const pylonMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.3
    });
    
    // Wing stubs for weapons
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.5);
    const wings = new THREE.Mesh(wingGeometry, pylonMaterial);
    wings.position.set(0, -0.5, 0.5);
    this.mesh.add(wings);
    
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
    this.mesh.add(gunMount);
    this.gunMount = gunMount; // Store reference for aiming
    
    // Rocket pods
    this.rocketPods = [];
    for (let side of [-1, 1]) {
      const podGroup = new THREE.Group();
      
      // Pod housing - FIX rotation to align with helicopter
      const podGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5);
      const pod = new THREE.Mesh(podGeometry, pylonMaterial);
      pod.rotation.z = Math.PI / 2;  // Changed from rotation.x to align horizontally
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
        rocket.position.x = 0.75;  // Changed to x position
        rocket.position.y = Math.cos(angle) * radius;
        rocket.position.z = Math.sin(angle) * radius;
        rocket.rotation.z = Math.PI / 2;  // Align with pod
        podGroup.add(rocket);
      }
      
      podGroup.position.set(side * 1.5, -0.8, 0.5);
      this.mesh.add(podGroup);
      this.rocketPods.push(podGroup);
    }
  }
  
  createLandingGear() {
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
      this.landingGear[side] = gearGroup;
      this.mesh.add(gearGroup);
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
    this.mesh.add(tailGear);
  }
  
  createRotors() {
    // Main rotor
    this.mainRotor = new THREE.Group();
    
    // Main rotor mast
    const mastGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.5);
    const mastMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.1
    });
    const mainMast = new THREE.Mesh(mastGeometry, mastMaterial);
    this.mainRotor.add(mainMast);
    
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
    this.mainRotor.add(rotorDisc);
    
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
    this.mainRotor.add(blade1);
    
    const blade2 = new THREE.Mesh(bladeGeometry, bladeMaterial);
    blade2.rotation.y = Math.PI / 2;
    blade2.position.y = 0.1;
    this.mainRotor.add(blade2);
    
    this.mainRotor.position.set(0, 1.5, 0);
    this.mesh.add(this.mainRotor);
    
    // Tail rotor
    this.tailRotor = new THREE.Group();
    
    // Tail rotor hub
    const tailHubGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.2);
    const tailHub = new THREE.Mesh(tailHubGeometry, mastMaterial);
    tailHub.rotation.z = Math.PI / 2;
    this.tailRotor.add(tailHub);
    
    // Tail rotor disc
    const tailRotorDiscGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.02, 8);
    const tailRotorDisc = new THREE.Mesh(tailRotorDiscGeometry, rotorDiscMaterial);
    tailRotorDisc.rotation.z = Math.PI / 2;
    this.tailRotor.add(tailRotorDisc);
    
    // Tail rotor blades
    const tailBladeGeometry = new THREE.BoxGeometry(1.5, 0.02, 0.1);
    const tailBlade1 = new THREE.Mesh(tailBladeGeometry, bladeMaterial);
    tailBlade1.rotation.z = Math.PI / 2;
    this.tailRotor.add(tailBlade1);
    
    const tailBlade2 = new THREE.Mesh(tailBladeGeometry, bladeMaterial);
    tailBlade2.rotation.y = Math.PI / 2;
    tailBlade2.rotation.z = Math.PI / 2;
    this.tailRotor.add(tailBlade2);
    
    this.tailRotor.position.set(0.3, 0.5, -6);
    this.mesh.add(this.tailRotor);
  }
  
  createPhysics(position) {
    // Create main body for fuselage with ADJUSTED damping for better lift
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 1.5,  // Reduced from 2.5 for better lift
      angularDamping: 5.0  // Keep high angular damping for stability
    });
    
    // Create compound collider to match helicopter shape better
    // Main fuselage collider
    const fuselageCollider = this.physics.createBoxCollider(
      new THREE.Vector3(1, 1, 2.5),  // Adjusted height to match mesh
      {
        density: 0.3,
        friction: 0.5,
        restitution: 0.3
      }
    );
    
    // Tail boom collider - FIX: Set translation before creating collider
    const tailColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(0.4, 0.4, 3),
      {
        density: 0.2,
        friction: 0.5,
        restitution: 0.3
      }
    );
    
    // Set translation on the descriptor before creating the collider
    tailColliderDesc.setTranslation(0, 0, -4);
    
    // Create compound collider
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
    this.physics.world.createCollider(tailColliderDesc, this.body);
  }
  
  checkGrounded() {
    if (!this.collider || !this.body) return false;
    
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Get gravity direction for ground check
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    const rayOrigin = playerPos.clone();
    const rayDir = gravityDir;
    
    const maxDistance = 2.0; // Check 2 units below
    const hit = this.physics.castRay(
      rayOrigin,
      rayDir,
      maxDistance,
      this.collider.handle
    );
    
    this.isGrounded = hit !== null && hit.toi < 1.5;
    
    return this.isGrounded;
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Map player keys to helicopter controls when occupied
    if (this.isOccupied && this.keys) {
      // Collective (up/down) with Shift/Control
      this.controls.collectiveUp = this.keys.run;        // Shift
      this.controls.collectiveDown = this.keys.throttleDown; // Control
      
      // Cyclic controls (tilt)
      this.controls.pitchForward = this.keys.forward;    // W
      this.controls.pitchBackward = this.keys.backward;  // S
      this.controls.rollLeft = this.keys.left;           // A
      this.controls.rollRight = this.keys.right;         // D
      
      // Tail rotor (yaw)
      this.controls.yawLeft = this.keys.rollLeft;        // Q
      this.controls.yawRight = this.keys.rollRight;      // E
      
      // Exit control - check for key release to prevent immediate exit
      if (this.keys.interact && !this.wasInteracting) {
        // Don't process exit on the same frame as entry
        if (Date.now() - (this.entryTime || 0) > 500) { // 500ms delay
          this.controls.interact = true;
        }
      }
      this.wasInteracting = this.keys.interact;
      
      // Check for weapon controls
      if (this.keys.fireGun) {
        this.fireGun(deltaTime);
      }
      
      if (this.keys.fireMissile && !this.wasFiringMissile) {
        this.fireRocket();
      }
      this.wasFiringMissile = this.keys.fireMissile;
    }
    
    // Check grounding
    this.checkGrounded();
    
    // Get gravity info
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    
    // Handle exit input when occupied
    if (this.isOccupied && this.keys) {
      // Check for exit key
      if (this.keys.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        
        // Trigger exit through the player
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          console.log('Helicopter controller triggering exit');
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.keys.interact) {
        this.wasInteracting = false;
      }
      
      // Update collective (vertical thrust) - FIXED CONTROLS
      if (this.controls.throttleUp) {
        this.collectivePitch = Math.min(this.collectivePitch + deltaTime * 0.5, 1.0);
      } else if (this.controls.throttleDown) {
        this.collectivePitch = Math.max(this.collectivePitch - deltaTime * 0.5, 0);
      }
    }
    
    // Handle controls
    this.handleControls(deltaTime, upDir);
    
    // Apply physics
    const velocity = this.body.linvel();
    const mass = this.body.mass();
    
    // Apply gravity manually
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
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);  // Changed from -1 to 1
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate lift force based on collective pitch
    if (this.collectivePitch > 0.1) {
      const liftMagnitude = this.collectivePitch * this.maxLiftForce * mass;
      const liftForce = up.clone().multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
    }
    
    // Apply control torques only when airborne
    if (!this.isGrounded && this.collectivePitch > 0.1) {
      // Project forward and right vectors onto the plane perpendicular to gravity
      const forwardHorizontal = forward.clone()
        .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
        .normalize();
      
      const rightHorizontal = right.clone()
        .sub(upDir.clone().multiplyScalar(right.dot(upDir)))
        .normalize();
      
      // Apply cyclic pitch (forward/backward tilt)
      if (this.cyclicPitch !== 0) {
        const pitchTorque = rightHorizontal.clone().multiplyScalar(this.cyclicPitch * this.maxTorque * 0.5);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply cyclic roll (left/right tilt)
      if (this.cyclicRoll !== 0) {
        const rollTorque = forwardHorizontal.clone().multiplyScalar(-this.cyclicRoll * this.maxTorque * 0.5);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply tail rotor (yaw) - around gravity axis, not local up
      if (this.tailRotorPitch !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.tailRotorPitch * this.maxTorque * 0.3);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply strong angular damping
      const angVel = this.body.angvel();
      const dampingTorque = {
        x: -angVel.x * 5.0,
        y: -angVel.y * 5.0,
        z: -angVel.z * 5.0
      };
      this.body.addTorque(dampingTorque);
      
      // Linear velocity damping
      const vel = this.body.linvel();
      const linearDamping = {
        x: -vel.x * 0.5,
        y: -vel.y * 0.3,
        z: -vel.z * 0.5
      };
      this.body.addForce(linearDamping);
    }
    
    // Auto-stabilization when no cyclic input
    if (!this.isGrounded && this.collectivePitch > 0.5) {
      if (Math.abs(this.cyclicPitch) < 0.05 && Math.abs(this.cyclicRoll) < 0.05) {
        // Calculate current tilt relative to gravity
        const currentUp = up;
        
        // Calculate correction torque to align with gravity up
        const correctionAxis = new THREE.Vector3().crossVectors(currentUp, upDir);
        const correctionMagnitude = Math.min(currentUp.angleTo(upDir), 0.5) * 10;
        
        if (correctionAxis.length() > 0.01) {
          correctionAxis.normalize();
          const correctionTorque = correctionAxis.multiplyScalar(correctionMagnitude);
          
          this.body.addTorque({
            x: correctionTorque.x,
            y: correctionTorque.y,
            z: correctionTorque.z
          });
        }
      } else {
        // Even with input, add some stabilization to prevent extreme tilts
        const currentUp = up;
        
        // If tilted more than 30 degrees, apply correction
        const tiltAngle = currentUp.angleTo(upDir);
        if (tiltAngle > Math.PI / 6) { // 30 degrees
          const correctionAxis = new THREE.Vector3().crossVectors(currentUp, upDir);
          const correctionMagnitude = (tiltAngle - Math.PI / 6) * 5;
          
          if (correctionAxis.length() > 0.01) {
            correctionAxis.normalize();
            const correctionTorque = correctionAxis.multiplyScalar(correctionMagnitude);
            
            this.body.addTorque({
              x: correctionTorque.x,
              y: correctionTorque.y,
              z: correctionTorque.z
            });
          }
        }
      }
    }
    
    // Update rotor animations
    if (this.mainRotor) {
      this.mainRotor.rotation.y += this.collectivePitch * deltaTime * 20;
    }
    
    if (this.tailRotor) {
      this.tailRotor.rotation.z += this.collectivePitch * deltaTime * 40;
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
  
  toggleLandingGear() {
    // Only allow retraction when airborne
    if (!this.landingGearExtended || !this.isGrounded) {
      this.landingGearExtended = !this.landingGearExtended;
      console.log(`Landing gear ${this.landingGearExtended ? 'extended' : 'retracted'}`);
    }
  }
  
  updateLandingGear(deltaTime) {
    const targetTransition = this.landingGearExtended ? 1 : 0;
    const transitionSpeed = 1.5; // slower for helicopter
    
    if (this.landingGearTransition !== targetTransition) {
      const delta = targetTransition - this.landingGearTransition;
      const change = Math.sign(delta) * Math.min(Math.abs(delta), deltaTime * transitionSpeed);
      this.landingGearTransition += change;
      
      // Update gear positions (retract upward)
      const gearOffset = (1 - this.landingGearTransition) * 0.8;
      
      Object.values(this.landingGear).forEach(gear => {
        if (gear) {
          gear.position.y = gear.userData?.baseY || -1 + gearOffset;
        }
      });
    }
  }
  
  fireGun(deltaTime) {
    if (this.weaponCooldown > 0) return;
    
    // Fire from chain gun
    const muzzlePos = new THREE.Vector3(0, -0.8, 3.5);  // Positive Z for front
    muzzlePos.applyQuaternion(this.mesh.quaternion);
    muzzlePos.add(this.mesh.position);
    
    // Get forward direction
    const forward = new THREE.Vector3(0, 0, 1);  // Positive Z
    forward.applyQuaternion(this.mesh.quaternion);
    
    // Create muzzle flash
    const flash = new THREE.PointLight(0xffaa00, 3, 8);
    flash.position.copy(muzzlePos);
    this.scene.scene.add(flash);
    
    // Create tracer
    const tracerGeometry = new THREE.CylinderGeometry(0.03, 0.03, 4);
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
    }, 100);
    
    this.weaponCooldown = 0.15; // 30mm cannon fires slower
    
    console.log('Firing 30mm chain gun');
  }
  
  fireRocket() {
    if (this.rocketCooldown > 0 || this.currentRockets <= 0) return;
    
    this.currentRockets--;
    
    // Alternate between pods
    const podIndex = this.currentRockets % 2;
    const pod = this.rocketPods[podIndex];
    
    // Get launch position
    const launchPos = pod.position.clone();
    launchPos.applyQuaternion(this.mesh.quaternion);
    launchPos.add(this.mesh.position);
    
    // Create rocket body
    const rocketBody = this.physics.createDynamicBody(launchPos, {
      linearDamping: 0.05,
      angularDamping: 0.3
    });
    
    const rocketCollider = this.physics.createBoxCollider(
      new THREE.Vector3(0.05, 0.05, 0.4),
      {
        density: 1.5,
        friction: 0.1,
        restitution: 0.1
      }
    );
    
    this.physics.world.createCollider(rocketCollider, rocketBody);
    
    // Create visual rocket
    const rocketGroup = new THREE.Group();
    const rocketGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.8);
    const rocketMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.8
    });
    const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
    rocketMesh.rotation.x = Math.PI / 2;
    rocketGroup.add(rocketMesh);
    
    // Add warhead
    const warheadGeometry = new THREE.ConeGeometry(0.08, 0.2, 6);
    const warheadMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa0000,
      metalness: 0.7
    });
    const warhead = new THREE.Mesh(warheadGeometry, warheadMaterial);
    warhead.position.z = 0.5;
    rocketGroup.add(warhead);
    
    // Add exhaust
    const exhaustGeometry = new THREE.ConeGeometry(0.06, 0.3, 6);
    const exhaustMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.8
    });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.position.z = -0.5;
    exhaust.rotation.x = Math.PI;
    rocketGroup.add(exhaust);
    
    this.scene.scene.add(rocketGroup);
    
    // Launch velocity
    const forward = new THREE.Vector3(0, 0, 1);  // Positive Z
    forward.applyQuaternion(this.mesh.quaternion);
    
    const heliVel = this.getVelocity();
    const launchVelocity = forward.multiplyScalar(60).add(heliVel);
    
    rocketBody.setLinvel({
      x: launchVelocity.x,
      y: launchVelocity.y,
      z: launchVelocity.z
    });
    
    // Copy helicopter rotation
    const rotation = this.body.rotation();
    rocketBody.setRotation(rotation);
    
    // Rocket update loop
    const rocket = {
      body: rocketBody,
      mesh: rocketGroup,
      age: 0,
      maxAge: 8
    };
    
    const updateRocket = () => {
      if (!rocket.body) return;
      
      const pos = rocket.body.translation();
      rocket.mesh.position.set(pos.x, pos.y, pos.z);
      
      const rot = rocket.body.rotation();
      rocket.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      
      // Apply thrust
      const rocketForward = new THREE.Vector3(0, 0, 1);  // Positive Z
      rocketForward.applyQuaternion(rocket.mesh.quaternion);
      const thrust = rocketForward.multiplyScalar(30);
      
      rocket.body.addForce({
        x: thrust.x,
        y: thrust.y,
        z: thrust.z
      });
      
      // Apply gravity
      this.physics.applyGravityToBody(rocket.body, 0.016);
      
      rocket.age += 0.016;
      
      if (rocket.age < rocket.maxAge) {
        requestAnimationFrame(updateRocket);
      } else {
        // Remove rocket
        this.scene.scene.remove(rocket.mesh);
        rocketGroup.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.physics.world.removeRigidBody(rocket.body);
      }
    };
    
    updateRocket();
    
    this.rocketCooldown = 0.5; // 2 rockets per second
    
    console.log(`Rocket fired! ${this.currentRockets} remaining`);
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Map player keys to helicopter controls when occupied
    if (this.isOccupied && this.keys) {
      // Collective (up/down) with Shift/Control
      this.controls.collectiveUp = this.keys.run;        // Shift
      this.controls.collectiveDown = this.keys.throttleDown; // Control
      
      // Cyclic controls (tilt)
      this.controls.pitchForward = this.keys.forward;    // W
      this.controls.pitchBackward = this.keys.backward;  // S
      this.controls.rollLeft = this.keys.left;           // A
      this.controls.rollRight = this.keys.right;         // D
      
      // Tail rotor (yaw)
      this.controls.yawLeft = this.keys.rollLeft;        // Q
      this.controls.yawRight = this.keys.rollRight;      // E
      
      // Exit control - check for key release to prevent immediate exit
      if (this.keys.interact && !this.wasInteracting) {
        // Don't process exit on the same frame as entry
        if (Date.now() - (this.entryTime || 0) > 500) { // 500ms delay
          this.controls.interact = true;
        }
      }
      this.wasInteracting = this.keys.interact;
      
      // Check for weapon controls
      if (this.keys.fireGun) {
        this.fireGun(deltaTime);
      }
      
      if (this.keys.fireMissile && !this.wasFiringMissile) {
        this.fireRocket();
      }
      this.wasFiringMissile = this.keys.fireMissile;
    }
    
    // Update landing gear animation
    this.updateLandingGear(deltaTime);
    
    // Update weapon cooldowns
    if (this.weaponCooldown > 0) {
      this.weaponCooldown -= deltaTime;
    }
    if (this.rocketCooldown > 0) {
      this.rocketCooldown -= deltaTime;
    }
    
    // Check grounding
    this.checkGrounded();
    
    // Get gravity info
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    
    // Handle exit input when occupied
    if (this.isOccupied && this.keys) {
      // Check for exit key
      if (this.keys.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        
        // Trigger exit through the player
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          console.log('Helicopter controller triggering exit');
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.keys.interact) {
        this.wasInteracting = false;
      }
      
      // Update collective (vertical thrust)
      if (this.controls.throttleUp) {
        this.collectivePitch = Math.min(this.collectivePitch + deltaTime * 0.5, 1.0);
      } else if (this.controls.throttleDown) {
        this.collectivePitch = Math.max(this.collectivePitch - deltaTime * 0.5, 0);
      }
    }
    
    // Handle controls
    this.handleControls(deltaTime, upDir);
    
    // Apply physics
    const velocity = this.body.linvel();
    const mass = this.body.mass();
    
    // Apply gravity manually
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
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);  // Changed from -1 to 1
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate lift force based on collective pitch
    if (this.collectivePitch > 0.1) {
      const liftMagnitude = this.collectivePitch * this.maxLiftForce * mass;
      const liftForce = up.clone().multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
    }
    
    // Apply control torques only when airborne
    if (!this.isGrounded && this.collectivePitch > 0.1) {
      // Project forward and right vectors onto the plane perpendicular to gravity
      const forwardHorizontal = forward.clone()
        .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
        .normalize();
      
      const rightHorizontal = right.clone()
        .sub(upDir.clone().multiplyScalar(right.dot(upDir)))
        .normalize();
      
      // Apply cyclic pitch (forward/backward tilt)
      if (this.cyclicPitch !== 0) {
        const pitchTorque = rightHorizontal.clone().multiplyScalar(this.cyclicPitch * this.maxTorque * 0.5);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply cyclic roll (left/right tilt)
      if (this.cyclicRoll !== 0) {
        const rollTorque = forwardHorizontal.clone().multiplyScalar(-this.cyclicRoll * this.maxTorque * 0.5);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply tail rotor (yaw) - around gravity axis, not local up
      if (this.tailRotorPitch !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.tailRotorPitch * this.maxTorque * 0.3);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply strong angular damping
      const angVel = this.body.angvel();
      const dampingTorque = {
        x: -angVel.x * 5.0,
        y: -angVel.y * 5.0,
        z: -angVel.z * 5.0
      };
      this.body.addTorque(dampingTorque);
      
      // Linear velocity damping
      const vel = this.body.linvel();
      const linearDamping = {
        x: -vel.x * 0.5,
        y: -vel.y * 0.3,
        z: -vel.z * 0.5
      };
      this.body.addForce(linearDamping);
    }
    
    // Auto-stabilization when no cyclic input
    if (!this.isGrounded && this.collectivePitch > 0.5) {
      if (Math.abs(this.cyclicPitch) < 0.05 && Math.abs(this.cyclicRoll) < 0.05) {
        // Calculate current tilt relative to gravity
        const currentUp = up;
        
        // Calculate correction torque to align with gravity up
        const correctionAxis = new THREE.Vector3().crossVectors(currentUp, upDir);
        const correctionMagnitude = Math.min(currentUp.angleTo(upDir), 0.5) * 10;
        
        if (correctionAxis.length() > 0.01) {
          correctionAxis.normalize();
          const correctionTorque = correctionAxis.multiplyScalar(correctionMagnitude);
          
          this.body.addTorque({
            x: correctionTorque.x,
            y: correctionTorque.y,
            z: correctionTorque.z
          });
        }
      } else {
        // Even with input, add some stabilization to prevent extreme tilts
        const currentUp = up;
        
        // If tilted more than 30 degrees, apply correction
        const tiltAngle = currentUp.angleTo(upDir);
        if (tiltAngle > Math.PI / 6) { // 30 degrees
          const correctionAxis = new THREE.Vector3().crossVectors(currentUp, upDir);
          const correctionMagnitude = (tiltAngle - Math.PI / 6) * 5;
          
          if (correctionAxis.length() > 0.01) {
            correctionAxis.normalize();
            const correctionTorque = correctionAxis.multiplyScalar(correctionMagnitude);
            
            this.body.addTorque({
              x: correctionTorque.x,
              y: correctionTorque.y,
              z: correctionTorque.z
            });
          }
        }
      }
    }
    
    // Update rotor animations
    if (this.mainRotor) {
      this.mainRotor.rotation.y += this.collectivePitch * deltaTime * 20;
    }
    
    if (this.tailRotor) {
      this.tailRotor.rotation.z += this.collectivePitch * deltaTime * 40;
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
  
  enterHelicopter(player) {
    if (this.isOccupied) return false;
    
    this.isOccupied = true;
    this.currentPlayer = player;
    
    // Remove camera from its current parent
    if (this.scene.camera.parent) {
      this.scene.camera.parent.remove(this.scene.camera);
    }
    
    // Attach camera to helicopter
    this.mesh.add(this.scene.camera);
    
    // Position camera behind the helicopter (negative Z)
    this.scene.camera.position.set(0, 18, -45); // Changed from positive to negative Z
    
    // Reset camera rotation
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Look forward and slightly down
    this.scene.camera.rotation.y = 0;
    this.scene.camera.rotation.x = -0.25;
    
    console.log('Player entered helicopter');
    return true;
  }

  updateCamera() {
    // Keep camera at fixed relative position to helicopter
    if (this.scene.camera.parent === this.mesh) {
      const velocity = this.getVelocity();
      const speed = velocity.length();
      
      // Adjust camera distance based on speed
      const baseDist = 45;
      const speedFactor = Math.min(speed / 30, 1);
      const extraDist = speedFactor * 15;
      
      this.scene.camera.position.z = -(baseDist + extraDist); // Negative Z for behind
      this.scene.camera.position.y = 18 + speedFactor * 5;
      
      // Keep facing forward
      this.scene.camera.rotation.y = 0;
      this.scene.camera.rotation.x = -0.25;
      this.scene.camera.rotation.z = 0;
    }
  }
  
  exitHelicopter() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    console.log('exitHelicopter called');
    
    // Calculate safe exit position
    const exitDistance = 5.0;
    const position = this.getPosition();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Exit to the left side
    const leftDir = new THREE.Vector3(-1, 0, 0).applyQuaternion(quaternion);
    const exitPos = position.clone().add(leftDir.multiplyScalar(exitDistance));
    
    // Remove camera from helicopter
    if (this.scene.camera.parent === this.mesh) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Reset controls
    this.collectivePitch = 0;  // FIXED: was rotorSpeed
    this.cyclicPitch = 0;       // FIXED: was pitch
    this.cyclicRoll = 0;        // FIXED: was roll
    this.tailRotorPitch = 0;    // FIXED: was yaw
    this.controls = {
      throttleUp: false,
      throttleDown: false,
      pitchForward: false,
      pitchBackward: false,
      rollLeft: false,
      rollRight: false,
      yawLeft: false,
      yawRight: false,
      interact: false
    };
    
    // Clear entry time
    this.entryTime = null;
    
    // Clear player reference
    this.isOccupied = false;
    this.currentPlayer = null;
    
    console.log('Player exited helicopter');
    
    return { exitPosition: exitPos };
  }
  
  handleControls(deltaTime, upDir) {
    // Only allow control when engine is running
    if (this.collectivePitch < 0.1) return;
    
    // Calculate control effectiveness based on rotor speed
    const controlEffectiveness = Math.min(this.collectivePitch, 1.0);
    
    // Cyclic (pitch/roll) controls
    if (this.controls.pitchForward) {
      this.cyclicPitch = Math.min(this.cyclicPitch + deltaTime * 2, this.maxPitch);
    } else if (this.controls.pitchBackward) {
      this.cyclicPitch = Math.max(this.cyclicPitch - deltaTime * 2, -this.maxPitch);
    } else {
      this.cyclicPitch *= 0.9; // Return to neutral
    }
    
    if (this.controls.rollLeft) {
      this.cyclicRoll = Math.max(this.cyclicRoll - deltaTime * 2, -this.maxRoll);
    } else if (this.controls.rollRight) {
      this.cyclicRoll = Math.min(this.cyclicRoll + deltaTime * 2, this.maxRoll);
    } else {
      this.cyclicRoll *= 0.9; // Return to neutral
    }
    
    // Tail rotor (yaw) control
    if (this.controls.yawLeft) {
      this.tailRotorPitch = Math.max(this.tailRotorPitch - deltaTime * 3, -this.maxYawRate);
    } else if (this.controls.yawRight) {
      this.tailRotorPitch = Math.min(this.tailRotorPitch + deltaTime * 3, this.maxYawRate);
    } else {
      this.tailRotorPitch *= 0.9; // Return to neutral
    }
  }

  createPhysics(position) {
    // Create main body for fuselage with ADJUSTED damping for better lift
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 1.5,  // Reduced from 2.5 for better lift
      angularDamping: 5.0  // Keep high angular damping for stability
    });
    
    // Create compound collider to match helicopter shape better
    // Main fuselage collider
    const fuselageCollider = this.physics.createBoxCollider(
      new THREE.Vector3(1, 1, 2.5),  // Adjusted height to match mesh
      {
        density: 0.3,
        friction: 0.5,
        restitution: 0.3
      }
    );
    
    // Tail boom collider - FIX: Set translation before creating collider
    const tailColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(0.4, 0.4, 3),
      {
        density: 0.2,
        friction: 0.5,
        restitution: 0.3
      }
    );
    
    // Set translation on the descriptor before creating the collider
    tailColliderDesc.setTranslation(0, 0, -4);
    
    // Create compound collider
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
    this.physics.world.createCollider(tailColliderDesc, this.body);
  }
  
  checkGrounded() {
    if (!this.collider || !this.body) return false;
    
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Get gravity direction for ground check
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    const rayOrigin = playerPos.clone();
    const rayDir = gravityDir;
    
    const maxDistance = 2.0; // Check 2 units below
    const hit = this.physics.castRay(
      rayOrigin,
      rayDir,
      maxDistance,
      this.collider.handle
    );
    
    this.isGrounded = hit !== null && hit.toi < 1.5;
    
    return this.isGrounded;
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
  
  enterHelicopter(player) {
    if (this.isOccupied) return false;
    
    this.isOccupied = true;
    this.currentPlayer = player;
    
    // Remove camera from its current parent
    if (this.scene.camera.parent) {
      this.scene.camera.parent.remove(this.scene.camera);
    }
    
    // Attach camera to helicopter
    this.mesh.add(this.scene.camera);
    
    // Position camera behind the helicopter (negative Z)
    this.scene.camera.position.set(0, 18, -45); // Changed from positive to negative Z
    
    // Reset camera rotation
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Look forward and slightly down
    this.scene.camera.rotation.y = 0;
    this.scene.camera.rotation.x = -0.25;
    
    console.log('Player entered helicopter');
    return true;
  }
  
  destroy() {
    // Remove visual mesh
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) this.mesh.material.dispose();
    }
    
    // Remove physics body and collider
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
    
    console.log('Helicopter destroyed');
  }
  
  updateFromServer(state) {
    if (!this.body || !this.mesh) return;
    
    if (state.position) {
      this.body.setTranslation({
        x: state.position.x,
        y: state.position.y,
        z: state.position.z
      });
      this.mesh.position.set(state.position.x, state.position.y, state.position.z);
    }
    
    if (state.rotation) {
      this.body.setRotation({
        x: state.rotation.x,
        y: state.rotation.y,
        z: state.rotation.z,
        w: state.rotation.w
      });
      this.mesh.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
    }
    
    if (state.velocity) {
      this.body.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
    
    // Update control state if provided
    if (state.rotorSpeed !== undefined) {
      this.rotorSpeed = state.rotorSpeed;
    }
  }
  
  // Add method to get flight data for HUD
  getFlightData() {
    if (!this.body) return null;
    
    const position = this.body.translation();
    const velocity = this.body.linvel();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Convert position to Vector3 for distance calculation
    const positionVec = new THREE.Vector3(position.x, position.y, position.z);
    
    // Calculate altitude
    const gravityCenter = this.physics.gravity.center;
    const altitude = positionVec.distanceTo(gravityCenter);
    
    // Calculate speeds
    const velocityVec = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const airspeed = velocityVec.length();
    
    // Calculate vertical speed relative to gravity
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, positionVec)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    const verticalSpeed = velocityVec.dot(upDir);
    
    // Get local axes
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate heading in gravity plane
    const forwardHorizontal = forward.clone()
      .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
      .normalize();
    const heading = Math.atan2(forwardHorizontal.x, forwardHorizontal.z) * (180 / Math.PI);
    
    // Calculate pitch and roll relative to gravity
    // Pitch: angle between forward vector and gravity plane
    const pitch = Math.asin(forward.dot(upDir)) * (180 / Math.PI);
    
    // Roll: angle of right vector relative to gravity plane
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
      throttle: Math.round(this.collectivePitch * 100),
      isGrounded: this.isGrounded,
      stallWarning: false,
      gravityDir: gravityDir // Pass gravity direction for HUD
    };
  }
}
