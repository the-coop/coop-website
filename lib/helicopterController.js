import * as THREE from 'three';
import { Pyrotechnics } from './pyrotechnics.js';
import { createHelicopterModel } from './models/helicopter.js';
import { VehicleHelpers, AircraftHelpers, WeaponHelpers } from './vehicles.js';
import { Ballistics } from './ballistics.js';

export class HelicopterController {
  constructor(scene, physics, position) {
    this.scene = scene;
    this.physics = physics;
    
    // Add pyrotechnics system
    this.pyrotechnics = new Pyrotechnics(scene.scene);
    
    // Helicopter properties - FURTHER INCREASED THRUST
    this.maxLiftForce = 80.0;  // Increased from 50.0
    this.maxTorque = 12.0;     // Increased from 10.0 for better control
    this.hoverThrottle = 0.55; // Reduced from 0.65 - less throttle needed to hover
    
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
    
    // Add interaction tracking
    this.wasInteracting = false;
    this.wasTogglingLights = false; // Add toggle lights state
    
    // Aircraft lights
    this.lights = {
      navigationRed: null,
      navigationGreen: null,
      strobeWhite: null,
      antiCollisionRed: null,
      searchLight: null
    };
    this.lightAnimationTime = 0;
    this.lightsEnabled = true; // Add lights enabled state
    
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
    
    // Add grounding state
    this.isGrounded = false;
    
    // Add landing gear state
    this.landingGearExtended = true;
    this.landingGearTransition = 0;
    
    // Add weapon state
    this.weaponCooldown = 0;
    this.rocketCooldown = 0;
    this.rockets = [];
    this.maxRockets = 38; // Apache carries 38 rockets
    this.currentRockets = this.maxRockets;
    
    // Add lock-on system
    this.lockOnSystem = {
      target: null,
      targetVehicle: null,
      targetDistance: 0,
      lockProgress: 1.0, // Always fully locked when we have a target
      maxLockRange: 300,
      minLockTime: 0, // Instant lock
      lockCone: Math.PI / 6, // 30 degree cone
      isLocked: false,
      lastLockTime: 0,
      lockBreakTime: 5, // seconds before lock breaks without line of sight
      crosshair: null,
      targetIndicator: null
    };
    
    // Add flare state
    this.flareCooldown = 0;
    this.maxFlares = 30;
    this.currentFlares = this.maxFlares;
    this.wasDeployingFlares = false;
    
    // Visual components - will be set from model
    this.landingGear = null;
    this.lights = null;
    this.rocketPods = null;
    this.gunMount = null;
    
    // Create the helicopter
    this.create(position);
  }
  
  create(position) {
    // Create helicopter using model
    this.mesh = createHelicopterModel();
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.scene.scene.add(this.mesh);
    
    // Get references from model
    this.mainRotor = this.mesh.userData.mainRotor;
    this.tailRotor = this.mesh.userData.tailRotor;
    this.rocketPods = this.mesh.userData.rocketPods;
    this.gunMount = this.mesh.userData.gunMount;
    this.lights = this.mesh.userData.lights;
    this.landingGear = this.mesh.userData.landingGear;
    
    // Add point lights for aircraft lights (like plane does)
    if (this.lights.navigationRed) {
      const redPointLight = new THREE.PointLight(0xff0000, 0.8, 12);
      redPointLight.position.copy(this.lights.navigationRed.position);
      this.mesh.add(redPointLight);
      this.lights.navigationRed.userData.pointLight = redPointLight;
    }
    
    if (this.lights.navigationGreen) {
      const greenPointLight = new THREE.PointLight(0x00ff00, 0.8, 12);
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
    
    if (this.lights.antiCollisionRed) {
      const beaconPointLight = new THREE.PointLight(0xff0000, 2, 20);
      beaconPointLight.position.copy(this.lights.antiCollisionRed.position);
      this.mesh.add(beaconPointLight);
      this.lights.antiCollisionRed.userData.pointLight = beaconPointLight;
    }
    
    // Create physics
    this.createPhysics(position);
    
    // Setup interaction using helper
    VehicleHelpers.setupInteraction(this.mesh, this, 'helicopter');
    
    console.log('Apache helicopter created at', position);
  }
  
  createPhysics(position) {
    // Create main body for fuselage with ADJUSTED damping for better lift
    this.body = this.physics.createDynamicBody(position, {
      linearDamping: 1.5,  // Reduced from 2.5 for better lift
      angularDamping: 5.0  // Keep high angular damping for stability
    });
    
    // Create compound collider to match helicopter shape better
    // Main fuselage collider
    const fuselageCollider = this.physics.createBoxCollider(
      new THREE.Vector3(1, 1, 2.5),  // Adjusted height to match mesh
      {
        density: 0.3,
        friction: 0.5,
        restitution: 0.3
      }
    );
    
    // Tail boom collider - FIX: Set translation before creating collider
    const tailColliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(0.4, 0.4, 3),
      {
        density: 0.2,
        friction: 0.5,
        restitution: 0.3
      }
    );
    
    // Set translation on the descriptor before creating the collider
    tailColliderDesc.setTranslation(0, 0, -4);
    
    // Create compound collider
    this.collider = this.physics.world.createCollider(fuselageCollider, this.body);
    this.physics.world.createCollider(tailColliderDesc, this.body);
  }
  
  checkGrounded() {
    this.isGrounded = VehicleHelpers.checkGrounded(this.physics, this.body, this.collider);
    return this.isGrounded;
  }
  
  toggleLights() {
    AircraftHelpers.toggleLights(this);
  }
  
  updateAircraftLights(deltaTime) {
    AircraftHelpers.updateAircraftLights(this, deltaTime);
    
    // Add helicopter-specific light animations
    if (this.lightsEnabled && this.lights.searchLight) {
      const searchIntensity = this.collectivePitch > 0.3 ? 1.0 : 0.4;
      this.lights.searchLight.material.emissiveIntensity = searchIntensity;
      
      if (this.lights.searchLight.userData.spotLight) {
        this.lights.searchLight.userData.spotLight.intensity = searchIntensity * 3;
        
        // Slow sweeping motion when active
        if (searchIntensity > 0.8) {
          const sweepAngle = Math.sin(this.lightAnimationTime * 0.5) * 0.3;
          this.lights.searchLight.userData.spotLight.target.position.x = Math.sin(sweepAngle) * 10;
          this.lights.searchLight.userData.spotLight.target.position.z = Math.cos(sweepAngle) * 10;
        }
      }
    }
    
    // Remove the redundant anti-collision light animation
    // The shared AircraftHelpers.updateAircraftLights already handles:
    // - Navigation lights (red/green)
    // - White strobe light with double-flash pattern
    // - Anti-collision beacon with rotation and pulsing
  }
  
  getPosition() {
    return VehicleHelpers.getPosition(this);
  }
  
  getVelocity() {
    return VehicleHelpers.getVelocity(this);
  }
  
  enterHelicopter(player) {
    const cameraPosition = new THREE.Vector3(0, 8, -25);
    const cameraRotation = new THREE.Vector3(-0.15, Math.PI, 0);
    const result = VehicleHelpers.enterVehicle(this, player, cameraPosition, cameraRotation);
    
    // Initialize lock-on indicators if weapon system exists
    if (result && this.scene.weaponSystem) {
      // Make sure indicators are created
      if (!this.scene.weaponSystem.lockOnIndicator) {
        console.log('Creating lock-on indicators for helicopter');
        this.scene.weaponSystem.createLockOnIndicator();
      }
      console.log('Helicopter lock-on system initialized with weapon system');
    } else {
      console.warn('No weapon system found for lock-on indicators');
    }
    
    return result;
  }
  
  exitHelicopter() {
    return VehicleHelpers.exitVehicle(this, 4);
  }
  
  fireGun(deltaTime) {
    if (this.weaponCooldown > 0) return;
    
    // Fire from chain gun
    const muzzlePos = new THREE.Vector3(0, -0.8, 3.5);
    muzzlePos.applyQuaternion(this.mesh.quaternion);
    muzzlePos.add(this.mesh.position);
    
    // Get forward direction
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    // Use weapon helper for muzzle flash
    const { flashGroup, flash } = WeaponHelpers.createMuzzleFlash(this.scene.scene, muzzlePos, forward);
    
    // Create tracer
    const tracerGeometry = new THREE.CylinderGeometry(0.03, 0.03, 4);
    const tracerMaterial = new THREE.MeshStandardMaterial({
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
    WeaponHelpers.animateAndRemoveMuzzleFlash(this.scene.scene, flashGroup, flash, 100);
    
    // Handle tracer separately
    const startTime = Date.now();
    const animateTracer = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / 100;
      
      if (progress >= 1) {
        this.scene.scene.remove(tracer);
        tracerGeometry.dispose();
        tracerMaterial.dispose();
        return;
      }
      
      requestAnimationFrame(animateTracer);
    };
    animateTracer();
    
    this.weaponCooldown = 0.15;
    console.log('Firing 30mm chain gun');
  }
  
  fireMissile() {
    if (this.rocketCooldown > 0 || this.currentRockets <= 0) return;
    
    // Check if we have a locked target - ADD MORE DEBUG
    const hasLockedTarget = this.lockOnSystem.isLocked && this.lockOnSystem.targetVehicle;
    
    console.log('=== FIRING MISSILE ===');
    console.log('Lock system state:', {
      isLocked: this.lockOnSystem.isLocked,
      hasTargetVehicle: !!this.lockOnSystem.targetVehicle,
      targetType: this.lockOnSystem.target?.type,
      lockProgress: this.lockOnSystem.lockProgress,
      targetDistance: this.lockOnSystem.targetDistance
    });
    console.log('Has locked target:', hasLockedTarget);
    
    // Also check if we're actually finding any vehicles to lock onto
    console.log('Vehicle scene references:', {
      hasVehicleRegistry: !!(this.scene.vehicles && this.scene.vehicles instanceof Map),
      vehicleRegistrySize: this.scene.vehicles ? this.scene.vehicles.size : 'N/A',
      hasPlaneController: !!this.scene.planeController,
      hasCarController: !!this.scene.carController
    });
    
    this.currentRockets--;
    
    // Alternate between pods
    const podIndex = this.currentRockets % 2;
    const pod = this.rocketPods[podIndex];
    
    // Get launch position
    const launchPos = pod.position.clone();
    launchPos.applyQuaternion(this.mesh.quaternion);
    launchPos.add(this.mesh.position);
    
    // Launch velocity
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    const heliVel = this.getVelocity();
    const launchVelocity = forward.multiplyScalar(25).add(heliVel); // Reduced from 30
    
    const rotation = this.body.rotation();
    
    // Create missile using shared helper
    const missile = WeaponHelpers.createMissile({
      scene: this.scene.scene,
      physics: this.physics,
      pyrotechnics: this.pyrotechnics,
      launchPos: launchPos,
      launchVelocity: launchVelocity,
      rotation: rotation,
      vehicleType: 'helicopter'
    });
    
    // IMPORTANT: Set the locked target if we have one
    if (hasLockedTarget) {
      missile.lockedTarget = this.lockOnSystem.targetVehicle;
      missile.trackingStrength = 1.0; // Increase tracking strength for locked missiles
      console.log('✓ MISSILE LOCKED ONTO TARGET:', this.lockOnSystem.target.type);
      console.log('Target vehicle has getPosition:', typeof this.lockOnSystem.targetVehicle.getPosition);
      console.log('Missile guidance active:', missile.guidanceActive);
      console.log('Missile tracking strength:', missile.trackingStrength);
    } else {
      console.log('✗ MISSILE FIRED WITHOUT LOCK');
    }
    
    // Update missile loop
    const updateMissile = () => {
      const hasExploded = WeaponHelpers.updateMissile(
        missile, 
        this.physics, 
        this.pyrotechnics, 
        this.scene.scene,
        0.016, // Use fixed deltaTime of 16ms (60fps)
        this.collider.handle // Pass launcher's collider to ignore
      );
      
      if (!hasExploded) {
        requestAnimationFrame(updateMissile);
      }
    };
    
    updateMissile();
    
    this.rocketCooldown = 0.2; // Changed from 1.5 to 0.2 - much faster fire rate!
    
    console.log(`Missile fired! ${this.currentRockets} remaining`);
  }
  
  deployFlares() {
    if (this.flareCooldown > 0 || this.currentFlares <= 0) return;
    
    this.currentFlares--;
    
    // Deploy multiple flares in a pattern
    const flareCount = 4;
    for (let i = 0; i < flareCount; i++) {
      const angle = (i / flareCount) * Math.PI * 2;
      
      // Get deployment position (behind and below helicopter)
      const offset = new THREE.Vector3(
        Math.cos(angle) * 1.5,
        -1,
        -2
      );
      offset.applyQuaternion(this.mesh.quaternion);
      
      const flarePos = this.getPosition().add(offset);
      
      // Calculate ejection velocity
      const heliVel = this.getVelocity();
      const ejectionDir = new THREE.Vector3(
        Math.cos(angle) * 15,
        -5,
        -10
      );
      ejectionDir.applyQuaternion(this.mesh.quaternion);
      
      const flareVelocity = heliVel.clone().add(ejectionDir);
      
      // Create flare with alternating colors
      const flareColor = i % 2 === 0 ? 0xff6600 : 0xffaa00;
      this.pyrotechnics.createFlare(flarePos, flareVelocity, {
        color: flareColor,
        duration: 4.0,
        brightness: 4
      });
    }
    
    this.flareCooldown = 2.0; // 2 second cooldown between flare deployments
    
    console.log(`Flares deployed! ${this.currentFlares} remaining`);
  }
  
  update(deltaTime) {
    if (!this.body) return;
    
    // Update pyrotechnics
    this.pyrotechnics.update(deltaTime);
    
    // Update lock-on system
    this.updateLockOnSystem(deltaTime);
    
    // Update aircraft lights animation
    this.updateAircraftLights(deltaTime);
    
    // Update flare cooldown
    if (this.flareCooldown > 0) {
      this.flareCooldown -= deltaTime;
    }
    
    // Handle common interaction logic
    VehicleHelpers.handleInteraction(this);
    
    // Map player keys to helicopter controls when occupied
    if (this.isOccupied && this.keys) {
      // Helicopter throttle controls - use Shift/Ctrl
      this.controls.throttleUp = this.keys.run;
      this.controls.throttleDown = this.keys.crouch;
      
      // Cyclic controls (pitch/roll)
      this.controls.pitchForward = this.keys.forward;  // W key
      this.controls.pitchBackward = this.keys.backward; // S key
      this.controls.rollLeft = this.keys.left;         // A key - roll left
      this.controls.rollRight = this.keys.right;       // D key - roll right
      
      // Tail rotor (yaw) controls - FIXED
      this.controls.yawLeft = this.keys.rollLeft;      // Q key - yaw left
      this.controls.yawRight = this.keys.rollRight;    // E key - yaw right
      
      // Weapon controls
      if (this.keys.fireGun) {
        this.fireGun(deltaTime);
      }
      if (this.keys.fireMissile && !this.wasFiringMissile) {
        this.fireMissile();
      }
      this.wasFiringMissile = this.keys.fireMissile;
      
      // Flare deployment
      if (this.keys.deployFlares && !this.wasDeployingFlares) {
        this.deployFlares();
      }
      this.wasDeployingFlares = this.keys.deployFlares;
      
      // Handle lights toggle
      if (this.keys.toggleLights && !this.wasTogglingLights) {
        this.toggleLights();
      }
      this.wasTogglingLights = this.keys.toggleLights;
      
      // Exit control
      this.controls.interact = this.keys.interact;     // U key
    }
    
    // Update landing gear animation
    this.updateLandingGear(deltaTime);
    
    // Update weapon cooldowns
    if (this.weaponCooldown > 0) {
      this.weaponCooldown -= deltaTime;
    }
    if (this.rocketCooldown > 0) {
      this.rocketCooldown -= deltaTime;
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
    
    // Handle controls
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
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);  // Changed from -1 to 1
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
      // Project forward and right vectors onto the plane perpendicular to gravity
      const forwardHorizontal = forward.clone()
        .sub(upDir.clone().multiplyScalar(forward.dot(upDir)))
        .normalize();
      
      const rightHorizontal = right.clone()
        .sub(upDir.clone().multiplyScalar(right.dot(upDir)))
        .normalize();
      
      // Apply cyclic pitch (forward/backward tilt)
      if (this.cyclicPitch !== 0) {
        const pitchTorque = rightHorizontal.clone().multiplyScalar(this.cyclicPitch * this.maxTorque * 0.5);
        this.body.addTorque({
          x: pitchTorque.x,
          y: pitchTorque.y,
          z: pitchTorque.z
        });
      }
      
      // Apply cyclic roll (left/right tilt)
      if (this.cyclicRoll !== 0) {
        const rollTorque = forwardHorizontal.clone().multiplyScalar(-this.cyclicRoll * this.maxTorque * 0.5);
        this.body.addTorque({
          x: rollTorque.x,
          y: rollTorque.y,
          z: rollTorque.z
        });
      }
      
      // Apply tail rotor (yaw) - around gravity axis, not local up
      if (this.tailRotorPitch !== 0) {
        const yawTorque = upDir.clone().multiplyScalar(this.tailRotorPitch * this.maxTorque * 0.3);
        this.body.addTorque({
          x: yawTorque.x,
          y: yawTorque.y,
          z: yawTorque.z
        });
      }
      
      // Apply strong angular damping
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
    
    // Auto-stabilization when no cyclic input
    if (!this.isGrounded && this.collectivePitch > 0.5) {
      if (Math.abs(this.cyclicPitch) < 0.05 && Math.abs(this.cyclicRoll) < 0.05) {
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
  
  toggleLandingGear() {
    // Only allow retraction when airborne
    if (!this.landingGearExtended || !this.isGrounded) {
      this.landingGearExtended = !this.landingGearExtended;
      console.log(`Landing gear ${this.landingGearExtended ? 'extended' : 'retracted'}`);
    }
  }
  
  updateLandingGear(deltaTime) {
    const targetTransition = this.landingGearExtended ? 1 : 0;
    const transitionSpeed = 1.5; // slower for helicopter
    
    if (this.landingGearTransition !== targetTransition) {
      const delta = targetTransition - this.landingGearTransition;
      const change = Math.sign(delta) * Math.min(Math.abs(delta), deltaTime * transitionSpeed);
      this.landingGearTransition += change;
      
      // Update gear positions (retract upward)
      const gearOffset = (1 - this.landingGearTransition) * 0.8;
      
      Object.values(this.landingGear).forEach(gear => {
        if (gear) {
          gear.position.y = gear.userData?.baseY || -1 + gearOffset;
        }
      });
    }
  }
  
  updateCamera() {
    if (!this.scene.camera || !this.mesh) return;
    
    // The camera is already attached to the helicopter mesh in enterHelicopter
    // This method can be used for dynamic camera adjustments if needed
    
    // Optional: Add slight camera shake based on rotor speed
    if (this.collectivePitch > 0.1) {
      const shakeIntensity = this.collectivePitch * 0.02;
      const time = Date.now() * 0.01;
      
      // Apply small random offset to simulate vibration
      const shakeX = (Math.sin(time * 1.1) + Math.sin(time * 2.3)) * shakeIntensity;
      const shakeY = (Math.sin(time * 1.7) + Math.sin(time * 2.9)) * shakeIntensity;
      
      // Update local position offset (keeping base position)
      this.scene.camera.position.x = shakeX;
      this.scene.camera.position.y = 8 + shakeY; // Updated from 20 to 8
      this.scene.camera.position.z = -25; // Updated from -70 to -25
    }
  }
  
  destroy() {
    // Clean up lock-on indicators
    if (this.lockOnIndicator) {
      this.scene.scene.remove(this.lockOnIndicator);
      this.lockOnIndicator.geometry.dispose();
      this.lockOnIndicator.material.dispose();
    }
    
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
    VehicleHelpers.updateFromServer(this, state);
    
    // Update helicopter-specific state
    if (state.rotorSpeed !== undefined) {
      this.rotorSpeed = state.rotorSpeed;
    }
  }
  
  getFlightData() {
    const baseData = AircraftHelpers.calculateFlightData(this);
    if (!baseData) return null;
    
    // Add helicopter-specific data
    return {
      ...baseData,
      throttle: Math.round(this.collectivePitch * 100),
      stallWarning: false,
      flares: this.currentFlares,
      rockets: this.currentRockets
    };
  }
  
  handleControls(deltaTime, upDir) {
    // Handle collective pitch (throttle) controls
    if (this.controls.throttleUp) {
      this.collectivePitch = Math.min(this.collectivePitch + deltaTime * 0.8, 1.0);
    } else if (this.controls.throttleDown) {
      this.collectivePitch = Math.max(this.collectivePitch - deltaTime * 0.8, 0);
    }
    
    // Only allow control when engine is running
    if (this.collectivePitch < 0.1) return;
    
    // Calculate control effectiveness based on rotor speed
    const controlEffectiveness = Math.min(this.collectivePitch, 1.0);
    
    // Cyclic (pitch/roll) controls - FIXED DIRECTIONS
    if (this.controls.pitchForward) {
      this.cyclicPitch = Math.min(this.cyclicPitch + deltaTime * 2, this.maxPitch);
    } else if (this.controls.pitchBackward) {
      this.cyclicPitch = Math.max(this.cyclicPitch - deltaTime * 2, -this.maxPitch);
    } else {
      this.cyclicPitch *= 0.9; // Decay when no input
    }
    
    if (this.controls.rollLeft) {
      this.cyclicRoll = Math.min(this.cyclicRoll + deltaTime * 2, this.maxRoll); // Fixed: + for left roll
    } else if (this.controls.rollRight) {
      this.cyclicRoll = Math.max(this.cyclicRoll - deltaTime * 2, -this.maxRoll); // Fixed: - for right roll
    } else {
      this.cyclicRoll *= 0.9; // Decay when no input
    }
    
    // Tail rotor (yaw) control - FIXED DIRECTIONS
    if (this.controls.yawLeft) {
      this.tailRotorPitch = Math.min(this.tailRotorPitch + deltaTime * 3, 1.0); // Fixed: + for left yaw
    } else if (this.controls.yawRight) {
      this.tailRotorPitch = Math.max(this.tailRotorPitch - deltaTime * 3, -1.0); // Fixed: - for right yaw
    } else {
      this.tailRotorPitch *= 0.9; // Decay when no input
    }
  }
  
  updateLockOnSystem(deltaTime) {
    if (!this.isOccupied) return;
    
    const position = this.getPosition();
    const rotation = this.body.rotation();
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);
    
    // Find all vehicles and potential lock target
    let closestTarget = null;
    let closestDistance = this.lockOnSystem.maxLockRange;
    const allTargets = [];
    
    // Get all registered vehicles from scene
    const potentialTargets = [];
    
    // Use the vehicle registry if available
    if (this.scene.vehicles && this.scene.vehicles instanceof Map) {
      this.scene.vehicles.forEach((vehicle, id) => {
        if (vehicle !== this && vehicle.getPosition) {
          potentialTargets.push({
            controller: vehicle,
            type: vehicle.constructor.name.toLowerCase().replace('controller', ''),
            id: id
          });
        }
      });
    }
    
    // Process all targets using Ballistics system
    potentialTargets.forEach(target => {
      if (!target.controller.getPosition) return;
      
      const targetPos = target.controller.getPosition();
      
      // Use Ballistics to check if target is in lock cone
      const detection = Ballistics.checkTargetInCone(
        position,
        forward,
        targetPos,
        this.lockOnSystem.lockCone,
        this.lockOnSystem.maxLockRange
      );
      
      // Add to all targets list for HUD
      allTargets.push({
        position: targetPos,
        distance: detection.range,
        inLockCone: detection.inCone,
        type: target.type,
        id: target.id,
        controller: target.controller
      });
      
      // Check if this is the closest target in cone
      if (detection.inCone && detection.range < closestDistance) {
        closestTarget = {
          vehicle: target.controller,
          position: targetPos,
          distance: detection.range,
          type: target.type,
          id: target.id
        };
        closestDistance = detection.range;
      }
    });
    
    // SIMPLIFIED INSTANT LOCK LOGIC
    if (closestTarget) {
      // LOCK ONTO CLOSEST TARGET IMMEDIATELY
      this.lockOnSystem.target = closestTarget;
      this.lockOnSystem.targetVehicle = closestTarget.vehicle;
      this.lockOnSystem.targetDistance = closestTarget.distance;
      this.lockOnSystem.lockProgress = 1.0; // Instant lock
      this.lockOnSystem.isLocked = true;
      this.lockOnSystem.lastLockTime = Date.now();
      
      console.log('✓ LOCKED ONTO:', closestTarget.type, 'at distance:', closestTarget.distance.toFixed(1));
    } else {
      // NO TARGET IN RANGE/CONE
      this.lockOnSystem.target = null;
      this.lockOnSystem.targetVehicle = null;
      this.lockOnSystem.targetDistance = 0;
      this.lockOnSystem.lockProgress = 0;
      this.lockOnSystem.isLocked = false;
    }
    
    // Update HUD indicators for ALL vehicles
    this.updateLockOnHUD(allTargets);
  }
  
  updateLockOnHUD(allTargets) {
    // Update visual indicators for all vehicles
    if (this.scene.weaponSystem && this.scene.weaponSystem.updateAllTargetIndicators) {
      // Update the locked target (if any)
      let lockedTargetPosition = null;
      if (this.lockOnSystem.targetVehicle && this.lockOnSystem.targetVehicle.getPosition) {
        lockedTargetPosition = this.lockOnSystem.targetVehicle.getPosition();
      }
      
      // Send data for locked target
      const lockData = {
        hasTarget: this.lockOnSystem.target !== null,
        isLocked: this.lockOnSystem.isLocked,
        lockProgress: this.lockOnSystem.lockProgress,
        targetDistance: this.lockOnSystem.targetDistance,
        targetPosition: lockedTargetPosition
      };
      
      // Update all target indicators
      this.scene.weaponSystem.updateAllTargetIndicators(allTargets, lockData);
    }
  }
}
