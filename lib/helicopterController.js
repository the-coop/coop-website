import * as THREE from 'three';

export class HelicopterController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Helicopter properties
    this.maxThrust = 30.0;
    this.maxPitch = 0.5;
    this.maxRoll = 0.5;
    this.maxYawRate = 1.0;
    this.rotorSpeed = 0;
    this.maxRotorSpeed = 20;
    
    // Current state
    this.enginePower = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
    
    // Physics objects
    this.body = null;
    this.collider = null;
    this.rotorBody = null;
    this.rotorJoint = null;
    this.tailRotorBody = null;
    this.tailRotorJoint = null;
    
    // Visual objects
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
      yawRight: false
    };
    
    // Create the helicopter
    this.create(position);
  }
  
  create(position) {
    // Create fuselage mesh
    const fuselageGeometry = new THREE.BoxGeometry(2, 1.5, 5);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.8,
      roughness: 0.2
    });
    
    this.mesh = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    
    // Add cockpit
    const cockpitGeometry = new THREE.BoxGeometry(1.8, 1, 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x222266,
      metalness: 0.6,
      roughness: 0.3
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.5, 1);
    this.mesh.add(cockpit);
    
    // Add tail boom
    const tailGeometry = new THREE.CylinderGeometry(0.5, 0.2, 4);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(0, 0.3, -3.5);
    this.mesh.add(tail);
    
    // Create main rotor with proper blades
    this.createMainRotor();
    
    // Create tail rotor
    this.createTailRotor();
    
    // Add landing skids
    const skidGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4);
    const skidMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.5,
      roughness: 0.5
    });
    
    const leftSkid = new THREE.Mesh(skidGeometry, skidMaterial);
    leftSkid.rotation.z = Math.PI / 2;
    leftSkid.position.set(-1, -1, 0);
    this.mesh.add(leftSkid);
    
    const rightSkid = new THREE.Mesh(skidGeometry, skidMaterial);
    rightSkid.rotation.z = Math.PI / 2;
    rightSkid.position.set(1, -1, 0);
    this.mesh.add(rightSkid);
    
    // Position and add to scene
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Create physics bodies
    this.createPhysics(position);
    
    console.log('Helicopter created at', position);
  }
  
  createMainRotor() {
    // Create rotor hub and blades
    this.mainRotor = new THREE.Group();
    
    // Rotor hub
    const hubGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.1
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    this.mainRotor.add(hub);
    
    // Create 4 rotor blades
    const bladeGeometry = new THREE.BoxGeometry(8, 0.02, 0.3);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.7,
      roughness: 0.3
    });
    
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.y = (Math.PI / 2) * i;
      blade.position.y = 0.1;
      this.mainRotor.add(blade);
    }
    
    // Position main rotor above fuselage
    this.mainRotor.position.set(0, 1.2, 0);
    this.mesh.add(this.mainRotor);
  }
  
  createTailRotor() {
    // Create tail rotor group
    const tailRotorGroup = new THREE.Group();
    
    // Tail rotor hub
    const hubGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.1
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.rotation.z = Math.PI / 2;
    tailRotorGroup.add(hub);
    
    // Create 3 tail rotor blades
    const bladeGeometry = new THREE.BoxGeometry(0.02, 1.5, 0.1);
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.7,
      roughness: 0.3
    });
    
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = (Math.PI * 2 / 3) * i;
      tailRotorGroup.add(blade);
    }
    
    // Create container for rotation
    this.tailRotor = new THREE.Group();
    this.tailRotor.add(tailRotorGroup);
    this.tailRotor.position.set(0.6, 0.8, -5);
    this.mesh.add(this.tailRotor);
  }
  
  createPhysics(position) {
    // Create main body for fuselage
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 1.0,
      angularDamping: 2.0
    });
    
    // Create fuselage collider
    const fuselageCollider = this.physics.createBoxCollider(
      new THREE.Vector3(1, 0.75, 2.5),
      {
        density: 0.5,
        friction: 0.5,
        restitution: 0.3
      }
    );
    
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
    
    // Create main rotor physics body (for rotation)
    const rotorPos = position.clone();
    rotorPos.y += 1.2;
    this.rotorBody = this.physics.createDynamicBody(rotorPos, {
      linearDamping: 0.1,
      angularDamping: 0.1
    });
    
    // Small collider for rotor
    const rotorCollider = this.physics.createBallCollider(0.2, {
      density: 0.1,
      friction: 0.1,
      restitution: 0.1
    });
    this.physics.world.createCollider(rotorCollider, this.rotorBody);
    
    // Create revolute joint for main rotor
    const rotorAnchor1 = { x: 0, y: 1.2, z: 0 }; // On fuselage
    const rotorAnchor2 = { x: 0, y: 0, z: 0 };   // On rotor
    const rotorAxis = { x: 0, y: 1, z: 0 };      // Rotation axis
    
    this.rotorJoint = this.physics.world.createImpulseJoint(
      this.physics.RAPIER.JointData.revolute(
        rotorAnchor1,
        rotorAnchor2,
        rotorAxis
      ),
      this.body,
      this.rotorBody,
      true
    );
    
    // Create tail rotor physics body
    const tailRotorPos = position.clone();
    tailRotorPos.x += 0.6;
    tailRotorPos.y += 0.8;
    tailRotorPos.z -= 5;
    
    this.tailRotorBody = this.physics.createDynamicBody(tailRotorPos, {
      linearDamping: 0.1,
      angularDamping: 0.1
    });
    
    // Small collider for tail rotor
    const tailRotorCollider = this.physics.createBallCollider(0.1, {
      density: 0.05,
      friction: 0.1,
      restitution: 0.1
    });
    this.physics.world.createCollider(tailRotorCollider, this.tailRotorBody);
    
    // Create revolute joint for tail rotor
    const tailAnchor1 = { x: 0.6, y: 0.8, z: -5 }; // On fuselage
    const tailAnchor2 = { x: 0, y: 0, z: 0 };      // On tail rotor
    const tailAxis = { x: 1, y: 0, z: 0 };         // Rotation axis (sideways)
    
    this.tailRotorJoint = this.physics.world.createImpulseJoint(
      this.physics.RAPIER.JointData.revolute(
        tailAnchor1,
        tailAnchor2,
        tailAxis
      ),
      this.body,
      this.tailRotorBody,
      true
    );
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
    this.driver = player;
    this.engineOn = true;
    
    // Move camera to helicopter
    if (this.scene.camera && player.mesh) {
      player.mesh.remove(this.scene.camera);
      this.mesh.add(this.scene.camera);
      this.scene.camera.position.set(-this.length * 1.5, 2, 0);
      this.scene.camera.rotation.set(0, 0, 0);
    }
    
    console.log('Entered helicopter');
    return true;
  }
  
  exitHelicopter() {
    if (!this.isOccupied || !this.driver) return null;
    
    // Calculate exit position (to the side of the helicopter)
    const exitOffset = new THREE.Vector3(0, -2, 3); // Exit to the side, not below
    const heliRotation = this.body.rotation();
    const heliQuat = new THREE.Quaternion(heliRotation.x, heliRotation.y, heliRotation.z, heliRotation.w);
    exitOffset.applyQuaternion(heliQuat);
    
    const heliPos = this.body.translation();
    const exitPosition = new THREE.Vector3(heliPos.x, heliPos.y, heliPos.z).add(exitOffset);
    
    // Return camera to player
    if (this.scene.camera && this.driver.mesh) {
      this.mesh.remove(this.scene.camera);
      this.driver.mesh.add(this.scene.camera);
      this.scene.camera.position.set(0, this.driver.height * 0.8, 0);
      this.scene.camera.rotation.set(0, 0, 0);
    }
    
    const driver = this.driver;
    this.isOccupied = false;
    this.driver = null;
    this.engineOn = false;
    this.collective = 0;
    
    // Reset controls
    Object.keys(this.keys).forEach(key => {
      this.keys[key] = false;
    });
    this.cyclic.set(0, 0);
    this.tailRotor = 0;
    
    console.log('Exited helicopter');
    return { driver, exitPosition };
  }
  
  handleControls(deltaTime) {
    if (!this.isOccupied || !this.body) return;
    
    // Update engine power
    if (this.controls.throttleUp) {
      this.enginePower = Math.min(1.0, this.enginePower + deltaTime * 0.5);
    }
    if (this.controls.throttleDown) {
      this.enginePower = Math.max(0, this.enginePower - deltaTime * 0.5);
    }
    
    // Update rotor speed based on engine power
    this.rotorSpeed = this.enginePower * this.maxRotorSpeed;
    
    // Apply rotor torque to spin the rotors
    if (this.rotorBody && this.rotorSpeed > 0) {
      this.rotorBody.applyTorque({
        x: 0,
        y: this.rotorSpeed * 10,
        z: 0
      });
    }
    
    if (this.tailRotorBody && this.rotorSpeed > 0) {
      this.tailRotorBody.applyTorque({
        x: this.rotorSpeed * 20,
        y: 0,
        z: 0
      });
    }
    
    // Update pitch/roll/yaw
    const controlRate = 2.0;
    
    if (this.controls.pitchForward) {
      this.pitch = Math.max(-this.maxPitch, this.pitch - deltaTime * controlRate);
    } else if (this.controls.pitchBackward) {
      this.pitch = Math.min(this.maxPitch, this.pitch + deltaTime * controlRate);
    } else {
      this.pitch *= 0.9; // Auto-center
    }
    
    if (this.controls.rollLeft) {
      this.roll = Math.max(-this.maxRoll, this.roll - deltaTime * controlRate);
    } else if (this.controls.rollRight) {
      this.roll = Math.min(this.maxRoll, this.roll + deltaTime * controlRate);
    } else {
      this.roll *= 0.9; // Auto-center
    }
    
    if (this.controls.yawLeft) {
      this.yaw = -this.maxYawRate;
    } else if (this.controls.yawRight) {
      this.yaw = this.maxYawRate;
    } else {
      this.yaw = 0;
    }
    
    // Apply forces
    const rotation = this.body.rotation();
    const quat = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Calculate lift force
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
    const liftForce = up.multiplyScalar(this.enginePower * this.maxThrust);
    
    // Apply gravity compensation
    const mass = this.body.mass();
    const gravityCompensation = mass * 9.81;
    liftForce.y += gravityCompensation * this.enginePower;
    
    // Apply forces using addForce (not applyForce)
    this.body.addForce({
      x: liftForce.x,
      y: liftForce.y,
      z: liftForce.z
    }, true); // true to wake the body
    
    // Apply torques for pitch, roll, and yaw
    const torque = new THREE.Vector3(
      this.pitch * 10,
      this.yaw * 5,
      -this.roll * 10
    ).applyQuaternion(quat);
    
    this.body.applyTorque({
      x: torque.x,
      y: torque.y,
      z: torque.z
    });
    
    // Add stabilization
    const angVel = this.body.angvel();
    this.body.applyTorque({
      x: -angVel.x * 2,
      y: -angVel.y * 1,
      z: -angVel.z * 2
    });
  }
  
  updateCamera() {
    // Camera follows helicopter smoothly
    if (this.scene.camera.parent === this.mesh) {
      // Camera is attached, no need for smooth follow
      return;
    }
  }
  
  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Update mesh position and rotation from physics
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
    
    const rotation = this.body.rotation();
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Update rotor visual rotations from physics bodies
    if (this.mainRotor && this.rotorBody) {
      const rotorRotation = this.rotorBody.rotation();
      this.mainRotor.quaternion.set(rotorRotation.x, rotorRotation.y, rotorRotation.z, rotorRotation.w);
    }
    
    if (this.tailRotor && this.tailRotorBody) {
      const tailRotation = this.tailRotorBody.rotation();
      // Apply rotation to the inner group for proper axis
      this.tailRotor.children[0].rotation.x = Math.atan2(
        2 * (tailRotation.w * tailRotation.x + tailRotation.y * tailRotation.z),
        1 - 2 * (tailRotation.x * tailRotation.x + tailRotation.y * tailRotation.y)
      );
    }
    
    // Update camera if player is in helicopter
    if (this.currentPlayer) {
      this.updateCamera();
    }
    
    // Handle controls if occupied
    if (this.isOccupied && this.controls) {
      this.handleControls(deltaTime);
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
    
    // Remove joints first
    if (this.rotorJoint && this.physics.world) {
      this.physics.world.removeImpulseJoint(this.rotorJoint, true);
    }
    
    if (this.tailRotorJoint && this.physics.world) {
      this.physics.world.removeImpulseJoint(this.tailRotorJoint, true);
    }
    
    // Remove colliders and bodies
    if (this.collider && this.physics.world) {
      this.physics.world.removeCollider(this.collider, true);
    }
    
    if (this.body && this.physics.world) {
      this.physics.world.removeRigidBody(this.body);
    }
    
    if (this.rotorBody && this.physics.world) {
      this.physics.world.removeRigidBody(this.rotorBody);
    }
    
    if (this.tailRotorBody && this.physics.world) {
      this.physics.world.removeRigidBody(this.tailRotorBody);
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
