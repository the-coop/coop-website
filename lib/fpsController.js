import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { TPController } from './TPController.js';

export class FPSController {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    
    // Player properties
    this.height = 1.8;
    this.radius = 0.4;
    this.walkSpeed = 8;
    this.runSpeed = 16;
    this.jumpForce = 8;
    
    // State
    this.isGrounded = false;
    this.wasGrounded = false;
    this.jumpInProgress = false;
    this.jumpTime = 0;
    this.jumpDuration = 0.5;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    
    // Physics objects
    this.body = null;
    this.collider = null;
    this.colliderHandle = null;
    
    // Visual objects
    this.mesh = null;
    
    // Ray casting
    this.rayDir = new THREE.Vector3(0, -1, 0);
    this.leftFootPos = new THREE.Vector3();
    this.rightFootPos = new THREE.Vector3();
    this.centerFootPos = new THREE.Vector3();
    this.leftFootHit = null;
    this.rightFootHit = null;
    this.centerFootHit = null;
    
    // Debug visualization
    this.rayLines = {
      left: null,
      right: null,
      center: null,
      facing: null
    };
    
    // Camera rotation (pitch only when grounded)
    this.cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    
    // Input state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      run: false,
      rollLeft: false,
      rollRight: false
    };
    
    // Third-person controller
    this.tpController = null;
  }

  create(spawnPosition = new THREE.Vector3(0, 35, 0)) {
    // Create physics body
    this.body = this.physics.createDynamicBody(spawnPosition, {
      linearDamping: 0.1,
      angularDamping: 1.0,
      canSleep: false,
      lockRotations: true
    });
    
    // Create collider
    const colliderDesc = this.physics.createCapsuleCollider(
      this.height / 2 - this.radius,
      this.radius,
      {
        friction: 0.0,
        restitution: 0.0,
        density: 1.0,
        activeCollisionTypes: RAPIER.ActiveCollisionTypes.DEFAULT,
        activeEvents: RAPIER.ActiveEvents.COLLISION_EVENTS
      }
    );
    
    this.collider = this.physics.world.createCollider(colliderDesc, this.body);
    this.colliderHandle = this.collider.handle;
    
    // Create visual mesh
    const geometry = new THREE.CapsuleGeometry(
      this.radius,
      this.height - this.radius * 2,
      8, 8
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0xff9900,
      transparent: true,
      opacity: 0.7
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.scene.add(this.mesh);
    
    // Add camera to player
    this.mesh.add(this.scene.camera);
    this.scene.camera.position.set(0, this.height * 0.8, 0);
    this.scene.camera.rotation.set(0, 0, 0);
    
    // Create ray visualizations
    this.createRayVisualizations();
    
    // Create third-person controller after mesh is created
    this.tpController = new TPController(this.scene, this);
    
    return this.mesh;
  }

  createRayVisualizations() {
    const rayMaterial = new THREE.LineBasicMaterial({ 
      color: 0x00ff00,
      opacity: 0.5,
      transparent: true
    });
    
    const facingMaterial = new THREE.LineBasicMaterial({ 
      color: 0xff0000,
      opacity: 0.8,
      transparent: true,
      linewidth: 3
    });
    
    const createRayLine = (material) => {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setDrawRange(0, 2);
      return new THREE.Line(geometry, material.clone());
    };
    
    this.rayLines.left = createRayLine(rayMaterial);
    this.rayLines.right = createRayLine(rayMaterial);
    this.rayLines.center = createRayLine(rayMaterial);
    this.rayLines.facing = createRayLine(facingMaterial);
    
    // Add to player mesh
    this.mesh.add(this.rayLines.left);
    this.mesh.add(this.rayLines.right);
    this.mesh.add(this.rayLines.center);
    this.mesh.add(this.rayLines.facing);
  }

  checkGrounded() {
    if (!this.body) return;
    
    this.wasGrounded = this.isGrounded;
    
    const currentTime = performance.now();
    const velocityRapier = this.body.linvel();
    const velocity = new THREE.Vector3(velocityRapier.x, velocityRapier.y, velocityRapier.z);
    
    const playerTranslation = this.body.translation();
    const playerPos = new THREE.Vector3(
      playerTranslation.x,
      playerTranslation.y,
      playerTranslation.z
    );
    
    // Calculate gravity direction
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    this.rayDir.copy(gravityDir);
    
    // Update foot positions
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    const footOffset = this.radius * 0.8;
    const footLevel = -this.height * 0.5;
    
    const leftOffset = new THREE.Vector3(-footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const rightOffset = new THREE.Vector3(footOffset, footLevel, 0).applyQuaternion(playerQuat);
    const centerOffset = new THREE.Vector3(0, footLevel, 0).applyQuaternion(playerQuat);
    
    this.leftFootPos.copy(playerPos).add(leftOffset);
    this.rightFootPos.copy(playerPos).add(rightOffset);
    this.centerFootPos.copy(playerPos).add(centerOffset);
    
    // Cast rays
    this.leftFootHit = this.physics.castRay(this.leftFootPos, this.rayDir, 0.5, this.colliderHandle);
    this.rightFootHit = this.physics.castRay(this.rightFootPos, this.rayDir, 0.5, this.colliderHandle);
    this.centerFootHit = this.physics.castRay(this.centerFootPos, this.rayDir, 0.5, this.colliderHandle);
    
    // Determine grounding
    const hasGroundCollisions = this.physics.groundCollisions.size > 0;
    const hasRayHits = this.leftFootHit || this.rightFootHit || this.centerFootHit;
    const lowDownwardVelocity = velocity.dot(gravityDir) < 2.0;
    const recentGroundContact = (currentTime - this.physics.lastGroundContact) < 200;
    
    this.isGrounded = (hasGroundCollisions && lowDownwardVelocity) || 
                     (hasRayHits && lowDownwardVelocity) ||
                     (recentGroundContact && Math.abs(velocity.dot(gravityDir)) < 0.5);
    
    // Handle transitions
    if (this.wasGrounded && !this.isGrounded) {
      this.resetCameraForAirborne();
    }
    
    // Align to surface when grounded
    if (this.isGrounded && (this.centerFootHit || this.leftFootHit || this.rightFootHit)) {
      this.alignToSurface(gravityDir);
      this.adjustPositionToGround(gravityDir);
    }
    
    if (hasGroundCollisions || hasRayHits) {
      this.physics.lastGroundContact = currentTime;
    }
  }

  alignToSurface(gravityDirection) {
    if (!this.isGrounded || !this.body) return;
    
    let surfaceNormal = null;
    
    if (this.centerFootHit?.normal) {
      surfaceNormal = new THREE.Vector3(
        this.centerFootHit.normal.x,
        this.centerFootHit.normal.y,
        this.centerFootHit.normal.z
      );
    } else if (this.leftFootHit?.normal || this.rightFootHit?.normal) {
      surfaceNormal = new THREE.Vector3(0, 0, 0);
      let normalCount = 0;
      
      if (this.leftFootHit?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          this.leftFootHit.normal.x,
          this.leftFootHit.normal.y,
          this.leftFootHit.normal.z
        ));
        normalCount++;
      }
      
      if (this.rightFootHit?.normal) {
        surfaceNormal.add(new THREE.Vector3(
          this.rightFootHit.normal.x,
          this.rightFootHit.normal.y,
          this.rightFootHit.normal.z
        ));
        normalCount++;
      }
      
      if (normalCount > 0) {
        surfaceNormal.divideScalar(normalCount).normalize();
      }
    }
    
    if (!surfaceNormal) {
      surfaceNormal = gravityDirection.clone().multiplyScalar(-1);
    }
    
    const currentPlayerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
    
    const projectedForward = currentForward.clone()
      .sub(surfaceNormal.clone().multiplyScalar(currentForward.dot(surfaceNormal)))
      .normalize();
    
    if (projectedForward.lengthSq() < 0.1) {
      const worldForward = new THREE.Vector3(0, 0, -1);
      projectedForward.copy(worldForward)
        .sub(surfaceNormal.clone().multiplyScalar(worldForward.dot(surfaceNormal)))
        .normalize();
    }
    
    const right = new THREE.Vector3().crossVectors(projectedForward, surfaceNormal).normalize();
    const alignedForward = new THREE.Vector3().crossVectors(surfaceNormal, right).normalize();
    
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(right, surfaceNormal, alignedForward.multiplyScalar(-1));
    
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    
    const lerpFactor = 0.15;
    currentPlayerQuat.slerp(targetQuat, lerpFactor);
    
    this.body.setRotation({
      x: currentPlayerQuat.x,
      y: currentPlayerQuat.y,
      z: currentPlayerQuat.z,
      w: currentPlayerQuat.w
    });
    
    this.mesh.quaternion.copy(currentPlayerQuat);
    this.lastGroundNormal.copy(surfaceNormal);
  }

  adjustPositionToGround(gravityDir) {
    const closestHit = this.centerFootHit || this.leftFootHit || this.rightFootHit;
    if (!closestHit || closestHit.toi === undefined) return;
    
    const playerTranslation = this.body.translation();
    const hitPoint = new THREE.Vector3(
      closestHit.point.x,
      closestHit.point.y,
      closestHit.point.z
    );
    
    const upDir = gravityDir.clone().multiplyScalar(-1);
    const targetPlayerCenter = hitPoint.clone().add(upDir.clone().multiplyScalar(this.height * 0.5));
    targetPlayerCenter.add(upDir.clone().multiplyScalar(0.05));
    
    const currentPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
    const correction = targetPlayerCenter.clone().sub(currentPos);
    
    if (correction.length() > 0.01 && correction.length() < 2.0) {
      correction.multiplyScalar(0.3);
      this.body.setTranslation({
        x: currentPos.x + correction.x,
        y: currentPos.y + correction.y,
        z: currentPos.z + correction.z
      });
    }
  }

  resetCameraForAirborne() {
    if (!this.mesh || !this.body || !this.wasGrounded || this.isGrounded) return;
    
    const currentPlayerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    if (Math.abs(this.cameraRotation.x) > 0.01) {
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, this.cameraRotation.x);
      
      currentPlayerQuat.premultiply(pitchQuat);
      
      this.body.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
    }
    
    this.cameraRotation.x = 0;
    this.cameraRotation.y = 0;
    this.cameraRotation.z = 0;
  }

  handleMovement(deltaTime) {
    if (!this.body) return;
    
    const velocity = this.body.linvel();
    const playerTranslation = this.body.translation();
    const playerPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
    
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    const gravityStrength = this.physics.gravity.strength;
    const gravityForce = gravityDir.clone().multiplyScalar(gravityStrength * deltaTime);
    
    // Handle airborne roll
    if (!this.isGrounded && this.body) {
      const rollSensitivity = 2.0;
      let rollDelta = 0;
      
      if (this.keys.rollLeft) rollDelta -= rollSensitivity * deltaTime;
      if (this.keys.rollRight) rollDelta += rollSensitivity * deltaTime;
      
      if (Math.abs(rollDelta) > 0.001) {
        const currentPlayerQuat = new THREE.Quaternion(
          this.body.rotation().x,
          this.body.rotation().y,
          this.body.rotation().z,
          this.body.rotation().w
        );
        
        const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
        const rollQuat = new THREE.Quaternion().setFromAxisAngle(localForward, rollDelta);
        
        currentPlayerQuat.premultiply(rollQuat);
        
        this.body.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
      }
    }
    
    // Calculate movement
    let moveForward = 0;
    let moveRight = 0;
    
    if (this.keys.forward) moveForward += 1;
    if (this.keys.backward) moveForward -= 1;
    if (this.keys.left) moveRight -= 1;
    if (this.keys.right) moveRight += 1;
    
    const moveLength = Math.sqrt(moveForward * moveForward + moveRight * moveRight);
    if (moveLength > 0) {
      moveForward /= moveLength;
      moveRight /= moveLength;
    }
    
    const speed = this.keys.run ? this.runSpeed : this.walkSpeed;
    moveForward *= speed;
    moveRight *= speed;
    
    const playerQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    
    let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
    let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
    
    if (this.isGrounded && this.lastGroundNormal) {
      forward.projectOnPlane(this.lastGroundNormal).normalize();
      right.projectOnPlane(this.lastGroundNormal).normalize();
    }
    
    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, moveForward);
    moveDir.addScaledVector(right, moveRight);
    
    let newVelX = velocity.x + gravityForce.x;
    let newVelY = velocity.y + gravityForce.y;
    let newVelZ = velocity.z + gravityForce.z;
    
    if (this.isGrounded) {
      const groundAccel = 100.0;
      newVelX += moveDir.x * groundAccel * deltaTime;
      newVelY += moveDir.y * groundAccel * deltaTime;
      newVelZ += moveDir.z * groundAccel * deltaTime;
      
      if (moveLength === 0) {
        newVelX *= 0.8;
        newVelY *= 0.95;
        newVelZ *= 0.8;
      }
      
      const vel = new THREE.Vector3(newVelX, newVelY, newVelZ);
      const velMagnitude = vel.length();
      if (velMagnitude > speed * 1.5) {
        vel.normalize().multiplyScalar(speed * 1.5);
        newVelX = vel.x;
        newVelY = vel.y;
        newVelZ = vel.z;
      }
    } else {
      const airControl = 1.0;
      newVelX += moveDir.x * airControl * deltaTime;
      newVelY += moveDir.y * airControl * deltaTime;
      newVelZ += moveDir.z * airControl * deltaTime;
      
      newVelX *= 0.95;
      newVelY *= 0.98;
      newVelZ *= 0.95;
    }
    
    // Handle jumping
    if (this.keys.jump && this.isGrounded && !this.jumpInProgress) {
      const jumpVector = gravityDir.clone().multiplyScalar(-this.jumpForce);
      newVelX += jumpVector.x;
      newVelY += jumpVector.y;
      newVelZ += jumpVector.z;
      this.jumpInProgress = true;
      this.jumpTime = 0;
    }
    
    if (this.jumpInProgress) {
      this.jumpTime += deltaTime;
      if (this.jumpTime >= this.jumpDuration || this.isGrounded) {
        this.jumpInProgress = false;
      }
    }
    
    this.body.setLinvel({
      x: newVelX,
      y: newVelY,
      z: newVelZ
    });
  }

  updateTransform() {
    if (!this.body || !this.mesh) return;
    
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
    
    const physicsQuat = new THREE.Quaternion(
      this.body.rotation().x,
      this.body.rotation().y,
      this.body.rotation().z,
      this.body.rotation().w
    );
    this.mesh.quaternion.copy(physicsQuat);
    
    if (this.isGrounded) {
      this.scene.camera.rotation.x = this.cameraRotation.x;
      this.scene.camera.rotation.y = this.cameraRotation.y;
      this.scene.camera.rotation.z = 0;
    } else {
      this.scene.camera.rotation.set(0, 0, 0);
    }
  }

  updateRayVisualizations() {
    if (!this.mesh) return;
    
    const worldToLocal = this.mesh.worldToLocal.bind(this.mesh);
    
    const leftFootLocal = worldToLocal(this.leftFootPos.clone());
    const rightFootLocal = worldToLocal(this.rightFootPos.clone());
    const centerFootLocal = worldToLocal(this.centerFootPos.clone());
    
    const rayLength = 2.0;
    const leftEndWorld = this.leftFootPos.clone().add(this.rayDir.clone().multiplyScalar(rayLength));
    const rightEndWorld = this.rightFootPos.clone().add(this.rayDir.clone().multiplyScalar(rayLength));
    const centerEndWorld = this.centerFootPos.clone().add(this.rayDir.clone().multiplyScalar(rayLength));
    
    const leftEndLocal = worldToLocal(leftEndWorld);
    const rightEndLocal = worldToLocal(rightEndWorld);
    const centerEndLocal = worldToLocal(centerEndWorld);
    
    const updateRayGeometry = (rayLine, startLocal, endLocal) => {
      const positions = rayLine.geometry.attributes.position.array;
      positions[0] = startLocal.x;
      positions[1] = startLocal.y;
      positions[2] = startLocal.z;
      positions[3] = endLocal.x;
      positions[4] = endLocal.y;
      positions[5] = endLocal.z;
      rayLine.geometry.attributes.position.needsUpdate = true;
    };
    
    updateRayGeometry(this.rayLines.left, leftFootLocal, leftEndLocal);
    updateRayGeometry(this.rayLines.right, rightFootLocal, rightEndLocal);
    updateRayGeometry(this.rayLines.center, centerFootLocal, centerEndLocal);
    
    const playerCenter = new THREE.Vector3(0, 0, 0);
    const facingEndLocal = new THREE.Vector3(0, 0, -3);
    updateRayGeometry(this.rayLines.facing, playerCenter, facingEndLocal);
    
    this.rayLines.left.material.color.setHex(this.leftFootHit ? 0xff0000 : 0x00ff00);
    this.rayLines.right.material.color.setHex(this.rightFootHit ? 0xff0000 : 0x00ff00);
    this.rayLines.center.material.color.setHex(this.centerFootHit ? 0xff0000 : 0x00ff00);
  }

  handleMouseMove(event, lookSensitivity = 0.001, yawSensitivity = 0.002) {
    // Pass to third-person controller if active
    if (this.tpController && this.tpController.isActive) {
      this.tpController.handleMouseMove(event);
      return;
    }
    
    if (!this.body) return;
    
    if (this.isGrounded) {
      // Camera pitch
      this.cameraRotation.x -= event.movementY * lookSensitivity;
      this.cameraRotation.x = Math.max(
        -Math.PI / 2 + 0.01, 
        Math.min(Math.PI / 2 - 0.01, this.cameraRotation.x)
      );
      
      // Player yaw
      const currentPlayerQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      let upVector = new THREE.Vector3(0, 1, 0);
      if (this.lastGroundNormal) {
        upVector = this.lastGroundNormal.clone();
      }
      
      const yawDelta = -event.movementX * yawSensitivity;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, yawDelta);
      
      currentPlayerQuat.premultiply(yawQuat);
      
      this.body.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
      
      this.cameraRotation.y = 0;
    } else {
      // Airborne - full 3D rotation
      const currentPlayerQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const pitchDelta = -event.movementY * lookSensitivity;
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, pitchDelta);
      
      const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentPlayerQuat);
      const yawDelta = -event.movementX * yawSensitivity;
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(localUp, yawDelta);
      
      currentPlayerQuat.premultiply(pitchQuat);
      currentPlayerQuat.premultiply(yawQuat);
      
      this.body.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
      
      this.cameraRotation.x = 0;
      this.cameraRotation.y = 0;
    }
  }

  // Add method to toggle camera
  toggleCamera() {
    if (this.tpController) {
      this.tpController.toggle();
    }
  }

  // Update the update method to include TP controller
  update(deltaTime) {
    this.checkGrounded();
    this.handleMovement(deltaTime);
    this.updateTransform();
    this.updateRayVisualizations();
    
    // Update third-person camera if active
    if (this.tpController) {
      this.tpController.update();
    }
  }

  getPosition() {
    if (!this.body) return new THREE.Vector3();
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  getFacing() {
    if (!this.mesh) return new THREE.Vector3(0, 0, -1);
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.mesh.quaternion);
  }

  getSpeed() {
    if (!this.body) return 0;
    const vel = this.body.linvel();
    return Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  }
}
