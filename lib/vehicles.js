import * as THREE from 'three';

// Common vehicle helper functions
export const VehicleHelpers = {
  // Common enter vehicle logic
  enterVehicle(controller, player, cameraPosition, cameraRotation = new THREE.Vector3(0, 0, 0)) {
    if (controller.isOccupied) return false;
    
    controller.isOccupied = true;
    controller.currentPlayer = player;
    controller.wasInteracting = true;
    
    // Remove camera from its current parent
    if (controller.scene.camera.parent) {
      controller.scene.camera.parent.remove(controller.scene.camera);
    }
    
    // Attach camera to vehicle
    controller.mesh.add(controller.scene.camera);
    controller.scene.camera.position.copy(cameraPosition);
    controller.scene.camera.rotation.set(cameraRotation.x, cameraRotation.y, cameraRotation.z);
    
    console.log(`Player entered vehicle`);
    return true;
  },
  
  // Common exit vehicle logic
  exitVehicle(controller, exitDistance = 4) {
    if (!controller.isOccupied || !controller.currentPlayer) return null;
    
    console.log(`Vehicle exit called`);
    
    // Calculate safe exit position
    const vehiclePos = controller.getPosition();
    const vehicleRotation = controller.body.rotation();
    const vehicleQuat = new THREE.Quaternion(vehicleRotation.x, vehicleRotation.y, vehicleRotation.z, vehicleRotation.w);
    
    // Get vehicle's right direction
    const rightDirection = new THREE.Vector3(1, 0, 0).applyQuaternion(vehicleQuat);
    
    const exitPosition = new THREE.Vector3(
      vehiclePos.x + rightDirection.x * exitDistance,
      vehiclePos.y + 1,
      vehiclePos.z + rightDirection.z * exitDistance
    );
    
    // Remove camera from vehicle
    if (controller.mesh.children.includes(controller.scene.camera)) {
      controller.mesh.remove(controller.scene.camera);
    }
    
    // Store reference to player before clearing
    const player = controller.currentPlayer;
    
    // Clear state
    controller.isOccupied = false;
    controller.currentPlayer = null;
    
    console.log(`Player exited vehicle`);
    
    return {
      exitPosition: exitPosition,
      player: player
    };
  },
  
  // Common position getter
  getPosition(controller) {
    if (!controller.body) return new THREE.Vector3();
    const pos = controller.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  },
  
  // Common velocity getter
  getVelocity(controller) {
    if (!controller.body) return new THREE.Vector3();
    const vel = controller.body.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  },
  
  // Common grounded check
  checkGrounded(physics, body, collider) {
    if (!collider || !body) return false;
    
    const position = body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    
    // Get gravity direction
    const gravityDir = new THREE.Vector3()
      .subVectors(physics.gravity.center, playerPos)
      .normalize();
    
    const rayOrigin = playerPos.clone();
    const rayDir = gravityDir;
    
    const maxDistance = 2.0;
    const hit = physics.castRay(
      rayOrigin,
      rayDir,
      maxDistance,
      collider.handle
    );
    
    return hit !== null && hit.toi < 1.5;
  },
  
  // Common interaction handling
  handleInteraction(controller) {
    if (controller.isOccupied && controller.keys) {
      if (controller.keys.interact && !controller.wasInteracting) {
        controller.wasInteracting = true;
        
        // Trigger exit through the player
        if (controller.currentPlayer && controller.currentPlayer.exitVehicle) {
          console.log(`Vehicle triggering exit`);
          controller.currentPlayer.exitVehicle();
        }
      } else if (!controller.keys.interact) {
        controller.wasInteracting = false;
      }
    }
  },
  
  // Common server update
  updateFromServer(controller, state) {
    if (!controller.body || controller.isOccupied) return;
    
    if (state.position) {
      controller.body.setTranslation({
        x: state.position.x,
        y: state.position.y,
        z: state.position.z
      });
      if (controller.mesh) {
        controller.mesh.position.set(state.position.x, state.position.y, state.position.z);
      }
    }
    
    if (state.rotation) {
      controller.body.setRotation({
        x: state.rotation.x,
        y: state.rotation.y,
        z: state.rotation.z,
        w: state.rotation.w
      });
      if (controller.mesh) {
        controller.mesh.quaternion.set(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);
      }
    }
    
    if (state.velocity) {
      controller.body.setLinvel({
        x: state.velocity.x,
        y: state.velocity.y,
        z: state.velocity.z
      });
    }
  },
  
  // Setup interaction on mesh
  setupInteraction(mesh, controller, interactionType = 'vehicle') {
    if (mesh) {
      mesh.userData[`${interactionType}Controller`] = controller;
      mesh.userData.interactable = true;
      mesh.userData.interactionType = interactionType;
    }
  }
};

// Aircraft-specific helpers
export const AircraftHelpers = {
  // Toggle aircraft lights
  toggleLights(controller) {
    controller.lightsEnabled = !controller.lightsEnabled;
    console.log(`Aircraft lights ${controller.lightsEnabled ? 'ON' : 'OFF'}`);
    
    Object.values(controller.lights).forEach(light => {
      if (light) {
        light.visible = controller.lightsEnabled;
        
        if (light.userData.pointLight) {
          light.userData.pointLight.visible = controller.lightsEnabled;
        }
        if (light.userData.spotLight) {
          light.userData.spotLight.visible = controller.lightsEnabled;
        }
      }
    });
  },
  
  // Update aircraft light animations
  updateAircraftLights(controller, deltaTime) {
    controller.lightAnimationTime += deltaTime;
    
    if (!controller.lightsEnabled) return;
    
    // Navigation lights - steady on
    if (controller.lights.navigationRed) {
      controller.lights.navigationRed.material.emissiveIntensity = 1.0;
      if (controller.lights.navigationRed.userData.pointLight) {
        controller.lights.navigationRed.userData.pointLight.intensity = 0.8;
      }
    }
    
    if (controller.lights.navigationGreen) {
      controller.lights.navigationGreen.material.emissiveIntensity = 1.0;
      if (controller.lights.navigationGreen.userData.pointLight) {
        controller.lights.navigationGreen.userData.pointLight.intensity = 0.8;
      }
    }
    
    // White strobe
    if (controller.lights.strobeWhite) {
      const strobeTime = controller.lightAnimationTime % 2.0;
      let strobeIntensity = 0.1;
      
      if (strobeTime < 0.1 || (strobeTime > 0.2 && strobeTime < 0.3)) {
        strobeIntensity = 2.0;
      }
      
      controller.lights.strobeWhite.material.emissiveIntensity = strobeIntensity;
      if (controller.lights.strobeWhite.userData.pointLight) {
        controller.lights.strobeWhite.userData.pointLight.intensity = strobeIntensity * 1.5;
      }
    }
    
    // Anti-collision beacon
    if (controller.lights.antiCollisionRed) {
      const beaconIntensity = Math.abs(Math.sin(controller.lightAnimationTime * 4)) * 1.5 + 0.2;
      controller.lights.antiCollisionRed.material.emissiveIntensity = beaconIntensity;
      if (controller.lights.antiCollisionRed.userData.pointLight) {
        controller.lights.antiCollisionRed.userData.pointLight.intensity = beaconIntensity * 2;
      }
      
      // Rotate beacon
      controller.lights.antiCollisionRed.rotation.y = controller.lightAnimationTime * 3;
    }
  },
  
  // Calculate common flight data
  calculateFlightData(controller) {
    if (!controller.body) return null;
    
    const position = controller.body.translation();
    const velocity = controller.body.linvel();
    const rotation = controller.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    const positionVec = new THREE.Vector3(position.x, position.y, position.z);
    
    // Calculate altitude
    const gravityCenter = controller.physics.gravity.center;
    const altitude = positionVec.distanceTo(gravityCenter);
    
    // Calculate speeds
    const velocityVec = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const airspeed = velocityVec.length();
    
    // Calculate vertical speed
    const gravityDir = new THREE.Vector3()
      .subVectors(controller.physics.gravity.center, positionVec)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    const verticalSpeed = velocityVec.dot(upDir);
    
    // Get local axes
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    
    // Calculate heading
    const forwardHorizontal = forward.clone()
      .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
      .normalize();
    const heading = Math.atan2(forwardHorizontal.x, forwardHorizontal.z) * (180 / Math.PI);
    
    // Calculate pitch and roll
    const pitch = Math.asin(forward.dot(upDir)) * (180 / Math.PI);
    
    const rightHorizontal = right.clone()
      .sub(upDir.clone().multiplyScalar(right.dot(upDir)));
    const roll = Math.atan2(right.dot(gravityDir), rightHorizontal.length()) * (180 / Math.PI);
    
    return {
      altitude: Math.round(altitude),
      airspeed: Math.round(airspeed * 10) / 10,
      verticalSpeed: Math.round(verticalSpeed * 10) / 10,
      heading: Math.round((heading + 360) % 360),
      pitch: Math.round(pitch),
      roll: Math.round(roll),
      isGrounded: controller.isGrounded,
      gravityDir: gravityDir
    };
  }
};

// Weapon effect helpers
export const WeaponHelpers = {
  createMuzzleFlash(scene, position, forward) {
    const flashGroup = new THREE.Group();
    flashGroup.position.copy(position);
    
    const flashType = Math.floor(Math.random() * 3);
    
    if (flashType === 0) {
      // Star burst
      for (let i = 0; i < 6; i++) {
        const flashGeometry = new THREE.PlaneGeometry(0.8, 0.2);
        const flashMaterial = new THREE.MeshBasicMaterial({
          color: 0xffaa00,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        const flashPlane = new THREE.Mesh(flashGeometry, flashMaterial);
        flashPlane.rotation.z = (i / 6) * Math.PI;
        flashPlane.rotation.x = (Math.random() - 0.5) * 0.2;
        flashGroup.add(flashPlane);
      }
    } else if (flashType === 1) {
      // Cone flash
      const coneGeometry = new THREE.ConeGeometry(0.4, 1.2, 6);
      const coneMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.rotation.x = -Math.PI / 2;
      flashGroup.add(cone);
    } else {
      // Sphere burst
      const sphereGeometry = new THREE.SphereGeometry(0.5, 6, 4);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      flashGroup.add(sphere);
    }
    
    flashGroup.lookAt(position.clone().add(forward));
    scene.add(flashGroup);
    
    // Add dynamic light
    const flash = new THREE.PointLight(0xffaa00, 5, 15);
    flash.position.copy(position);
    scene.add(flash);
    
    return { flashGroup, flash };
  },
  
  animateAndRemoveMuzzleFlash(scene, flashGroup, flash, duration = 100) {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;
      
      if (progress >= 1) {
        scene.remove(flash);
        scene.remove(flashGroup);
        flashGroup.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        return;
      }
      
      flash.intensity = 5 * (1 - progress);
      flashGroup.children.forEach(child => {
        if (child.material) {
          child.material.opacity = child.material.opacity * (1 - progress * 0.5);
        }
      });
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }
};
