import * as THREE from 'three';

export class HelicopterController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Helicopter properties
    this.maxThrust = 50.0;  // Increased from 30.0 for more lift
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
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Get gravity info - calculate direction from position to gravity center
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
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate lift force based on rotor speed
    if (this.rotorSpeed > 0.1) {
      // The lift force should be applied in the helicopter's local up direction
      // This way, tilting the helicopter redirects the thrust
      const liftMagnitude = this.rotorSpeed * this.maxThrust * 0.8;
      
      // Apply lift in the helicopter's local up direction (not world up)
      const liftForce = up.clone().multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
    }
    
    // Apply control forces only when airborne
    if (!this.isGrounded) {
      // Project forward and right vectors onto the plane perpendicular to gravity
      const forwardHorizontal = forward.clone()
        .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
        .normalize();
      
      const rightHorizontal = right.clone()
        .sub(upDir.clone().multiplyScalar(right.dot(upDir)))
        .normalize();
      
      // Apply pitch torque (forward/backward tilt) - REDUCED VALUES
      if (this.pitch !== 0) {
        const pitchTorque = rightHorizontal.clone().multiplyScalar(this.pitch * 3);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply roll torque (left/right tilt) - REDUCED VALUES
      if (this.roll !== 0) {
        const rollTorque = forwardHorizontal.clone().multiplyScalar(-this.roll * 3);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply yaw torque (rotation around gravity axis) - REDUCED VALUES
      if (this.yaw !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.yaw * 2);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // The forward/lateral movement now comes from the tilt naturally
      // No need to add extra forward/lateral thrust
      
      // Add STRONGER damping to prevent oscillations
      const angVel = this.body.angvel();
      const dampingTorque = {
        x: -angVel.x * 5.0,
        y: -angVel.y * 5.0,
        z: -angVel.z * 5.0
      };
      this.body.addTorque(dampingTorque);
      
      // Add linear velocity damping for more realistic helicopter physics
      const vel = this.body.linvel();
      const linearDamping = {
        x: -vel.x * 0.5,
        y: -vel.y * 0.3, // Less damping on vertical axis
        z: -vel.z * 0.5
      };
      this.body.addForce(linearDamping);
    }
    
    // Enhanced stability assistance
    if (!this.isGrounded && this.rotorSpeed > 0.5) {
      // Auto-level when no input
      if (Math.abs(this.pitch) < 0.05 && Math.abs(this.roll) < 0.05) {
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
    // Update rotor speed with Shift/Control
    if (this.controls.throttleUp) {
      this.rotorSpeed = Math.min(this.rotorSpeed + deltaTime * 1.0, this.maxRotorSpeed);
    } else if (this.controls.throttleDown) {
      this.rotorSpeed = Math.max(this.rotorSpeed - deltaTime * 1.0, 0);
    }
    
    // Only allow control when airborne or rotor spinning fast
    if (!this.isGrounded || this.rotorSpeed > this.minLiftoffRotorSpeed) {
      // Pitch control with W/S
      if (this.controls.pitchForward) {
        this.pitch = Math.min(this.pitch + deltaTime * 1.0, this.maxPitch);
      } else if (this.controls.pitchBackward) {
        this.pitch = Math.max(this.pitch - deltaTime * 1.0, -this.maxPitch);
      } else {
        this.pitch *= 0.95; // Slower decay
      }
      
      // Roll control with A/D
      if (this.controls.rollLeft) {
        this.roll = Math.max(this.roll - deltaTime * 1.0, -this.maxRoll);
      } else if (this.controls.rollRight) {
        this.roll = Math.min(this.roll + deltaTime * 1.0, this.maxRoll);
      } else {
        this.roll *= 0.95; // Slower decay
      }
      
      // Yaw control - only when airborne
      if (!this.isGrounded) {
        if (this.controls.yawLeft) {
          this.yaw = Math.max(this.yaw - deltaTime * 1.0, -this.maxYawRate);
        } else if (this.controls.yawRight) {
          this.yaw = Math.min(this.yaw + deltaTime * 1.0, this.maxYawRate);
        } else {
          this.yaw *= 0.95; // Slower decay
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

  createPhysics(position) {
    // Create main body for fuselage with HIGHER damping
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 2.5,  // Increased from 1.5
      angularDamping: 5.0  // Increased from 3.0
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
    // Position camera behind the helicopter looking forward
    this.scene.camera.position.set(0, 10, 30);  // Behind and above
    // Rotate camera to look forward (180 degrees around Y)
    this.scene.camera.rotation.set(-0.2, Math.PI, 0);  // Look forward from behind
    
    console.log('Player entered helicopter');
    return true;
  }
  
  exitHelicopter() {
    if (!this.isOccupied || !this.currentPlayer) return false;
    
    console.log('exitHelicopter called');
    
    // Calculate safe exit position to the side of the helicopter
    const exitDistance = 5.0;
    const position = this.getPosition();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Exit to the right side of the helicopter
    const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const exitPos = position.clone().add(rightDir.multiplyScalar(exitDistance));
    
    // Remove camera from helicopter
    if (this.scene.camera.parent === this.mesh) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Reset controls
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
    
    // Clear player reference
    const player = this.currentPlayer;
    this.isOccupied = false;
    this.currentPlayer = null;
    
    console.log('Player exited helicopter');
    
    return exitPos;
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Get gravity info - calculate direction from position to gravity center
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
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate lift force based on rotor speed
    if (this.rotorSpeed > 0.1) {
      // The lift force should be applied in the helicopter's local up direction
      // This way, tilting the helicopter redirects the thrust
      const liftMagnitude = this.rotorSpeed * this.maxThrust * 0.8;
      
      // Apply lift in the helicopter's local up direction (not world up)
      const liftForce = up.clone().multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
    }
    
    // Apply control forces only when airborne
    if (!this.isGrounded) {
      // Project forward and right vectors onto the plane perpendicular to gravity
      const forwardHorizontal = forward.clone()
        .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
        .normalize();
      
      const rightHorizontal = right.clone()
        .sub(upDir.clone().multiplyScalar(right.dot(upDir)))
        .normalize();
      
      // Apply pitch torque (forward/backward tilt) - REDUCED VALUES
      if (this.pitch !== 0) {
        const pitchTorque = rightHorizontal.clone().multiplyScalar(this.pitch * 3);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply roll torque (left/right tilt) - REDUCED VALUES
      if (this.roll !== 0) {
        const rollTorque = forwardHorizontal.clone().multiplyScalar(-this.roll * 3);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply yaw torque (rotation around gravity axis) - REDUCED VALUES
      if (this.yaw !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.yaw * 2);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // The forward/lateral movement now comes from the tilt naturally
      // No need to add extra forward/lateral thrust
      
      // Add STRONGER damping to prevent oscillations
      const angVel = this.body.angvel();
      const dampingTorque = {
        x: -angVel.x * 5.0,
        y: -angVel.y * 5.0,
        z: -angVel.z * 5.0
      };
      this.body.addTorque(dampingTorque);
      
      // Add linear velocity damping for more realistic helicopter physics
      const vel = this.body.linvel();
      const linearDamping = {
        x: -vel.x * 0.5,
        y: -vel.y * 0.3, // Less damping on vertical axis
        z: -vel.z * 0.5
      };
      this.body.addForce(linearDamping);
    }
    
    // Enhanced stability assistance
    if (!this.isGrounded && this.rotorSpeed > 0.5) {
      // Auto-level when no input
      if (Math.abs(this.pitch) < 0.05 && Math.abs(this.roll) < 0.05) {
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
    // Update rotor speed with Shift/Control
    if (this.controls.throttleUp) {
      this.rotorSpeed = Math.min(this.rotorSpeed + deltaTime * 1.0, this.maxRotorSpeed);
    } else if (this.controls.throttleDown) {
      this.rotorSpeed = Math.max(this.rotorSpeed - deltaTime * 1.0, 0);
    }
    
    // Only allow control when airborne or rotor spinning fast
    if (!this.isGrounded || this.rotorSpeed > this.minLiftoffRotorSpeed) {
      // Pitch control with W/S
      if (this.controls.pitchForward) {
        this.pitch = Math.min(this.pitch + deltaTime * 1.0, this.maxPitch);
      } else if (this.controls.pitchBackward) {
        this.pitch = Math.max(this.pitch - deltaTime * 1.0, -this.maxPitch);
      } else {
        this.pitch *= 0.95; // Slower decay
      }
      
      // Roll control with A/D
      if (this.controls.rollLeft) {
        this.roll = Math.max(this.roll - deltaTime * 1.0, -this.maxRoll);
      } else if (this.controls.rollRight) {
        this.roll = Math.min(this.roll + deltaTime * 1.0, this.maxRoll);
      } else {
        this.roll *= 0.95; // Slower decay
      }
      
      // Yaw control - only when airborne
      if (!this.isGrounded) {
        if (this.controls.yawLeft) {
          this.yaw = Math.max(this.yaw - deltaTime * 1.0, -this.maxYawRate);
        } else if (this.controls.yawRight) {
          this.yaw = Math.min(this.yaw + deltaTime * 1.0, this.maxYawRate);
        } else {
          this.yaw *= 0.95; // Slower decay
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

  createPhysics(position) {
    // Create main body for fuselage with HIGHER damping
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 2.5,  // Increased from 1.5
      angularDamping: 5.0  // Increased from 3.0
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
    // Position camera behind the helicopter looking forward
    this.scene.camera.position.set(0, 10, 30);  // Behind and above
    // Rotate camera to look forward (180 degrees around Y)
    this.scene.camera.rotation.set(-0.2, Math.PI, 0);  // Look forward from behind
    
    console.log('Player entered helicopter');
    return true;
  }
  
  exitHelicopter() {
    if (!this.isOccupied || !this.currentPlayer) return false;
    
    console.log('exitHelicopter called');
    
    // Calculate safe exit position to the side of the helicopter
    const exitDistance = 5.0;
    const position = this.getPosition();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Exit to the right side of the helicopter
    const rightDir = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const exitPos = position.clone().add(rightDir.multiplyScalar(exitDistance));
    
    // Remove camera from helicopter
    if (this.scene.camera.parent === this.mesh) {
      this.mesh.remove(this.scene.camera);
    }
    
    // Reset controls
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
    
    // Clear player reference
    const player = this.currentPlayer;
    this.isOccupied = false;
    this.currentPlayer = null;
    
    console.log('Player exited helicopter');
    
    return exitPos;
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Get gravity info - calculate direction from position to gravity center
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
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate lift force based on rotor speed
    if (this.rotorSpeed > 0.1) {
      // The lift force should be applied in the helicopter's local up direction
      // This way, tilting the helicopter redirects the thrust
      const liftMagnitude = this.rotorSpeed * this.maxThrust * 0.8;
      
      // Apply lift in the helicopter's local up direction (not world up)
      const liftForce = up.clone().multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
    }
    
    // Apply control forces only when airborne
    if (!this.isGrounded) {
      // Project forward and right vectors onto the plane perpendicular to gravity
      const forwardHorizontal = forward.clone()
        .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
        .normalize();
      
      const rightHorizontal = right.clone()
        .sub(upDir.clone().multiplyScalar(right.dot(upDir)))
        .normalize();
      
      // Apply pitch torque (forward/backward tilt) - REDUCED VALUES
      if (this.pitch !== 0) {
        const pitchTorque = rightHorizontal.clone().multiplyScalar(this.pitch * 3);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply roll torque (left/right tilt) - REDUCED VALUES
      if (this.roll !== 0) {
        const rollTorque = forwardHorizontal.clone().multiplyScalar(-this.roll * 3);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply yaw torque (rotation around gravity axis) - REDUCED VALUES
      if (this.yaw !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.yaw * 2);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // The forward/lateral movement now comes from the tilt naturally
      // No need to add extra forward/lateral thrust
      
      // Add STRONGER damping to prevent oscillations
      const angVel = this.body.angvel();
      const dampingTorque = {
        x: -angVel.x * 5.0,
        y: -angVel.y * 5.0,
        z: -angVel.z * 5.0
      };
      this.body.addTorque(dampingTorque);
      
      // Add linear velocity damping for more realistic helicopter physics
      const vel = this.body.linvel();
      const linearDamping = {
        x: -vel.x * 0.5,
        y: -vel.y * 0.3, // Less damping on vertical axis
        z: -vel.z * 0.5
      };
      this.body.addForce(linearDamping);
    }
    
    // Enhanced stability assistance
    if (!this.isGrounded && this.rotorSpeed > 0.5) {
      // Auto-level when no input
      if (Math.abs(this.pitch) < 0.05 && Math.abs(this.roll) < 0.05) {
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
    // Keep camera at fixed relative position to helicopter
    // The camera is already attached to the helicopter mesh, so it moves with it
    // But we can add dynamic camera adjustments here if needed
    
    // Optional: Add slight camera shake based on rotor speed
    if (this.rotorSpeed > 0 && this.scene.camera.parent === this.mesh) {
      const shake = this.rotorSpeed * 0.01;
      this.scene.camera.position.x = Math.sin(Date.now() * 0.01) * shake;
      this.scene.camera.position.y = 12 + Math.sin(Date.now() * 0.015) * shake;  // Updated base height
      // Keep Z position stable for better view
      this.scene.camera.position.z = 35;
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
    
    // Calculate altitude (distance from gravity center)
    const gravityCenter = this.physics.gravity.center;
    const altitude = position.distanceTo(gravityCenter);
    
    // Calculate speeds
    const velocityVec = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const airspeed = velocityVec.length();
    
    // Calculate vertical speed
    const gravityDir = new THREE.Vector3()
      .subVectors(gravityCenter, position)
      .normalize();
    const verticalSpeed = -velocityVec.dot(gravityDir); // Negative because up is opposite to gravity
    
    // Calculate heading (yaw)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const heading = Math.atan2(forward.x, forward.z) * (180 / Math.PI);
    
    // Calculate pitch and roll angles
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    
    return {
      altitude: Math.round(altitude),
      airspeed: Math.round(airspeed * 10) / 10,
      verticalSpeed: Math.round(verticalSpeed * 10) / 10,
      heading: Math.round((heading + 360) % 360),
      pitch: Math.round(euler.x * (180 / Math.PI)),
      roll: Math.round(euler.z * (180 / Math.PI)),
      throttle: Math.round((this.rotorSpeed / this.maxRotorSpeed) * 100),
      engineRPM: Math.round(this.rotorSpeed * 1000),
      isGrounded: this.isGrounded
    };
  }
}
