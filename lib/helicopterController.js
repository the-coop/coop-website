import * as THREE from 'three';
import { Pyrotechnics } from './pyrotechnics.js';
import { createHelicopterModel } from './models/helicopter.js';
import { VehicleHelpers, AircraftHelpers, WeaponHelpers } from './vehicles.js';

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
    return VehicleHelpers.enterVehicle(this, player, cameraPosition, cameraRotation);
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
    
    this.currentRockets--;
    
    // Alternate between pods
    const podIndex = this.currentRockets % 2;
    const pod = this.rocketPods[podIndex];
    
    // Get launch position
    const launchPos = pod.position.clone();
    launchPos.applyQuaternion(this.mesh.quaternion);
    launchPos.add(this.mesh.position);
    
    // Create missile body
    const missileBody = this.physics.createDynamicBody(launchPos, {
      linearDamping: 0.02,
      angularDamping: 0.8
    });
    
    const missileCollider = this.physics.createBoxCollider(
      new THREE.Vector3(0.06, 0.06, 0.5),
      {
        density: 1.2,
        friction: 0.1,
        restitution: 0.1
      }
    );
    
    this.physics.world.createCollider(missileCollider, missileBody);
    
    // Create visual missile
    const missileGroup = new THREE.Group();
    const missileGeometry = new THREE.CylinderGeometry(0.1, 0.08, 1.0);
    const missileMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.8
    });
    const missileMesh = new THREE.Mesh(missileGeometry, missileMaterial);
    missileMesh.rotation.x = Math.PI / 2;
    missileGroup.add(missileMesh);
    
    // Add fins
    const finGeometry = new THREE.BoxGeometry(0.02, 0.15, 0.08);
    const finMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      metalness: 0.7
    });
    
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(finGeometry, finMaterial);
      const angle = (i / 4) * Math.PI * 2;
      fin.position.x = Math.cos(angle) * 0.1;
      fin.position.y = Math.sin(angle) * 0.1;
      fin.position.z = -0.3;
      missileGroup.add(fin);
    }
    
    // Add warhead
    const warheadGeometry = new THREE.ConeGeometry(0.1, 0.25, 8);
    const warheadMaterial = new THREE.MeshStandardMaterial({
      color: 0x880000,
      metalness: 0.7
    });
    const warhead = new THREE.Mesh(warheadGeometry, warheadMaterial);
    warhead.position.z = 0.6;
    missileGroup.add(warhead);
    
    // Create afterburner effects (initially hidden)
    const afterburnerGroup = new THREE.Group();
    afterburnerGroup.position.z = -0.5; // Position at missile rear
    afterburnerGroup.visible = false; // Start hidden
    
    // Flame cone
    const flameGeometry = new THREE.ConeGeometry(0.1, 0.6, 8);
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
    flame.position.z = -0.3;
    afterburnerGroup.add(flame);
    
    // Inner flame (white hot)
    const innerFlameGeometry = new THREE.ConeGeometry(0.05, 0.4, 6);
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
    innerFlame.position.z = -0.25;
    afterburnerGroup.add(innerFlame);
    
    // Glow effect
    const glowGeometry = new THREE.SphereGeometry(0.2, 8, 6);
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
    const engineLight = new THREE.PointLight(0xff4400, 0, 20);
    engineLight.position.z = -0.2;
    afterburnerGroup.add(engineLight);
    
    missileGroup.add(afterburnerGroup);
    
    this.scene.scene.add(missileGroup);
    
    // Launch velocity
    const forward = new THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(this.mesh.quaternion);
    
    const heliVel = this.getVelocity();
    const launchVelocity = forward.multiplyScalar(40).add(heliVel); // Start slower
    
    missileBody.setLinvel({
      x: launchVelocity.x,
      y: launchVelocity.y,
      z: launchVelocity.z
    });
    
    // Copy helicopter rotation
    const rotation = this.body.rotation();
    missileBody.setRotation(rotation);
    
    // Missile guidance system
    const missile = {
      body: missileBody,
      mesh: missileGroup,
      collider: missileCollider,
      age: 0,
      maxAge: 2.0, // Total lifetime 2 seconds
      thrust: 0, // Start with no thrust
      motorIgnited: false,
      guidanceActive: true,
      hasExploded: false,
      afterburnerGroup: afterburnerGroup,
      flame: flame,
      innerFlame: innerFlame,
      glow: glow,
      engineLight: engineLight,
      exhaustParticles: []
    };
    
    const updateMissile = () => {
      if (!missile.body || missile.hasExploded) return;
      
      const pos = missile.body.translation();
      missile.mesh.position.set(pos.x, pos.y, pos.z);
      
      const rot = missile.body.rotation();
      missile.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      
      // Rocket motor ignition at 1 second
      if (!missile.motorIgnited && missile.age >= 1.0) {
        missile.motorIgnited = true;
        missile.thrust = 70; // Reduced from 100 - slightly less than plane missiles
        missile.afterburnerGroup.visible = true;
        
        // Apply ignition impulse
        const missileForward = new THREE.Vector3(0, 0, 1);
        missileForward.applyQuaternion(missile.mesh.quaternion);
        const ignitionImpulse = missileForward.multiplyScalar(12); // Reduced from 40 - gentler kick
        
        missile.body.applyImpulse({
          x: ignitionImpulse.x,
          y: ignitionImpulse.y,
          z: ignitionImpulse.z
        }, true);
        
        console.log('Missile rocket motor ignited!');
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
        missile.flame.scale.set(
          0.8 + pulseFactor * 0.2,
          1.2 + pulseFactor * 0.3,
          0.8 + pulseFactor * 0.2
        );
        
        missile.innerFlame.scale.set(
          0.6 + pulseFactor * 0.1,
          0.9 + pulseFactor * 0.2,
          0.6 + pulseFactor * 0.1
        );
        
        // Update glow
        missile.glow.scale.setScalar(1.0 + pulseFactor * 0.3);
        missile.glow.material.opacity = 0.6 + pulseFactor * 0.2;
        
        // Update engine light
        missile.engineLight.intensity = 4 + pulseFactor * 2;
        
        // Create exhaust particles
        if (Math.random() < 0.8) {
          const particleGeometry = new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 4, 4);
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
          const exhaustPos = new THREE.Vector3(0, 0, -0.6);
          exhaustPos.applyQuaternion(missile.mesh.quaternion);
          exhaustPos.add(missile.mesh.position);
          particle.position.copy(exhaustPos);
          
          // Exhaust velocity
          const exhaustVel = missileForward.clone().multiplyScalar(-12);
          exhaustVel.x += (Math.random() - 0.5) * 3;
          exhaustVel.y += (Math.random() - 0.5) * 3;
          
          particle.userData = {
            velocity: exhaustVel,
            age: 0,
            maxAge: 0.6
          };
          
          this.scene.scene.add(particle);
          missile.exhaustParticles.push(particle);
        }
      }
      
      // Update exhaust particles
      missile.exhaustParticles = missile.exhaustParticles.filter(particle => {
        particle.userData.age += 0.016;
        
        if (particle.userData.age > particle.userData.maxAge) {
          this.scene.scene.remove(particle);
          particle.geometry.dispose();
          particle.material.dispose();
          return false;
        }
        
        particle.position.add(particle.userData.velocity.clone().multiplyScalar(0.016));
        particle.userData.velocity.multiplyScalar(0.94); // Drag
        
        const fadeProgress = particle.userData.age / particle.userData.maxAge;
        particle.material.opacity = (1 - fadeProgress) * 0.7;
        particle.scale.multiplyScalar(1.03); // Expand
        
        return true;
      });
      
      // Simple guidance - adjust trajectory slightly toward gravity center for dramatic effect
      if (missile.guidanceActive && missile.motorIgnited) {
        const missilePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const gravityCenter = this.physics.gravity.center;
        const targetDir = new THREE.Vector3()
          .subVectors(gravityCenter, missilePos)
          .normalize();
        
        const missileForward = new THREE.Vector3(0, 0, 1);
        missileForward.applyQuaternion(missile.mesh.quaternion);
        const correction = targetDir.clone()
          .sub(missileForward)
          .multiplyScalar(0.08); // Slightly stronger guidance for helicopter missiles
        
        missile.body.addForce({
          x: correction.x * 15,
          y: correction.y * 15,
          z: correction.z * 15
        });
      }
      
      // Apply gravity
      this.physics.applyGravityToBody(missile.body, 0.016);
      
      missile.age += 0.016;
      
      // Check if missile should explode
      if (missile.age >= missile.maxAge && !missile.hasExploded) {
        missile.hasExploded = true;
        
        // Clean up exhaust particles
        missile.exhaustParticles.forEach(particle => {
          this.scene.scene.remove(particle);
          particle.geometry.dispose();
          particle.material.dispose();
        });
        
        // Create explosion at missile position
        const missilePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        this.pyrotechnics.createMissileExplosion(missilePos);
        
        // Remove missile
        this.scene.scene.remove(missile.mesh);
        missileGroup.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        
        // Remove physics body and collider
        if (missile.collider && this.physics.world) {
          this.physics.world.removeCollider(missile.collider, true);
        }
        if (missile.body && this.physics.world) {
          this.physics.world.removeRigidBody(missile.body);
        }
        
        console.log('Helicopter missile exploded!');
        return;
      }
      
      if (!missile.hasExploded) {
        requestAnimationFrame(updateMissile);
      }
    };
    
    updateMissile();
    
    this.rocketCooldown = 1.5; // Missiles have longer cooldown
    
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
}
