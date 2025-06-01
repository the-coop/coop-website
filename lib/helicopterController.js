import * as THREE from 'three';

export class HelicopterController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Helicopter properties
    this.maxLiftForce = 30.0;
    this.maxTorque = 10.0;
    this.hoverThrottle = 0.65;
    
    // Control limits - ADD THESE
    this.maxPitch = 0.5;    // radians - helicopters have less pitch range
    this.maxRoll = 0.5;     // radians - helicopters have less roll range
    this.maxYawRate = 2.0;  // radians per second - helicopters can yaw faster
    
    // Flight state
    this.collectivePitch = 0; // 0-1, main rotor collective
    this.cyclicPitch = 0;     // Forward/backward tilt
    this.cyclicRoll = 0;      // Left/right tilt
    this.tailRotorPitch = 0;  // Anti-torque
    
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
    
    // Map player keys to helicopter controls when occupied
    if (this.isOccupied && this.keys) {
      // Throttle/collective controls
      this.controls.throttleUp = this.keys.jump;       // Space - increase collective
      this.controls.throttleDown = this.keys.run;      // Shift - decrease collective
      
      // Cyclic controls
      this.controls.pitchForward = this.keys.forward;  // W key
      this.controls.pitchBackward = this.keys.backward; // S key
      this.controls.rollLeft = this.keys.left;         // A key
      this.controls.rollRight = this.keys.right;       // D key
      
      // Tail rotor controls
      this.controls.yawLeft = this.keys.rollLeft;      // Q key
      this.controls.yawRight = this.keys.rollRight;    // E key
      
      // Exit control
      this.controls.interact = this.keys.interact;     // U key
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
    
    // Handle controls - PASS upDir as parameter
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
    
    // Remove camera from its current parent
    if (this.scene.camera.parent) {
      this.scene.camera.parent.remove(this.scene.camera);
    }
    
    // Attach camera to helicopter
    this.mesh.add(this.scene.camera);
    
    // Position camera behind and above the helicopter
    this.scene.camera.position.set(0, 10, 20);
    
    // Reset camera rotation
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Rotate camera 180 degrees to face backward (toward the helicopter)
    this.scene.camera.rotation.y = Math.PI;  // 180 degrees
    // Look down slightly at the helicopter
    this.scene.camera.rotation.x = -0.2;
    
    console.log('Player entered helicopter');
    return true;
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
    this.rotorSpeed = 0;
    this.pitch = 0;
    this.roll = 0;
    this.yaw = 0;
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
    this.isOccupied = false;
    this.currentPlayer = null;
    
    console.log('Player exited helicopter');
    
    return { exitPosition: exitPos };
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Map player keys to helicopter controls when occupied
    if (this.isOccupied && this.keys) {
      // Throttle/collective controls
      this.controls.throttleUp = this.keys.jump;       // Space - increase collective
      this.controls.throttleDown = this.keys.run;      // Shift - decrease collective
      
      // Cyclic controls
      this.controls.pitchForward = this.keys.forward;  // W key
      this.controls.pitchBackward = this.keys.backward; // S key
      this.controls.rollLeft = this.keys.left;         // A key
      this.controls.rollRight = this.keys.right;       // D key
      
      // Tail rotor controls
      this.controls.yawLeft = this.keys.rollLeft;      // Q key
      this.controls.yawRight = this.keys.rollRight;    // E key
      
      // Exit control
      this.controls.interact = this.keys.interact;     // U key
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
    
    // Handle controls - PASS upDir as parameter
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
    if (this.scene.camera.parent === this.mesh) {
      const velocity = this.getVelocity();
      const speed = velocity.length();
      
      // Dynamic camera distance based on speed
      const baseDist = 20;
      const speedFactor = Math.min(speed / 30, 1);
      const extraDist = speedFactor * 5;
      
      this.scene.camera.position.z = baseDist + extraDist;
      
      // Adjust height based on altitude changes
      const verticalSpeed = Math.abs(velocity.y);
      const verticalFactor = Math.min(verticalSpeed / 10, 1);
      this.scene.camera.position.y = 10 + verticalFactor * 3;
      
      // Keep camera rotation fixed facing backward
      this.scene.camera.rotation.y = Math.PI;  // 180 degrees
      this.scene.camera.rotation.x = -0.2;
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
    
    // Calculate vertical speed
    const gravityDir = new THREE.Vector3()
      .subVectors(gravityCenter, positionVec)
      .normalize();
    const verticalSpeed = -velocityVec.dot(gravityDir);
    
    // Calculate heading
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const heading = Math.atan2(forward.x, forward.z) * (180 / Math.PI);
    
    // Calculate pitch and roll
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    
    return {
      altitude: Math.round(altitude),
      airspeed: Math.round(airspeed * 10) / 10,
      verticalSpeed: Math.round(verticalSpeed * 10) / 10,
      heading: Math.round((heading + 360) % 360),
      pitch: Math.round(euler.x * (180 / Math.PI)),
      roll: Math.round(euler.z * (180 / Math.PI)),
      throttle: Math.round(this.rotorSpeed * 5), // Convert rotor speed to percentage
      isGrounded: this.isGrounded,
      stallWarning: false // Helicopters don't stall like planes
    };
  }
}
