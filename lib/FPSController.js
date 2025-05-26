import * as THREE from 'three';

// FPS Controller class to handle camera and input controls
export class FPSController {
  constructor() {
    this.lookSensitivity = 0.001;
    this.yawSensitivity = 0.002;
    this.rollSensitivity = 2.0; // Radians per second
    
    // Camera detachment functionality
    this.isCameraDetached = false;
    this.detachedCamera = {
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      moveSpeed: 10.0
    };
  }

  // Handle mouse movement for player rotation
  handleMouseMove(event, started, gameCanvas, isGrounded, playerBody, cameraRotation, lastGroundNormal) {
    if (!started || document.pointerLockElement !== gameCanvas) return;
    
    try {
      if (isGrounded && playerBody) {
        // When grounded, only allow camera pitch and player yaw
        
        // Update camera pitch with limits (always affects camera)
        cameraRotation.x -= event.movementY * this.lookSensitivity;
        cameraRotation.x = Math.max(
          -Math.PI / 2 + 0.01, 
          Math.min(Math.PI / 2 - 0.01, cameraRotation.x)
        );
        
        // Rotate the player body for yaw instead of camera
        const currentPlayerQuat = new THREE.Quaternion(
          playerBody.rotation().x,
          playerBody.rotation().y,
          playerBody.rotation().z,
          playerBody.rotation().w
        );
        
        // Create yaw rotation around the up vector (surface normal)
        let upVector = new THREE.Vector3(0, 1, 0); // Default up
        if (lastGroundNormal) {
          upVector = lastGroundNormal.clone();
        }
        
        const yawDelta = -event.movementX * this.yawSensitivity;
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(upVector, yawDelta);
        
        // Apply yaw rotation to player body
        currentPlayerQuat.premultiply(yawQuat);
        
        // Update player body rotation
        playerBody.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
        
        // Keep camera yaw at 0 since player body is now handling the yaw
        cameraRotation.y = 0;
      } else {
        // When airborne, rotate the entire player capsule with mouse movement
        if (playerBody) {
          const currentPlayerQuat = new THREE.Quaternion(
            playerBody.rotation().x,
            playerBody.rotation().y,
            playerBody.rotation().z,
            playerBody.rotation().w
          );
          
          // Create pitch rotation around local right axis
          const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
          const pitchDelta = -event.movementY * this.lookSensitivity;
          const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, pitchDelta);
          
          // Create yaw rotation around local up axis
          const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(currentPlayerQuat);
          const yawDelta = -event.movementX * this.yawSensitivity;
          const yawQuat = new THREE.Quaternion().setFromAxisAngle(localUp, yawDelta);
          
          // Apply both rotations to player body
          currentPlayerQuat.premultiply(pitchQuat);
          currentPlayerQuat.premultiply(yawQuat);
          
          // Update player body rotation
          playerBody.setRotation({
            x: currentPlayerQuat.x,
            y: currentPlayerQuat.y,
            z: currentPlayerQuat.z,
            w: currentPlayerQuat.w
          });
          
          // Keep camera rotation at 0 since player body handles all rotation
          cameraRotation.x = 0;
          cameraRotation.y = 0;
        }
      }
    } catch (e) {
      console.error("Error in mouse move:", e);
    }
  }

  // Handle key down events
  handleKeyDown(event, started, keys, isGrounded) {
    if (!started) return;
    
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = true;
        break;
      case 'KeyQ': // Add Q key for roll left when airborne
        keys.rollLeft = true;
        break;
      case 'KeyE': // Add E key for roll right when airborne
        keys.rollRight = true;
        break;
      case 'Space':
        if (isGrounded) {
          keys.jump = true;
        }
        break;
      case 'ShiftLeft':
        keys.run = true;
        break;
      case 'KeyO': // Add 'o' key handler
        this.toggleCameraAttachment();
        break;
    }
  }

  // Handle key up events
  handleKeyUp(event, started, keys) {
    if (!started) return;
    
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = false;
        break;
      case 'KeyQ': // Add Q key release
        keys.rollLeft = false;
        break;
      case 'KeyE': // Add E key release
        keys.rollRight = false;
        break;
      case 'Space':
        keys.jump = false;
        break;
      case 'ShiftLeft':
        keys.run = false;
        break;
    }
  }

  // Handle pointer lock change
  handlePointerLockChange(gameCanvas, keys) {
    if (document.pointerLockElement !== gameCanvas) {
      // Pointer lock was exited
      keys.forward = false;
      keys.backward = false;
      keys.left = false;
      keys.right = false;
      keys.jump = false;
      keys.run = false;
    }
  }

  // Reset camera for airborne transition
  resetCameraForAirborne(player, playerBody, wasGrounded, isGrounded, cameraRotation) {
    // When transitioning from grounded to airborne, transfer camera pitch to player rotation
    if (player && playerBody && wasGrounded && !isGrounded) {
      console.log("Transitioning to airborne - transferring camera rotation to player body");
      
      // Get current player quaternion
      const currentPlayerQuat = new THREE.Quaternion(
        playerBody.rotation().x,
        playerBody.rotation().y,
        playerBody.rotation().z,
        playerBody.rotation().w
      );
      
      // Apply current camera pitch to player rotation around local right axis
      if (Math.abs(cameraRotation.x) > 0.01) {
        const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(currentPlayerQuat);
        const pitchQuat = new THREE.Quaternion().setFromAxisAngle(localRight, cameraRotation.x);
        
        currentPlayerQuat.premultiply(pitchQuat);
        
        // Update player body with new rotation
        playerBody.setRotation({
          x: currentPlayerQuat.x,
          y: currentPlayerQuat.y,
          z: currentPlayerQuat.z,
          w: currentPlayerQuat.w
        });
      }
      
      // Reset camera rotation since player body now handles all rotation
      cameraRotation.x = 0;
      cameraRotation.y = 0;
      cameraRotation.z = 0;
      
      // Unlock rotations for airborne movement
      // Note: We can't change the locked rotations flag after creation, 
      // but we can manually control rotation through setRotation
    }
  }

  // Toggle camera attachment
  toggleCameraAttachment() {
    this.isCameraDetached = !this.isCameraDetached;
    
    if (this.isCameraDetached) {
      console.log("Camera detached - use WASD to fly around");
      // Store current camera position when detaching
      // This will be set by the caller
    } else {
      console.log("Camera attached to player");
    }
  }

  // Update detached camera
  updateDetachedCamera(camera, keys, deltaTime) {
    if (!this.isCameraDetached || !camera) return;
    
    // Calculate movement based on keys
    let forward = 0, right = 0, up = 0;
    
    if (keys.forward) forward += 1;
    if (keys.backward) forward -= 1;
    if (keys.left) right -= 1;
    if (keys.right) right += 1;
    if (keys.jump) up += 1;
    if (keys.run) up -= 1; // Use run key for down movement when detached
    
    // Get camera forward and right vectors
    const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0);
    
    // Calculate movement vector
    const movement = new THREE.Vector3();
    movement.addScaledVector(cameraForward, forward * this.detachedCamera.moveSpeed * deltaTime);
    movement.addScaledVector(cameraRight, right * this.detachedCamera.moveSpeed * deltaTime);
    movement.addScaledVector(cameraUp, up * this.detachedCamera.moveSpeed * deltaTime);
    
    // Apply movement
    camera.position.add(movement);
  }

  // Handle roll input when airborne
  handleRollInput(keys, playerBody, isGrounded, deltaTime) {
    if (isGrounded || !playerBody) return;
    
    let rollDelta = 0;
    
    if (keys.rollLeft) rollDelta -= this.rollSensitivity * deltaTime;
    if (keys.rollRight) rollDelta += this.rollSensitivity * deltaTime;
    
    if (Math.abs(rollDelta) > 0.001) {
      // Get current player quaternion
      const currentPlayerQuat = new THREE.Quaternion(
        playerBody.rotation().x,
        playerBody.rotation().y,
        playerBody.rotation().z,
        playerBody.rotation().w
      );
      
      // Create roll rotation around local forward axis (Z-axis)
      const localForward = new THREE.Vector3(0, 0, -1).applyQuaternion(currentPlayerQuat);
      const rollQuat = new THREE.Quaternion().setFromAxisAngle(localForward, rollDelta);
      
      // Apply roll rotation to player body
      currentPlayerQuat.premultiply(rollQuat);
      
      // Update player body rotation
      playerBody.setRotation({
        x: currentPlayerQuat.x,
        y: currentPlayerQuat.y,
        z: currentPlayerQuat.z,
        w: currentPlayerQuat.w
      });
    }
  }

  // Handle window resize
  handleResize(camera, renderer) {
    if (!camera || !renderer) return;
    
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    
    // Resize renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Create a singleton instance
export const fpsController = new FPSController();

// Utility function to project vector onto plane
export const projectVectorOntoPlane = (vector, planeNormal) => {
  const dot = vector.dot(planeNormal);
  return vector.clone().sub(planeNormal.clone().multiplyScalar(dot));
};
