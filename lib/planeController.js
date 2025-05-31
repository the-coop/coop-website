import * as THREE from 'three';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Plane properties
    this.maxThrust = 50.0;
    this.maxSpeed = 80.0;
    this.liftCoefficient = 0.8;
    this.dragCoefficient = 0.05;
    this.stallAngle = 0.3; // radians
    
    // Current state
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    this.speed = 0;
    
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
      interact: false  // Add interact key for exit
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    
    // Create the plane
    this.create(position);
    
    // Add grounding state
    this.isGrounded = true;
    this.minTakeoffSpeed = 10; // Minimum speed to take off
  }
  
  create(position) {
    // Create fuselage mesh
    const fuselageGeometry = new THREE.BoxGeometry(1.5, 1, 6);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x666666,
      metalness: 0.7,
      roughness: 0.3
    });
    
    this.mesh = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    
    // Add cockpit
    const cockpitGeometry = new THREE.BoxGeometry(1.2, 0.8, 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x444488,
      metalness: 0.5,
      roughness: 0.4
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.3, 1.5);
    this.mesh.add(cockpit);
    
    // Add wings
    const wingGeometry = new THREE.BoxGeometry(8, 0.2, 2);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.6,
      roughness: 0.4
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, -0.5);
    this.mesh.add(wings);
    
    // Add tail
    const tailGeometry = new THREE.BoxGeometry(0.5, 2, 1);
    const tail = new THREE.Mesh(tailGeometry, wingMaterial);
    tail.position.set(0, 0.5, -2.5);
    this.mesh.add(tail);
    
    // Add propeller
    this.createPropeller();
    
    // Position and add to scene
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Create physics
    this.createPhysics(position);
    
    // Store reference on mesh for interaction (like car does)
    this.mesh.userData.planeController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
    
    console.log('Plane created at', position);
  }
  
  createPropeller() {
    this.propeller = new THREE.Group();
    
    // Propeller hub
    const hubGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.rotation.x = Math.PI / 2;
    this.propeller.add(hub);
    
    // Propeller blades
    const bladeGeometry = new THREE.BoxGeometry(0.1, 3, 0.05);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.7,
      roughness: 0.3
    });
    
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = (Math.PI * 2 / 3) * i;
      this.propeller.add(blade);
    }
    
    this.propeller.position.set(0, 0, 3);
    this.mesh.add(this.propeller);
  }
  
  createPhysics(position) {
    // Create main body for fuselage
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.3,
      angularDamping: 2.0
    });
    
    // Create fuselage collider
    const fuselageCollider = this.physics.createBoxCollider(
      new THREE.Vector3(1, 0.75, 3),
      {
        density: 0.3,
        friction: 0.5,
        restitution: 0.2
      }
    );
    
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
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
    
    // Attach camera to plane
    if (player.mesh && player.mesh.children.includes(this.scene.camera)) {
      player.mesh.remove(this.scene.camera);
    }
    
    this.mesh.add(this.scene.camera);
    // Position camera behind and above the plane
    this.scene.camera.position.set(0, 3, 8);
    this.scene.camera.rotation.set(-0.15, 0, 0);
    
    console.log('Player entered plane');
    return true;
  }
  
  exitPlane() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    console.log('exitPlane called');
    
    // Calculate safe exit position to the side of the plane
    const planePos = this.getPosition();
    const planeRotation = this.body.rotation();
    const planeQuat = new THREE.Quaternion(planeRotation.x, planeRotation.y, planeRotation.z, planeRotation.w);
    
    // Get plane's right direction and move player to the side
    const rightDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(planeQuat);
    const exitDistance = 8; // Increased distance
    
    const exitPosition = new THREE.Vector3(
      planePos.x + rightDirection.x * exitDistance,
      planePos.y + 1, // Slightly above plane
      planePos.z + rightDirection.z * exitDistance
    );
    
    // Remove camera from plane
    if (this.mesh && this.mesh.children.includes(this.scene.camera)) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Store reference to player before clearing
    const player = this.currentPlayer;
    
    // Clear vehicle state first
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Reset controls - reset all control flags properly
    this.controls.throttleUp = false;
    this.controls.throttleDown = false;
    this.controls.pitchForward = false;
    this.controls.pitchBackward = false;
    this.controls.rollLeft = false;
    this.controls.rollRight = false;
    this.controls.yawLeft = false;
    this.controls.yawRight = false;
    this.controls.interact = false;
    
    // Reset plane state
    this.enginePower = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    
    console.log('Player exited plane');
    
    return {
      exitPosition: exitPosition,
      player: player  // Return player reference for camera restoration
    };
  }
  
  // Add grounding check method
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
  
  handleControls(deltaTime) {
    if (!this.isOccupied || !this.body) return;
    
    // Check if grounded
    this.checkGrounded();
    
    // Update engine power
    if (this.controls.throttleUp) {
      this.enginePower = Math.min(1.0, this.enginePower + deltaTime * 0.5);
    }
    if (this.controls.throttleDown) {
      this.enginePower = Math.max(0, this.enginePower - deltaTime * 0.5);
    }
    
    // Update control surfaces - reduced rates when grounded
    const controlRate = this.isGrounded ? 0.5 : 1.5; // Slower on ground
    const returnRate = 0.9; // How fast controls return to center
    
    if (this.controls.pitchForward) {
      this.pitch = Math.max(-this.maxPitch, this.pitch - deltaTime * controlRate);
    } else if (this.controls.pitchBackward) {
      this.pitch = Math.min(this.maxPitch, this.pitch + deltaTime * controlRate);
    } else {
      this.pitch *= returnRate; // Auto-center
    }
    
    if (this.controls.rollLeft) {
      this.roll = Math.max(-this.maxRoll, this.roll - deltaTime * controlRate);
    } else if (this.controls.rollRight) {
      this.roll = Math.min(this.maxRoll, this.roll + deltaTime * controlRate);
    } else {
      this.roll *= returnRate; // Auto-center
    }
    
    // Yaw only works when airborne or moving fast
    if (!this.isGrounded || this.speed > this.minTakeoffSpeed) {
      if (this.controls.yawLeft) {
        this.yaw = -this.maxYawRate;
      } else if (this.controls.yawRight) {
        this.yaw = this.maxYawRate;
      } else {
        this.yaw = 0;
      }
    } else {
      // No yaw control when grounded and slow
      this.yaw = 0;
    }
    
    // Apply forces
    const rotation = this.body.rotation();
    const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Forward thrust
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);
    const thrustForce = forward.multiplyScalar(this.enginePower * this.maxThrust);
    
    this.body.addForce({
      x: thrustForce.x,
      y: thrustForce.y,
      z: thrustForce.z
    }, true);
    
    // Apply torques for pitch, roll, and yaw - reduced when grounded
    const torqueMultiplier = this.isGrounded ? 0.3 : 1.0;
    const torque = new THREE.Vector3(
      this.pitch * 10 * torqueMultiplier,
      this.yaw * 5 * torqueMultiplier,
      -this.roll * 8 * torqueMultiplier // Reduced from 12
    ).applyQuaternion(quat);
    
    this.body.addTorque({
      x: torque.x,
      y: torque.y,
      z: torque.z
    }, true);
    
    // Calculate speed
    const velocity = this.body.linvel();
    this.speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
    
    // Add lift when moving forward fast enough
    if (this.speed > 5 && !this.isGrounded) {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
      const liftForce = up.multiplyScalar(this.speed * 0.5 * this.enginePower);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      }, true);
    }
    
    // Add stabilization when grounded
    if (this.isGrounded) {
      const angVel = this.body.angvel();
      this.body.addTorque({
        x: -angVel.x * 5,
        y: -angVel.y * 3,
        z: -angVel.z * 5
      }, true);
    }
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Get gravity info
    const position = this.body.translation();
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, new THREE.Vector3(position.x, position.y, position.z))
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    
    // Update grounded state
    this.checkGrounded();
    
    // Handle controls
    this.handleControls(deltaTime);
    
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
      // Calculate angle of attack
      const velocityNormalized = velocityVec.clone().normalize();
      const angleOfAttack = Math.acos(Math.max(-1, Math.min(1, -velocityNormalized.dot(forward))));
      
      // Simple lift model
      let liftMagnitude = 0;
      if (angleOfAttack < this.stallAngle) {
        liftMagnitude = this.liftCoefficient * speed * speed * Math.sin(angleOfAttack * 2) * 0.01;
      }
      
      // Lift acts perpendicular to velocity in the plane's up direction
      const liftDirection = new THREE.Vector3()
        .crossVectors(velocityNormalized, right)
        .normalize();
      
      if (liftDirection.dot(up) < 0) {
        liftDirection.multiplyScalar(-1);
      }
      
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
      // Pitch control
      if (this.pitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.pitch * 10 * Math.min(1, speed / 20));
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Roll control
      if (this.roll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.roll * 15 * Math.min(1, speed / 20));
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Yaw control - only when airborne
      if (!this.isGrounded && this.yaw !== 0) {
        const yawTorque = up.clone().multiplyScalar(this.yaw * 5 * Math.min(1, speed / 30));
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
      
      // No pitch or roll on ground
      this.pitch = 0;
      this.roll = 0;
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
  
  destroy() {
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      this.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    // Remove collider and body
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
  }
  
  updateFromServer(state) {
    if (!this.body || this.isOccupied) return;
    
    // Update position
    if (state.position) {
      this.body.setTranslation({
        x: state.position.x,
        y: state.position.y,
        z: state.position.z
      });
    }
    
    // Update rotation
    if (state.rotation) {
      this.body.setRotation({
        x: state.rotation.x,
        y: state.rotation.y,
        z: state.rotation.z,
        w: state.rotation.w
      });
    }
    
    // Update velocity
    if (state.velocity) {
      this.body.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
  }
}
