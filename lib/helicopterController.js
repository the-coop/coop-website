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
      yawRight: false,
      interact: false  // Add interact key for exit
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    
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
    
    // Store reference on mesh for interaction (like car does)
    this.mesh.userData.helicopterController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
    
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
    this.currentPlayer = player;
    
    // Attach camera to helicopter
    if (player.mesh && player.mesh.children.includes(this.scene.camera)) {
      player.mesh.remove(this.scene.camera);
    }
    
    this.mesh.add(this.scene.camera);
    // Position camera behind and above the helicopter
    this.scene.camera.position.set(0, 4, 10);
    this.scene.camera.rotation.set(-0.2, 0, 0);
    
    console.log('Player entered helicopter');
    return true;
  }
  
  exitHelicopter() {
    if (!this.isOccupied || !this.currentPlayer) return null;
    
    console.log('exitHelicopter called');
    
    // Calculate safe exit position to the side of the helicopter
    const heliPos = this.getPosition();
    const heliRotation = this.body.rotation();
    const heliQuat = new THREE.Quaternion(heliRotation.x, heliRotation.y, heliRotation.z, heliRotation.w);
    
    // Get helicopter's right direction and move player to the side
    const rightDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(heliQuat);
    const exitDistance = 8; // Increased from 3 to 8 meters
    
    const exitPosition = new THREE.Vector3(
      heliPos.x + rightDirection.x * exitDistance,
      heliPos.y + 1, // Slightly above helicopter
      heliPos.z + rightDirection.z * exitDistance
    );
    
    // Remove camera from helicopter
    if (this.mesh.children.includes(this.scene.camera)) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Store reference to player before clearing
    const player = this.currentPlayer;
    
    // Clear vehicle state first
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Reset controls properly - reset individual properties instead of using Object.keys
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
    
    console.log('Player exited helicopter');
    
    return {
      exitPosition: exitPosition,
      player: player  // Return player reference for camera restoration
    };
  }
  
  update(deltaTime) {
    if (!this.body || !this.mesh) return;
    
    // Handle exit input when occupied - moved to main update like car
    if (this.isOccupied) {
      // Check for exit key
      if (this.controls.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        
        // Trigger exit through the player
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          console.log('Helicopter controller triggering exit');
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.controls.interact) {
        this.wasInteracting = false;
      }
    }
    
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
  
  handleControls(deltaTime) {
    if (!this.isOccupied || !this.body) return;
    
    // Remove the exit key check from here - it's now in update()
    
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
      this.rotorBody.addTorque({
        x: 0,
        y: this.rotorSpeed * 10,
        z: 0
      }, true); // true to wake the body
    }
    
    if (this.tailRotorBody && this.rotorSpeed > 0) {
      this.tailRotorBody.addTorque({
        x: this.rotorSpeed * 20,
        y: 0,
        z: 0
      }, true); // true to wake the body
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
    
    // Apply forces using addForce
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
    
    this.body.addTorque({
      x: torque.x,
      y: torque.y,
      z: torque.z
    }, true); // true to wake the body
    
    // Add stabilization
    const angVel = this.body.angvel();
    this.body.addTorque({
      x: -angVel.x * 2,
      y: -angVel.y * 1,
      z: -angVel.z * 2
    }, true); // true to wake the body
  }
  
  updateCamera() {
    // Camera follows helicopter smoothly
    if (this.scene.camera.parent === this.mesh) {
      // Camera is attached, no need for smooth follow
      return;
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
