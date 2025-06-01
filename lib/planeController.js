import * as THREE from 'three';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Plane properties - INCREASED THRUST AND LIFT
    this.maxThrust = 80.0;        // Increased from 50.0
    this.maxSpeed = 100.0;        // Increased from 80.0
    this.liftCoefficient = 1.2;   // Increased from 0.8
    this.dragCoefficient = 0.04;  // Reduced from 0.05 for less drag
    this.stallAngle = 0.35;       // Increased from 0.3 - more forgiving stall angle
    
    // Control limits - ADD THESE
    this.maxPitch = 1.0;  // radians
    this.maxRoll = 1.5;   // radians
    this.maxYawRate = 1.0; // radians per second
    
    // Current state
    this.enginePower = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    
    // Physics objects
    this.body = null;
    this.collider = null;
    
    // Visual objects
    this.mesh = null;
    this.propeller = null;
    
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
    this.isGrounded = true;
    
    // Add landing gear state
    this.landingGearExtended = true;
    this.landingGearTransition = 0;
    
    // Add weapon state
    this.weaponCooldown = 0;
    this.missileCooldown = 0;
    this.missiles = [];
    this.maxMissiles = 6;
    this.currentMissiles = this.maxMissiles;
    
    // Visual components
    this.landingGear = {
      front: null,
      left: null,
      right: null
    };
    
    // Create the plane
    this.create(position);
  }
  
  create(position) {
    // Create F-16 style fighter jet
    this.mesh = new THREE.Group();
    
    // Create fuselage (more streamlined) - FIX: rotation for proper alignment
    const fuselageGeometry = new THREE.ConeGeometry(0.8, 8, 8);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.8,
      roughness: 0.2
    });
    
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.rotation.x = -Math.PI / 2;  // Changed to negative to point forward
    fuselage.position.z = 1;  // Adjusted position
    this.mesh.add(fuselage);
    
    // Add cockpit canopy
    const canopyGeometry = new THREE.SphereGeometry(0.6, 8, 6);
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: 0x87ceeb,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7
    });
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.scale.set(1, 0.6, 1.5);
    canopy.position.set(0, 0.4, 1);
    this.mesh.add(canopy);
    
    // Add swept wings
    const wingGeometry = new THREE.BoxGeometry(7, 0.2, 2);
    wingGeometry.vertices = wingGeometry.vertices || [];
    const wings = new THREE.Mesh(wingGeometry, fuselageMaterial);
    wings.position.set(0, -0.2, 0);
    this.mesh.add(wings);
    
    // Add vertical stabilizer
    const tailGeometry = new THREE.BoxGeometry(0.2, 2.5, 1.5);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.position.set(0, 0.8, -3);
    tail.rotation.x = -0.2; // Slight angle
    this.mesh.add(tail);
    
    // Add horizontal stabilizers
    const stabilizerGeometry = new THREE.BoxGeometry(3, 0.1, 1);
    const stabilizer = new THREE.Mesh(stabilizerGeometry, fuselageMaterial);
    stabilizer.position.set(0, 0, -3);
    this.mesh.add(stabilizer);
    
    // Add engine intake
    const intakeGeometry = new THREE.BoxGeometry(1.2, 0.8, 2);
    const intake = new THREE.Mesh(intakeGeometry, fuselageMaterial);
    intake.position.set(0, -0.5, 0.5);
    this.mesh.add(intake);
    
    // Add engine exhaust - FIX alignment
    const exhaustGeometry = new THREE.CylinderGeometry(0.5, 0.3, 1);
    const exhaustMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.3
    });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.rotation.x = -Math.PI / 2;  // Changed to negative
    exhaust.position.set(0, 0, -4);
    this.mesh.add(exhaust);
    
    // Create landing gear
    this.createLandingGear();
    
    // Create weapon hardpoints
    this.createWeaponHardpoints();
    
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
      metalness: 0.8,
      roughness: 0.4
    });
    
    // Front gear
    const frontGearGroup = new THREE.Group();
    const frontStrut = new THREE.CylinderGeometry(0.08, 0.08, 1.5);
    const frontStrutMesh = new THREE.Mesh(frontStrut, gearMaterial);
    frontGearGroup.add(frontStrutMesh);
    
    const frontWheel = new THREE.CylinderGeometry(0.2, 0.2, 0.1);
    const frontWheelMesh = new THREE.Mesh(frontWheel, gearMaterial);
    frontWheelMesh.rotation.z = Math.PI / 2;
    frontWheelMesh.position.y = -0.75;
    frontGearGroup.add(frontWheelMesh);
    
    frontGearGroup.position.set(0, -0.8, 2);
    this.landingGear.front = frontGearGroup;
    this.mesh.add(frontGearGroup);
    
    // Rear gears
    for (let side of ['left', 'right']) {
      const gearGroup = new THREE.Group();
      const strut = new THREE.CylinderGeometry(0.08, 0.08, 1.2);
      const strutMesh = new THREE.Mesh(strut, gearMaterial);
      gearGroup.add(strutMesh);
      
      const wheel = new THREE.CylinderGeometry(0.25, 0.25, 0.15);
      const wheelMesh = new THREE.Mesh(wheel, gearMaterial);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelMesh.position.y = -0.6;
      gearGroup.add(wheelMesh);
      
      const xPos = side === 'left' ? -1.5 : 1.5;
      gearGroup.position.set(xPos, -0.8, -0.5);
      this.landingGear[side] = gearGroup;
      this.mesh.add(gearGroup);
    }
  }
  
  createWeaponHardpoints() {
    // Add gun (internal M61 Vulcan cannon) - FIX alignment
    const gunGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
    const gunMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.2
    });
    const gun = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.rotation.x = -Math.PI / 2;  // Changed to negative
    gun.position.set(-0.5, -0.3, 2.5);
    this.mesh.add(gun);
    
    // Add missile pylons under wings
    const pylonGeometry = new THREE.BoxGeometry(0.1, 0.3, 0.1);
    const missileGeometry = new THREE.ConeGeometry(0.1, 1, 6);
    const missileMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.7,
      roughness: 0.3
    });
    
    // Create 6 missile positions (3 per wing)
    this.missilePositions = [];
    for (let i = 0; i < 3; i++) {
      for (let side of [-1, 1]) {
        const pylon = new THREE.Mesh(pylonGeometry, missileMaterial);
        pylon.position.set(side * (1 + i * 0.8), -0.5, 0 - i * 0.5);
        this.mesh.add(pylon);
        
        const missile = new THREE.Mesh(missileGeometry, missileMaterial);
        missile.rotation.x = -Math.PI / 2;  // Point forward
        missile.position.set(side * (1 + i * 0.8), -0.8, 0 - i * 0.5);
        this.mesh.add(missile);
        
        this.missilePositions.push({
          position: missile.position.clone(),
          mesh: missile,
          used: false
        });
      }
    }
  }
  
  createPhysics(position) {
    // Create main body for fuselage
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.3,
      angularDamping: 2.0
    });
    
    // Create compound collider to match F-16 shape better
    // Main fuselage collider
    const fuselageCollider = this.physics.createBoxCollider(
      new THREE.Vector3(0.8, 0.6, 4),  // Adjusted to match mesh
      {
        density: 0.3,
        friction: 0.5,
        restitution: 0.2
      }
    );
    
    // Wing collider
    const wingCollider = this.physics.createBoxCollider(
      new THREE.Vector3(3.5, 0.1, 1),
      {
        density: 0.2,
        friction: 0.5,
        restitution: 0.2
      }
    );
    
    // Tail collider - FIX: Set translation before creating collider
    const tailColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(0.1, 1.25, 0.75),
      {
        density: 0.1,
        friction: 0.5,
        restitution: 0.2
      }
    );
    
    // Set translation on the descriptor before creating the collider
    tailColliderDesc.setTranslation(0, 0.4, -3);
    
    // Create compound collider
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
    this.physics.world.createCollider(wingCollider, this.body);
    this.physics.world.createCollider(tailColliderDesc, this.body);
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
    
    // Remove camera from its current parent
    if (this.scene.camera.parent) {
      this.scene.camera.parent.remove(this.scene.camera);
    }
    
    // Attach camera to plane
    this.mesh.add(this.scene.camera);
    
    // Position camera behind the plane looking forward
    this.scene.camera.position.set(0, 8, 25);  // Behind and above
    
    // Reset camera rotation to neutral first
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Camera should face forward (same direction as plane)
    // No Y rotation needed
    this.scene.camera.rotation.y = 0;
    // Add a small downward pitch
    this.scene.camera.rotation.x = -0.15;
    
    console.log('Player entered plane');
    return true;
  }
  
  exitPlane() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    console.log('exitPlane called');
    
    // Calculate safe exit position to the side of the plane
    const exitDistance = 5.0;
    const position = this.getPosition();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Exit to the left side of the plane
    const leftDir = new THREE.Vector3(-1, 0, 0).applyQuaternion(quaternion);
    const exitPos = position.clone().add(leftDir.multiplyScalar(exitDistance));
    
    // Remove camera from plane
    if (this.scene.camera.parent === this.mesh) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Reset controls
    this.enginePower = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
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
    
    // Clear player reference
    this.isOccupied = false;
    this.currentPlayer = null;
    
    console.log('Player exited plane');
    
    return { exitPosition: exitPos };
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Map player keys to aircraft controls when occupied
    if (this.isOccupied && this.keys) {
      // Throttle controls
      this.controls.throttleUp = this.keys.run;        // Shift key
      this.controls.throttleDown = this.keys.rollLeft; // Q key (using as throttle down)
      
      // Flight controls
      this.controls.pitchUp = this.keys.backward;      // S key - pull back
      this.controls.pitchDown = this.keys.forward;     // W key - push forward
      this.controls.rollLeft = this.keys.left;         // A key
      this.controls.rollRight = this.keys.right;       // D key
      this.controls.yawLeft = this.keys.rollLeft;      // Q key
      this.controls.yawRight = this.keys.rollRight;    // E key
      
      // Exit control
      this.controls.interact = this.keys.interact;     // U key
      
      // Check for landing gear toggle
      if (this.keys.landingGear && !this.wasLandingGear) {
        this.toggleLandingGear();
      }
      this.wasLandingGear = this.keys.landingGear;
      
      // Check for weapons
      if (this.keys.fireGun) {
        this.fireGun(deltaTime);
      }
      
      if (this.keys.fireMissile && !this.wasFiringMissile) {
        this.fireMissile();
      }
      this.wasFiringMissile = this.keys.fireMissile;
    }
    
    // Update landing gear animation
    this.updateLandingGear(deltaTime);
    
    // Update weapon cooldowns
    if (this.weaponCooldown > 0) {
      this.weaponCooldown -= deltaTime;
    }
    if (this.missileCooldown > 0) {
      this.missileCooldown -= deltaTime;
    }
    
    // Get gravity info
    const position = this.body.translation();
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, new THREE.Vector3(position.x, position.y, position.z))
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    
    // Update grounded state
    this.checkGrounded();
    
    // Handle controls
    this.handleControls(deltaTime, upDir);
    
    // Apply physics
    const velocity = this.body.linvel();
    const velocityVec = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const speed = velocityVec.length();
    const mass = this.body.mass();
    
    // Apply gravity
    const gravityStrength = this.physics.gravity.strength;
    const gravityForce = gravityDir.multiplyScalar(gravityStrength * mass);
    this.body.addForce({
      x: gravityForce.x,
      y: gravityForce.y,
      z: gravityForce.z
    });
    
    // Get local axes
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Apply thrust
    if (this.enginePower > 0) {
      const thrustForce = forward.clone().multiplyScalar(this.enginePower * this.maxThrust * mass);
      this.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
    }
    
    // Calculate lift (only when moving and not grounded)
    if (speed > 5 && !this.isGrounded) {
      // Get velocity direction
      const velocityNormalized = velocityVec.clone().normalize();
      
      // Calculate the plane's attack angle relative to its motion
      const motionDotForward = -velocityNormalized.dot(forward);
      const angleOfAttack = Math.acos(Math.max(-1, Math.min(1, motionDotForward)));
      
      // Calculate how "upright" the plane is relative to gravity
      // This is important for lift generation
      const wingsDotUp = up.dot(upDir);
      const pitchAngleFromGravity = Math.acos(Math.max(-1, Math.min(1, forward.dot(upDir))));
      
      // Lift effectiveness based on wings orientation
      // Wings generate most lift when perpendicular to gravity
      const wingsEffectiveness = Math.abs(wingsDotUp);
      
      // Simple lift model with gravity consideration
      let liftMagnitude = 0;
      if (angleOfAttack < this.stallAngle) {
        // Base lift from angle of attack
        const baseLift = this.liftCoefficient * speed * speed * Math.sin(angleOfAttack * 2) * 0.01;
        
        // Modify lift based on wing orientation relative to gravity
        // Reduced lift when wings are parallel to gravity (knife edge)
        liftMagnitude = baseLift * wingsEffectiveness;
        
        // Add bonus lift when pitched up relative to gravity
        if (pitchAngleFromGravity > Math.PI / 2) {
          // Nose pointing away from gravity center (pitched up)
          const pitchBonus = (pitchAngleFromGravity - Math.PI / 2) / (Math.PI / 2);
          liftMagnitude *= (1 + pitchBonus * 0.3);
        }
      }
      
      // Lift direction should be perpendicular to velocity and in the plane's "up" direction
      // but also considering gravity
      let liftDirection = new THREE.Vector3()
        .crossVectors(velocityNormalized, right)
        .normalize();
      
      // Make sure lift opposes gravity when possible
      if (liftDirection.dot(upDir) < 0) {
        liftDirection.multiplyScalar(-1);
      }
      
      // Blend lift direction with gravity-opposing direction for more intuitive flight
      const gravityOpposingLift = upDir.clone();
      liftDirection.lerp(gravityOpposingLift, 0.3); // 30% bias toward opposing gravity
      liftDirection.normalize();
      
      const liftForce = liftDirection.multiplyScalar(liftMagnitude * mass);
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
    }
    
    // Apply drag
    if (speed > 0.1) {
      const dragMagnitude = this.dragCoefficient * speed * speed;
      const dragForce = velocityVec.clone().normalize().multiplyScalar(-dragMagnitude);
      this.body.addForce({
        x: dragForce.x,
        y: dragForce.y,
        z: dragForce.z
      });
    }
    
    // Apply control torques only when moving or airborne
    if (speed > 5 || !this.isGrounded) {
      // Control effectiveness based on speed
      const controlEffectiveness = Math.min(1, speed / 20);
      
      // Pitch control
      if (this.pitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.pitch * 10 * controlEffectiveness);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Roll control
      if (this.roll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.roll * 15 * controlEffectiveness);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Yaw control - only when airborne
      if (!this.isGrounded && this.yaw !== 0) {
        // Yaw around local up axis, but reduce effectiveness based on bank angle
        const bankEffectiveness = Math.abs(up.dot(upDir)); // Less yaw when banked
        const yawTorque = up.clone().multiplyScalar(this.yaw * 5 * controlEffectiveness * bankEffectiveness);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
    }
    
    // Ground movement restrictions
    if (this.isGrounded) {
      // Allow forward/backward movement only
      const groundVel = velocityVec.clone();
      const forwardComponent = groundVel.dot(forward);
      const newVel = forward.clone().multiplyScalar(forwardComponent);
      
      // Preserve some lateral movement for steering
      const rightComponent = groundVel.dot(right) * 0.3;
      newVel.add(right.clone().multiplyScalar(rightComponent));
      
      // Set constrained velocity
      this.body.setLinvel({
        x: newVel.x,
        y: velocity.y, // Preserve vertical
        z: newVel.z
      });
      
      // No pitch or roll on ground - force them to zero
      this.pitch = 0;
      this.roll = 0;
      
      // Constrain rotation to prevent tipping
      const currentRotation = this.body.rotation();
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w)
      );
      
      // Force pitch and roll to zero
      euler.x = 0; // pitch
      euler.z = 0; // roll
      
      const constrainedQuat = new THREE.Quaternion().setFromEuler(euler);
      this.body.setRotation({
        x: constrainedQuat.x,
        y: constrainedQuat.y,
        z: constrainedQuat.z,
        w: constrainedQuat.w
      });
    }
    
    // Update visual propeller
    if (this.propeller) {
      this.propeller.rotation.z += this.enginePower * deltaTime * 50;
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
  
  handleControls(deltaTime, upDir) {
    // Update engine power with Shift/Control
    if (this.controls.throttleUp) {
      this.enginePower = Math.min(this.enginePower + deltaTime * 0.5, 1.0);
    } else if (this.controls.throttleDown) {
      this.enginePower = Math.max(this.enginePower - deltaTime * 0.5, 0);
    }
    
    // Get current speed
    const velocity = this.getVelocity();
    const speed = velocity.length();
    
    // Only allow control when moving fast enough or airborne
    if (speed > 5 || !this.isGrounded) {
      // Pitch control with W/S
      if (this.controls.pitchUp) {
        this.pitch = Math.min(this.pitch + deltaTime * 2, this.maxPitch);
      } else if (this.controls.pitchDown) {
        this.pitch = Math.max(this.pitch - deltaTime * 2, -this.maxPitch);
      } else {
        this.pitch *= 0.9; // Decay when no input
      }
      
      // Roll control with A/D - ONLY when airborne
      if (!this.isGrounded) {
        if (this.controls.rollLeft) {
          this.roll = Math.max(this.roll - deltaTime * 2, -this.maxRoll);
        } else if (this.controls.rollRight) {
          this.roll = Math.min(this.roll + deltaTime * 2, this.maxRoll);
        } else {
          this.roll *= 0.9; // Decay when no input
        }
      } else {
        // Force roll to zero when grounded
        this.roll = 0;
      }
      
      // Yaw control with Q/E - limited when grounded
      if (this.controls.yawLeft) {
        const yawRate = this.isGrounded ? 0.5 : 1.5; // Slower yaw on ground
        this.yaw = Math.max(this.yaw - deltaTime * yawRate, -this.maxYawRate);
      } else if (this.controls.yawRight) {
        const yawRate = this.isGrounded ? 0.5 : 1.5;
        this.yaw = Math.min(this.yaw + deltaTime * yawRate, this.maxYawRate);
      } else {
        this.yaw *= 0.9; // Decay when no input
      }
    } else {
      // Reset all controls when stopped on ground
      this.pitch = 0;
      this.roll = 0;
      this.yaw *= 0.9; // Allow some steering
    }
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
  
  updateCamera() {
    // Keep camera at fixed relative position to plane
    // The camera is already attached to the plane mesh, so it moves with it
    
    // Only update position, not rotation
    if (this.scene.camera.parent === this.mesh) {
      const velocity = this.getVelocity();
      const speed = velocity.length();
      
      // Pull camera back more at higher speeds
      const baseDist = 25;
      const speedFactor = Math.min(speed / 50, 1); // Normalize to 0-1
      const extraDist = speedFactor * 10; // Add up to 10 more units
      
      this.scene.camera.position.z = baseDist + extraDist;
      
      // Also adjust height slightly based on speed
      this.scene.camera.position.y = 8 + speedFactor * 2;
      
      // Keep camera rotation fixed facing backward (toward the plane)
      this.scene.camera.rotation.y = Math.PI;  // 180 degrees to face backward
      this.scene.camera.rotation.x = -0.15;
      this.scene.camera.rotation.z = 0;
    }
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
    
    console.log('Plane destroyed');
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
    if (state.enginePower !== undefined) {
      this.enginePower = state.enginePower;
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
      .subVectors(gravityCenter, positionVec)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    const verticalSpeed = velocityVec.dot(upDir);
    
    // Get local axes
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
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
      throttle: Math.round(this.enginePower * 100),
      isGrounded: this.isGrounded,
      stallWarning: airspeed < 10 && !this.isGrounded,
      gravityDir: gravityDir // Pass gravity direction for HUD
    };
  }
  
  toggleLandingGear() {
    this.landingGearExtended = !this.landingGearExtended;
    console.log(`Landing gear ${this.landingGearExtended ? 'extended' : 'retracted'}`);
  }
  
  updateLandingGear(deltaTime) {
    const targetTransition = this.landingGearExtended ? 1 : 0;
    const transitionSpeed = 2; // 0.5 seconds to extend/retract
    
    if (this.landingGearTransition !== targetTransition) {
      const delta = targetTransition - this.landingGearTransition;
      const change = Math.sign(delta) * Math.min(Math.abs(delta), deltaTime * transitionSpeed);
      this.landingGearTransition += change;
      
      // Update gear positions
      const gearOffset = (1 - this.landingGearTransition) * 0.8;
      
      if (this.landingGear.front) {
        this.landingGear.front.position.y = -0.8 + gearOffset;
      }
      if (this.landingGear.left) {
        this.landingGear.left.position.y = -0.8 + gearOffset;
      }
      if (this.landingGear.right) {
        this.landingGear.right.position.y = -0.8 + gearOffset;
      }
    }
  }
  
  fireGun(deltaTime) {
    if (this.weaponCooldown > 0) return;
    
    // Fire burst from cannon
    const muzzlePos = new THREE.Vector3(-0.5, -0.3, 3);
    muzzlePos.applyQuaternion(this.mesh.quaternion);
    muzzlePos.add(this.mesh.position);
    
    // Get forward direction
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    // Create tracer effect
    const tracerGeometry = new THREE.CylinderGeometry(0.02, 0.02, 5);
    const tracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 2
    });
    const tracer = new THREE.Mesh(tracerGeometry, tracerMaterial);
    tracer.position.copy(muzzlePos);
    tracer.quaternion.copy(this.mesh.quaternion);
    tracer.rotateX(Math.PI / 2);
    
    this.scene.scene.add(tracer);
    
    // Remove tracer after short time
    setTimeout(() => {
      this.scene.scene.remove(tracer);
      tracerGeometry.dispose();
      tracerMaterial.dispose();
    }, 100);
    
    // Add muzzle flash
    const flash = new THREE.PointLight(0xffff00, 2, 10);
    flash.position.copy(muzzlePos);
    this.scene.scene.add(flash);
    
    setTimeout(() => {
      this.scene.scene.remove(flash);
    }, 50);
    
    this.weaponCooldown = 0.1; // 10 rounds per second
    
    console.log('Firing cannon');
  }
  
  fireMissile() {
    if (this.missileCooldown > 0 || this.currentMissiles <= 0) return;
    
    // Find next available missile
    const missilePos = this.missilePositions.find(m => !m.used);
    if (!missilePos) return;
    
    missilePos.used = true;
    missilePos.mesh.visible = false;
    this.currentMissiles--;
    
    // Create physics missile
    const worldPos = missilePos.position.clone();
    worldPos.applyQuaternion(this.mesh.quaternion);
    worldPos.add(this.mesh.position);
    
    // Create missile body
    const missileBody = this.physics.createDynamicBody(worldPos, {
      linearDamping: 0.1,
      angularDamping: 0.5
    });
    
    const missileCollider = this.physics.createBoxCollider(
      new THREE.Vector3(0.1, 0.1, 0.5),
      {
        density: 2.0,
        friction: 0.1,
        restitution: 0.1
      }
    );
    
    this.physics.world.createCollider(missileCollider, missileBody);
    
    // Create visual missile
    const missileGeometry = new THREE.ConeGeometry(0.15, 1.5, 8);
    const missileMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.5
    });
    const missileMesh = new THREE.Mesh(missileGeometry, missileMaterial);
    missileMesh.rotation.x = Math.PI / 2;
    
    // Add exhaust flame
    const exhaustGeometry = new THREE.ConeGeometry(0.1, 0.5, 6);
    const exhaustMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.8
    });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.position.z = -0.75;
    exhaust.rotation.x = Math.PI;
    missileMesh.add(exhaust);
    
    this.scene.scene.add(missileMesh);
    
    // Get launch direction and velocity
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    const planeVel = this.getVelocity();
    const launchVelocity = forward.multiplyScalar(80).add(planeVel); // 80 m/s relative + plane velocity
    
    missileBody.setLinvel({
      x: launchVelocity.x,
      y: launchVelocity.y,
      z: launchVelocity.z
    });
    
    // Copy plane rotation
    const rotation = this.body.rotation();
    missileBody.setRotation(rotation);
    
    // Add to active missiles list
    const missile = {
      body: missileBody,
      mesh: missileMesh,
      age: 0,
      maxAge: 10 // Self-destruct after 10 seconds
    };
    
    this.missiles.push(missile);
    
    // Update missiles in animation loop
    const updateMissile = () => {
      if (!missile.body) return;
      
      const pos = missile.body.translation();
      missile.mesh.position.set(pos.x, pos.y, pos.z);
      
      const rot = missile.body.rotation();
      missile.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      
      // Apply thrust
      const missileForward = new THREE.Vector3(0, 0, 1);
      missileForward.applyQuaternion(missile.mesh.quaternion);
      const thrust = missileForward.multiplyScalar(50); // Continuous thrust
      
      missile.body.addForce({
        x: thrust.x,
        y: thrust.y,
        z: thrust.z
      });
      
      // Apply gravity
      this.physics.applyGravityToBody(missile.body, 0.016);
      
      missile.age += 0.016;
      
      if (missile.age < missile.maxAge) {
        requestAnimationFrame(updateMissile);
      } else {
        // Remove missile
        this.scene.scene.remove(missile.mesh);
        missile.mesh.geometry.dispose();
        missile.mesh.material.dispose();
        this.physics.world.removeRigidBody(missile.body);
        const index = this.missiles.indexOf(missile);
        if (index > -1) this.missiles.splice(index, 1);
      }
    };
    
    updateMissile();
    
    this.missileCooldown = 1.0; // 1 second between missiles
    
    console.log(`Missile fired! ${this.currentMissiles} remaining`);
  }
}
