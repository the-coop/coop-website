import * as THREE from 'three';

export class FPSController {
  constructor(physicsManager, sceneManager) {
    this.physics = physicsManager;
    this.scene = sceneManager;
    
    // Player properties
    this.playerBody = null;
    this.playerHeight = 1.8;
    this.playerRadius = 0.4;
    this.walkSpeed = 8;
    this.runSpeed = 16;
    this.jumpForce = 8;
    
    // Camera properties
    this.cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.isCameraDetached = false;
    this.detachedCameraAngle = 0;
    
    // Movement state
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
    
    // Ground detection
    this.isGrounded = false;
    this.wasGrounded = false;
    this.jumpInProgress = false;
    this.jumpTime = 0;
    this.jumpDuration = 0.5;
    this.lastGroundNormal = new THREE.Vector3(0, 1, 0);
    this.groundCollisions = new Set();
    this.lastGroundContact = 0;
    
    // Ray casting
    this.rayDir = new THREE.Vector3(0, -1, 0);
    this.leftFootPos = new THREE.Vector3();
    this.rightFootPos = new THREE.Vector3();
    this.centerFootPos = new THREE.Vector3();
    this.leftFootHit = null;
    this.rightFootHit = null;
    this.centerFootHit = null;
    
    // UI state
    this.playerPosition = new THREE.Vector3();
    this.playerFacing = new THREE.Vector3(0, 0, -1);
    this.isMoving = false;
    this.currentSpeed = 0;
    
    // Client-side prediction
    this.pendingInputs = [];
    this.inputSequence = 0;
    this.lastServerUpdate = null;
    this.predictionError = 0;
    
    // Match server gravity settings
    this.planetCenter = new THREE.Vector3(0, -250, 0);
    this.gravityStrength = 25;
  }

  createPlayer(x, y, z) {
    console.log("Creating player...");
    
    this.playerBody = this.physics.createPlayerBody(x, y, z, this.playerHeight, this.playerRadius);
    
    const playerGeometry = new THREE.CapsuleGeometry(
      this.playerRadius,
      this.playerHeight - this.playerRadius * 2,
      8, 8
    );
    const playerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff9900,
      transparent: true,
      opacity: 0.7
    });
    
    this.scene.player = new THREE.Mesh(playerGeometry, playerMaterial);
    this.scene.scene.add(this.scene.player);
    
    this.scene.player.add(this.scene.camera);
    this.scene.camera.position.set(0, this.playerHeight * 0.8, 0);
    this.scene.camera.rotation.set(0, 0, 0);
    
    this.cameraRotation.set(0, 0, 0);
    
    this.scene.createRayVisualizations();
    
    console.log("Player created successfully at position:", y);
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
      case 'KeyO':
        this.toggleCameraAttachment();
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

  handleMouseMove(event) {
    const lookSensitivity = 0.001;
    const yawSensitivity = 0.002;
    
    try {
      if (this.isGrounded && this.playerBody) {
        this.cameraRotation.x -= event.movementY * lookSensitivity;
        this.cameraRotation.x = Math.max(
          -Math.PI / 2 + 0.01, 
          Math.min(Math.PI / 2 - 0.01, this.cameraRotation.x)
        );
        
        const currentPlayerQuat = new THREE.Quaternion(
          this.playerBody.rotation().x,
          this.playerBody.rotation().y,
          this.playerBody.rotation().z,
          this.playerBody.rotation().w
        );
        
        let upVector = new THREE.Vector3(0, 1, 0);
        if (this.lastGroundNormal) {
          upVector = this.lastGroundNormal.clone();
        }
        
        const yawDelta = -event.movementX * yawSensitivity;
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, yawDelta);
        
        currentPlayerQuat.premultiply(yawQuat);
        
        this.playerBody.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
        
        this.cameraRotation.y = 0;
      } else {
        if (this.playerBody) {
          const currentPlayerQuat = new THREE.Quaternion(
            this.playerBody.rotation().x,
            this.playerBody.rotation().y,
            this.playerBody.rotation().z,
            this.playerBody.rotation().w
          );
          
          const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
          const pitchDelta = -event.movementY * lookSensitivity;
          const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, pitchDelta);
          
          const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentPlayerQuat);
          const yawDelta = -event.movementX * yawSensitivity;
          const yawQuat = new THREE.Quaternion().setFromAxisAngle(localUp, yawDelta);
          
          currentPlayerQuat.premultiply(pitchQuat);
          currentPlayerQuat.premultiply(yawQuat);
          
          this.playerBody.setRotation({
            x: currentPlayerQuat.x,
            y: currentPlayerQuat.y,
            z: currentPlayerQuat.z,
            w: currentPlayerQuat.w
          });
          
          this.cameraRotation.x = 0;
          this.cameraRotation.y = 0;
        }
      }
    } catch (e) {
      console.error("Error in mouse move:", e);
    }
  }

  handlePointerLockChange(gameCanvas) {
    if (document.pointerLockElement !== gameCanvas) {
      this.keys.forward = false;
      this.keys.backward = false;
      this.keys.left = false;
      this.keys.right = false;
      this.keys.jump = false;
      this.keys.run = false;
    }
  }

  checkGrounded(frameCount) {
    if (!this.playerBody || !this.physics.world) return;
    
    try {
      this.wasGrounded = this.isGrounded;
      
      const currentTime = performance.now();
      const velocityRapier = this.playerBody.linvel();
      
      const velocity = new THREE.Vector3(velocityRapier.x, velocityRapier.y, velocityRapier.z);
      
      const playerTranslation = this.playerBody.translation();
      const playerPos = new THREE.Vector3(
        playerTranslation.x,
        playerTranslation.y,
        playerTranslation.z
      );
      
      // Use same planet-centered gravity as server for ground detection
      const toPlanet = new THREE.Vector3().subVectors(this.planetCenter, playerPos);
      const gravityDir = toPlanet.normalize();
      
      this.rayDir.copy(gravityDir);
      
      const playerQuat = new THREE.Quaternion(
        this.playerBody.rotation().x,
        this.playerBody.rotation().y,
        this.playerBody.rotation().z,
        this.playerBody.rotation().w
      );
      
      const footOffset = this.playerRadius * 0.8;
      const footLevel = -this.playerHeight * 0.5;
      
      const leftOffset = new THREE.Vector3(-footOffset, footLevel, 0).applyQuaternion(playerQuat);
      const rightOffset = new THREE.Vector3(footOffset, footLevel, 0).applyQuaternion(playerQuat);
      const centerOffset = new THREE.Vector3(0, footLevel, 0).applyQuaternion(playerQuat);
      
      this.leftFootPos.copy(playerPos).add(leftOffset);
      this.rightFootPos.copy(playerPos).add(rightOffset);
      this.centerFootPos.copy(playerPos).add(centerOffset);
      
      this.leftFootHit = this.physics.castRay(
        this.leftFootPos, 
        this.rayDir, 
        1.5, // Match server raycast distance
        this.physics.debugInfo.playerColliderHandle
      );
      this.rightFootHit = this.physics.castRay(
        this.rightFootPos, 
        this.rayDir, 
        1.5, // Match server raycast distance
        this.physics.debugInfo.playerColliderHandle
      );
      this.centerFootHit = this.physics.castRay(
        this.centerFootPos, 
        this.rayDir, 
        1.5, // Match server raycast distance
        this.physics.debugInfo.playerColliderHandle
      );
      
      const hasGroundCollisions = this.groundCollisions.size > 0;
      const hasRayHits = this.leftFootHit || this.rightFootHit || this.centerFootHit;
      const lowDownwardVelocity = velocity.dot(gravityDir) < 3.0; // Match server velocity threshold
      const recentGroundContact = (currentTime - this.lastGroundContact) < 200;
      
      // Use same grounding logic as server - conservative approach
      this.isGrounded = (hasGroundCollisions && lowDownwardVelocity) || 
                        (hasRayHits && lowDownwardVelocity) ||
                        (recentGroundContact && Math.abs(velocity.dot(gravityDir)) < 0.5);
      
      // Trust server reconciliation more - if we just received server state, use it
      if (this.lastServerUpdate && (Date.now() - this.lastServerUpdate.timestamp) < 100) {
        // If server says we're grounded and we're close to agreeing, trust server
        const serverGrounded = this.lastServerUpdate.isGrounded;
        if (serverGrounded && (hasGroundCollisions || hasRayHits || recentGroundContact)) {
          this.isGrounded = true;
        } else if (!serverGrounded && !hasGroundCollisions && !hasRayHits) {
          this.isGrounded = false;
        }
      }
      
      if (this.wasGrounded && !this.isGrounded) {
        this.resetCameraForAirborne();
      }
      
      if (hasGroundCollisions || hasRayHits) {
        this.lastGroundContact = currentTime;
      }
      
      if (this.isGrounded && (this.centerFootHit || this.leftFootHit || this.rightFootHit)) {
        this.alignPlayerToSurface(gravityDir);
        
        const closestHit = this.centerFootHit || this.leftFootHit || this.rightFootHit;
        if (closestHit && closestHit.toi !== undefined && closestHit.toi < 1.0) {
          const hitPoint = new THREE.Vector3(
            closestHit.point.x,
            closestHit.point.y,
            closestHit.point.z
          );
          
          const upDir = gravityDir.clone().multiplyScalar(-1);
          const targetPlayerCenter = hitPoint.clone().add(upDir.clone().multiplyScalar(this.playerHeight * 0.5));
          
          targetPlayerCenter.add(upDir.clone().multiplyScalar(0.05));
          
          const currentPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
          const correction = targetPlayerCenter.clone().sub(currentPos);
          
          if (correction.length() > 0.01 && correction.length() < 2.0) {
            correction.multiplyScalar(0.1); // Reduced correction strength
            this.playerBody.setTranslation({
              x: currentPos.x + correction.x,
              y: currentPos.y + correction.y,
              z: currentPos.z + correction.z
            });
          }
        }
      }
      
      if (this.isGrounded !== this.wasGrounded) {
        if (this.isGrounded) {
          console.log("Client: Player became grounded - Collisions:", this.groundCollisions.size, "Ray hits:", hasRayHits, "Server says:", this.lastServerUpdate?.isGrounded);
        } else {
          console.log("Client: Player became airborne - Collisions:", this.groundCollisions.size, "Ray hits:", hasRayHits, "Server says:", this.lastServerUpdate?.isGrounded);
        }
      }
      
      if (frameCount % 60 === 0) {
        console.log("Client ground check - Collisions:", this.groundCollisions.size, 
                    "Ray hits:", hasRayHits, 
                    "Client grounded:", this.isGrounded,
                    "Server grounded:", this.lastServerUpdate?.isGrounded,
                    "Player pos:", playerPos.x.toFixed(1), playerPos.y.toFixed(1), playerPos.z.toFixed(1));
      }
    } catch (e) {
      console.error("Error checking grounded state:", e);
    }
  }

  processCollisionEvents() {
    if (!this.physics.world?.eventQueue || !this.playerBody) return;
    
    try {
      this.physics.world.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        let playerColliderHandle = null;
        let otherColliderHandle = null;
        
        if (this.physics.debugInfo.playerColliderHandle) {
          if (handle1 === this.physics.debugInfo.playerColliderHandle) {
            playerColliderHandle = handle1;
            otherColliderHandle = handle2;
          } else if (handle2 === this.physics.debugInfo.playerColliderHandle) {
            playerColliderHandle = handle2;
            otherColliderHandle = handle1;
          }
        }
        
        if (playerColliderHandle) {
          const currentTime = performance.now();
          
          if (started) {
            this.groundCollisions.add(otherColliderHandle);
            this.lastGroundContact = currentTime;
            
            console.log("Collision started with handle:", otherColliderHandle, "Total collisions:", this.groundCollisions.size);
          } else {
            this.groundCollisions.delete(otherColliderHandle);
            
            console.log("Collision ended with handle:", otherColliderHandle, "Remaining collisions:", this.groundCollisions.size);
          }
        }
      });
    } catch (e) {
      console.error("Error processing collision events:", e);
    }
  }

  alignPlayerToSurface(gravityDirection) {
    // ...existing code from original alignPlayerToSurface function...
    if (!this.playerBody || !this.scene.player || !this.isGrounded) return;
    
    try {
      let surfaceNormal = null;
      
      if (this.centerFootHit && this.centerFootHit.normal) {
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
        } else {
          surfaceNormal = null;
        }
      }
      
      if (!surfaceNormal) {
        surfaceNormal = gravityDirection.clone().multiplyScalar(-1);
      }
      
      const currentPlayerQuat = new THREE.Quaternion(
        this.playerBody.rotation().x,
        this.playerBody.rotation().y,
        this.playerBody.rotation().z,
        this.playerBody.rotation().w
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
        
        if (projectedForward.lengthSq() < 0.1) {
          projectedForward.set(1, 0, 0).projectOnPlane(surfaceNormal).normalize();
        }
      }
      
      const right = new THREE.Vector3().crossVectors(projectedForward, surfaceNormal).normalize();
      const alignedForward = new THREE.Vector3().crossVectors(surfaceNormal, right).normalize();
      
      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.makeBasis(right, surfaceNormal, alignedForward.multiplyScalar(-1));
      
      const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
      
      const lerpFactor = 0.15;
      currentPlayerQuat.slerp(targetQuat, lerpFactor);
      
      this.playerBody.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
      
      this.scene.player.quaternion.copy(currentPlayerQuat);
      
      if (this.lastGroundNormal) {
        this.lastGroundNormal.copy(surfaceNormal);
      }
      
    } catch (e) {
      console.error("Error aligning player to surface:", e);
    }
  }

  resetCameraForAirborne() {
    if (this.scene.player && this.playerBody && this.wasGrounded && !this.isGrounded) {
      console.log("Transitioning to airborne - transferring camera rotation to player body");
      
      const currentPlayerQuat = new THREE.Quaternion(
        this.playerBody.rotation().x,
        this.playerBody.rotation().y,
        this.playerBody.rotation().z,
        this.playerBody.rotation().w
      );
      
      if (Math.abs(this.cameraRotation.x) > 0.01) {
        const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, this.cameraRotation.x);
        
        currentPlayerQuat.premultiply(pitchQuat);
        
        this.playerBody.setRotation({
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
  }

  handleAllMovement(deltaTime, frameCount) {
    if (!this.playerBody || !this.physics.world) return;
    
    try {
      const velocity = this.playerBody.linvel();
      const playerTranslation = this.playerBody.translation();
      const playerPos = new THREE.Vector3(playerTranslation.x, playerTranslation.y, playerTranslation.z);
      
      // Check if we have a recent server update for reconciliation
      const recentServerUpdate = this.lastServerUpdate && (Date.now() - this.lastServerUpdate.timestamp) < 500;
      
      // Use same planet-centered gravity calculation as server
      const toPlanet = new THREE.Vector3().subVectors(this.planetCenter, playerPos);
      const distanceToPlanet = toPlanet.length();
      const gravityDir = toPlanet.normalize();
      
      // Apply gravity to scene FIRST - let server authority handle conflicts
      this.physics.applyGravityToScene(this.scene.scene, deltaTime);
      
      // Handle local player air movement (rolling, etc.)
      if (!this.isGrounded && this.playerBody) {
        const rollSensitivity = 2.0;
        let rollDelta = 0;
        
        if (this.keys.rollLeft) rollDelta -= rollSensitivity * deltaTime;
        if (this.keys.rollRight) rollDelta += rollSensitivity * deltaTime;
        
        if (Math.abs(rollDelta) > 0.001) {
          const currentPlayerQuat = new THREE.Quaternion(
            this.playerBody.rotation().x,
            this.playerBody.rotation().y,
            this.playerBody.rotation().z,
            this.playerBody.rotation().w
          );
          
          const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
          const rollQuat = new THREE.Quaternion().setFromAxisAngle(localForward, rollDelta);
          
          currentPlayerQuat.premultiply(rollQuat);
          
          this.playerBody.setRotation({
            x: currentPlayerQuat.x,
            y: currentPlayerQuat.y,
            z: currentPlayerQuat.z,
            w: currentPlayerQuat.w
          });
        }
      }
      
      // Get current velocity (after potential gravity application)
      const currentVel = this.playerBody.linvel();
      let newVelX = currentVel.x;
      let newVelY = currentVel.y;
      let newVelZ = currentVel.z;
      
      // Calculate movement for local player - but be more conservative if server disagrees
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
      
      // Reduce movement strength if server disagrees on grounding
      let movementStrength = 1.0;
      if (recentServerUpdate && this.isGrounded !== this.lastServerUpdate.isGrounded) {
        movementStrength = 0.3; // Much more conservative when grounding conflicts
        console.log('Grounding conflict - reducing movement strength. Client:', this.isGrounded, 'Server:', this.lastServerUpdate.isGrounded);
      }
      
      const speed = this.keys.run ? this.runSpeed : this.walkSpeed;
      moveForward *= speed * movementStrength;
      moveRight *= speed * movementStrength;
      
      this.isMoving = moveLength > 0;
      this.currentSpeed = Math.sqrt(newVelX * newVelX + newVelZ * newVelZ);
      
      // Apply movement forces
      const playerQuat = new THREE.Quaternion(
        this.playerBody.rotation().x,
        this.playerBody.rotation().y,
        this.playerBody.rotation().z,
        this.playerBody.rotation().w
      );
      
      let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerQuat);
      let right = new THREE.Vector3(1, 0, 0).applyQuaternion(playerQuat);
      
      if (this.isGrounded && this.lastGroundNormal) {
        const surfaceNormal = this.lastGroundNormal;
        forward.projectOnPlane(surfaceNormal).normalize();
        right.projectOnPlane(surfaceNormal).normalize();
      }
      
      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(forward, moveForward);
      moveDir.addScaledVector(right, moveRight);
      
      if (this.isGrounded) {
        const groundAccel = recentServerUpdate ? 50.0 : 100.0; // Reduce acceleration during server reconciliation
        newVelX += moveDir.x * groundAccel * deltaTime;
        newVelY += moveDir.y * groundAccel * deltaTime;
        newVelZ += moveDir.z * groundAccel * deltaTime;
        
        if (moveLength === 0) {
          const friction = recentServerUpdate ? 0.9 : 0.8;
          newVelX *= friction;
          newVelY *= 0.95;
          newVelZ *= friction;
        }
        
        // More aggressive velocity limiting when server is involved
        const maxSpeed = recentServerUpdate ? speed * 1.2 : speed * 1.5;
        const vel = new THREE.Vector3(newVelX, newVelY, newVelZ);
        const velMagnitude = vel.length();
        if (velMagnitude > maxSpeed) {
          vel.normalize().multiplyScalar(maxSpeed);
          newVelX = vel.x;
          newVelY = vel.y;
          newVelZ = vel.z;
        }
      } else {
        const airControl = recentServerUpdate ? 0.3 : 1.0; // Much less air control during reconciliation
        newVelX += moveDir.x * airControl * deltaTime;
        newVelY += moveDir.y * airControl * deltaTime;
        newVelZ += moveDir.z * airControl * deltaTime;
        
        const resistance = recentServerUpdate ? 0.97 : 0.95;
        newVelX *= resistance;
        newVelY *= 0.98;
        newVelZ *= resistance;
      }
      
      // Handle jumping - be more conservative
      if (this.keys.jump && this.isGrounded && !this.jumpInProgress && !recentServerUpdate) {
        const jumpVector = gravityDir.clone().multiplyScalar(-this.jumpForce);
        newVelX += jumpVector.x;
        newVelY += jumpVector.y;
        newVelZ += jumpVector.z;
        this.jumpInProgress = true;
        this.jumpTime = 0;
        console.log("Jump initiated against gravity direction with force:", this.jumpForce);
      }
      
      if (this.jumpInProgress) {
        this.jumpTime += deltaTime;
        if (this.jumpTime >= this.jumpDuration || this.isGrounded) {
          this.jumpInProgress = false;
        }
      }
      
      // Apply final velocity to local player - but defer to server if recent update
      if (!recentServerUpdate || this.predictionError < 0.05) {
        this.playerBody.setLinvel({
          x: newVelX,
          y: newVelY,
          z: newVelZ
        });
      }
      
      if (frameCount % 60 === 0 && (moveLength > 0 || !this.isGrounded)) {
        const serverConflict = recentServerUpdate && this.isGrounded !== this.lastServerUpdate.isGrounded;
        console.log("Movement - Grounded:", this.isGrounded, 
                    "Server grounded:", this.lastServerUpdate?.isGrounded,
                    "Conflict:", serverConflict, 
                    "Error:", this.predictionError.toFixed(3),
                    "Movement strength:", movementStrength.toFixed(2));
      }
    } catch (e) {
      console.error("Error in handleAllMovement:", e);
    }
  }

  updatePlayerTransform() {
    if (!this.playerBody || !this.scene.player || !this.scene.camera) return;
    
    try {
      const position = this.playerBody.translation();
      this.scene.player.position.set(position.x, position.y, position.z);
      
      const physicsQuat = new THREE.Quaternion(
        this.playerBody.rotation().x,
        this.playerBody.rotation().y,
        this.playerBody.rotation().z,
        this.playerBody.rotation().w
      );
      this.scene.player.quaternion.copy(physicsQuat);
      
      this.playerFacing.set(0, 0, -1).applyQuaternion(physicsQuat);
      
      if (this.isGrounded) {
        this.scene.camera.rotation.x = this.cameraRotation.x;
        this.scene.camera.rotation.y = this.cameraRotation.y;
        this.scene.camera.rotation.z = 0;
      } else {
        this.scene.camera.rotation.x = 0;
        this.scene.camera.rotation.y = 0;
        this.scene.camera.rotation.z = 0;
      }
      
      this.playerPosition.set(position.x, position.y, position.z);
    } catch (e) {
      console.error("Error updating player transform:", e);
    }
  }

  toggleCameraAttachment() {
    this.isCameraDetached = !this.isCameraDetached;
    
    if (this.isCameraDetached) {
      if (this.scene.player && this.scene.camera) {
        const worldPos = new THREE.Vector3();
        this.scene.camera.getWorldPosition(worldPos);
        
        const worldRot = new THREE.Euler();
        this.scene.camera.getWorldQuaternion(new THREE.Quaternion().setFromEuler(worldRot));
        
        this.scene.player.remove(this.scene.camera);
        this.scene.scene.add(this.scene.camera);
        
        this.scene.camera.position.copy(worldPos);
        this.scene.camera.rotation.copy(worldRot);
        
        const cameraOffset = new THREE.Vector3(0, 5, 15);
        this.scene.camera.position.add(cameraOffset);
        
        console.log("Camera detached from player");
      }
    } else {
      if (this.scene.player && this.scene.camera) {
        this.scene.scene.remove(this.scene.camera);
        this.scene.player.add(this.scene.camera);
        
        this.scene.camera.position.set(0, this.playerHeight * 0.8, 0);
        this.scene.camera.rotation.set(this.cameraRotation.x, 0, 0);
        
        console.log("Camera reattached to player");
      }
    }
  }

  updateDetachedCamera() {
    if (!this.isCameraDetached || !this.scene.camera || !this.scene.player) return;
    
    const playerWorldPos = new THREE.Vector3();
    this.scene.player.getWorldPosition(playerWorldPos);
    
    const cameraDistance = 15;
    const cameraHeight = 8;
    
    const cameraX = playerWorldPos.x + Math.sin(this.detachedCameraAngle) * cameraDistance;
    const cameraZ = playerWorldPos.z + Math.cos(this.detachedCameraAngle) * cameraDistance;
    const cameraY = playerWorldPos.y + cameraHeight;
    
    this.scene.camera.position.set(cameraX, cameraY, cameraZ);
    this.scene.camera.lookAt(playerWorldPos);
  }

  getPlayerState() {
    if (!this.playerBody) return null;
    
    const pos = this.playerBody.translation();
    const vel = this.playerBody.linvel();
    const rot = this.playerBody.rotation();
    
    return {
      position: [pos.x, pos.y, pos.z],
      velocity: [vel.x, vel.y, vel.z],
      rotation: [rot.x, rot.y, rot.z, rot.w],
      isGrounded: this.isGrounded
    };
  }

  applyInputLocally(input, deltaTime) {
    // Apply input directly to keys for local prediction
    this.keys.forward = input.forward;
    this.keys.backward = input.backward;
    this.keys.left = input.left;
    this.keys.right = input.right;
    this.keys.jump = input.jump;
    this.keys.run = input.run;
    
    // Apply camera rotation from input
    this.cameraRotation.y = input.yaw;
    this.cameraRotation.x = input.pitch;
  }

  generateInput() {
    // Get current player state for world position
    const playerState = this.getPlayerState();
    
    return {
      forward: this.keys.forward,
      backward: this.keys.backward,
      left: this.keys.left,
      right: this.keys.right,
      jump: this.keys.jump,
      run: this.keys.run,
      yaw: this.cameraRotation.y,
      pitch: this.cameraRotation.x,
      world_position: playerState ? playerState.position : [0, 0, 0],
      world_origin: [0, 0, 0] // This will be set by the caller
    };
  }

  addPendingInput(input, sequence, deltaTime) {
    this.pendingInputs.push({
      input,
      sequence,
      timestamp: Date.now(),
      deltaTime
    });
    
    // Apply input locally for prediction
    this.applyInputLocally(input, deltaTime);
  }

  reconcileWithServer(serverData, worldOriginOffset) {
    if (!this.playerBody) return;
    
    this.lastServerUpdate = {
      ...serverData,
      timestamp: Date.now(),
      isGrounded: serverData.isGrounded // Store server grounding state
    };
    
    const currentPosRapier = this.playerBody.translation();
    const currentPos = new THREE.Vector3(currentPosRapier.x, currentPosRapier.y, currentPosRapier.z);
    
    const serverWorldPos = new THREE.Vector3(...serverData.position);
    const serverLocalPos = serverWorldPos.sub(worldOriginOffset);
    
    this.predictionError = currentPos.distanceTo(serverLocalPos);
    
    // Find acknowledged input
    const ackIndex = this.pendingInputs.findIndex(
      input => input.sequence === serverData.inputSequence
    );
    
    if (ackIndex >= 0) {
      // Remove acknowledged inputs
      this.pendingInputs.splice(0, ackIndex + 1);
      
      // Much more aggressive reconciliation to prevent getting stuck
      const groundingConflict = this.isGrounded !== serverData.isGrounded;
      const shouldReconcile = this.predictionError > 0.05 || groundingConflict;
      
      if (shouldReconcile) {
        console.log('Server reconciliation - error:', this.predictionError.toFixed(3), 
                    'grounding conflict:', groundingConflict,
                    'Client grounded:', this.isGrounded, 'Server grounded:', serverData.isGrounded);
        
        // Immediately apply server state
        this.playerBody.setTranslation({
          x: serverLocalPos.x,
          y: serverLocalPos.y,
          z: serverLocalPos.z
        });
        
        this.playerBody.setLinvel({
          x: serverData.velocity[0],
          y: serverData.velocity[1],
          z: serverData.velocity[2]
        });
        
        this.playerBody.setRotation({
          x: serverData.rotation[0],
          y: serverData.rotation[1],
          z: serverData.rotation[2],
          w: serverData.rotation[3]
        });
        
        // Immediately trust server grounding state
        this.isGrounded = serverData.isGrounded;
        
        // Clear ground collisions if server says we're not grounded
        if (!serverData.isGrounded) {
          this.groundCollisions.clear();
          this.lastGroundContact = 0;
        }
        
        // Re-apply only recent pending inputs to avoid drift
        const recentInputs = this.pendingInputs.slice(-3); // Only last 3 inputs
        recentInputs.forEach(input => {
          this.applyInputLocally(input.input, input.deltaTime * 0.5); // Reduced strength
        });
      }
    }
  }

  cleanupOldInputs(timeout = 2000) {
    const cutoffTime = Date.now() - timeout;
    this.pendingInputs = this.pendingInputs.filter(
      input => input.timestamp > cutoffTime
    );
  }
}
