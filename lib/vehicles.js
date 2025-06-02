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
  createMuzzleFlash(scene, position, direction) {
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
    
    flashGroup.lookAt(position.clone().add(direction));
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
  },
  
  createMissile(options) {
    const {
      scene,
      physics,
      pyrotechnics,
      launchPos,
      launchVelocity,
      rotation,
      vehicleType = 'plane' // 'plane' or 'helicopter'
    } = options;
    
    // Create missile body with consistent physics
    const missileBody = physics.createDynamicBody(launchPos, {
      linearDamping: 0.02,
      angularDamping: 0.8
    });
    
    // Missile size based on vehicle type
    const missileSize = vehicleType === 'helicopter' ? 
      new THREE.Vector3(0.06, 0.06, 0.5) : 
      new THREE.Vector3(0.06, 0.06, 0.4);
    
    const missileCollider = physics.createBoxCollider(
      missileSize,
      {
        density: vehicleType === 'helicopter' ? 1.2 : 1.0,
        friction: 0.1,
        restitution: 0.1
      }
    );
    
    const collider = physics.world.createCollider(missileCollider, missileBody);
    
    // Add collision event listener - IMPORTANT FOR COLLISION DETECTION
    collider.setActiveEvents(physics.RAPIER.ActiveEvents.COLLISION_EVENTS);
    
    // Create visual missile
    const missileGroup = new THREE.Group();
    const missileRadius = vehicleType === 'helicopter' ? 0.1 : 0.08;
    const missileLength = vehicleType === 'helicopter' ? 1.0 : 0.8;
    
    const missileGeometry = new THREE.CylinderGeometry(
      missileRadius, 
      missileRadius * 0.8, 
      missileLength
    );
    const missileMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.8
    });
    const missileMesh = new THREE.Mesh(missileGeometry, missileMaterial);
    missileMesh.rotation.x = Math.PI / 2;
    missileGroup.add(missileMesh);
    
    // Add fins
    const finGeometry = new THREE.BoxGeometry(0.02, 0.12, 0.06);
    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.7
    });
    
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeometry, finMaterial);
      const angle = (i / 4) * Math.PI * 2;
      fin.position.x = Math.cos(angle) * missileRadius * 0.6;
      fin.position.y = Math.sin(angle) * missileRadius * 0.6;
      fin.position.z = -missileLength * 0.3;
      missileGroup.add(fin);
    }
    
    // Add warhead for helicopter missiles
    if (vehicleType === 'helicopter') {
      const warheadGeometry = new THREE.ConeGeometry(missileRadius, 0.25, 8);
      const warheadMaterial = new THREE.MeshStandardMaterial({
        color: 0x880000,
        metalness: 0.7
      });
      const warhead = new THREE.Mesh(warheadGeometry, warheadMaterial);
      warhead.position.z = missileLength * 0.6;
      missileGroup.add(warhead);
    }
    
    // Create afterburner effects (initially hidden)
    const afterburnerGroup = new THREE.Group();
    afterburnerGroup.position.z = -missileLength * 0.5;
    afterburnerGroup.visible = false;
    
    // Flame cone
    const flameSize = vehicleType === 'helicopter' ? 0.1 : 0.08;
    const flameLength = vehicleType === 'helicopter' ? 0.6 : 0.5;
    const flameGeometry = new THREE.ConeGeometry(flameSize, flameLength, 8);
    const flameMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      emissive: 0xff4400,
      emissiveIntensity: 3,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.rotation.x = Math.PI;
    flame.position.z = -flameLength * 0.5;
    afterburnerGroup.add(flame);
    
    // Inner flame
    const innerFlameGeometry = new THREE.ConeGeometry(flameSize * 0.5, flameLength * 0.7, 6);
    const innerFlameMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 4,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const innerFlame = new THREE.Mesh(innerFlameGeometry, innerFlameMaterial);
    innerFlame.rotation.x = Math.PI;
    innerFlame.position.z = -flameLength * 0.4;
    afterburnerGroup.add(innerFlame);
    
    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(flameSize * 2, 8, 6);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      emissive: 0xff6600,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.z = -0.1;
    afterburnerGroup.add(glow);
    
    // Engine light
    const lightRange = vehicleType === 'helicopter' ? 20 : 15;
    const engineLight = new THREE.PointLight(0xff4400, 0, lightRange);
    engineLight.position.z = -0.2;
    afterburnerGroup.add(engineLight);
    
    missileGroup.add(afterburnerGroup);
    scene.add(missileGroup);
    
    // Set initial velocity
    missileBody.setLinvel({
      x: launchVelocity.x,
      y: launchVelocity.y,
      z: launchVelocity.z
    });
    
    missileBody.setRotation(rotation);
    
    // Missile parameters - FURTHER REDUCED VALUES
    const missileData = {
      body: missileBody,
      mesh: missileGroup,
      collider: collider,
      age: 0,
      maxAge: vehicleType === 'helicopter' ? 8.0 : 2.0, // Longer flight time for guided missiles
      thrust: 0, // Start with no thrust
      motorIgnited: false,
      guidanceActive: true,
      hasExploded: false,
      afterburnerGroup: afterburnerGroup,
      flame: flame,
      innerFlame: innerFlame,
      glow: glow,
      engineLight: engineLight,
      exhaustParticles: [],
      // Further reduced thrust values for each vehicle type
      maxThrust: vehicleType === 'helicopter' ? 40 : 45, // Reduced from 50/60
      ignitionImpulse: vehicleType === 'helicopter' ? 4 : 5, // Reduced from 8/10
      vehicleType: vehicleType,
      lockedTarget: null, // Target vehicle for lock-on
      trackingStrength: 0.5, // How aggressively missile tracks
      previousPos: launchPos.clone(), // Initialize previous position
      launchTime: Date.now() // Track launch time
    };
    
    return missileData;
  },
  
  updateMissile(missile, physics, pyrotechnics, scene, deltaTime = 0.016, launcherCollider = null) {
    if (!missile.body || missile.hasExploded) return true;
    
    const pos = missile.body.translation();
    missile.mesh.position.set(pos.x, pos.y, pos.z);
    
    const rot = missile.body.rotation();
    missile.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    
    // Only check for collisions after motor has ignited
    if (!missile.hasExploded && missile.motorIgnited) {
      const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);
      
      // Get missile forward direction
      const missileForward = new THREE.Vector3(0, 0, 1);
      missileForward.applyQuaternion(missile.mesh.quaternion);
      
      // Cast ray from front of missile
      const missileLength = missile.vehicleType === 'helicopter' ? 1.0 : 0.8;
      const rayStartPos = currentPos.clone().add(missileForward.clone().multiplyScalar(missileLength * 0.6));
      
      // Check for imminent collision in forward direction
      const velocity = missile.body.linvel();
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
      
      if (speed > 0.1) {
        // Cast ray forward from the nose of the missile
        const checkDistance = Math.max(speed * deltaTime * 3, 0.5); // Check ahead based on speed
        
        const hit = physics.castRay(
          rayStartPos,
          missileForward,
          checkDistance,
          missile.collider.handle // Exclude self
        );
        
        if (hit && hit.collider !== launcherCollider) {
          missile.hasExploded = true;
          console.log('Missile collision detected! Distance to impact:', hit.toi);
        }
      }
      
      // Alternative method: Check with a short sphere cast from missile center
      // This helps detect glancing blows
      if (!missile.hasExploded && missile.previousPos) {
        const moveDir = currentPos.clone().sub(missile.previousPos);
        const moveDistance = moveDir.length();
        
        if (moveDistance > 0.01) {
          moveDir.normalize();
          
          // Cast from slightly behind current position to slightly ahead
          const sphereRadius = missile.vehicleType === 'helicopter' ? 0.1 : 0.08;
          const castStart = missile.previousPos.clone();
          const castDistance = moveDistance + sphereRadius * 2;
          
          // Use a shape cast if available, otherwise use multiple rays in a cone
          const numRays = 5;
          for (let i = 0; i < numRays; i++) {
            let testDir = moveDir.clone();
            
            if (i > 0) {
              // Create a small cone of rays
              const angle = (i - 1) * Math.PI / 8; // Small cone angle
              const rotAxis = new THREE.Vector3(0, 1, 0);
              if (Math.abs(moveDir.y) > 0.9) {
                rotAxis.set(1, 0, 0);
              }
              testDir.applyAxisAngle(rotAxis, angle * ((i % 2) === 0 ? 1 : -1));
            }
            
            const hit = physics.castRay(
              castStart,
              testDir,
              castDistance,
              missile.collider.handle
            );
            
            if (hit && hit.toi < castDistance && hit.collider !== launcherCollider) {
              missile.hasExploded = true;
              console.log('Missile side collision detected!');
              break;
            }
          }
        }
      }
      
      // Store current position for next frame
      missile.previousPos = currentPos.clone();
    }
    
    // Check if missile hit the ground (only after motor ignition)
    if (!missile.hasExploded && missile.motorIgnited) {
      const missilePos = new THREE.Vector3(pos.x, pos.y, pos.z);
      
      // Ground check with terrain
      const gravityCenter = physics.gravity.center;
      const distanceToCenter = missilePos.distanceTo(gravityCenter);
      const groundRadius = physics.gravity.groundRadius || 100;
      
      // Cast a short ray downward from missile center
      const downDir = new THREE.Vector3()
        .subVectors(gravityCenter, missilePos)
        .normalize();
      
      const groundHit = physics.castRay(
        missilePos,
        downDir,
        1.0, // Check 1 unit down
        missile.collider.handle
      );
      
      if (distanceToCenter <= groundRadius + 0.5 || (groundHit && groundHit.toi < 0.5)) {
        missile.hasExploded = true;
        console.log('Missile hit ground!');
      }
      
      // Target proximity check for locked missiles
      if (missile.lockedTarget && missile.lockedTarget.getPosition) {
        const targetPos = missile.lockedTarget.getPosition();
        const distanceToTarget = missilePos.distanceTo(targetPos);
        
        if (distanceToTarget < 3.0) { // Proximity fuse
          missile.hasExploded = true;
          console.log('Missile proximity detonation!');
        }
      }
    }
    
    // Rocket motor ignition at 1 second
    if (!missile.motorIgnited && missile.age >= 1.0) {
      missile.motorIgnited = true;
      missile.thrust = missile.maxThrust;
      missile.afterburnerGroup.visible = true;
      
      // Apply ignition impulse
      const missileForward = new THREE.Vector3(0, 0, 1);
      missileForward.applyQuaternion(missile.mesh.quaternion);
      const ignitionImpulse = missileForward.multiplyScalar(missile.ignitionImpulse);
      
      missile.body.applyImpulse({
        x: ignitionImpulse.x,
        y: ignitionImpulse.y,
        z: ignitionImpulse.z
      }, true);
      
      console.log(`${missile.vehicleType} missile rocket motor ignited!`);
    }
    
    // Apply thrust if motor is running
    if (missile.motorIgnited && missile.thrust > 0) {
      const missileForward = new THREE.Vector3(0, 0, 1);
      missileForward.applyQuaternion(missile.mesh.quaternion);
      const thrustForce = missileForward.multiplyScalar(missile.thrust);
      
      missile.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
      
      // Update afterburner effects
      const pulseTime = Date.now() * 0.02;
      const pulseFactor = 0.9 + Math.sin(pulseTime) * 0.1;
      
      // Animate flame
      const flameScale = missile.vehicleType === 'helicopter' ? 1.2 : 1.0;
      missile.flame.scale.set(
        (0.8 + pulseFactor * 0.2),
        (flameScale + pulseFactor * 0.3),
        (0.8 + pulseFactor * 0.2)
      );
      
      missile.innerFlame.scale.set(
        (0.6 + pulseFactor * 0.1),
        (0.8 + pulseFactor * 0.2),
        (0.6 + pulseFactor * 0.1)
      );
      
      // Update glow
      missile.glow.scale.setScalar(1.0 + pulseFactor * 0.2);
      missile.glow.material.opacity = 0.6 + pulseFactor * 0.2;
      
      // Update engine light
      missile.engineLight.intensity = 3 + pulseFactor * 2;
      
      // Create exhaust particles
      if (Math.random() < 0.8) {
        const particleSize = missile.vehicleType === 'helicopter' ? 
          0.06 + Math.random() * 0.06 : 
          0.05 + Math.random() * 0.05;
          
        const particleGeometry = new THREE.SphereGeometry(particleSize, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({
          color: 0xff6600,
          emissive: 0xff4400,
          emissiveIntensity: 2,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending
        });
        
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position at engine exhaust
        const exhaustOffset = missile.vehicleType === 'helicopter' ? -0.6 : -0.5;
        const exhaustPos = new THREE.Vector3(0, 0, exhaustOffset);
        exhaustPos.applyQuaternion(missile.mesh.quaternion);
        exhaustPos.add(missile.mesh.position);
        particle.position.copy(exhaustPos);
        
        // Exhaust velocity
        const exhaustSpeed = missile.vehicleType === 'helicopter' ? -12 : -10;
        const exhaustVel = missileForward.clone().multiplyScalar(exhaustSpeed);
        exhaustVel.x += (Math.random() - 0.5) * 2;
        exhaustVel.y += (Math.random() - 0.5) * 2;
        
        particle.userData = {
          velocity: exhaustVel,
          age: 0,
          maxAge: 0.5
        };
        
        scene.add(particle);
        missile.exhaustParticles.push(particle);
      }
    }
    
    // Update exhaust particles
    missile.exhaustParticles = missile.exhaustParticles.filter(particle => {
      particle.userData.age += deltaTime;
      
      if (particle.userData.age > particle.userData.maxAge) {
        scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
        return false;
      }
      
      particle.position.add(particle.userData.velocity.clone().multiplyScalar(deltaTime));
      particle.userData.velocity.multiplyScalar(0.95); // Drag
      
      const fadeProgress = particle.userData.age / particle.userData.maxAge;
      particle.material.opacity = (1 - fadeProgress) * 0.7;
      particle.scale.multiplyScalar(1.02); // Expand
      
      return true;
    });
    
    // Simple guidance - MODIFIED FOR LOCK-ON
    if (missile.guidanceActive && missile.motorIgnited && !missile.hasExploded) {
      let targetDir;
      
      if (missile.lockedTarget && missile.lockedTarget.getPosition) {
        // Guide to locked target
        const targetPos = missile.lockedTarget.getPosition();
        const missilePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        
        // Lead the target based on velocity if available
        if (missile.lockedTarget.getVelocity) {
          const targetVel = missile.lockedTarget.getVelocity();
          const timeToTarget = missilePos.distanceTo(targetPos) / 50; // Estimate based on missile speed
          const leadPos = targetPos.clone().add(targetVel.multiplyScalar(timeToTarget * 0.5));
          targetDir = new THREE.Vector3().subVectors(leadPos, missilePos).normalize();
        } else {
          targetDir = new THREE.Vector3().subVectors(targetPos, missilePos).normalize();
        }
      } else {
        // Default guidance towards ground
        const missilePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const gravityCenter = physics.gravity.center;
        targetDir = new THREE.Vector3()
          .subVectors(gravityCenter, missilePos)
          .normalize();
      }
      
      const missileForward = new THREE.Vector3(0, 0, 1);
      missileForward.applyQuaternion(missile.mesh.quaternion);
      
      // Stronger correction for locked targets
      const trackingMultiplier = missile.lockedTarget ? missile.trackingStrength : 0.05;
      const correction = targetDir.clone()
        .sub(missileForward)
        .multiplyScalar(trackingMultiplier);
      
      missile.body.addForce({
        x: correction.x * 10,
        y: correction.y * 10,
        z: correction.z * 10
      });
      
      // Add rotation to point at target
      if (missile.lockedTarget) {
        const currentQuat = missile.mesh.quaternion.clone();
        const targetQuat = new THREE.Quaternion();
        const lookMatrix = new THREE.Matrix4();
        lookMatrix.lookAt(missile.mesh.position, missile.mesh.position.clone().add(targetDir), new THREE.Vector3(0, 1, 0));
        targetQuat.setFromRotationMatrix(lookMatrix);
        
        // Slerp towards target rotation
        currentQuat.slerp(targetQuat, 0.1);
        missile.body.setRotation({
          x: currentQuat.x,
          y: currentQuat.y,
          z: currentQuat.z,
          w: currentQuat.w
        });
      }
    }
    
    // Apply gravity
    physics.applyGravityToBody(missile.body, deltaTime);
    
    missile.age += deltaTime;
    
    // Check if missile should explode (age timeout or collision)
    if ((missile.age >= missile.maxAge || missile.hasExploded)) {
      if (!missile.hasExploded) {
        missile.hasExploded = true;
        console.log('Missile self-destructed (timeout)');
      }
      
      // Clean up exhaust particles
      missile.exhaustParticles.forEach(particle => {
        scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
      });
      
      // Create explosion at current position
      const missilePos = new THREE.Vector3(pos.x, pos.y, pos.z);
      pyrotechnics.createMissileExplosion(missilePos);
      
      // Remove missile mesh
      scene.remove(missile.mesh);
      missile.mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      
      // Remove physics body and collider
      if (missile.collider && physics.world) {
        physics.world.removeCollider(missile.collider, true);
      }
      if (missile.body && physics.world) {
        physics.world.removeRigidBody(missile.body);
      }
      
      console.log(`${missile.vehicleType} missile exploded!`);
      return true; // Missile has exploded
    }
    
    return false; // Missile still active
  }
};
