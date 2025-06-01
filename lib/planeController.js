import * as THREE from 'three';
import { createPlaneModel } from './models/plane.js';
import { Pyrotechnics } from './pyrotechnics.js';
import { VehicleHelpers, AircraftHelpers, WeaponHelpers } from './vehicles.js';

export class PlaneController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Add pyrotechnics system
    this.pyrotechnics = new Pyrotechnics(scene.scene);
    
    // Plane properties - ADJUSTED FOR REALISTIC TAKEOFF
    this.maxThrust = 80.0;      // Reduced from 100.0 - less acceleration
    this.liftCoefficient = 1.8;  // Keep same
    this.dragCoefficient = 0.08; // Increased from 0.06 - more drag
    this.inducedDragFactor = 0.025; // Increased from 0.02
    this.groundDragCoefficient = 0.2; // Increased from 0.15
    this.stallAngle = 20;        // Keep same
    this.criticalAngle = 15;     // Keep same
    this.minSpeed = 20;          // Keep same
    this.takeoffSpeed = 35;      // Keep same
    
    // Wing properties
    this.wingArea = 15.0;        // Approximate wing area
    this.aspectRatio = 8.0;      // Wing aspect ratio
    
    // Control sensitivity
    this.pitchSensitivity = 1.5;  // Increased from 1.2
    this.rollSensitivity = 2.0;   // Increased from 1.8
    this.yawSensitivity = 0.8;    // Increased from 0.5
    
    // Ground effect parameters
    this.groundEffectHeight = 5.0; // Height at which ground effect starts
    this.groundEffectMultiplier = 1.5; // Extra lift near ground
    
    // Flight state
    this.throttle = 0;
    this.isStalling = false;
    
    // Control surfaces - INITIALIZE THIS!
    this.controlSurfaces = {
      elevator: 0,    // Pitch control (-1 to 1)
      aileron: 0,     // Roll control (-1 to 1)
      rudder: 0       // Yaw control (-1 to 1)
    };
    
    // Physics
    this.body = null;
    this.collider = null;
    
    // Visual
    this.mesh = null;
    this.propeller = null;
    
    // Player state
    this.isOccupied = false;
    this.currentPlayer = null;
    
    // Control state
    this.controls = {
      throttleUp: false,
      throttleDown: false,
      pitchUp: false,
      pitchDown: false,
      rollLeft: false,
      rollRight: false,
      yawLeft: false,
      yawRight: false,
      interact: false
    };
    
    // Add interaction tracking
    this.wasInteracting = false;
    this.wasTogglingGear = false;
    this.wasTogglingLights = false; // Add toggle lights state
    
    // Aircraft lights
    this.lights = {
      navigationRed: null,
      navigationGreen: null,
      strobeWhite: null,
      landingLight: null
    };
    this.lightAnimationTime = 0;
    this.lightsEnabled = true; // Add lights enabled state
    
    // Landing gear state
    this.landingGearExtended = true;
    this.landingGearTransition = 0;
    
    // Afterburner effects - MUST BE INITIALIZED BEFORE create()
    this.afterburnerEffects = {
      leftEngine: null,
      rightEngine: null,
      leftFlame: null,
      rightFlame: null,
      leftGlow: null,
      rightGlow: null,
      particles: []
    };
    
    // Weapon state
    this.weaponCooldown = 0;
    this.guns = []; // Store gun positions for dual firing
    this.missileCooldown = 0;
    this.currentMissiles = 6; // F-16 typically carries 6 missiles
    this.missilePylons = []; // Store missile pylon references
    
    // Add flare and bomb state
    this.flareCooldown = 0;
    this.maxFlares = 60;
    this.currentFlares = this.maxFlares;
    this.wasDeployingFlares = false;
    
    this.bombCooldown = 0;
    this.maxBombs = 4;
    this.currentBombs = this.maxBombs;
    this.wasDroppingBomb = false;
    
    // Create the plane
    this.create(position);
  }
  
  create(position) {
    // Create plane using model
    this.mesh = createPlaneModel();
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Get references from model
    this.afterburner = this.mesh.userData.afterburner;
    this.guns = this.mesh.userData.guns;
    this.missilePylons = this.mesh.userData.missilePylons;
    this.bombPylons = this.mesh.userData.bombPylons;
    this.landingGear = this.mesh.userData.landingGear;
    this.lights = this.mesh.userData.lights;
    this.afterburnerEffects = this.mesh.userData.afterburnerEffects;
    
    // Add point lights for navigation lights
    if (this.lights.navigationRed) {
      const redPointLight = new THREE.PointLight(0xff0000, 1, 15);
      redPointLight.position.copy(this.lights.navigationRed.position);
      this.mesh.add(redPointLight);
      this.lights.navigationRed.userData.pointLight = redPointLight;
    }
    
    if (this.lights.navigationGreen) {
      const greenPointLight = new THREE.PointLight(0x00ff00, 1, 15);
      greenPointLight.position.copy(this.lights.navigationGreen.position);
      this.mesh.add(greenPointLight);
      this.lights.navigationGreen.userData.pointLight = greenPointLight;
    }
    
    if (this.lights.strobeWhite) {
      const strobePointLight = new THREE.PointLight(0xffffff, 2, 20);
      strobePointLight.position.copy(this.lights.strobeWhite.position);
      this.mesh.add(strobePointLight);
      this.lights.strobeWhite.userData.pointLight = strobePointLight;
    }
    
    if (this.lights.landingLight) {
      const landingSpotLight = new THREE.SpotLight(0xffffff, 4, 80, Math.PI / 6, 0.3);
      landingSpotLight.position.copy(this.lights.landingLight.position);
      landingSpotLight.target.position.set(0, -10, 20);
      this.mesh.add(landingSpotLight);
      this.mesh.add(landingSpotLight.target);
      this.lights.landingLight.userData.spotLight = landingSpotLight;
    }
    
    // Add engine lights for afterburner
    const enginePositions = [
      { x: -1.5, y: 0, z: -3 },
      { x: 1.5, y: 0, z: -3 }
    ];
    
    enginePositions.forEach((pos, index) => {
      const engineLight = new THREE.PointLight(0xff4400, 0, 10);
      engineLight.position.set(pos.x, pos.y, pos.z);
      this.mesh.add(engineLight);
      
      if (index === 0) {
        this.afterburnerEffects.leftEngine = engineLight;
      } else {
        this.afterburnerEffects.rightEngine = engineLight;
      }
    });
    
    // Initialize afterburner particles array
    this.afterburnerEffects.particles = [];
    
    // Create physics
    this.createPhysics(position);
    
    // Setup interaction using helper
    VehicleHelpers.setupInteraction(this.mesh, this, 'plane');
    
    console.log('F-16 created at', position);
  }
  
  createPhysics(position) {
    // Create rigid body
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 0.1,
      angularDamping: 0.5
    });
    
    // Create collider
    this.collider = this.physics.createBoxCollider(
      new THREE.Vector3(5, 1, 3),
      {
        density: 0.5,
        friction: 0.3,
        restitution: 0.2
      }
    );
    
    this.physics.world.createCollider(this.collider, this.body);
  }
  
  toggleLights() {
    AircraftHelpers.toggleLights(this);
  }

  updateAircraftLights(deltaTime) {
    AircraftHelpers.updateAircraftLights(this, deltaTime);
    
    // Add plane-specific light animations
    if (this.lightsEnabled && this.lights.landingLight) {
      const landingIntensity = this.landingGearExtended ? 1.0 : 0.3;
      this.lights.landingLight.material.emissiveIntensity = landingIntensity;
      
      if (this.lights.landingLight.userData.spotLight) {
        this.lights.landingLight.userData.spotLight.intensity = landingIntensity * 4;
      }
    }
  }
  
  toggleLandingGear() {
    // Only allow retraction when airborne
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    
    const hit = this.physics.castRay(playerPos, gravityDir, 2.0, this.collider.handle);
    const isGrounded = hit !== null && hit.toi < 1.5;
    
    if (!this.landingGearExtended || !isGrounded) {
      this.landingGearExtended = !this.landingGearExtended;
    }
  }
  
  updateLandingGear(deltaTime) {
    const targetTransition = this.landingGearExtended ? 1 : 0;
    const transitionSpeed = 2.0;
    
    if (this.landingGearTransition !== targetTransition) {
      const delta = targetTransition - this.landingGearTransition;
      const change = Math.sign(delta) * Math.min(Math.abs(delta), deltaTime * transitionSpeed);
      this.landingGearTransition += change;
      
      // Update gear positions
      const gearOffset = (1 - this.landingGearTransition) * 0.5;
      
      Object.values(this.landingGear).forEach(gear => {
        if (gear && gear.userData.baseY !== undefined) {
          gear.position.y = gear.userData.baseY + gearOffset;
        }
      });
    }
  }
  
  getPosition() {
    return VehicleHelpers.getPosition(this);
  }
  
  getVelocity() {
    return VehicleHelpers.getVelocity(this);
  }
  
  enterPlane(player) {
    const cameraPosition = new THREE.Vector3(0, 3, -10);
    const cameraRotation = new THREE.Vector3(-0.1, Math.PI, 0);
    return VehicleHelpers.enterVehicle(this, player, cameraPosition, cameraRotation);
  }
  
  exitPlane() {
    const result = VehicleHelpers.exitVehicle(this, 3);
    
    if (result) {
      // Reset plane-specific controls
      this.throttle = 0;
      this.controlSurfaces.elevator = 0;
      this.controlSurfaces.aileron = 0;
      this.controlSurfaces.rudder = 0;
    }
    
    return result;
  }
  
  fireGun(deltaTime) {
    if (this.weaponCooldown > 0) return;
    
    // Fire from both wing guns
    this.guns.forEach((gun, index) => {
      const muzzlePos = new THREE.Vector3();
      gun.getWorldPosition(muzzlePos);
      muzzlePos.add(new THREE.Vector3(0, 0, 0.6).applyQuaternion(this.mesh.quaternion));
      
      // Get forward direction
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(this.mesh.quaternion);
      
      // Use weapon helper for muzzle flash
      const { flashGroup, flash } = WeaponHelpers.createMuzzleFlash(this.scene.scene, muzzlePos, forward);
      
      // Create tracer
      const tracerGeometry = new THREE.CylinderGeometry(0.02, 0.02, 3);
      const tracerMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        emissive: 0xffaa00,
        emissiveIntensity: 2
      });
      const tracer = new THREE.Mesh(tracerGeometry, tracerMaterial);
      tracer.position.copy(muzzlePos);
      tracer.quaternion.copy(this.mesh.quaternion);
      tracer.rotateX(Math.PI / 2);
      
      this.scene.scene.add(tracer);
      
      // Animate and remove effects
      WeaponHelpers.animateAndRemoveMuzzleFlash(this.scene.scene, flashGroup, flash, 80);
      
      // Handle tracer separately
      const startTime = Date.now();
      const animateTracer = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / 80;
        
        if (progress >= 1) {
          this.scene.scene.remove(tracer);
          tracerGeometry.dispose();
          tracerMaterial.dispose();
          return;
        }
        
        requestAnimationFrame(animateTracer);
      };
      animateTracer();
    });
    
    this.weaponCooldown = 0.1;
    console.log('Firing wing guns');
  }
  
  fireMissile() {
    if (this.missileCooldown > 0 || this.currentMissiles <= 0) return;
    
    this.currentMissiles--;
    
    // Alternate between pylons
    const pylonIndex = this.currentMissiles % 2;
    const pylon = this.missilePylons[pylonIndex];
    
    // Get launch position
    const launchPos = new THREE.Vector3();
    pylon.getWorldPosition(launchPos);
    
    // Launch with plane velocity
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    const planeVel = this.getVelocity();
    const launchVelocity = forward.multiplyScalar(25).add(planeVel); // Reduced from 30
    
    const rotation = this.body.rotation();
    
    // Create missile using shared helper
    const missile = WeaponHelpers.createMissile({
      scene: this.scene.scene,
      physics: this.physics,
      pyrotechnics: this.pyrotechnics,
      launchPos: launchPos,
      launchVelocity: launchVelocity,
      rotation: rotation,
      vehicleType: 'plane'
    });
    
    // Update missile loop
    const updateMissile = () => {
      const hasExploded = WeaponHelpers.updateMissile(
        missile, 
        this.physics, 
        this.pyrotechnics, 
        this.scene.scene
      );
      
      if (!hasExploded) {
        requestAnimationFrame(updateMissile);
      }
    };
    
    updateMissile();
    
    this.missileCooldown = 2.0;
    
    console.log(`Missile fired! ${this.currentMissiles} remaining`);
  }
  
  deployFlares() {
    if (this.flareCooldown > 0 || this.currentFlares <= 0) return;
    
    this.currentFlares -= 2; // Deploy 2 flares at a time
    
    // Deploy flares from wingtips
    const flarePositions = [
      { x: -4, y: 0, z: -1 }, // Left wingtip
      { x: 4, y: 0, z: -1 }   // Right wingtip
    ];
    
    flarePositions.forEach((offset, i) => {
      const worldOffset = new THREE.Vector3(offset.x, offset.y, offset.z);
      worldOffset.applyQuaternion(this.mesh.quaternion);
      
      const flarePos = this.getPosition().add(worldOffset);
      
      // Calculate ejection velocity
      const planeVel = this.getVelocity();
      const ejectionDir = new THREE.Vector3(
        i === 0 ? -20 : 20, // Eject sideways
        -10,
        -20
      );
      ejectionDir.applyQuaternion(this.mesh.quaternion);
      
      const flareVelocity = planeVel.clone().add(ejectionDir);
      
      // Create flare
      this.pyrotechnics.createFlare(flarePos, flareVelocity, {
        color: 0xffcc00,
        duration: 5.0,
        brightness: 5
      });
    });
    
    this.flareCooldown = 1.0; // 1 second cooldown
    
    console.log(`Flares deployed! ${this.currentFlares} remaining`);
  }
  
  dropBomb() {
    if (this.bombCooldown > 0 || this.currentBombs <= 0) return;
    
    // Find next loaded pylon
    const pylon = this.bombPylons.find(p => p.userData.loaded);
    if (!pylon) return;
    
    this.currentBombs--;
    pylon.userData.loaded = false;
    
    // Hide bomb on pylon
    if (pylon.userData.bomb) {
      pylon.userData.bomb.visible = false;
    }
    
    // Get drop position
    const dropPos = new THREE.Vector3();
    pylon.getWorldPosition(dropPos);
    
    // Create physics bomb
    const bombBody = this.physics.createDynamicBody(dropPos, {
      linearDamping: 0.1,
      angularDamping: 0.3
    });
    
    const bombCollider = this.physics.createBoxCollider(
      new THREE.Vector3(0.15, 0.4, 0.15),
      {
        density: 5.0,
        friction: 0.3,
        restitution: 0.1
      }
    );
    
    this.physics.world.createCollider(bombCollider, bombBody);
    
    // Create visual bomb
    const bombGroup = new THREE.Group();
    const bombGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.0, 8);
    const bombMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
      roughness: 0.3
    });
    const bombMesh = new THREE.Mesh(bombGeometry, bombMaterial);
    bombMesh.rotation.x = Math.PI / 2;
    bombGroup.add(bombMesh);
    
    // Add fins
    const finGeometry = new THREE.BoxGeometry(0.4, 0.05, 0.15);
    for (let j = 0; j < 4; j++) {
      const fin = new THREE.Mesh(finGeometry, bombMaterial);
      const angle = (j / 4) * Math.PI * 2;
      fin.position.x = Math.cos(angle) * 0.15;
      fin.position.z = Math.sin(angle) * 0.15;
      fin.position.y = -0.4;
      fin.rotation.y = angle;
      bombGroup.add(fin);
    }
    
    this.scene.scene.add(bombGroup);
    
    // Set initial velocity to match plane
    const planeVel = this.getVelocity();
    bombBody.setLinvel({
      x: planeVel.x,
      y: planeVel.y,
      z: planeVel.z
    });
    
    // Copy plane rotation
    const rotation = this.body.rotation();
    bombBody.setRotation(rotation);
    
    // Track bomb for detonation
    const bomb = {
      body: bombBody,
      mesh: bombGroup,
      collider: bombCollider,
      age: 0,
      detonated: false
    };
    
    const updateBomb = () => {
      if (!bomb.body || bomb.detonated) return;
      
      const pos = bomb.body.translation();
      bomb.mesh.position.set(pos.x, pos.y, pos.z);
      
      const rot = bomb.body.rotation();
      bomb.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      
      // Apply gravity
      this.physics.applyGravityToBody(bomb.body, 0.016);
      
      // Check for ground impact
      const bombPos = new THREE.Vector3(pos.x, pos.y, pos.z);
      const gravityDir = new THREE.Vector3()
        .subVectors(this.physics.gravity.center, bombPos)
        .normalize();
      
      const hit = this.physics.castRay(bombPos, gravityDir, 1.0, bomb.collider.handle);
      
      if (hit && hit.toi < 0.5) {
        // Detonate!
        bomb.detonated = true;
        
        this.pyrotechnics.createBombExplosion(bombPos);
        
        // Remove bomb
        this.scene.scene.remove(bomb.mesh);
        bombGroup.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        
        // Remove physics
        if (bomb.collider && this.physics.world) {
          this.physics.world.removeCollider(bomb.collider, true);
        }
        if (bomb.body && this.physics.world) {
          this.physics.world.removeRigidBody(bomb.body);
        }
        
        console.log('Bomb detonated!');
        return;
      }
      
      bomb.age += 0.016;
      
      // Safety timeout after 30 seconds
      if (bomb.age > 30) {
        // Remove without explosion
        this.scene.scene.remove(bomb.mesh);
        if (bomb.collider) this.physics.world.removeCollider(bomb.collider, true);
        if (bomb.body) this.physics.world.removeRigidBody(bomb.body);
        return;
      }
      
      if (!bomb.detonated) {
        requestAnimationFrame(updateBomb);
      }
    };
    
    updateBomb();
    
    this.bombCooldown = 3.0; // 3 second cooldown between bombs
    
    console.log(`Bomb dropped! ${this.currentBombs} remaining`);
  }
  
  updateAfterburnerEffects(deltaTime) {
    // Scale effects based on throttle
    const throttleEffect = this.throttle * this.throttle; // Square for more dramatic effect
    const pulseTime = Date.now() * 0.01;
    const pulseFactor = 0.9 + Math.sin(pulseTime) * 0.1;
    
    // Update flame effects
    [this.afterburnerEffects.leftFlame, this.afterburnerEffects.rightFlame].forEach(flame => {
      if (flame) {
        // Scale flame based on throttle
        flame.scale.set(
          0.5 + throttleEffect * 0.5,
          throttleEffect * 1.5,
          0.5 + throttleEffect * 0.5
        );
        
        // Adjust opacity
        flame.material.opacity = throttleEffect * 0.8;
        
        // Color shift based on throttle (orange to blue-white at max)
        if (this.throttle > 0.8) {
          const highThrottleFactor = (this.throttle - 0.8) / 0.2;
          flame.material.color.setRGB(
            1,
            0.3 + highThrottleFactor * 0.7,
            highThrottleFactor * 0.8
          );
        } else {
          flame.material.color.setHex(0xff4400);
        }
        
        // Add flicker
        flame.material.emissiveIntensity = 2 + pulseFactor * throttleEffect;
      }
    });
    
    // Update glow effects
    [this.afterburnerEffects.leftGlow, this.afterburnerEffects.rightGlow].forEach(glow => {
      if (glow) {
        const glowScale = throttleEffect * pulseFactor;
        glow.scale.set(glowScale, glowScale, glowScale);
        glow.material.opacity = throttleEffect * 0.6;
        
        // Color shift for glow too
        if (this.throttle > 0.8) {
          const highThrottleFactor = (this.throttle - 0.8) / 0.2;
          glow.material.color.setRGB(
            1,
            0.4 + highThrottleFactor * 0.6,
            highThrottleFactor * 0.6
          );
        }
      }
    });
    
    // Update engine lights
    [this.afterburnerEffects.leftEngine, this.afterburnerEffects.rightEngine].forEach(light => {
      if (light) {
        light.intensity = throttleEffect * 3 * pulseFactor;
        
        // Color shift for light
        if (this.throttle > 0.8) {
          const highThrottleFactor = (this.throttle - 0.8) / 0.2;
          light.color.setRGB(
            1,
            0.3 + highThrottleFactor * 0.7,
            highThrottleFactor * 0.8
          );
        } else {
          light.color.setHex(0xff4400);
        }
      }
    });
    
    // Create exhaust particles at high throttle
    if (this.throttle > 0.5 && Math.random() < this.throttle) {
      this.createExhaustParticle();
    }
    
    // Update and clean up particles
    this.afterburnerEffects.particles = this.afterburnerEffects.particles.filter(particle => {
      particle.age += deltaTime;
      
      // Update particle
      const ageRatio = particle.age / particle.maxAge;
      particle.mesh.position.add(particle.velocity.clone().multiplyScalar(deltaTime));
      particle.velocity.multiplyScalar(0.98); // Drag
      
      // Fade out
      particle.mesh.material.opacity = (1 - ageRatio) * 0.5;
      particle.mesh.scale.multiplyScalar(1 - deltaTime * 0.5);
      
      // Remove old particles
      if (particle.age > particle.maxAge) {
        this.scene.scene.remove(particle.mesh);
        particle.mesh.geometry.dispose();
        particle.mesh.material.dispose();
        return false;
      }
      
      return true;
    });
  }

  createExhaustParticle() {
    // Limit particle count
    if (this.afterburnerEffects.particles.length > 50) return;
    
    const particleGeometry = new THREE.SphereGeometry(0.1 + Math.random() * 0.1, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({
      color: this.throttle > 0.8 ? 0x8888ff : 0xff6600,
      emissive: this.throttle > 0.8 ? 0x4444ff : 0xff4400,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    
    // Random engine position
    const engineX = Math.random() < 0.5 ? -1.5 : 1.5;
    const worldPos = new THREE.Vector3(engineX, 0, -3);
    worldPos.applyQuaternion(this.mesh.quaternion);
    worldPos.add(this.mesh.position);
    
    particle.position.copy(worldPos);
    
    // Get backward direction with some randomness
    const backward = new THREE.Vector3(0, 0, -1);
    backward.applyQuaternion(this.mesh.quaternion);
    
    // Add some spread
    const spread = 0.2;
    backward.x += (Math.random() - 0.5) * spread;
    backward.y += (Math.random() - 0.5) * spread;
    backward.normalize();
    
    const particleSpeed = 10 + Math.random() * 5;
    
    this.scene.scene.add(particle);
    
    this.afterburnerEffects.particles.push({
      mesh: particle,
      velocity: backward.multiplyScalar(particleSpeed),
      age: 0,
      maxAge: 0.5 + Math.random() * 0.5
    });
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Clamp deltaTime to prevent instability
    deltaTime = Math.min(deltaTime, 0.05);
    
    // Update pyrotechnics
    this.pyrotechnics.update(deltaTime);
    
    // Update aircraft lights
    this.updateAircraftLights(deltaTime);
    
    // Update afterburner effects
    this.updateAfterburnerEffects(deltaTime);
    
    // Handle common interaction logic
    VehicleHelpers.handleInteraction(this);
    
    // Map player keys to plane controls when occupied
    if (this.isOccupied && this.keys) {
      this.controls.throttleUp = this.keys.run;
      this.controls.throttleDown = this.keys.crouch;
      this.controls.pitchUp = this.keys.forward;
      this.controls.pitchDown = this.keys.backward;
      this.controls.rollLeft = this.keys.left;
      this.controls.rollRight = this.keys.right;
      this.controls.yawLeft = this.keys.rollLeft;
      this.controls.yawRight = this.keys.rollRight;
      this.controls.interact = this.keys.interact;
      
      // Handle landing gear toggle
      if (this.keys.landingGear && !this.wasTogglingGear) {
        this.toggleLandingGear();
      }
      this.wasTogglingGear = this.keys.landingGear;
      
      // Handle lights toggle
      if (this.keys.toggleLights && !this.wasTogglingLights) {
        this.toggleLights();
      }
      this.wasTogglingLights = this.keys.toggleLights;
    }
    
    // Handle exit input
    if (this.isOccupied && this.keys) {
      if (this.keys.interact && !this.wasInteracting) {
        this.wasInteracting = true;
        if (this.currentPlayer && this.currentPlayer.exitVehicle) {
          this.currentPlayer.exitVehicle();
        }
      } else if (!this.keys.interact) {
        this.wasInteracting = false;
      }
    }
    
    // Handle controls
    this.handleControls(deltaTime);
    
    // Apply physics
    this.applyAerodynamics(deltaTime);
    
    // Update mesh position/rotation
    const pos = this.body.translation();
    this.mesh.position.set(pos.x, pos.y, pos.z);
    
    const rot = this.body.rotation();
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
    
    // Update cooldowns
    if (this.flareCooldown > 0) {
      this.flareCooldown -= deltaTime;
    }
    if (this.bombCooldown > 0) {
      this.bombCooldown -= deltaTime;
    }
    
    // Map additional controls when occupied
    if (this.isOccupied && this.keys) {
      // ...existing code...
      
      // Add flare and bomb controls
      this.controls.deployFlares = this.keys.deployFlares; // F key
      this.controls.dropBomb = this.keys.dropBomb;         // B key
    }
    
    // ...existing code...
  }
  
  getFlightData() {
    const baseData = AircraftHelpers.calculateFlightData(this);
    if (!baseData) return null;
    
    // Add plane-specific data
    return {
      ...baseData,
      throttle: Math.round(this.throttle * 100),
      stallWarning: this.isStalling,
      flares: this.currentFlares,
      missiles: this.currentMissiles,
      bombs: this.currentBombs
    };
  }
  
  handleControls(deltaTime) {
    // Update throttle
    if (this.controls.throttleUp) {
      this.throttle = Math.min(this.throttle + deltaTime * 0.5, 1.0);
    } else if (this.controls.throttleDown) {
      this.throttle = Math.max(this.throttle - deltaTime * 0.5, 0);
    }
    
    // Control surface deflections with smooth transitions
    const controlRate = 3.0; // How fast controls respond
    
    // Elevator (pitch)
    let targetElevator = 0;
    if (this.controls.pitchUp) targetElevator = -1;
    else if (this.controls.pitchDown) targetElevator = 1;
    
    this.controlSurfaces.elevator += (targetElevator - this.controlSurfaces.elevator) * deltaTime * controlRate;
    
    // Ailerons (roll)
    let targetAileron = 0;
    if (this.controls.rollLeft) targetAileron = -1;
    else if (this.controls.rollRight) targetAileron = 1;
    
    this.controlSurfaces.aileron += (targetAileron - this.controlSurfaces.aileron) * deltaTime * controlRate;
    
    // Rudder (yaw)
    let targetRudder = 0;
    if (this.controls.yawLeft) targetRudder = -1;
    else if (this.controls.yawRight) targetRudder = 1;
    
    this.controlSurfaces.rudder += (targetRudder - this.controlSurfaces.rudder) * deltaTime * controlRate;
    
    // Clamp control surfaces
    this.controlSurfaces.elevator = Math.max(-1, Math.min(1, this.controlSurfaces.elevator));
    this.controlSurfaces.aileron = Math.max(-1, Math.min(1, this.controlSurfaces.aileron));
    this.controlSurfaces.rudder = Math.max(-1, Math.min(1, this.controlSurfaces.rudder));
    
    // Flare deployment (F key)
    if (this.controls.deployFlares && !this.wasDeployingFlares) {
      this.deployFlares();
    }
    this.wasDeployingFlares = this.controls.deployFlares;
    
    // Bomb drop (B key)
    if (this.controls.dropBomb && !this.wasDroppingBomb) {
      this.dropBomb();
    }
    this.wasDroppingBomb = this.controls.dropBomb;
  }
  
  applyAerodynamics(deltaTime) {
    const velocity = this.body.linvel();
    const mass = this.body.mass();
    
    // Calculate gravity info
    const position = this.body.translation();
    const playerPos = new THREE.Vector3(position.x, position.y, position.z);
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    const upDir = gravityDir.clone().multiplyScalar(-1);
    
    // Prevent NaN by checking velocity
    if (isNaN(velocity.x) || isNaN(velocity.y) || isNaN(velocity.z)) {
      console.warn('NaN velocity detected, resetting to zero');
      this.body.setLinvel({ x: 0, y: 0, z: 0 });
      return;
    }
    
    // Apply gravity
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
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    
    // Calculate airspeed and velocity vector
    const airspeedVector = new THREE.Vector3(velocity.x, velocity.y, velocity.z);
    const airspeed = airspeedVector.length();
    
    // Apply thrust
    if (this.throttle > 0) {
      const thrustMagnitude = this.throttle * this.maxThrust * mass;
      const thrustForce = forward.clone().multiplyScalar(thrustMagnitude);
      
      this.body.addForce({
        x: thrustForce.x,
        y: thrustForce.y,
        z: thrustForce.z
      });
    }
    
    // Calculate angle of attack properly
    let angleOfAttack = 0;
    let liftDirection = up.clone();
    
    if (airspeed > 1) {
      // Get velocity relative to plane
      const relativeVelocity = airspeedVector.clone().normalize();
      
      // Calculate angle between velocity and forward direction
      const dot = forward.dot(relativeVelocity);
      const clampedDot = Math.max(-1, Math.min(1, dot));
      angleOfAttack = Math.acos(clampedDot);
      
      // Determine sign of angle of attack
      const velocityInPlaneFrame = relativeVelocity.clone();
      const upComponent = velocityInPlaneFrame.dot(up);
      if (upComponent < 0) {
        angleOfAttack = -angleOfAttack;
      }
      
      // Convert to degrees for calculations
      angleOfAttack = angleOfAttack * (180 / Math.PI);
      
      // Calculate lift direction - perpendicular to relative velocity in the plane of wings
      // This ensures lift is always perpendicular to airflow
      if (Math.abs(relativeVelocity.dot(up)) < 0.99) {
        liftDirection = new THREE.Vector3()
          .crossVectors(relativeVelocity, right)
          .normalize();
      }
    }
    
    // Check for stall - but not if landing gear is extended
    this.isStalling = this.landingGearExtended ? false : Math.abs(angleOfAttack) > this.stallAngle;
    
    // Calculate lift with proper physics
    if (airspeed > this.minSpeed) {
      // Lift coefficient varies with angle of attack
      let Cl = 0;
      
      if (!this.isStalling) {
        // Linear approximation of lift coefficient
        // Maximum at critical angle, zero at 0 degrees
        const normalizedAngle = Math.abs(angleOfAttack) / this.criticalAngle;
        Cl = this.liftCoefficient * Math.sin(normalizedAngle * Math.PI / 2);
        
        // Reduce lift at very high angles (approaching stall) - but not with gear down
        if (!this.landingGearExtended && Math.abs(angleOfAttack) > this.criticalAngle) {
          const stallFactor = 1 - ((Math.abs(angleOfAttack) - this.criticalAngle) / 
                                  (this.stallAngle - this.criticalAngle));
          Cl *= Math.max(0.3, stallFactor);
        }
      } else {
        // Stalled - drastically reduced lift (won't happen with gear down)
        Cl = this.liftCoefficient * 0.2;
      }
      
      // Lift equation: L = 0.5 * ρ * V² * S * Cl
      // Simplified with density = 1
      const liftMagnitude = 0.5 * airspeed * airspeed * this.wingArea * Cl * 0.01;
      
      // Ground effect - extra lift when close to ground
      const groundDistance = this.checkGroundDistance(playerPos, gravityDir);
      if (groundDistance < this.groundEffectHeight && groundDistance > 0) {
        const groundEffectFactor = 1 + (this.groundEffectMultiplier - 1) * 
          (1 - groundDistance / this.groundEffectHeight);
        liftMagnitude *= groundEffectFactor;
      }
      
      const liftForce = liftDirection.multiplyScalar(liftMagnitude);
      
      this.body.addForce({
        x: liftForce.x,
        y: liftForce.y,
        z: liftForce.z
      });
      
      // Induced drag - drag created by lift generation
      if (liftMagnitude > 0) {
        const inducedDrag = this.inducedDragFactor * liftMagnitude * liftMagnitude / 
                           (airspeed * airspeed);
        const inducedDragForce = airspeedVector.clone()
          .normalize()
          .multiplyScalar(-inducedDrag);
        
        this.body.addForce({
          x: inducedDragForce.x,
          y: inducedDragForce.y,
          z: inducedDragForce.z
        });
      }
    }
    
    // Apply drag
    if (airspeed > 0.1) {
      // Check if on ground for different drag calculation
      const onGround = this.checkGroundDistance(playerPos, gravityDir) < 1.0;
      
      let dragCoeff = this.dragCoefficient;
      if (onGround && airspeed < this.takeoffSpeed) {
        // Higher drag on ground (rolling resistance)
        dragCoeff = this.groundDragCoefficient;
      }
      
      // Drag equation: D = 0.5 * ρ * V² * S * Cd
      const dragMagnitude = 0.5 * dragCoeff * airspeed * airspeed * this.wingArea * 0.01;
      const dragForce = airspeedVector.clone().normalize().multiplyScalar(-dragMagnitude);
      
      this.body.addForce({
        x: dragForce.x,
        y: dragForce.y,
        z: dragForce.z
      });
    }
    
    // Apply control surfaces (reduced effectiveness at low speed)
    const controlSpeed = Math.max(5, this.minSpeed * 0.5);
    if (airspeed > controlSpeed) {
      const controlEffectiveness = Math.min(1.0, (airspeed - controlSpeed) / 
                                           (this.takeoffSpeed - controlSpeed));
      
      // Control effectiveness also depends on dynamic pressure
      const dynamicPressure = 0.5 * airspeed * airspeed;
      const controlForce = dynamicPressure * 0.01;
      
      // Pitch control
      if (this.controlSurfaces.elevator !== 0) {
        const pitchTorque = right.clone().multiplyScalar(
          this.controlSurfaces.elevator * this.pitchSensitivity * 
          controlEffectiveness * controlForce
        );
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Roll control
      if (this.controlSurfaces.aileron !== 0) {
        const rollTorque = forward.clone().multiplyScalar(
          this.controlSurfaces.aileron * this.rollSensitivity * 
          controlEffectiveness * controlForce
        );
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Yaw control (rudder) - less effective than other controls
      if (this.controlSurfaces.rudder !== 0) {
        const yawTorque = up.clone().multiplyScalar(
          this.controlSurfaces.rudder * this.yawSensitivity * 
          controlEffectiveness * controlForce * 0.5
        );
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
    }
    
    // Angular damping for stability
    const angVel = this.body.angvel();
    const angularDamping = {
      x: -angVel.x * 2.0,
      y: -angVel.y * 2.0,
      z: -angVel.z * 2.0
    };
    this.body.addTorque(angularDamping);
  }

  // Add ground distance check for ground effect
  checkGroundDistance(position, gravityDir) {
    const rayOrigin = position.clone();
    const rayDir = gravityDir;
    const maxDistance = this.groundEffectHeight * 2;
    
    const hit = this.physics.castRay(
      rayOrigin,
      rayDir,
      maxDistance,
      this.collider.handle
    );
    
    return hit ? hit.toi : maxDistance;
  }
}
