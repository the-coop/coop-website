import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Plane properties - FURTHER INCREASED for better performance
    this.maxThrust = 150.0;        // Increased from 80.0
    this.maxSpeed = 150.0;         // Increased from 100.0
    this.liftCoefficient = 2.0;    // Increased from 1.2
    this.dragCoefficient = 0.02;   // Reduced from 0.04 for less drag
    this.stallAngle = 0.4;         // Increased from 0.35
    
    // Control limits
    this.maxPitch = 1.0;
    this.maxRoll = 1.5;
    this.maxYawRate = 1.0;

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
    
    // Aircraft lights
    this.lights = {
      navigationRed: null,
      navigationGreen: null,
      strobeWhite: null,
      antiCollisionRed: null,
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
    
    // Adjust spawn position to prevent landing gear clipping
    const adjustedPosition = position.clone();
    adjustedPosition.y += 2.0; // Raise plane 2 units higher
    
    // Create fuselage (more streamlined) - FIX: Point nose forward
    const fuselageGeometry = new THREE.ConeGeometry(0.8, 8, 8);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      metalness: 0.8,
      roughness: 0.2
    });
    
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.rotation.x = Math.PI / 2;  // Changed to positive to point nose forward
    fuselage.position.z = 0;  // Centered
    this.mesh.add(fuselage);
    
    // Add cockpit canopy - adjusted position for correct orientation
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
    canopy.position.set(0, 0.4, 2);  // Moved forward toward nose
    this.mesh.add(canopy);
    
    // Add swept wings
    const wingGeometry = new THREE.BoxGeometry(7, 0.2, 2);
    const wings = new THREE.Mesh(wingGeometry, fuselageMaterial);
    wings.position.set(0, -0.2, 0);
    this.mesh.add(wings);
    
    // Add vertical stabilizer - moved to tail
    const tailGeometry = new THREE.BoxGeometry(0.2, 2.5, 1.5);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.position.set(0, 0.8, -3);  // At the tail (negative Z)
    tail.rotation.x = -0.2; // Slight angle
    this.mesh.add(tail);
    
    // Add horizontal stabilizers - at tail
    const stabilizerGeometry = new THREE.BoxGeometry(3, 0.1, 1);
    const stabilizer = new THREE.Mesh(stabilizerGeometry, fuselageMaterial);
    stabilizer.position.set(0, 0, -3);  // At the tail
    this.mesh.add(stabilizer);
    
    // Add engine intake - moved toward center/rear
    const intakeGeometry = new THREE.BoxGeometry(1.2, 0.8, 2);
    const intake = new THREE.Mesh(intakeGeometry, fuselageMaterial);
    intake.position.set(0, -0.5, -0.5);  // Behind center
    this.mesh.add(intake);
    
    // Add engine exhaust - at the very tail
    const exhaustGeometry = new THREE.CylinderGeometry(0.5, 0.3, 1);
    const exhaustMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.3
    });
    const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
    exhaust.rotation.x = Math.PI / 2;  // Changed to positive to point backward
    exhaust.position.set(0, 0, -4);  // At the tail
    this.mesh.add(exhaust);
    
    // Create landing gear
    this.createLandingGear();
    
    // Create weapon hardpoints
    this.createWeaponHardpoints();
    
    // Create aircraft lights
    this.createAircraftLights();
    
    // Position and add to scene with adjusted height
    this.mesh.position.copy(adjustedPosition);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Create physics with adjusted position
    this.createPhysics(adjustedPosition);
    
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
    // Add gun (internal M61 Vulcan cannon) - positioned at nose
    const gunGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5);
    const gunMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.2
    });
    const gun = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.rotation.x = Math.PI / 2;  // Point forward
    gun.position.set(-0.5, -0.3, 3.5);  // Moved forward to nose area
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
        missile.rotation.x = Math.PI / 2;  // Point forward
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
    tailColliderDesc.setTranslation(0, 0.4, -3);
    
    // Add landing gear wheel colliders for ground contact using correct method
    // Front wheel collider - use RAPIER directly since createSphereCollider doesn't exist
    const frontWheelDesc = RAPIER.ColliderDesc.ball(0.2)
      .setTranslation(0, -1.2, 2) // Below and forward
      .setDensity(0.1)
      .setFriction(1.0)  // High friction for wheels
      .setRestitution(0.1);
    
    // Left main wheel collider
    const leftWheelDesc = RAPIER.ColliderDesc.ball(0.25)
      .setTranslation(-1.5, -1.2, -0.5) // Left side, below, behind center
      .setDensity(0.1)
      .setFriction(1.0)
      .setRestitution(0.1);
    
    // Right main wheel collider
    const rightWheelDesc = RAPIER.ColliderDesc.ball(0.25)
      .setTranslation(1.5, -1.2, -0.5) // Right side, below, behind center
      .setDensity(0.1)
      .setFriction(1.0)
      .setRestitution(0.1);
    
    // Create compound collider with all parts
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
    this.physics.world.createCollider(wingCollider, this.body);
    this.physics.world.createCollider(tailColliderDesc, this.body);
    
    // Add wheel colliders for ground contact
    this.physics.world.createCollider(frontWheelDesc, this.body);
    this.physics.world.createCollider(leftWheelDesc, this.body);
    this.physics.world.createCollider(rightWheelDesc, this.body);
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
    
    // Position camera further behind the plane for better view
    this.scene.camera.position.set(0, 15, -60);  // Much further back and higher
    
    // Reset camera rotation to neutral first
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Camera should face forward - rotate 180 degrees to face the nose
    this.scene.camera.rotation.y = Math.PI; // 180 degrees
    // Add a small downward pitch to see the plane better
    this.scene.camera.rotation.x = -0.15; // Reduced angle
    
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
    
    // Update aircraft lights animation
    this.updateAircraftLights(deltaTime);
    
    // Map player keys to aircraft controls when occupied
    if (this.isOccupied && this.keys) {
      // Fix plane throttle controls - use Shift/Ctrl for throttle
      this.controls.throttleUp = this.keys.run;        // Shift key for throttle up
      this.controls.throttleDown = this.keys.crouch;   // Ctrl key for throttle down
      
      // Flight controls
      this.controls.pitchUp = this.keys.backward;      // S key - pull back
      this.controls.pitchDown = this.keys.forward;     // W key - push forward
      this.controls.rollLeft = this.keys.left;         // A key - roll left
      this.controls.rollRight = this.keys.right;       // D key - roll right
      
      // Fix yaw controls - Q/E should be yaw left/right
      this.controls.yawLeft = this.keys.rollLeft;      // Q key - yaw left
      this.controls.yawRight = this.keys.rollRight;    // E key - yaw right
      
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
    
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);  // Changed from -1 to 1
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Apply thrust with increased power
    if (this.enginePower > 0) {
      const thrustForce = forward.clone().multiplyScalar(this.enginePower * this.maxThrust * mass);
      this.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
    }
    
    // Calculate lift (only when moving and not grounded) - IMPROVED
    if (speed > 3 && !this.isGrounded) {  // Reduced minimum speed from 5 to 3
      // Get velocity direction
      const velocityNormalized = velocityVec.clone().normalize();
      
      // Calculate the plane's attack angle relative to its motion
      const motionDotForward = velocityNormalized.dot(forward);
      const angleOfAttack = Math.acos(Math.max(-1, Math.min(1, motionDotForward)));
      
      // Simple lift model - more aggressive
      let liftMagnitude = 0;
      if (angleOfAttack < this.stallAngle) {
        // Improved lift calculation
        const effectiveAngle = Math.min(angleOfAttack, 0.25); // Optimal angle around 15 degrees
        const angleFactor = Math.sin(effectiveAngle * 4); // Peak at small angles
        
        // Speed-squared lift with better scaling
        liftMagnitude = this.liftCoefficient * speed * speed * angleFactor * 0.02;
        
        // Bonus lift at higher speeds
        if (speed > 30) {
          liftMagnitude *= 1.0 + ((speed - 30) / 100); // Extra lift at high speed
        }
      }
      
      // Lift direction - perpendicular to velocity, biased toward opposing gravity
      const velocityRight = new THREE.Vector3()
        .crossVectors(velocityNormalized, upDir)
        .normalize();
      
      // If cross product is near zero (flying straight up/down), use plane's right vector
      if (velocityRight.lengthSq() < 0.1) {
        velocityRight.copy(right);
      }
      
      // Lift is perpendicular to both velocity and the "right" vector
      let liftDirection = new THREE.Vector3()
        .crossVectors(velocityRight, velocityNormalized)
        .normalize();
      
      // Ensure lift opposes gravity
      if (liftDirection.dot(upDir) < 0) {
        liftDirection.multiplyScalar(-1);
      }
      
      // Blend with pure anti-gravity for more intuitive flight
      const pureAntiGrav = upDir.clone();
      liftDirection.lerp(pureAntiGrav, 0.5); // 50% bias toward opposing gravity
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
    
    // Apply control torques with better effectiveness
    if (speed > 1 || !this.isGrounded) { // Further reduced from 2
      // Control effectiveness based on speed - more responsive
      const controlEffectiveness = Math.min(1, speed / 10); // Reduced from 15
      
      // Pitch control - increased torque
      if (this.pitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.pitch * 15 * controlEffectiveness); // Increased from 10
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Roll control - increased torque
      if (this.roll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.roll * 20 * controlEffectiveness); // Increased from 15
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Yaw control - improved ground steering
      if (this.yaw !== 0) {
        let yawTorque;
        if (this.isGrounded) {
          // Ground steering around gravity-aligned up axis
          const gravityUpDir = upDir.clone();
          yawTorque = gravityUpDir.multiplyScalar(this.yaw * 8 * Math.min(1, speed / 10));
        } else {
          // Air yaw around local up axis with bank effectiveness
          const bankEffectiveness = Math.abs(up.dot(upDir));
          yawTorque = up.clone().multiplyScalar(this.yaw * 5 * controlEffectiveness * bankEffectiveness);
        }
        
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
    }
    
    // Improved ground movement
    if (this.isGrounded) {
      // Less restrictive ground movement
      const groundVel = velocityVec.clone();
      const forwardComponent = groundVel.dot(forward);
      const rightComponent = groundVel.dot(right);
      
      // Allow more lateral movement for better steering
      const newVel = forward.clone().multiplyScalar(forwardComponent)
        .add(right.clone().multiplyScalar(rightComponent * 0.6)); // Increased from 0.3
      
      this.body.setLinvel({
        x: newVel.x,
        y: velocity.y, // Preserve vertical
        z: newVel.z
      });
      
      // Less aggressive rotation constraints
      const currentRotation = this.body.rotation();
      const euler = new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w)
      );
      
      // Only limit extreme pitch and roll
      if (Math.abs(euler.x) > 0.3) euler.x = Math.sign(euler.x) * 0.3; // Allow some pitch
      if (Math.abs(euler.z) > 0.2) euler.z = Math.sign(euler.z) * 0.2; // Allow some roll
      
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
    // Faster throttle response
    if (this.controls.throttleUp) {
      this.enginePower = Math.min(this.enginePower + deltaTime * 1.5, 1.0);
    } else if (this.controls.throttleDown) {
      this.enginePower = Math.max(this.enginePower - deltaTime * 1.5, 0);
    }
    
    // Get current speed
    const velocity = this.getVelocity();
    const speed = velocity.length();
    
    // Further reduced minimum speed for controls
    if (speed > 1 || !this.isGrounded) {
      // Pitch control with W/S - faster response
      if (this.controls.pitchUp) {
        this.pitch = Math.min(this.pitch + deltaTime * 3, this.maxPitch);
      } else if (this.controls.pitchDown) {
        this.pitch = Math.max(this.pitch - deltaTime * 3, -this.maxPitch);
      } else {
        this.pitch *= 0.85; // Faster decay
      }
      
      // Roll control with A/D - ONLY when airborne - FIXED DIRECTION
      if (!this.isGrounded) {
        if (this.controls.rollLeft) {
          this.roll = Math.min(this.roll + deltaTime * 2, this.maxRoll); // Fixed: + for left roll
        } else if (this.controls.rollRight) {
          this.roll = Math.max(this.roll - deltaTime * 2, -this.maxRoll); // Fixed: - for right roll
        } else {
          this.roll *= 0.9; // Decay when no input
        }
      } else {
        // Force roll to zero when grounded
        this.roll = 0;
      }
      
      // Yaw control with Q/E - FIXED DIRECTION
      if (this.controls.yawLeft) {
        const yawRate = this.isGrounded ? 1.0 : 1.5;
        this.yaw = Math.min(this.yaw + deltaTime * yawRate, this.maxYawRate); // Fixed: + for left yaw
      } else if (this.controls.yawRight) {
        const yawRate = this.isGrounded ? 1.0 : 1.5;
        this.yaw = Math.max(this.yaw - deltaTime * yawRate, -this.maxYawRate); // Fixed: - for right yaw
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
    
    // Check multiple points below the plane including wheel positions
    const checkPoints = [
      new THREE.Vector3(0, -1.5, 2),     // Front wheel area
      new THREE.Vector3(-1.5, -1.5, -0.5), // Left wheel area  
      new THREE.Vector3(1.5, -1.5, -0.5),  // Right wheel area
      new THREE.Vector3(0, -0.8, 0)        // Fuselage bottom
    ];
    
    let groundHits = 0;
    const maxDistance = 0.8; // Reduced distance for more accurate detection
    
    for (const offset of checkPoints) {
      // Transform offset to world space
      const rotation = this.body.rotation();
      const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      const worldOffset = offset.clone().applyQuaternion(quaternion);
      const rayOrigin = playerPos.clone().add(worldOffset);
      
      const hit = this.physics.castRay(
        rayOrigin,
        gravityDir,
        maxDistance,
        this.collider.handle
      );
      
      if (hit !== null) {
        groundHits++;
      }
    }
    
    // Consider grounded if at least one wheel area detects ground
    this.isGrounded = groundHits > 0;
    
    return this.isGrounded;
  }
  
  updateCamera() {
    // Keep camera at fixed relative position to plane
    if (this.scene.camera.parent === this.mesh) {
      const velocity = this.getVelocity();
      const speed = velocity.length();
      
      // Pull camera back more at higher speeds
      const baseDist = 60; // Increased base distance
      const speedFactor = Math.min(speed / 50, 1); // Normalize to 0-1
      const extraDist = speedFactor * 20; // Increased extra distance
      
      this.scene.camera.position.z = -(baseDist + extraDist);  // Negative Z for behind
      
      // Also adjust height slightly based on speed
      this.scene.camera.position.y = 15 + speedFactor * 5; // Higher base height
      
      // Keep camera rotation fixed facing forward
      this.scene.camera.rotation.y = Math.PI; // Face forward (180 degrees)
      this.scene.camera.rotation.x = -0.15; // Consistent with enter angle
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
    
    // Fix stall warning - only show when airborne AND landing gear retracted AND low speed
    const isStalling = airspeed < 15 && !this.isGrounded && !this.landingGearExtended;
    
    return {
      altitude: Math.round(altitude),
      airspeed: Math.round(airspeed * 10) / 10,
      verticalSpeed: Math.round(verticalSpeed * 10) / 10,
      heading: Math.round((heading + 360) % 360),
      pitch: Math.round(pitch),
      roll: Math.round(roll),
      throttle: Math.round(this.enginePower * 100),
      isGrounded: this.isGrounded,
      stallWarning: isStalling, // Fixed: only when airborne with gear up
      gravityDir: gravityDir
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
    
    // Fire burst from cannon - updated position for nose-mounted gun
    const muzzlePos = new THREE.Vector3(-0.5, -0.3, 4);  // Positive Z for front
    muzzlePos.applyQuaternion(this.mesh.quaternion);
    muzzlePos.add(this.mesh.position);
    
    // Get forward direction
    const forward = new THREE.Vector3(0, 0, 1);  // Positive Z
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
    const forward = new THREE.Vector3(0, 0, 1);  // Positive Z
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
  
  handleGroundMovement(deltaTime) {
    const velocity = this.body.linvel();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Get local axes
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);  // Changed to positive Z
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Ground steering - increased effectiveness for jet
    if (this.controls.rollLeft || this.controls.rollRight) {
      const steerDirection = this.controls.rollLeft ? 1 : -1;
      const steerStrength = 3.0; // Increased from 2.0 for better ground steering
      
      // Apply steering torque around up axis
      const upDir = this.getUpDirection();
      const steerTorque = upDir.clone().multiplyScalar(steerDirection * steerStrength);
      
      this.body.addTorque({
        x: steerTorque.x,
        y: steerTorque.y,
        z: steerTorque.z
      });
    }
    
    // Ground thrust - SIGNIFICANTLY increased for F-16
    if (this.controls.throttleUp) {
      // Increase throttle
      this.throttle = Math.min(this.throttle + deltaTime * 0.5, 1.0);
    } else if (this.controls.throttleDown) {
      // Decrease throttle
      this.throttle = Math.max(this.throttle - deltaTime * 0.5, 0);
    }
    
    if (this.throttle > 0.1) {
      // F-16 has much more powerful engines - increased thrust
      const groundThrust = this.throttle * 80.0; // Increased from 30.0 to 80.0
      const thrustForce = forward.clone().multiplyScalar(groundThrust);
      
      this.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
    }
    
    // Ground friction/braking - adjusted for jet
    const groundFriction = 0.95; // Slightly less friction for jet on runway
    const vel = this.body.linvel();
    this.body.setLinvel({
      x: vel.x * groundFriction,
      y: vel.y,
      z: vel.z * groundFriction
    });
    
    // Prevent tipping - jets are more stable on ground
    const angVel = this.body.angvel();
    this.body.setAngvel({
      x: angVel.x * 0.8,
      y: angVel.y * 0.95, // Allow yaw rotation for steering
      z: angVel.z * 0.8
    });
  }
  
  createAircraftLights() {
    // Navigation lights - red on left (port), green on right (starboard)
    const navRedGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    const navRedMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.0
    });
    this.lights.navigationRed = new THREE.Mesh(navRedGeometry, navRedMaterial);
    this.lights.navigationRed.position.set(-3.5, 0, 0); // Left wingtip
    this.mesh.add(this.lights.navigationRed);
    
    // Add red point light
    const redPointLight = new THREE.PointLight(0xff0000, 1, 15);
    redPointLight.position.set(-3.5, 0, 0);
    this.mesh.add(redPointLight);
    this.lights.navigationRed.userData.pointLight = redPointLight;
    
    const navGreenGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    const navGreenMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 1.0
    });
    this.lights.navigationGreen = new THREE.Mesh(navGreenGeometry, navGreenMaterial);
    this.lights.navigationGreen.position.set(3.5, 0, 0); // Right wingtip
    this.mesh.add(this.lights.navigationGreen);
    
    // Add green point light
    const greenPointLight = new THREE.PointLight(0x00ff00, 1, 15);
    greenPointLight.position.set(3.5, 0, 0);
    this.mesh.add(greenPointLight);
    this.lights.navigationGreen.userData.pointLight = greenPointLight;
    
    // White strobe lights on wingtips
    const strobeGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const strobeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.0
    });
    this.lights.strobeWhite = new THREE.Mesh(strobeGeometry, strobeMaterial);
    this.lights.strobeWhite.position.set(0, 0.5, -3); // Top of tail
    this.mesh.add(this.lights.strobeWhite);
    
    // Add white strobe point light
    const strobePointLight = new THREE.PointLight(0xffffff, 2, 20);
    strobePointLight.position.set(0, 0.5, -3);
    this.mesh.add(strobePointLight);
    this.lights.strobeWhite.userData.pointLight = strobePointLight;
    
    // Anti-collision beacon (red, rotating)
    const beaconGeometry = new THREE.SphereGeometry(0.12, 8, 6);
    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 1.5
    });
    this.lights.antiCollisionRed = new THREE.Mesh(beaconGeometry, beaconMaterial);
    this.lights.antiCollisionRed.position.set(0, 0.8, 0); // Top of fuselage
    this.mesh.add(this.lights.antiCollisionRed);
    
    // Add anti-collision point light
    const beaconPointLight = new THREE.PointLight(0xff0000, 3, 25);
    beaconPointLight.position.set(0, 0.8, 0);
    this.mesh.add(beaconPointLight);
    this.lights.antiCollisionRed.userData.pointLight = beaconPointLight;
    
    // Landing light (white, forward-facing)
    const landingGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    const landingMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.0
    });
    this.lights.landingLight = new THREE.Mesh(landingGeometry, landingMaterial);
    this.lights.landingLight.position.set(0, -0.5, 3.5); // Front nose gear area
    this.mesh.add(this.lights.landingLight);
    
    // Add landing light spotlight
    const landingSpotLight = new THREE.SpotLight(0xffffff, 2, 50, Math.PI / 6, 0.3);
    landingSpotLight.position.set(0, -0.5, 3.5);
    landingSpotLight.target.position.set(0, -0.5, 10); // Point forward
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
    
    // White strobe - fast pulse every 1 second
    if (this.lights.strobeWhite) {
      const strobePattern = Math.sin(this.lightAnimationTime * 10) > 0.8 ? 2.0 : 0.1;
      this.lights.strobeWhite.material.emissiveIntensity = strobePattern;
      if (this.lights.strobeWhite.userData.pointLight) {
        this.lights.strobeWhite.userData.pointLight.intensity = strobePattern * 2;
      }
    }
    
    // Anti-collision beacon - rotating red beacon effect
    if (this.lights.antiCollisionRed) {
      const beaconIntensity = Math.abs(Math.sin(this.lightAnimationTime * 3)) * 1.5 + 0.3;
      this.lights.antiCollisionRed.material.emissiveIntensity = beaconIntensity;
      if (this.lights.antiCollisionRed.userData.pointLight) {
        this.lights.antiCollisionRed.userData.pointLight.intensity = beaconIntensity * 2;
      }
      
      // Rotate the beacon light
      this.lights.antiCollisionRed.rotation.y = this.lightAnimationTime * 2;
    }
    
    // Landing light - brighter when gear extended, dimmer when retracted
    if (this.lights.landingLight) {
      const landingIntensity = this.landingGearExtended ? 1.0 : 0.3;
      this.lights.landingLight.material.emissiveIntensity = landingIntensity;
      if (this.lights.landingLight.userData.spotLight) {
        this.lights.landingLight.userData.spotLight.intensity = landingIntensity * 3;
      }
    }
  }
}
