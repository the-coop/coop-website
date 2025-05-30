import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class HelicopterController {
  constructor(scene, physics, position = new THREE.Vector3(0, 50, 0)) {
    this.scene = scene;
    this.physics = physics;
    
    // Helicopter properties
    this.rotorDiameter = 8;
    this.length = 5;
    this.height = 2.5;
    
    // Flight properties
    this.collective = 0; // Main rotor lift control
    this.maxLift = 60;
    this.cyclic = new THREE.Vector2(0, 0); // Tilt control
    this.maxTilt = 0.3;
    this.tailRotor = 0; // Anti-torque control
    this.maxYawRate = 1.5;
    
    // Physics properties
    this.hoverThrottle = 0.65; // Throttle needed to hover
    this.autoStabilize = true;
    this.stabilizationStrength = 2.0;
    
    // State
    this.isOccupied = false;
    this.driver = null;
    this.engineOn = false;
    this.altitude = 0;
    
    // Multiplayer state
    this.isMultiplayer = false;
    this.objectId = null;
    
    // Physics objects
    this.body = null;
    this.collider = null;
    
    // Visual objects
    this.mesh = null;
    this.mainRotor = null;
    this.tailRotor = null;
    
    // Input state
    this.keys = {
      collectiveUp: false,
      collectiveDown: false,
      forward: false,
      backward: false,
      left: false,
      right: false,
      yawLeft: false,
      yawRight: false
    };
    
    // Create the helicopter
    this.create(position);
  }
  
  create(position) {
    // Create body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.5,
      angularDamping: 0.8,
      canSleep: false
    });
    
    // Create fuselage collider
    const fuselageDesc = this.physics.createBoxCollider(
      new THREE.Vector3(this.length / 2, this.height / 2, 1),
      {
        friction: 0.3,
        restitution: 0.1,
        density: 0.8
      }
    );
    
    this.physics.world.createCollider(fuselageDesc, this.body);
    
    // Create visual mesh
    const group = new THREE.Group();
    
    // Fuselage
    const fuselageGeometry = new THREE.BoxGeometry(this.length, this.height, 2);
    const fuselageMaterial = new THREE.MeshStandardMaterial({
      color: 0x228822,
      metalness: 0.6,
      roughness: 0.4
    });
    
    const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    group.add(fuselage);
    
    // Tail boom
    const tailGeometry = new THREE.BoxGeometry(this.length * 0.8, 0.5, 0.5);
    const tail = new THREE.Mesh(tailGeometry, fuselageMaterial);
    tail.position.set(-this.length * 0.6, 0, 0);
    tail.castShadow = true;
    tail.receiveShadow = true;
    group.add(tail);
    
    // Main rotor mast
    const mastGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1);
    const mastMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.2
    });
    
    const mast = new THREE.Mesh(mastGeometry, mastMaterial);
    mast.position.set(0, this.height / 2 + 0.5, 0);
    group.add(mast);
    
    // Main rotor
    const rotorGeometry = new THREE.BoxGeometry(this.rotorDiameter, 0.1, 0.3);
    const rotorMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.7,
      roughness: 0.3
    });
    
    this.mainRotor = new THREE.Mesh(rotorGeometry, rotorMaterial);
    this.mainRotor.position.set(0, this.height / 2 + 1, 0);
    group.add(this.mainRotor);
    
    // Add second rotor blade
    const rotor2 = new THREE.Mesh(rotorGeometry, rotorMaterial);
    rotor2.rotation.y = Math.PI / 2;
    this.mainRotor.add(rotor2);
    
    // Tail rotor
    const tailRotorGeometry = new THREE.BoxGeometry(0.1, 1.5, 0.2);
    this.tailRotor = new THREE.Mesh(tailRotorGeometry, rotorMaterial);
    this.tailRotor.position.set(-this.length, 0.5, 0);
    this.tailRotor.rotation.x = Math.PI / 2;
    group.add(this.tailRotor);
    
    // Cockpit
    const cockpitGeometry = new THREE.BoxGeometry(this.length / 2, this.height / 2, 1.8);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.6,
      metalness: 0.9,
      roughness: 0.1
    });
    
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(this.length / 4, 0, 0);
    group.add(cockpit);
    
    // Landing skids
    const skidGeometry = new THREE.BoxGeometry(this.length * 0.8, 0.1, 0.2);
    const skidMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.5,
      roughness: 0.5
    });
    
    const leftSkid = new THREE.Mesh(skidGeometry, skidMaterial);
    leftSkid.position.set(0, -this.height / 2 - 0.3, -1);
    group.add(leftSkid);
    
    const rightSkid = new THREE.Mesh(skidGeometry, skidMaterial);
    rightSkid.position.set(0, -this.height / 2 - 0.3, 1);
    group.add(rightSkid);
    
    this.mesh = group;
    this.scene.scene.add(this.mesh);
    
    // Store reference for interaction
    this.mesh.userData.helicopterController = this;
    this.mesh.userData.interactable = true;
    this.mesh.userData.interactionType = 'vehicle';
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
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Update visual position from physics
    const pos = this.body.translation();
    const rot = this.body.rotation();
    
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    
    // Spin rotors when engine is on
    if (this.engineOn) {
      if (this.mainRotor) {
        this.mainRotor.rotation.y += (0.5 + this.collective * 0.5) * 30 * deltaTime;
      }
      if (this.tailRotor) {
        this.tailRotor.rotation.z += 50 * deltaTime;
      }
    }
    
    if (!this.isOccupied) return;
    
    // Update collective (main rotor thrust)
    if (this.keys.collectiveUp) {
      this.collective = Math.min(this.collective + 0.5 * deltaTime, 1.0);
    }
    if (this.keys.collectiveDown) {
      this.collective = Math.max(this.collective - 0.5 * deltaTime, 0);
    }
    
    // Update cyclic (tilt) controls
    const targetCyclic = new THREE.Vector2(0, 0);
    if (this.keys.forward) targetCyclic.y = this.maxTilt;
    if (this.keys.backward) targetCyclic.y = -this.maxTilt;
    if (this.keys.left) targetCyclic.x = -this.maxTilt;
    if (this.keys.right) targetCyclic.x = this.maxTilt;
    
    this.cyclic.lerp(targetCyclic, 2 * deltaTime);
    
    // Update tail rotor (yaw)
    let targetTailRotor = 0;
    if (this.keys.yawLeft) targetTailRotor = -1;
    if (this.keys.yawRight) targetTailRotor = 1;
    
    this.tailRotor += (targetTailRotor - this.tailRotor) * 2 * deltaTime;
    
    // Get helicopter orientation
    const heliQuat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(heliQuat);
    const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(heliQuat);
    const right = new THREE.Vector3(0, 0, 1).applyQuaternion(heliQuat);
    
    // Apply main rotor lift
    if (this.engineOn) {
      const lift = up.multiplyScalar(this.collective * this.maxLift);
      this.body.applyImpulse({
        x: lift.x * deltaTime,
        y: lift.y * deltaTime,
        z: lift.z * deltaTime
      });
    }
    
    // Apply cyclic tilt forces
    if (this.cyclic.length() > 0.01) {
      // Forward/backward tilt
      const pitchTorque = right.multiplyScalar(-this.cyclic.y * 15);
      this.body.applyTorqueImpulse({
        x: pitchTorque.x,
        y: pitchTorque.y,
        z: pitchTorque.z
      });
      
      // Left/right tilt
      const rollTorque = forward.multiplyScalar(this.cyclic.x * 15);
      this.body.applyTorqueImpulse({
        x: rollTorque.x,
        y: rollTorque.y,
        z: rollTorque.z
      });
      
      // Apply translational force from tilt
      const tiltForce = new THREE.Vector3(
        this.cyclic.y * 20,
        0,
        -this.cyclic.x * 20
      ).applyQuaternion(heliQuat);
      
      this.body.applyImpulse({
        x: tiltForce.x * deltaTime,
        y: tiltForce.y * deltaTime,
        z: tiltForce.z * deltaTime
      });
    }
    
    // Apply tail rotor anti-torque
    if (Math.abs(this.tailRotor) > 0.01) {
      const yawTorque = up.multiplyScalar(this.tailRotor * this.maxYawRate * 10);
      this.body.applyTorqueImpulse({
        x: yawTorque.x,
        y: yawTorque.y,
        z: yawTorque.z
      });
    }
    
    // Apply main rotor torque (opposite to tail rotor)
    const mainRotorTorque = up.multiplyScalar(-this.collective * 2);
    this.body.applyTorqueImpulse({
      x: mainRotorTorque.x,
      y: mainRotorTorque.y,
      z: mainRotorTorque.z
    });
    
    // Auto-stabilization
    if (this.autoStabilize && this.cyclic.length() < 0.01) {
      const angularVel = this.body.angvel();
      const stabilizeTorque = {
        x: -angularVel.x * this.stabilizationStrength,
        y: -angularVel.y * this.stabilizationStrength * 0.5, // Less yaw stabilization
        z: -angularVel.z * this.stabilizationStrength
      };
      
      this.body.applyTorqueImpulse(stabilizeTorque);
    }
    
    // Additional drag for realism
    const velocity = this.body.linvel();
    const dragForce = {
      x: -velocity.x * 0.3,
      y: -velocity.y * 0.2,
      z: -velocity.z * 0.3
    };
    
    this.body.applyImpulse({
      x: dragForce.x * deltaTime,
      y: dragForce.y * deltaTime,
      z: dragForce.z * deltaTime
    });
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
  
  destroy() {
    // Remove visual mesh
    if (this.mesh) {
      this.scene.scene.remove(this.mesh);
      // Dispose of geometries and materials in the group
      this.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    // Remove physics body
    if (this.physics.world && this.body) {
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
