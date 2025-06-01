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
    
    // Create the plane
    this.create(position);
  }
  
  create(position) {
    // Create fuselage mesh
    const fuselageGeometry = new THREE.BoxGeometry(1.5, 1, 6);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x333366,
      metalness: 0.7,
      roughness: 0.3
    });
    
    this.mesh = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    
    // Add wings
    const wingGeometry = new THREE.BoxGeometry(8, 0.2, 2);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x444477,
      metalness: 0.6,
      roughness: 0.4
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, 0, 0.5);
    this.mesh.add(wings);
    
    // Add tail
    const tailGeometry = new THREE.BoxGeometry(0.5, 2, 0.2);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
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
    
    // Store reference on mesh for interaction
    this.mesh.userData.planeController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
    
    console.log('Plane created at', position);
  }
  
  createPropeller() {
    this.propeller = new THREE.Group();
    
    // Propeller hub
    const hubGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.8,
      roughness: 0.2
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.rotation.z = Math.PI / 2;
    this.propeller.add(hub);
    
    // Propeller blades
    const bladeGeometry = new THREE.BoxGeometry(0.05, 2, 0.1);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.7,
      roughness: 0.3
    });
    
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = (i * Math.PI * 2) / 3;
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
      new THREE.Vector3(0.75, 0.5, 3),
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
    // Position camera much further back behind the plane
    // Plane faces -Z, so positive Z is behind it
    this.scene.camera.position.set(0, 10, 35);  // Higher and much further back
    // Look forward at the plane
    this.scene.camera.rotation.set(-0.15, 0, 0);  // Look down slightly, no Y rotation needed
    
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
    const exitDistance = 8;
    
    const exitPosition = new THREE.Vector3(
      planePos.x + rightDirection.x * exitDistance,
      planePos.y + 1,
      planePos.z + rightDirection.z * exitDistance
    );
    
    // Remove camera from plane
    if (this.mesh.children.includes(this.scene.camera)) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Store reference to player before clearing
    const player = this.currentPlayer;
    
    // Clear vehicle state first
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Reset controls
    this.enginePower = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    
    // Reset all control flags
    this.controls.throttleUp = false;
    this.controls.throttleDown = false;
    this.controls.pitchForward = false;
    this.controls.pitchBackward = false;
    this.controls.rollLeft = false;
    this.controls.rollRight = false;
    this.controls.yawLeft = false;
    this.controls.yawRight = false;
    this.controls.interact = false;
    
    console.log('Player exited plane');
    
    return {
      exitPosition: exitPosition,
      player: player
    };
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
  
  handleControls(deltaTime) {
    // Engine power
    if (this.controls.throttleUp) {
      this.enginePower = Math.min(this.enginePower + deltaTime * 2, 1.0);
    } else if (this.controls.throttleDown) {
      this.enginePower = Math.max(this.enginePower - deltaTime * 2, 0);
    }
    
    // Pitch control
    if (this.controls.pitchForward) {
      this.pitch = Math.min(this.pitch + deltaTime * 2, 0.5);
    } else if (this.controls.pitchBackward) {
      this.pitch = Math.max(this.pitch - deltaTime * 2, -0.5);
    } else {
      this.pitch *= 0.9; // Decay
    }
    
    // Roll control
    if (this.controls.rollLeft) {
      this.roll = Math.max(this.roll - deltaTime * 2, -0.8);
    } else if (this.controls.rollRight) {
      this.roll = Math.min(this.roll + deltaTime * 2, 0.8);
    } else {
      this.roll *= 0.9; // Decay
    }
    
    // Yaw control - only when airborne
    if (!this.isGrounded) {
      if (this.controls.yawLeft) {
        this.yaw = Math.max(this.yaw - deltaTime * 2, -0.5);
      } else if (this.controls.yawRight) {
        this.yaw = Math.min(this.yaw + deltaTime * 2, 0.5);
      } else {
        this.yaw *= 0.9; // Decay
      }
    } else {
      this.yaw = 0; // No yaw on ground
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
    
    // Optional: Adjust camera distance based on speed
    if (this.scene.camera.parent === this.mesh) {
      const velocity = this.getVelocity();
      const speed = velocity.length();
      
      // Pull camera back more at higher speeds
      const baseDist = 35;  // Updated from 25
      const speedFactor = Math.min(speed / 50, 1); // Normalize to 0-1
      const extraDist = speedFactor * 20; // Add up to 20 more units
      
      this.scene.camera.position.z = baseDist + extraDist;
      
      // Also adjust height slightly based on speed
      this.scene.camera.position.y = 10 + speedFactor * 5;  // Updated base from 8
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
}
