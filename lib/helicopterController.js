import * as THREE from 'three';

export class HelicopterController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Helicopter properties
    this.maxThrust = 30.0;
    this.maxPitch = 0.3;
    this.maxRoll = 0.3;
    this.maxYawRate = 0.6;
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
      interact: false
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    
    // Add grounding state
    this.isGrounded = true;
    this.minLiftoffRotorSpeed = 0.7;
    
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
    const tailGeometry = new THREE.CylinderGeometry(0.5, 0.2, 4);    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.rotation.x = Math.PI / 2;    tail.position.set(0, 0.3, -3.5);
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
    this.tailRotor = new THREE.Group();
    
    // Tail rotor hub
    const hubGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.2);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.1
    });
    const hub = new THREE.Mesh(hubGeometry, hubMaterial);
    hub.rotation.z = Math.PI / 2;  // Rotate hub to align with X axis
    this.tailRotor.add(hub);
    
    // Create 3 tail rotor blades
    const bladeGeometry = new THREE.BoxGeometry(1.5, 0.1, 0.02);  // Swap dimensions for correct orientation
    const bladeMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.7,
      roughness: 0.3
    });
    
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
      blade.rotation.z = (Math.PI * 2 / 3) * i;  // Rotate around Z axis
      this.tailRotor.add(blade);
    }
    
    // Position tail rotor at the end of tail boom
    this.tailRotor.position.set(0.6, 0.8, -5);
    this.tailRotor.rotation.y = Math.PI / 2;  // Rotate entire group to face sideways
    this.mesh.add(this.tailRotor);
  }
  
  createPhysics(position) {
    // Create main body for fuselage
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 1.5,
      angularDamping: 3.0
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
    this.handleControls(deltaTime, upDir);
    
    // Apply physics
    const velocity = this.body.linvel();
    const angularVelocity = this.body.angvel();
    const mass = this.body.mass();
    
    // Apply gravity
    const gravityStrength = this.physics.gravity.strength;
    const gravityForce = gravityDir.multiplyScalar(gravityStrength * mass);
    this.body.addForce({
      x: gravityForce.x,
      y: gravityForce.y,
      z: gravityForce.z
    });
    
    // Calculate lift force based on rotor speed
    if (this.rotorSpeed > 0.1) {
      const liftMagnitude = this.rotorSpeed * this.maxThrust * mass;
      const liftForce = upDir.clone().multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
    }
    
    // Apply control forces only when airborne
    if (!this.isGrounded) {
      // Get local axes
      const rotation = this.body.rotation();
      const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
      
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
      
      // Apply pitch torque
      if (this.pitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.pitch * 10);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply roll torque
      if (this.roll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.roll * 10);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply yaw torque
      if (this.yaw !== 0) {
        const yawTorque = up.clone().multiplyScalar(this.yaw * 5);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply forward/lateral thrust based on tilt
      const tiltForward = forward.clone().multiplyScalar(this.pitch * this.rotorSpeed * 20);
      const tiltRight = right.clone().multiplyScalar(this.roll * this.rotorSpeed * 20);
      
      this.body.addForce({
        x: tiltForward.x + tiltRight.x,
        y: tiltForward.y + tiltRight.y,
        z: tiltForward.z + tiltRight.z
      });
    }
    
    // Add stability assistance
    if (!this.isGrounded && this.rotorSpeed > 0.5) {
      // Auto-level when no input
      if (Math.abs(this.pitch) < 0.05 && Math.abs(this.roll) < 0.05) {
        // Calculate current tilt
        const rotation = this.body.rotation();
        const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
        
        // Calculate correction torque to align with gravity up
        const correctionAxis = new THREE.Vector3().crossVectors(up, upDir);
        const correctionMagnitude = Math.min(up.angleTo(upDir), 0.5) * 5;
        
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
    
    // Update visual rotors
    if (this.mainRotor) {
      this.mainRotor.rotation.y += this.rotorSpeed * deltaTime * 10;
    }
    if (this.tailRotor) {
      this.tailRotor.rotation.x += this.rotorSpeed * deltaTime * 30;
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
    // Update rotor speed
    if (this.controls.throttleUp) {
      this.rotorSpeed = Math.min(this.rotorSpeed + deltaTime * 2, this.maxRotorSpeed);
    } else if (this.controls.throttleDown) {
      this.rotorSpeed = Math.max(this.rotorSpeed - deltaTime * 2, 0);
    }
    
    // Only allow control when airborne or rotor spinning fast
    if (!this.isGrounded || this.rotorSpeed > this.minLiftoffRotorSpeed) {
      // Pitch control
      if (this.controls.pitchForward) {
        this.pitch = Math.min(this.pitch + deltaTime * 2, this.maxPitch);
      } else if (this.controls.pitchBackward) {
        this.pitch = Math.max(this.pitch - deltaTime * 2, -this.maxPitch);
      } else {
        this.pitch *= 0.9; // Decay
      }
      
      // Roll control
      if (this.controls.rollLeft) {
        this.roll = Math.max(this.roll - deltaTime * 2, -this.maxRoll);
      } else if (this.controls.rollRight) {
        this.roll = Math.min(this.roll + deltaTime * 2, this.maxRoll);
      } else {
        this.roll *= 0.9; // Decay
      }
      
      // Yaw control - only when airborne
      if (!this.isGrounded) {
        if (this.controls.yawLeft) {
          this.yaw = Math.max(this.yaw - deltaTime * 2, -this.maxYawRate);
        } else if (this.controls.yawRight) {
          this.yaw = Math.min(this.yaw + deltaTime * 2, this.maxYawRate);
        } else {
          this.yaw *= 0.9; // Decay
        }
      } else {
        this.yaw = 0; // No yaw on ground
      }
    } else {
      // Reset controls when grounded with low rotor speed
      this.pitch = 0;
      this.roll = 0;
      this.yaw = 0;
    }
  }
  
  // Add grounding check method
  checkGrounded() {
    const position = this.getPosition();
    
    // Get gravity-based down direction
    const downDirection = this.physics.getDownDirection(position);
    
    // Check if we're on the ground (check from bottom of skids)
    // Offset position by 1.2 units in the down direction
    const checkPosition = new THREE.Vector3(
      position.x + downDirection.x * 1.2,
      position.y + downDirection.y * 1.2,
      position.z + downDirection.z * 1.2
    );
    
    this.isGrounded = this.physics.isPositionGrounded(
      checkPosition,
      downDirection,
      0.5
    );
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
