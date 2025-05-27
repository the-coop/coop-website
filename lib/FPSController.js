import * as THREE from 'three';
import { RAPIER } from './physics.js';

export class FPSController {
  constructor(scene, camera, physicsWorld, physicsManager) {
    this.scene = scene;
    this.camera = camera;
    this.physicsWorld = physicsWorld;
    this.physicsManager = physicsManager;
    
    // Player properties
    this.height = 1.8;
    this.radius = 0.4;
    this.walkSpeed = 8;
    this.runSpeed = 16;
    this.jumpForce = 8;
    
    // State
    this.isGrounded = false;
    this.wasGrounded = false;
    this.isMoving = false;
    this.currentSpeed = 0;
    this.jumpInProgress = false;
    this.jumpTime = 0;
    this.jumpDuration = 0.5;
    
    // Physics
    this.body = null;
    this.collider = null;
    this.mesh = null;
    
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
    
    // Camera control
    this.cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.isCameraDetached = false;
    
    // Ground detection
    this.groundCollisions = new Set();
    this.lastGroundContact = 0;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    
    // Ray casting
    this.rayDir = new THREE.Vector3(0, -1, 0);
    this.leftFootPos = new THREE.Vector3();
    this.rightFootPos = new THREE.Vector3();
    this.centerFootPos = new THREE.Vector3();
    this.leftFootHit = null;
    this.rightFootHit = null;
    this.centerFootHit = null;
    
    // Debug visualization
    this.debugVisuals = {
      leftRayLine: null,
      rightRayLine: null,
      centerRayLine: null,
      facingLine: null
    };
  }

  init(spawnPosition = new THREE.Vector3(0, 35, 0)) {
    // Create player physics body
    const playerBodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPosition.x, spawnPosition.y, spawnPosition.z)
      .setLinearDamping(0.1)
      .setAngularDamping(1.0)
      .setCanSleep(false)
      .lockRotations();
    
    this.body = this.physicsWorld.createRigidBody(playerBodyDesc);
    
    // Create collider
    const playerColliderDesc = RAPIER.ColliderDesc.capsule(
      this.height / 2 - this.radius,
      this.radius
    )
    .setFriction(0.0)
    .setRestitution(0.0)
    .setDensity(1.0)
    .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.DEFAULT)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    this.collider = this.physicsWorld.createCollider(playerColliderDesc, this.body);
    
    // Create visual mesh
    const playerGeometry = new THREE.CapsuleGeometry(
      this.radius,
      this.height - this.radius * 2,
      8, 8
    );
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff9900,
      transparent: true,
      opacity: 0.7
    });
    
    this.mesh = new THREE.Mesh(playerGeometry, playerMaterial);
    this.scene.add(this.mesh);
    
    // Add camera to player
    this.mesh.add(this.camera);
    this.camera.position.set(0, this.height * 0.8, 0);
    this.camera.rotation.set(0, 0, 0);
    
    // Create debug visualizations
    this.createDebugVisualizations();
    
    return this.mesh;
  }

  createDebugVisualizations() {
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
    
    this.debugVisuals.leftRayLine = createRayLine(rayMaterial);
    this.debugVisuals.rightRayLine = createRayLine(rayMaterial);
    this.debugVisuals.centerRayLine = createRayLine(rayMaterial);
    this.debugVisuals.facingLine = createRayLine(facingMaterial);
    
    // Add to player mesh
    this.mesh.add(this.debugVisuals.leftRayLine);
    this.mesh.add(this.debugVisuals.rightRayLine);
    this.mesh.add(this.debugVisuals.centerRayLine);
    this.mesh.add(this.debugVisuals.facingLine);
  }

  handleKeyDown(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'KeyQ':
        this.keys.rollLeft = true;
        break;
      case 'KeyE':
        this.keys.rollRight = true;
        break;
      case 'Space':
        if (this.isGrounded) {
          this.keys.jump = true;
        }
        break;
      case 'ShiftLeft':
        this.keys.run = true;
        break;
    }
  }

  handleKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'KeyQ':
        this.keys.rollLeft = false;
        break;
      case 'KeyE':
        this.keys.rollRight = false;
        break;
      case 'Space':
        this.keys.jump = false;
        break;
      case 'ShiftLeft':
        this.keys.run = false;
        break;
    }
  }

  handleMouseMove(event, canvas) {
    if (document.pointerLockElement !== canvas) return;
    
    const lookSensitivity = 0.001;
    const yawSensitivity = 0.002;
    
    if (this.isGrounded && this.body) {
      // When grounded, camera pitch and player yaw
      this.cameraRotation.x -= event.movementY * lookSensitivity;
      this.cameraRotation.x = Math.max(
        -Math.PI / 2 + 0.01, 
        Math.min(Math.PI / 2 - 0.01, this.cameraRotation.x)
      );
      
      // Rotate player body for yaw
      const currentPlayerQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      const upVector = this.lastGroundNormal.clone();
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
    } else if (this.body) {
      // When airborne, rotate entire player capsule
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

  update(deltaTime) {
    if (!this.body) return;
    
    this.checkGrounded();
    this.handleMovement(deltaTime);
    this.updateTransform();
    this.updateDebugVisualizations();
  }

  checkGrounded() {
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
      .subVectors(this.physicsManager.gravity.center, playerPos)
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
    const castGroundingRay = (footPos) => {
      const footRay = new RAPIER.Ray(
        { x: footPos.x, y: footPos.y, z: footPos.z },
        { x: this.rayDir.x, y: this.rayDir.y, z: this.rayDir.z }
      );
      
      return this.physicsWorld.castRay(
        footRay,
        0.5,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
        undefined,
        undefined,
        (colliderHandle) => colliderHandle !== this.collider.handle
      );
    };
    
    this.leftFootHit = castGroundingRay(this.leftFootPos);
    this.rightFootHit = castGroundingRay(this.rightFootPos);
    this.centerFootHit = castGroundingRay(this.centerFootPos);
    
    const hasGroundCollisions = this.groundCollisions.size > 0;
    const hasRayHits = this.leftFootHit || this.rightFootHit || this.centerFootHit;
    const lowDownwardVelocity = velocity.dot(gravityDir) < 2.0;
    const recentGroundContact = (currentTime - this.lastGroundContact) < 200;
    
    this.isGrounded = (hasGroundCollisions && lowDownwardVelocity) || 
                     (hasRayHits && lowDownwardVelocity) ||
                     (recentGroundContact && Math.abs(velocity.dot(gravityDir)) < 0.5);
    
    if (hasGroundCollisions || hasRayHits) {
      this.lastGroundContact = currentTime;
    }
    
    if (this.isGrounded && (this.centerFootHit || this.leftFootHit || this.rightFootHit)) {
      this.alignToSurface(gravityDir);
    }
    
    if (this.wasGrounded && !this.isGrounded) {
      this.resetCameraForAirborne();
    }
  }

  alignToSurface(gravityDirection) {
    if (!this.isGrounded) return;
    
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

  handleMovement(deltaTime) {
    const velocity = this.body.linvel();
    const playerTranslation = this.body.translation();
    const playerPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
    
    // Apply gravity
    this.physicsManager.applyPlanetGravity(this.body, deltaTime);
    
    // Handle airborne roll
    if (!this.isGrounded) {
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
    
    this.isMoving = moveLength > 0;
    this.currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
    
    // Get movement directions
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
    
    // Calculate new velocity (gravity already applied)
    let newVelX = velocity.x;
    let newVelY = velocity.y;
    let newVelZ = velocity.z;
    
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
      const gravityDir = new THREE.Vector3()
        .subVectors(this.physicsManager.gravity.center, playerPos)
        .normalize();
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
    
    this.body.setLinvel({ x: newVelX, y: newVelY, z: newVelZ });
  }

  updateTransform() {
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
      this.camera.rotation.x = this.cameraRotation.x;
      this.camera.rotation.y = this.cameraRotation.y;
      this.camera.rotation.z = 0;
    } else {
      this.camera.rotation.x = 0;
      this.camera.rotation.y = 0;
      this.camera.rotation.z = 0;
    }
  }

  updateDebugVisualizations() {
    if (!this.mesh) return;
    
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
    
    // Convert world positions to local
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
    
    updateRayGeometry(this.debugVisuals.leftRayLine, leftFootLocal, leftEndLocal);
    updateRayGeometry(this.debugVisuals.rightRayLine, rightFootLocal, rightEndLocal);
    updateRayGeometry(this.debugVisuals.centerRayLine, centerFootLocal, centerEndLocal);
    
    // Update facing line
    const playerCenter = new THREE.Vector3(0, 0, 0);
    const facingEndLocal = new THREE.Vector3(0, 0, -3);
    updateRayGeometry(this.debugVisuals.facingLine, playerCenter, facingEndLocal);
    
    // Update colors
    this.debugVisuals.leftRayLine.material.color.setHex(this.leftFootHit ? 0xff0000 : 0x00ff00);
    this.debugVisuals.rightRayLine.material.color.setHex(this.rightFootHit ? 0xff0000 : 0x00ff00);
    this.debugVisuals.centerRayLine.material.color.setHex(this.centerFootHit ? 0xff0000 : 0x00ff00);
  }

  resetCameraForAirborne() {
    if (this.wasGrounded && !this.isGrounded && Math.abs(this.cameraRotation.x) > 0.01) {
      const currentPlayerQuat = new THREE.Quaternion(
        this.body.rotation().x,
        this.body.rotation().y,
        this.body.rotation().z,
        this.body.rotation().w
      );
      
      const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
      const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, this.cameraRotation.x);
      
      currentPlayerQuat.premultiply(pitchQuat);
      
      this.body.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
      
      this.cameraRotation.x = 0;
      this.cameraRotation.y = 0;
      this.cameraRotation.z = 0;
    }
  }

  processCollisionEvents() {
    if (!this.physicsWorld?.eventQueue) return;
    
    this.physicsWorld.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      let otherColliderHandle = null;
      
      if (handle1 === this.collider.handle) {
        otherColliderHandle = handle2;
      } else if (handle2 === this.collider.handle) {
        otherColliderHandle = handle1;
      }
      
      if (otherColliderHandle !== null) {
        if (started) {
          this.groundCollisions.add(otherColliderHandle);
          this.lastGroundContact = performance.now();
        } else {
          this.groundCollisions.delete(otherColliderHandle);
        }
      }
    });
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
}
