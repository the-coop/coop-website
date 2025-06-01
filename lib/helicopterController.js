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
    
    // Create the helicopter
    this.create(position);
  }
  
  create(position) {
    // Create main body group
    this.mesh = new THREE.Group();
    
    // Create fuselage
    const fuselageGeometry = new THREE.BoxGeometry(2, 1.5, 4);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d4a2b,
      metalness: 0.7,
      roughness: 0.3
    });
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    this.mesh.add(fuselage);
    
    // Create cockpit
    const cockpitGeometry = new THREE.SphereGeometry(1, 8, 6);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.8
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.scale.set(1, 0.7, 1.5);
    cockpit.position.set(0, 0, 1.5);
    cockpit.castShadow = true;
    this.mesh.add(cockpit);
    
    // Create tail boom
    const tailGeometry = new THREE.CylinderGeometry(0.3, 0.5, 5);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(0, 0, -3.5);
    tail.castShadow = true;
    tail.receiveShadow = true;
    this.mesh.add(tail);
    
    // Create landing skids
    const skidMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.9,
      roughness: 0.1
    });
    
    const skidGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4);
    const leftSkid = new THREE.Mesh(skidGeometry, skidMaterial);
    leftSkid.rotation.z = Math.PI / 2;
    leftSkid.position.set(-1, -1, 0);
    leftSkid.castShadow = true;
    this.mesh.add(leftSkid);
    
    const rightSkid = new THREE.Mesh(skidGeometry, skidMaterial);
    rightSkid.rotation.z = Math.PI / 2;
    rightSkid.position.set(1, -1, 0);
    rightSkid.castShadow = true;
    this.mesh.add(rightSkid);
    
    // Create skid connectors
    const connectorGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);
    for (let i = -1; i <= 1; i++) {
      const leftConnector = new THREE.Mesh(connectorGeometry, skidMaterial);
      leftConnector.position.set(-1, -0.5, i * 1.5);
      this.mesh.add(leftConnector);
      
      const rightConnector = new THREE.Mesh(connectorGeometry, skidMaterial);
      rightConnector.position.set(1, -0.5, i * 1.5);
      this.mesh.add(rightConnector);
    }
    
    // Create rotors
    this.createRotors();
    
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
    
    console.log('Helicopter created at', position);
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
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Map player keys to helicopter controls when occupied
    if (this.isOccupied && this.keys) {
      // Throttle/collective controls - FIXED: Shift increases, Control decreases
      this.controls.throttleUp = this.keys.run;        // Shift - increase collective
      this.controls.throttleDown = this.keys.throttleDown; // Control - decrease collective
      
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
      
      // Update collective (vertical thrust) - FIXED CONTROLS
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
      // Apply cyclic pitch (forward/backward tilt)
      if (this.cyclicPitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.cyclicPitch * this.maxTorque);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply cyclic roll (left/right tilt)
      if (this.cyclicRoll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.cyclicRoll * this.maxTorque);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply tail rotor (yaw)
      if (this.tailRotorPitch !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.tailRotorPitch * this.maxTorque * 0.5);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply damping
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
    
    // Auto-stabilization when no input
    if (!this.isGrounded && this.collectivePitch > 0.5) {
      if (Math.abs(this.cyclicPitch) < 0.05 && Math.abs(this.cyclicRoll) < 0.05) {
        const currentUp = up;
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
      this.controls.throttleUp = this.keys.run;        // Shift - increase collective
      this.controls.throttleDown = this.keys.throttleDown; // Control - decrease collective
      
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
      // Apply cyclic pitch (forward/backward tilt)
      if (this.cyclicPitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.cyclicPitch * this.maxTorque);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply cyclic roll (left/right tilt)
      if (this.cyclicRoll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.cyclicRoll * this.maxTorque);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply tail rotor (yaw)
      if (this.tailRotorPitch !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.tailRotorPitch * this.maxTorque * 0.5);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply damping
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
    
    // Auto-stabilization when no input
    if (!this.isGrounded && this.collectivePitch > 0.5) {
      if (Math.abs(this.cyclicPitch) < 0.05 && Math.abs(this.cyclicRoll) < 0.05) {
        const currentUp = up;
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
    
    // Rotate camera 180 degrees to face forward (not backward)
    // The camera should look in the same direction as the helicopter
    this.scene.camera.rotation.y = 0;  // No Y rotation needed
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
      this.controls.throttleUp = this.keys.run;        // Shift - increase collective
      this.controls.throttleDown = this.keys.throttleDown; // Control - decrease collective
      
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
      // Apply cyclic pitch (forward/backward tilt)
      if (this.cyclicPitch !== 0) {
        const pitchTorque = right.clone().multiplyScalar(this.cyclicPitch * this.maxTorque);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply cyclic roll (left/right tilt)
      if (this.cyclicRoll !== 0) {
        const rollTorque = forward.clone().multiplyScalar(-this.cyclicRoll * this.maxTorque);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply tail rotor (yaw)
      if (this.tailRotorPitch !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.tailRotorPitch * this.maxTorque * 0.5);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply damping
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
    
    // Auto-stabilization when no input
    if (!this.isGrounded && this.collectivePitch > 0.5) {
      if (Math.abs(this.cyclicPitch) < 0.05 && Math.abs(this.cyclicRoll) < 0.05) {
        const currentUp = up;
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
      
      // Keep camera rotation fixed facing backward (toward the helicopter)
      this.scene.camera.rotation.y = Math.PI;  // 180 degrees to face backward
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
      throttle: Math.round(this.collectivePitch * 100), // Convert collective to percentage
      isGrounded: this.isGrounded,
      stallWarning: false // Helicopters don't stall like planes
    };
  }
}
