import * as THREE from 'three';
import { Ballistics } from './ballistics.js';
import { createPistolModel } from '../models/pistol.js';
import { createRifleModel } from '../models/rifle.js';
import { createShotgunModel } from '../models/shotgun.js';
import { createGrenadeLauncherModel } from '../models/grenadeLauncher.js';
import { createRocketLauncherModel } from '../models/rocketLauncher.js';
import { createSniperModel } from '../models/sniper.js';

export class WeaponSystem {
  constructor(scene, physics, player) {
    this.scene = scene;
    this.physics = physics;
    this.player = player;
    this.networkManager = null;
    
    // Current weapon state
    this.currentWeapon = null;
    this.isReloading = false;
    this.lastFireTime = 0;
    this.lastReloadStart = 0; // Add this for reload progress tracking
    
    // Initialize effects array
    this.effects = [];
    
    // Lock-on indicator components
    this.lockOnIndicator = null;
    this.lockProgressIndicator = null;
    this.targetBoxIndicator = null;
    this.trackingIndicator = null;
    
    // Target indicators for all vehicles
    this.targetIndicators = new Map();
    
    // Weapon definitions - removed hands
    this.weaponTypes = {
      pistol: {
        name: 'Pistol',
        model: null,
        damage: 25,
        fireRate: 300,
        range: 50,
        ammo: 12,
        maxAmmo: 12,
        recoil: 0.02,
        spread: 0.02,
        holdOffset: new THREE.Vector3(0.2, -0.15, -0.3),
        holdRotation: new THREE.Euler(0, Math.PI, 0),
        muzzleOffset: new THREE.Vector3(0, 0.05, -0.35)
      },
      rifle: {
        name: 'Rifle',
        model: null,
        damage: 35,
        fireRate: 600,
        range: 100,
        ammo: 30,
        maxAmmo: 30,
        recoil: 0.03,
        spread: 0.01,
        holdOffset: new THREE.Vector3(0.25, -0.2, -0.4),
        holdRotation: new THREE.Euler(0, Math.PI, 0),
        muzzleOffset: new THREE.Vector3(0, 0, -0.65)
      },
      shotgun: {
        name: 'Shotgun',
        model: null,
        damage: 80,
        fireRate: 60,
        range: 20,
        ammo: 8,
        maxAmmo: 8,
        recoil: 0.08,
        spread: 0.15,
        pellets: 8,
        holdOffset: new THREE.Vector3(0.25, -0.2, -0.4),
        holdRotation: new THREE.Euler(0, Math.PI, 0),
        muzzleOffset: new THREE.Vector3(0, 0, -0.65)
      },
      grenadeLauncher: {
        name: 'Grenade Launcher',
        model: null,
        damage: 150,
        fireRate: 60,
        range: 80,
        ammo: 6,
        maxAmmo: 6,
        recoil: 0.1,
        spread: 0.02,
        isExplosive: true,
        explosionRadius: 8,
        holdOffset: new THREE.Vector3(0.3, -0.25, -0.5),
        holdRotation: new THREE.Euler(0, Math.PI, 0),
        muzzleOffset: new THREE.Vector3(0, 0, -0.7)
      },
      rocketLauncher: {
        name: 'Rocket Launcher',
        model: null,
        damage: 200,
        fireRate: 30,
        range: 150,
        ammo: 4,
        maxAmmo: 4,
        recoil: 0.15,
        spread: 0.01,
        isExplosive: true,
        explosionRadius: 12,
        isHoming: true,
        holdOffset: new THREE.Vector3(0.35, -0.3, -0.6),
        holdRotation: new THREE.Euler(0, Math.PI, 0),
        muzzleOffset: new THREE.Vector3(0, 0, -0.8)
      },
      sniper: {
        name: 'Sniper Rifle',
        model: null,
        damage: 120,
        fireRate: 30,
        range: 300,
        ammo: 5,
        maxAmmo: 5,
        recoil: 0.2,
        spread: 0.001,
        holdOffset: new THREE.Vector3(0.3, -0.25, -0.7),
        holdRotation: new THREE.Euler(0, Math.PI, 0),
        muzzleOffset: new THREE.Vector3(0, 0, -0.9)
      }
    };
    
    // Player inventory - all slots start empty
    this.inventory = [
      null, // Slot 0
      null, // Slot 1
      null, // Slot 2
      null, // Slot 3
      null  // Slot 4
    ];
    
    this.currentSlot = -1; // No weapon selected initially
    this.currentWeapon = null;
    
    // Weapon view model
    this.weaponViewModel = null;
    this.viewModelGroup = new THREE.Group();
    this.scene.camera.add(this.viewModelGroup);
    
    // Third-person weapon model
    this.thirdPersonWeapon = null;
    this.thirdPersonWeaponGroup = new THREE.Group();
    
    // External weapon model (visible on player mesh)
    this.externalWeaponModel = null;
    this.externalWeaponOffset = new THREE.Vector3(0.3, -0.2, -0.4); // Offset from player center
    
    // Weapon pickups in world
    this.weaponPickups = new Map();
    
    // Add pickup cooldown to prevent immediate re-pickup
    this.pickupCooldowns = new Map(); // Track weapons that were just dropped
    
    // Shooting state
    this.lastFireTime = 0;
    this.isReloading = false;
    this.reloadStartTime = 0;
    this.reloadDuration = 2000; // 2 seconds
    
    // Muzzle flash
    this.muzzleFlash = null;
    this.muzzleFlashDuration = 50; // milliseconds
    
    // Projectiles/hit effects
    this.projectiles = [];
    this.hitEffects = [];
    
    // Create weapon models using the model files - load ALL models upfront
    this.loadWeaponModels();
    this.createMuzzleFlash();
    this.updateViewModel();
    
    // Add lock-on system state
    this.lockOnSystem = {
      target: null,
      targetVehicle: null,
      targetDistance: 0,
      lockProgress: 0,
      maxLockRange: 200,
      minLockTime: 1.0, // 1 second to lock
      lockCone: Math.PI / 8, // 22.5 degree cone
      isLocked: false,
      lastLockTime: 0,
      lockBreakTime: 2, // seconds before lock breaks without line of sight
    };
  }
  
  loadWeaponModels() {
    // Load ALL weapon models upfront - removed hands
    console.log('Loading all weapon models...');
    
    try {
      this.weaponTypes.pistol.model = createPistolModel();
      console.log('Pistol model loaded:', this.weaponTypes.pistol.model);
      
      this.weaponTypes.rifle.model = createRifleModel();
      console.log('Rifle model loaded:', this.weaponTypes.rifle.model);
      
      this.weaponTypes.shotgun.model = createShotgunModel();
      console.log('Shotgun model loaded:', this.weaponTypes.shotgun.model);
      
      this.weaponTypes.grenadeLauncher.model = createGrenadeLauncherModel();
      console.log('Grenade launcher model loaded:', this.weaponTypes.grenadeLauncher.model);
      
      this.weaponTypes.rocketLauncher.model = createRocketLauncherModel();
      console.log('Rocket launcher model loaded:', this.weaponTypes.rocketLauncher.model);
      
      this.weaponTypes.sniper.model = createSniperModel();
      console.log('Sniper rifle model loaded:', this.weaponTypes.sniper.model);
      
      console.log('All weapon models loaded successfully');
    } catch (error) {
      console.error('Error loading weapon models:', error);
    }
  }
  
  // Add method to load weapon model on-demand
  loadWeaponModelIfNeeded(weaponType) {
    if (!this.weaponTypes[weaponType]) return false;
    
    // If model is already loaded, return true
    if (this.weaponTypes[weaponType].model) return true;
    
    // Load the model on-demand
    switch(weaponType) {
      case 'pistol':
        this.weaponTypes.pistol.model = createPistolModel();
        console.log('Loaded pistol model on-demand');
        break;
      case 'rifle':
        this.weaponTypes.rifle.model = createRifleModel();
        console.log('Loaded rifle model on-demand');
        break;
      case 'shotgun':
        this.weaponTypes.shotgun.model = createShotgunModel();
        console.log('Loaded shotgun model on-demand');
        break;
      case 'grenadeLauncher':
        this.weaponTypes.grenadeLauncher.model = createGrenadeLauncherModel();
        console.log('Loaded grenade launcher model on-demand');
        break;
      case 'rocketLauncher':
        this.weaponTypes.rocketLauncher.model = createRocketLauncherModel();
        console.log('Loaded rocket launcher model on-demand');
        break;
      case 'sniper':
        this.weaponTypes.sniper.model = createSniperModel();
        console.log('Loaded sniper rifle model on-demand');
        break;
      default:
        return false;
    }
    
    return true;
  }

  createMuzzleFlash() {
    // Create a group to hold all muzzle flash elements
    this.muzzleFlash = new THREE.Group();
    this.muzzleFlash.visible = false;
    
    // Create multiple flash variations for randomization
    const flashVariations = [];
    
    // Variation 1: Star-burst pattern
    const flash1 = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const flashGeometry = new THREE.PlaneGeometry(0.6, 0.15);
      const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const flashPlane = new THREE.Mesh(flashGeometry, flashMaterial);
      flashPlane.rotation.z = (i / 4) * Math.PI;
      flash1.add(flashPlane);
    }
    flashVariations.push(flash1);
    
    // Variation 2: Cone-shaped flame
    const flash2 = new THREE.Group();
    const coneGeometry = new THREE.ConeGeometry(0.2, 0.8, 6);
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = 0.4;
    flash2.add(cone);
    
    // Add inner cone for depth
    const innerCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.6, 6),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      })
    );
    innerCone.rotation.x = -Math.PI / 2;
    innerCone.position.z = 0.3;
    flash2.add(innerCone);
    flashVariations.push(flash2);
    
    // Variation 3: Spherical burst
    const flash3 = new THREE.Group();
    const sphereGeometry = new THREE.SphereGeometry(0.3, 8, 6);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    flash3.add(sphere);
    
    // Add spikes
    const spikeGeometry = new THREE.ConeGeometry(0.05, 0.4, 4);
    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(spikeGeometry, sphereMaterial);
      const angle = (i / 6) * Math.PI * 2;
      spike.position.x = Math.cos(angle) * 0.2;
      spike.position.y = Math.sin(angle) * 0.2;
      spike.rotation.z = angle;
      flash3.add(spike);
    }
    flashVariations.push(flash3);
    
    // Store variations
    this.muzzleFlash.userData.variations = flashVariations;
    
    // Create muzzle flash light
    const muzzleLight = new THREE.PointLight(0xffaa00, 3, 10);
    muzzleLight.position.set(0, 0, 0);
    this.muzzleFlash.add(muzzleLight);
    this.muzzleFlash.userData.light = muzzleLight;
    
    // Add smoke particles
    const smokeGeometry = new THREE.SphereGeometry(0.1, 4, 4);
    const smokeMaterial = new THREE.MeshBasicMaterial({
      color: 0x666666,
      transparent: true,
      opacity: 0.3
    });
    for (let i = 0; i < 3; i++) {
      const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
      smoke.visible = false;
      this.muzzleFlash.add(smoke);
      this.muzzleFlash.userData[`smoke${i}`] = smoke;
    }
  }

  createTracer(startPos, endPos) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      startPos.x, startPos.y, startPos.z,
      endPos.x, endPos.y, endPos.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Make tracer more visible
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 3, // Note: linewidth > 1 only works on some platforms
      transparent: true,
      opacity: 1.0, // Start fully opaque
      blending: THREE.AdditiveBlending
    });
    
    const tracer = new THREE.Line(geometry, material);
    
    // Add glow effect
    const glowGeometry = new THREE.CylinderGeometry(0.05, 0.05, startPos.distanceTo(endPos));
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    
    // Position and orient the glow cylinder
    const midPoint = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    glowMesh.position.copy(midPoint);
    glowMesh.lookAt(endPos);
    glowMesh.rotateX(Math.PI / 2);
    
    // Add both to scene
    this.scene.scene.add(tracer);
    this.scene.scene.add(glowMesh);
    
    // Add to effects list
    this.effects.push({
      type: 'tracer',
      object: tracer,
      glowMesh: glowMesh,
      lifetime: 0,
      maxLifetime: 0.3 // Slightly longer visibility
    });
  }
  
  updateViewModel() {
    console.log(`updateViewModel called for weapon: ${this.currentWeapon?.type}`);
    
    // Store reference to current flashlight target before cleanup
    const oldFlashlightTarget = this.currentFlashlightTarget;
    
    // Clear the view model group children completely
    while (this.viewModelGroup.children.length > 0) {
      const child = this.viewModelGroup.children[0];
      this.viewModelGroup.remove(child);
      
      // Don't dispose of the weapon models themselves - they're reused
      // Only dispose of dynamically created objects like muzzle flash
      if (child === this.muzzleFlash) {
        child.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material && !obj.material.isShared) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
      }
    }
    
    // Clean up flashlight target if it exists
    if (oldFlashlightTarget && oldFlashlightTarget.parent) {
      oldFlashlightTarget.parent.remove(oldFlashlightTarget);
    }
    this.currentFlashlightTarget = null;
    
    // Reset the view model reference
    this.weaponViewModel = null;
    
    // Clear any existing muzzle flash reference
    this.muzzleFlash = null;
    
    // Don't show anything if no current weapon
    if (!this.currentWeapon) {
      console.log('No current weapon, clearing view model');
      this.updateWeaponVisibility();
      return;
    }
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    if (!weaponType) {
      console.log(`Invalid weapon type: ${this.currentWeapon.type}`);
      this.updateWeaponVisibility();
      return;
    }
    
    if (!weaponType.model) {
      console.error(`Missing model for weapon type: ${this.currentWeapon.type}`);
      console.log('Available weapon types:', Object.keys(this.weaponTypes));
      console.log('Weapon type object:', weaponType);
      this.updateWeaponVisibility();
      return;
    }
    
    console.log(`Creating view model for: ${this.currentWeapon.type}`, weaponType.model);
    
    // Clone the weapon model - all models are pre-loaded
    this.weaponViewModel = weaponType.model.clone();
    this.weaponViewModel.position.copy(weaponType.holdOffset);
    this.weaponViewModel.rotation.copy(weaponType.holdRotation);
    this.weaponViewModel.userData.weaponType = this.currentWeapon.type;
    
    // Add ONLY the current weapon model to viewModelGroup
    this.viewModelGroup.add(this.weaponViewModel);
    
    // Make sure the weapon view model is visible
    this.weaponViewModel.visible = true;
    this.weaponViewModel.traverse((child) => {
      if (child.isMesh) {
        child.visible = true;
        // Ensure materials are visible
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.visible = true;
              mat.opacity = mat.transparent ? mat.opacity : 1.0;
            });
          } else {
            child.material.visible = true;
            child.material.opacity = child.material.transparent ? child.material.opacity : 1.0;
          }
        }
      }
    });
    
    console.log(`Added ${this.currentWeapon.type} to viewModelGroup, children count: ${this.viewModelGroup.children.length}`);
    console.log('Weapon view model position:', this.weaponViewModel.position);
    console.log('Weapon view model visible:', this.weaponViewModel.visible);
    console.log('ViewModelGroup parent:', this.viewModelGroup.parent?.type || 'none');
    
    // Clear third-person weapon group before adding new weapon
    while (this.thirdPersonWeaponGroup.children.length > 0) {
      const child = this.thirdPersonWeaponGroup.children[0];
      this.thirdPersonWeaponGroup.remove(child);
    }
    
    // Create third-person weapon model
    console.log(`Creating third-person model for: ${this.currentWeapon.type}`);
    this.thirdPersonWeapon = weaponType.model.clone();
    // Position weapon in player's hand area for third-person
    this.thirdPersonWeapon.position.set(0.2, 0.3, -0.2);
    this.thirdPersonWeapon.rotation.set(0, Math.PI, 0);
    this.thirdPersonWeapon.scale.setScalar(0.8);
    
    // Handle flashlight for third-person shotgun model
    if (this.currentWeapon.type === 'shotgun') {
      let tpLight = null;
      let tpTarget = null;
      
      this.thirdPersonWeapon.traverse((child) => {
        if (child.isSpotLight) {
          tpLight = child;
        }
        // Find the target by checking position (the original target position was z: -5)
        if (child.isObject3D && !child.isMesh && !child.isLight && 
            Math.abs(child.position.z + 5) < 0.1) {
          tpTarget = child;
        }
      });
      
      if (tpLight && tpTarget) {
        // For third-person, adjust the target position because weapon is rotated 180 degrees
        tpTarget.position.set(-0.05, -0.03, 5); // Positive Z because weapon is rotated
        tpLight.target = tpTarget;
        // Add target to scene for proper lighting
        this.scene.scene.add(tpLight.target);
        
        this.thirdPersonWeapon.userData.flashlight = tpLight;
        this.thirdPersonWeapon.userData.flashlightTarget = tpTarget;
      }
    }
    
    this.thirdPersonWeaponGroup.add(this.thirdPersonWeapon);
    
    // Handle first-person shotgun flashlight
    if (this.currentWeapon.type === 'shotgun') {
      let fpLight = null;
      let fpTarget = null;
      
      this.weaponViewModel.traverse((child) => {
        if (child.isSpotLight) {
          fpLight = child;
        }
        // Find the target by checking position
        if (child.isObject3D && !child.isMesh && !child.isLight && 
            Math.abs(child.position.z + 5) < 0.1) {
          fpTarget = child;
        }
      });
      
      if (fpLight && fpTarget) {
        // For first-person, keep original target position
        fpLight.target = fpTarget;
        // Add target to scene for proper lighting
        this.scene.scene.add(fpLight.target);
        this.currentFlashlightTarget = fpTarget;
        
        this.weaponViewModel.userData.flashlight = fpLight;
        this.weaponViewModel.userData.flashlightTarget = fpTarget;
      }
    }
    
    // Add muzzle flash if weapon can shoot
    if (weaponType.muzzleOffset && weaponType.damage > 0) {
      // Re-create muzzle flash for this weapon
      this.createMuzzleFlash();
      
      // Position muzzle flash at the weapon's muzzle position
      this.muzzleFlash.position.copy(weaponType.muzzleOffset);
      
      // Don't make flash face camera here - it will be oriented with the weapon
      
      this.weaponViewModel.add(this.muzzleFlash);
    }
    
    // Create external weapon model
    this.createExternalWeaponModel(weaponType);
    
    // Update visibility based on current camera mode
    this.updateWeaponVisibility();
    
    console.log(`View model update complete. Current weapon: ${this.currentWeapon.type}`);
  }

  createExternalWeaponModel(weaponDef) {
    // Remove previous external model
    if (this.externalWeaponModel) {
      if (this.externalWeaponModel.parent) {
        this.externalWeaponModel.parent.remove(this.externalWeaponModel);
      }
      if (this.externalWeaponModel.geometry) this.externalWeaponModel.geometry.dispose();
      if (this.externalWeaponModel.material) this.externalWeaponModel.material.dispose();
      this.externalWeaponModel = null;
    }
    
    // Create simplified weapon model for external view based on weapon type
    let geometry;
    let scale = new THREE.Vector3(1, 1, 1);
    
    switch(weaponDef.name) {
      case 'Pistol':
        geometry = new THREE.BoxGeometry(0.15, 0.2, 0.4);
        break;
      case 'Rifle':
        geometry = new THREE.BoxGeometry(0.1, 0.15, 0.8);
        break;
      case 'Shotgun':
        geometry = new THREE.BoxGeometry(0.12, 0.18, 0.6);
        break;
      case 'Grenade Launcher':
        geometry = new THREE.BoxGeometry(0.14, 0.16, 0.5);
        break;
      case 'Rocket Launcher':
        geometry = new THREE.BoxGeometry(0.16, 0.18, 0.7);
        break;
      case 'Sniper Rifle':
        geometry = new THREE.BoxGeometry(0.1, 0.12, 0.9);
        break;
      default:
        // Fallback to a basic box
        geometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: weaponDef.color || 0x444444,
      roughness: 0.7,
      metalness: 0.3
    });
    
    this.externalWeaponModel = new THREE.Mesh(geometry, material);
    
    // Apply weapon scale if specified
    if (weaponDef.scale) {
      this.externalWeaponModel.scale.copy(weaponDef.scale);
    }
    
    // Attach to player mesh
    if (this.player.mesh) {
      this.player.mesh.add(this.externalWeaponModel);
      
      // Position at player's side/front
      this.externalWeaponModel.position.copy(this.externalWeaponOffset);
      
      // Rotate to point forward
      this.externalWeaponModel.rotation.set(0, Math.PI / 2, 0);
    }
    
    this.externalWeaponModel.visible = true;
    this.externalWeaponModel.castShadow = true;
    this.externalWeaponModel.receiveShadow = true;
  }

  updateWeaponVisibility() {
    // Check if third-person camera is active
    const isThirdPerson = this.player.tpController && this.player.tpController.isActive;
    
    // Check if player is in a vehicle
    const isInVehicle = this.player.isInVehicle;
    
    // Debug log current state
    // console.log(`updateWeaponVisibility: thirdPerson=${isThirdPerson}, inVehicle=${isInVehicle}, currentWeapon=${this.currentWeapon?.type}`);
    
    // Hide all weapon models when in vehicle
    if (isInVehicle) {
      this.viewModelGroup.visible = false;
      this.thirdPersonWeaponGroup.visible = false;
      if (this.externalWeaponModel) {
        this.externalWeaponModel.visible = false;
      }
      // console.log('In vehicle - hiding all weapons');
      return;
    }
    
    // First-person view model visibility
    // Show viewmodel in first-person mode when we have a current weapon
    const shouldShowFirstPerson = !isThirdPerson && this.currentWeapon !== null;
    this.viewModelGroup.visible = shouldShowFirstPerson;
    
    // Debug camera attachment
    if (this.viewModelGroup.parent !== this.scene.camera) {
      console.warn('ViewModelGroup is not attached to camera! Reattaching...');
      this.scene.camera.add(this.viewModelGroup);
    }
    
    // Force update camera matrices to ensure children render
    this.scene.camera.updateMatrix();
    this.scene.camera.updateMatrixWorld(true);
    
    console.log(`ViewModelGroup visible: ${this.viewModelGroup.visible}, contains ${this.viewModelGroup.children.length} children`);
    
    // Log details about the weapon view model
    if (this.weaponViewModel) {
      console.log(`Weapon view model (${this.currentWeapon.type}) visible:`, this.weaponViewModel.visible);
      console.log('Weapon view model position:', this.weaponViewModel.position.toArray());
      console.log('Weapon view model world position:', (() => {
        const worldPos = new THREE.Vector3();
        this.weaponViewModel.getWorldPosition(worldPos);
        return worldPos.toArray();
      })());
      
      // Make sure the weapon model itself is visible
      this.weaponViewModel.visible = true;
      
      // Force visibility on all meshes
      this.weaponViewModel.traverse((child) => {
        if (child.isMesh) {
          child.visible = true;
          child.frustumCulled = false; // Disable frustum culling to ensure visibility
        }
      });
    }
    
    // Third-person weapon visibility
    // Only show in third-person mode when we have a weapon
    this.thirdPersonWeaponGroup.visible = isThirdPerson && this.currentWeapon !== null;
    
    // External weapon model visibility
    // Only show external weapon model when in third-person mode
    if (this.externalWeaponModel) {
      const shouldShowExternal = isThirdPerson && this.currentWeapon !== null;
      this.externalWeaponModel.visible = shouldShowExternal;
      
      console.log(`External weapon model visible: ${shouldShowExternal} (thirdPerson: ${isThirdPerson}, weapon: ${this.currentWeapon?.type})`);
    }
    
    // Handle third-person group attachment
    if (isThirdPerson && this.thirdPersonWeaponGroup.children.length > 0 && this.player.mesh) {
      // For weapons in third-person, attach and show
      if (!this.thirdPersonWeaponGroup.parent) {
        this.player.mesh.add(this.thirdPersonWeaponGroup);
      }
    }
  }

  spawnWeaponPickup(type, position) {
    if (!this.weaponTypes[type]) return null;
    
    const pickupId = 'pickup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create pickup visual
    const pickupGroup = new THREE.Group();
    
    // Clone weapon model (already loaded)
    const weaponModel = this.weaponTypes[type].model.clone();
    weaponModel.scale.setScalar(1.5);
    pickupGroup.add(weaponModel);
    
    // Add floating animation
    pickupGroup.position.copy(position);
    pickupGroup.position.y += 0.5; // Float above ground
    
    // Add glow effect
    const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    pickupGroup.add(glow);
    
    this.scene.scene.add(pickupGroup);
    
    // Create physics trigger
    const body = this.physics.createKinematicBody(position);
    const colliderDesc = this.physics.createBoxCollider(
      new THREE.Vector3(0.5, 0.5, 0.5),
      {
        isSensor: true,
        friction: 0,
        restitution: 0
      }
    );
    colliderDesc.setSensor(true);
    const collider = this.physics.world.createCollider(colliderDesc, body);
    
    // Store pickup data
    const pickupData = {
      id: pickupId,
      type: type,
      mesh: pickupGroup,
      body: body,
      collider: collider,
      position: position.clone(),
      rotation: 0,
      bobOffset: 0
    };
    
    this.weaponPickups.set(pickupId, pickupData);
    
    // Store reference on mesh for interaction
    pickupGroup.userData.weaponPickup = pickupData;
    pickupGroup.userData.interactable = true;
    pickupGroup.userData.interactionType = 'weapon';
    
    console.log(`Spawned ${type} pickup at`, position);
    
    return pickupData;
  }
  
  checkPickupCollisions() {
    if (!this.player || !this.player.body) return;
    
    const playerPos = this.player.getPosition();
    
    this.weaponPickups.forEach((pickup, id) => {
      const distance = playerPos.distanceTo(pickup.position);
      if (distance < 2.0) // Pickup range
        this.pickupWeapon(id);
    });
  }
  
  update(deltaTime) {
    // Update lock-on system if we have rocket launcher equipped
    if (this.currentWeapon && this.currentWeapon.type === 'rocketLauncher') {
      this.updateLockOnSystem(deltaTime);
    }
    
    // Update weapon visibility based on camera mode
    this.updateWeaponVisibility();
    
    // Update reload
    if (this.isReloading) {
      const reloadProgress = (Date.now() - this.reloadStartTime) / this.reloadDuration;
      if (reloadProgress >= 1.0) {
        // Reload complete
        this.currentWeapon.ammo = this.weaponTypes[this.currentWeapon.type].maxAmmo;
        this.isReloading = false;
      }
    }
    
    // Auto-fire for automatic weapons
    if (this.isFiring && this.currentWeapon.automatic && !this.isReloading) {
      this.fire();
    }
    
    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      
      // Skip rockets - they handle their own updates
      if (projectile.type === 'rocket') {
        continue;
      }
      
      // Check for collisions using physics wrapper's cast methods
      if (projectile.body && projectile.collider && this.physics.world.bodies.contains(projectile.body.handle)) {
        // Use the physics wrapper's castShape method if available, or use a simple raycast
        const pos = projectile.body.translation();
        const projectilePos = new THREE.Vector3(pos.x, pos.y, pos.z);
        
        // Cast a short ray in the direction of movement to detect collisions
        const vel = projectile.body.linvel();
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
        
        if (speed > 0.1) {
          const direction = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
          const hitInfo = this.physics.castRay(
            projectilePos,
            direction,
            0.5, // Short detection distance
            projectile.colliderHandle
          );
          
          if (hitInfo && hitInfo.toi !== undefined && hitInfo.colliderHandle !== this.player.colliderHandle) {
            // Hit something - explode
            if (projectile.isExplosive) {
              this.createExplosion(projectilePos, projectile);
            } else {
              // Non-explosive hit effect
              this.createHitEffect(projectilePos, new THREE.Vector3(0, 1, 0));
            }
            
            this.removeProjectile(projectile);
          }
        }
      }
    }
    
    // Update visual effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.lifetime += deltaTime;
      
      if (effect.lifetime >= effect.maxLifetime) {
        // Remove expired effect
        this.scene.scene.remove(effect.object);
        if (effect.glowMesh) {
          this.scene.scene.remove(effect.glowMesh);
        }
        this.effects.splice(i, 1);
      } else {
        // Update effect (fade out, etc.)
        const progress = effect.lifetime / effect.maxLifetime;
        if (effect.object.material) {
          effect.object.material.opacity = 1.0 - progress;
        }
        if (effect.glowMesh && effect.glowMesh.material) {
          effect.glowMesh.material.opacity = 0.6 * (1.0 - progress);
        }
      }
    }
    
    // Update pickup cooldowns - remove expired ones
    const now = Date.now();
    const cooldownDuration = 2000; // 2 seconds
    
    for (const [pickupId, dropTime] of this.pickupCooldowns) {
      if (now - dropTime > cooldownDuration) {
        this.pickupCooldowns.delete(pickupId);
      }
    }
    
    // Update pickups - collect IDs to pick up after iteration to avoid modifying map during iteration
    const pickupsToCollect = [];
    const playerPos = this.player.getPosition();
    
    this.weaponPickups.forEach((pickup, id) => {
      // Check distance to player
      const distance = playerPos.distanceTo(pickup.position);
      
      // Auto-pickup if close enough
      if (distance < 2.0 && !this.pickupCooldowns.has(id)) {
        pickupsToCollect.push(id);
      }
      
      // Update floating animation
      pickup.rotation += deltaTime;
      pickup.bobOffset += deltaTime * 2;
      
      if (pickup.mesh) {
        pickup.mesh.rotation.y = pickup.rotation;
        pickup.mesh.position.y = pickup.position.y + 0.5 + Math.sin(pickup.bobOffset) * 0.2;
      }
    });
    
    // Now pick up the weapons outside of the forEach loop
    for (const pickupId of pickupsToCollect) {
      this.pickupWeapon(pickupId);
    }
  }
  
  getHUDInfo() {
    if (!this.currentWeapon) return null;
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    return {
      weaponName: weaponType.name,
      currentAmmo: this.currentWeapon.ammo,
      maxAmmo: weaponType.maxAmmo || 0,
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 
        (Date.now() - this.reloadStartTime) / this.reloadDuration : 0
    };
  }
  
   
  updatePickups(deltaTime) {
    this.weaponPickups.forEach(pickup => {
      // Rotate pickup
      pickup.rotation += deltaTime * 2;
      pickup.mesh.rotation.y = pickup.rotation;
      
      // Bob up and down
      pickup.bobOffset += deltaTime * 3;
      pickup.mesh.position.y = pickup.position.y + 0.5 + Math.sin(pickup.bobOffset) * 0.1;
    });
  }
  
  pickupWeapon(pickupId) {
    const pickup = this.weaponPickups.get(pickupId);
    if (!pickup) {
      console.log(`Pickup ${pickupId} not found`);
      return false;
    }
    
    console.log(`Attempting to pickup weapon: ${pickup.type}`);
    
    // Check if this pickup is on cooldown (was just dropped)
    if (this.pickupCooldowns.has(pickupId)) {
      console.log(`Pickup ${pickupId} is on cooldown`);
      return false;
    }
    
    // Find empty slot or replace current weapon
    let slotIndex = -1;
    
    // Check for empty slots first
    for (let i = 0; i < this.inventory.length; i++) {
      if (!this.inventory[i]) {
        slotIndex = i;
        break;
      }
    }
    
    // If no empty slot and we have a current weapon, replace it
    if (slotIndex === -1 && this.currentSlot >= 0) {
      slotIndex = this.currentSlot;
      
      // Drop current weapon before replacing
      if (this.inventory[slotIndex]) {
        const dropPos = this.player.getPosition().clone();
        
        // Add offset to drop position to avoid immediate re-pickup
        const playerFacing = this.player.getFacing();
        dropPos.add(playerFacing.multiplyScalar(3)); // Drop 3 units in front
        dropPos.y += 1;
        
        const droppedPickup = this.spawnWeaponPickup(this.inventory[slotIndex].type, dropPos);
        
        // Add cooldown for the dropped weapon
        if (droppedPickup) {
          this.pickupCooldowns.set(droppedPickup.id, Date.now());
        }
      }
    }
    
    // If still no slot available, use slot 0
    if (slotIndex === -1) {
      slotIndex = 0;
    }
    
    console.log(`Adding ${pickup.type} to slot ${slotIndex}`);
    
    // Add weapon to inventory with full ammo
    this.inventory[slotIndex] = {
      type: pickup.type,
      ammo: this.weaponTypes[pickup.type].maxAmmo || this.weaponTypes[pickup.type].ammo
    };
    
    // Remove pickup from world
    this.removePickup(pickupId);
    
    // Switch to picked up weapon immediately
    const switchSuccess = this.switchToSlot(slotIndex);
    
    console.log(`Picked up ${pickup.type} in slot ${slotIndex}, switch success: ${switchSuccess}`);
    console.log('Current weapon after pickup:', this.currentWeapon?.type);
    console.log('Inventory:', this.inventory.map((w, i) => `${i}: ${w ? w.type : 'empty'}`));
    
    return true;
  }
  
  removePickup(pickupId) {
    const pickup = this.weaponPickups.get(pickupId);
    if (!pickup) return;
    
    // Remove visual
    this.scene.scene.remove(pickup.mesh);
    pickup.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    
    // Remove physics
    if (this.physics.world && pickup.body) {
      if (pickup.collider) {
        this.physics.world.removeCollider(pickup.collider, true);
      }
      this.physics.world.removeRigidBody(pickup.body);
    }
    
    this.weaponPickups.delete(pickupId);
  }
  
  switchToSlot(slot) {
    if (slot < 0 || slot >= this.inventory.length) {
      console.log(`Invalid slot: ${slot}`);
      return false;
    }
    if (!this.inventory[slot]) {
      console.log(`No weapon in slot: ${slot}`);
      return false;
    }
    
    // Check if we're already on this slot
    if (this.currentSlot === slot && this.currentWeapon === this.inventory[slot]) {
      console.log(`Already on slot ${slot} with weapon ${this.currentWeapon.type}`);
      return true;
    }
    
    // Cancel reload if switching weapons
    this.isReloading = false;
    
    // Update current weapon
    this.currentSlot = slot;
    this.currentWeapon = this.inventory[slot];
    
    console.log(`Switching to slot ${slot}: ${this.currentWeapon.type}`);
    console.log('Current inventory:', this.inventory.map(w => w ? w.type : 'empty'));
    
    // Force complete view model update
    this.updateViewModel();
    
    console.log(`Switched to ${this.currentWeapon.type} (slot ${slot})`);
    return true;
  }
  
  fire() {
    if (!this.currentWeapon || this.isReloading) return false;
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    
    // Check fire rate
    const now = Date.now();
    const fireDelay = 60000 / weaponType.fireRate; // Convert RPM to ms between shots
    if (now - this.lastFireTime < fireDelay) return false;
    
    // Check ammo
    if (this.currentWeapon.ammo <= 0) {
      console.log('Out of ammo!');
      // Auto reload if we have ammo
      this.reload();
      return false;
    }
    
    // Decrease ammo
    this.currentWeapon.ammo--;
    this.lastFireTime = now;
    
    // Show muzzle flash (only in first-person mode)
    const isThirdPerson = this.player.tpController && this.player.tpController.isActive;
    if (!isThirdPerson) {
      this.showMuzzleFlash();
    }
    
    // Fire projectile(s)
    if (weaponType.pellets) {
      // Shotgun - fire multiple pellets
      for (let i = 0; i < weaponType.pellets; i++) {
        this.fireProjectile(weaponType);
      }
    } else {
      // Single projectile
      this.fireProjectile(weaponType);
    }
    
    // Apply recoil (only in first-person mode)
    if (this.player && weaponType.recoil && !isThirdPerson) {
      this.player.cameraRotation.x -= weaponType.recoil;
    }
    
    console.log(`Fired ${weaponType.name}! Ammo: ${this.currentWeapon.ammo}/${weaponType.maxAmmo}`);
    return true;
  }
  
  fireProjectile(weaponType) {
    // Use the weaponType parameter if provided, otherwise use current weapon
    const weapon = weaponType || this.weaponTypes[this.currentWeapon.type];
    
    // For rocket launcher with physics-based movement
    if (weapon.name === 'Rocket Launcher' && weapon.isHoming) {
      // Get actual muzzle position in world space
      const muzzleWorldPos = this.getMuzzleWorldPosition();
      const hasLockedTarget = this.lockOnSystem.isLocked && this.lockOnSystem.targetVehicle;
      
      // Get launch direction from camera
      const camera = this.scene.camera;
      const cameraWorldDir = new THREE.Vector3();
      camera.getWorldDirection(cameraWorldDir);
      cameraWorldDir.normalize();
      
      console.log('Firing rocket launcher, locked:', hasLockedTarget);
      console.log('Muzzle position:', muzzleWorldPos);
      console.log('Launch direction:', cameraWorldDir);
      
      // Create rocket projectile with helicopter-style physics
      const projectile = {
        type: 'rocket',
        weapon: this.currentWeapon.type,
        position: muzzleWorldPos.clone(),
        velocity: cameraWorldDir.clone().multiplyScalar(40), // Increased initial velocity
        direction: cameraWorldDir.clone(),
        damage: weapon.damage,
        isExplosive: true,
        explosionRadius: weapon.explosionRadius,
        mesh: null,
        body: null,
        trail: null,
        startTime: Date.now(),
        owner: this.player,
        lockedTarget: hasLockedTarget ? this.lockOnSystem.targetVehicle : null,
        guidanceActive: hasLockedTarget,
        speed: 40, // Initial speed
        maxSpeed: 120, // Higher maximum speed
        acceleration: 60, // Higher acceleration rate
        turnRate: 6.0, // Higher turn rate for better tracking
        hasDetonated: false,
        lifetime: 15000, // 15 seconds
        proximityFuseRange: 4.0, // Smaller proximity fuse
        lastCollisionCheck: Date.now(),
        thrustForce: 80, // Higher thrust force
        navigationGain: 5 // Proportional navigation gain
      };
      
      // Create rocket mesh (similar to helicopter missile)
      const rocketGeometry = new THREE.CylinderGeometry(0.08, 0.12, 0.6, 8);
      const rocketMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.8,
        roughness: 0.2
      });
      projectile.mesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
      projectile.mesh.position.copy(muzzleWorldPos);
      
      // Orient rocket to face launch direction
      projectile.mesh.lookAt(muzzleWorldPos.clone().add(cameraWorldDir));
      projectile.mesh.rotateX(Math.PI / 2);
      
      // Add glowing tip
      const tipGeometry = new THREE.SphereGeometry(0.12, 6, 4);
      const tipMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        emissive: 0xff4400,
        emissiveIntensity: 1.5
      });
      const tip = new THREE.Mesh(tipGeometry, tipMaterial);
      tip.position.y = 0.3;
      projectile.mesh.add(tip);
      
      this.scene.scene.add(projectile.mesh);
      
      // Create physics body - use DYNAMIC for realistic physics (like helicopter)
      projectile.body = this.physics.createDynamicBody(muzzleWorldPos, {
        linearDamping: 0.05, // Very low damping for missiles
        angularDamping: 0.3,
        gravityScale: 1.0, // Enable gravity
        rotation: {
          x: projectile.mesh.quaternion.x,
          y: projectile.mesh.quaternion.y,
          z: projectile.mesh.quaternion.z,
          w: projectile.mesh.quaternion.w
        }
      });
      
      // Create collider with proper collision filtering
      const colliderDesc = this.physics.createBallCollider(0.15, {
        density: 0.3,
        friction: 0.0,
        restitution: 0.0
      });
      
      // Set collision groups to avoid self-collision with player and launcher
      // Use a unique group for projectiles that doesn't collide with player
      const PROJECTILE_GROUP = 0x00020000; // Projectile collision group
      const PLAYER_GROUP = 0x00010000; // Player collision group (assumed)
      const EVERYTHING_BUT_PLAYER = 0xffffffff ^ PLAYER_GROUP; // Collide with everything except player
      
      colliderDesc.setCollisionGroups(PROJECTILE_GROUP);
      colliderDesc.setSolverGroups(PROJECTILE_GROUP);
      colliderDesc.setActiveCollisionTypes(EVERYTHING_BUT_PLAYER);
      
      projectile.collider = this.physics.world.createCollider(colliderDesc, projectile.body);
      projectile.colliderHandle = projectile.collider.handle;
      
      // Store player's collider handle to ignore in collision checks
      projectile.ownerColliderHandle = this.player.colliderHandle;
      
      // Add glowing trail effect
      const trailGeometry = new THREE.ConeGeometry(0.2, 1.5, 8);
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      projectile.trail = new THREE.Mesh(trailGeometry, trailMaterial);
      this.scene.scene.add(projectile.trail);
      
      // Add to projectiles array
      this.projectiles.push(projectile);
      
      // Store reference to this for use in updateRocket
      const weaponSystem = this;
      
      // Get gravity vector for missile physics
      const playerPos = this.player.getPosition();
      const gravityDir = new THREE.Vector3()
        .subVectors(this.physics.gravity.center, playerPos)
        .normalize();
      const gravityVector = gravityDir.multiplyScalar(this.physics.gravity.strength);
      
      // Update loop for rocket - physics-based with thrust (like helicopter missiles)
      const updateRocket = () => {
        if (!projectile.body || !weaponSystem.physics.world.bodies.contains(projectile.body.handle)) {
          weaponSystem.removeProjectile(projectile);
          return;
        }
        
        // Get current physics body state BEFORE updating
        const bodyPos = projectile.body.translation();
        const bodyVel = projectile.body.linvel();
        
        // Update projectile's stored position directly from physics
        projectile.position.set(bodyPos.x, bodyPos.y, bodyPos.z);
        projectile.velocity.set(bodyVel.x, bodyVel.y, bodyVel.z);
        
        // Log position at regular intervals to debug
        const elapsed = (Date.now() - projectile.startTime) / 1000;
        if (elapsed < 0.5 && Math.floor(elapsed * 10) % 2 === 0) {
          console.log('Rocket position:', projectile.position.toArray());
          console.log('Rocket velocity:', projectile.velocity.length().toFixed(2));
        }
        
        // Apply gravity manually if needed (though dynamic bodies should handle this)
        const playerPos = weaponSystem.player.getPosition();
        const gravityDir = new THREE.Vector3()
          .subVectors(weaponSystem.physics.gravity.center, playerPos)
          .normalize();
        const gravityVector = gravityDir.multiplyScalar(weaponSystem.physics.gravity.strength);
        
        // Use Ballistics system for physics-based update
        const shouldContinue = Ballistics.updatePhysicsBasedMissile(
          projectile, 
          weaponSystem.physics, 
          0.016, // 60fps deltaTime
          gravityVector
        );
        
        if (!shouldContinue) {
          if (!projectile.hasDetonated) {
            weaponSystem.createExplosion(projectile.position, projectile);
            projectile.hasDetonated = true;
          }
          weaponSystem.removeProjectile(projectile);
          return;
        }
        
        // Check for collisions manually, ignoring owner
        const hit = weaponSystem.physics.castRay(
          projectile.position,
          projectile.velocity.clone().normalize(),
          0.5, // Short cast distance
          [projectile.colliderHandle, projectile.ownerColliderHandle] // Ignore self and owner
        );
        
        if (hit && hit.toi < 0.5) {
          // Hit something
          if (!projectile.hasDetonated) {
            weaponSystem.createExplosion(projectile.position, projectile);
            projectile.hasDetonated = true;
          }
          weaponSystem.removeProjectile(projectile);
          return;
        }
        
        // IMPORTANT: Directly update mesh position from the physics body
        // Don't use the projectile.position which might not be updated correctly
        const currentPos = projectile.body.translation();
        projectile.mesh.position.set(currentPos.x, currentPos.y, currentPos.z);
        
        // Update rotation to face velocity direction
        const vel = projectile.body.linvel();
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
        
        if (speed > 0.1) {
          // Create direction vector from velocity
          const direction = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
          
          // Make the rocket mesh look in the direction of travel
          const lookTarget = new THREE.Vector3(
            currentPos.x + direction.x,
            currentPos.y + direction.y, 
            currentPos.z + direction.z
          );
          projectile.mesh.lookAt(lookTarget);
          projectile.mesh.rotateX(Math.PI / 2);
        }
        
        // Update trail position and orientation
        if (projectile.trail) {
          const trailPos = new THREE.Vector3(currentPos.x, currentPos.y, currentPos.z);
          // Position trail behind rocket
          if (speed > 0.1) {
            const direction = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
            trailPos.sub(direction.multiplyScalar(0.8));
          }
          projectile.trail.position.copy(trailPos);
          projectile.trail.lookAt(projectile.mesh.position);
          projectile.trail.rotateX(Math.PI / 2);
        }
        
        // Continue update loop
        requestAnimationFrame(updateRocket);
      };
      
      // Make sure we apply a strong initial impulse to get it moving
      projectile.body.applyImpulse({
        x: projectile.velocity.x * 0.3,
        y: projectile.velocity.y * 0.3,
        z: projectile.velocity.z * 0.3
      });
      
      // Start the update loop
      updateRocket();
      
      return;
    }
    
    // Get camera position and direction for accurate shooting
    const camera = this.scene.camera;
    const cameraWorldPos = new THREE.Vector3();
    const cameraWorldDir = new THREE.Vector3();
    
    // Get camera world position
    camera.getWorldPosition(cameraWorldPos);
    
    // Get camera forward direction in world space
    camera.getWorldDirection(cameraWorldDir);
    cameraWorldDir.normalize();
    
    // Start ray from camera position (center of screen/crosshair)
    const startPos = cameraWorldPos.clone();
    const direction = cameraWorldDir.clone();
    
    // Add spread if applicable
    const spread = weapon.spread || 0;
    if (spread > 0) {
      const spreadX = (Math.random() - 0.5) * spread;
      const spreadY = (Math.random() - 0.5) * spread;
      
      // Create perpendicular vectors for spread
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      
      // Get camera's right and up vectors
      camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
      
      // Apply spread
      direction.add(right.multiplyScalar(spreadX));
      direction.add(up.multiplyScalar(spreadY));
      direction.normalize();
    }
    
    // Calculate gravity compensation for ballistic trajectory
    const maxDistance = weapon.range || 100;
    const muzzleVelocity = weapon.muzzleVelocity || 300; // m/s
    
    // Get gravity vector
    const playerPos = this.player.getPosition();
    const gravityDir = new THREE.Vector3()
      .subVectors(this.physics.gravity.center, playerPos)
      .normalize();
    const gravityVector = gravityDir.multiplyScalar(this.physics.gravity.strength);
    
    // Calculate trajectory with gravity compensation
    const trajectory = Ballistics.calculateBulletTrajectory(
      startPos,
      direction,
      muzzleVelocity,
      gravityVector,
      maxDistance
    );
    
    // Use compensated direction for more realistic ballistics
    const compensatedDir = trajectory.compensatedDirection;
    
    // Perform raycast with compensated direction
    const hit = this.physics.castRay(
      startPos,
      compensatedDir,
      maxDistance,
      this.player.colliderHandle
    );
    
    if (hit && hit.toi !== undefined) {
      console.log('Weapon hit at distance:', hit.toi);
      
      // Calculate hit point
      const hitPoint = startPos.clone().add(compensatedDir.clone().multiplyScalar(hit.toi));
      
      // Get actual muzzle position in world space
      const muzzleWorldPos = this.getMuzzleWorldPosition();
      this.createTracer(muzzleWorldPos, hitPoint);
      
      // Create hit effect with valid normal
      const hitNormal = hit.normal ? 
        new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z) : 
        new THREE.Vector3(0, 1, 0);
      this.createHitEffect(hitPoint, hitNormal);
      
      // Apply damage if hitting a player or destructible
      if (hit.collider) {
        // Handle damage if hitting a player or destructible
      }
    } else {
      // No hit - fire into distance
      const endPoint = startPos.clone().add(compensatedDir.clone().multiplyScalar(maxDistance));
      const muzzleWorldPos = this.getMuzzleWorldPosition();
      this.createTracer(muzzleWorldPos, endPoint);
    }
  }
  
  showMuzzleFlash() {
    if (!this.muzzleFlash) return;
    
    // Clear previous variation
    this.muzzleFlash.children.forEach(child => {
      if (child.userData.isVariation) {
        this.muzzleFlash.remove(child);
      }
    });
    
    // Select random variation
    const variations = this.muzzleFlash.userData.variations;
    if (variations && variations.length > 0) {
      const randomIndex = Math.floor(Math.random() * variations.length);
      const selectedVariation = variations[randomIndex].clone();
      selectedVariation.userData.isVariation = true;
      
      // Randomize scale and rotation
      const scale = 0.8 + Math.random() * 0.4;
      selectedVariation.scale.set(scale, scale, scale);
      selectedVariation.rotation.z = Math.random() * Math.PI * 2;
      
      this.muzzleFlash.add(selectedVariation);
    }
    
    this.muzzleFlash.visible = true;
    
    // Orient muzzle flash to face camera for billboard effect
    const cameraPos = new THREE.Vector3();
    this.scene.camera.getWorldPosition(cameraPos);
    
    const muzzlePos = new THREE.Vector3();
    this.muzzleFlash.getWorldPosition(muzzlePos);
    
    // Calculate look direction in world space
    const lookDir = new THREE.Vector3().subVectors(cameraPos, muzzlePos);
    
    // Convert to local space of muzzle flash parent
    if (this.muzzleFlash.parent) {
      const parentMatrixInv = new THREE.Matrix4().copy(this.muzzleFlash.parent.matrixWorld).invert();
      lookDir.applyMatrix4(parentMatrixInv);
      lookDir.add(this.muzzleFlash.position);
    }
    
    this.muzzleFlash.lookAt(lookDir);
    
    // Flash the light with random intensity
    const light = this.muzzleFlash.userData.light;
    if (light) {
      light.intensity = 2 + Math.random() * 2; // Random intensity between 2 and 4
      light.color.setHex(Math.random() > 0.5 ? 0xffaa00 : 0xffff00); // Vary between orange and yellow
    }
    
    // Animate smoke particles
    for (let i = 0; i < 3; i++) {
      const smoke = this.muzzleFlash.userData[`smoke${i}`];
      if (smoke) {
        smoke.visible = true;
        smoke.position.set(
          (Math.random() - 0.5) * 0.2,
          (Math.random() - 0.5) * 0.2,
          Math.random() * 0.3
        );
        smoke.scale.setScalar(0.1);
        smoke.material.opacity = 0.3;
      }
    }
    
    // Animate the flash
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / this.muzzleFlashDuration;
      
      if (progress >= 1) {
        this.muzzleFlash.visible = false;
        return;
      }
      
      // Fade out light
      if (light) {
        light.intensity = (2 + Math.random() * 2) * (1 - progress);
      }
      
      // Animate smoke
      for (let i = 0; i < 3; i++) {
        const smoke = this.muzzleFlash.userData[`smoke${i}`];
        if (smoke) {
          smoke.position.z += 0.02;
          smoke.scale.multiplyScalar(1.05);
          smoke.material.opacity = 0.3 * (1 - progress);
        }
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }
  
  createHitEffect(hitPoint, hitNormal) {
    // Check if hitPoint is valid
    if (!hitPoint || typeof hitPoint.x === 'undefined') {
      console.warn('Invalid hit point for hit effect');
      return;
    }
    
    // Create hit particles
    const particleCount = 10;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 4, 4),
        new THREE.MeshBasicMaterial({ 
          color: 0xffaa00
        })
      );
      
      // Position at hit point
      particle.position.copy(hitPoint);
      
      // Random velocity away from surface
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      
      // Add normal influence if provided
      if (hitNormal && typeof hitNormal.x !== 'undefined') {
        velocity.add(hitNormal.clone().multiplyScalar(Math.random() * 2));
      }
      
      particle.userData.velocity = velocity;
      particle.userData.lifetime = 0;
      particles.add(particle);
    }
    
    this.scene.scene.add(particles);
    this.effects.push({
      type: 'hit',
      object: particles,
      lifetime: 0,
      maxLifetime: 0.5
    });
  }
  
  reload() {
    if (this.isReloading || !this.currentWeapon) return;
    if (this.currentWeapon.currentAmmo === this.currentWeapon.maxAmmo) return;
    
    this.isReloading = true;
    this.lastReloadStart = Date.now(); // Track when reload started
    
    setTimeout(() => {
      if (this.currentWeapon) {
        this.currentWeapon.currentAmmo = this.currentWeapon.maxAmmo;
        this.isReloading = false;
      }
    }, this.currentWeapon.reloadTime);
  }

  createLockOnIndicator() {
    console.log('Creating lock-on indicators...');
    
    // Main lock indicator (diamond shape)
    const lockGeometry = new THREE.RingGeometry(2, 2.2, 4);
    lockGeometry.rotateZ(Math.PI / 4); // Rotate to make diamond
    const lockMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    this.lockOnIndicator = new THREE.Mesh(lockGeometry, lockMaterial);
    this.lockOnIndicator.renderOrder = 999; // Render on top
    this.scene.scene.add(this.lockOnIndicator);
    
    // Lock progress indicator (circular)
    const progressGeometry = new THREE.RingGeometry(2.5, 2.7, 32);
    const progressMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    this.lockProgressIndicator = new THREE.Mesh(progressGeometry, progressMaterial);
    this.lockProgressIndicator.renderOrder = 998;
    this.scene.scene.add(this.lockProgressIndicator);
    
    // Target box indicator
    const boxGeometry = new THREE.BoxGeometry(4, 4, 4);
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const boxMaterial = new THREE.LineBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false
    });
    this.targetBoxIndicator = new THREE.LineSegments(edges, boxMaterial);
    this.targetBoxIndicator.renderOrder = 997;
    this.scene.scene.add(this.targetBoxIndicator);
    
    // Tracking crosshair
    const trackingGroup = new THREE.Group();
    
    // Create crosshair lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false
    });
    
    // Horizontal line
    const hLineGeometry = new THREE.BufferGeometry();
    hLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -3, 0, 0,
      -1, 0, 0,
      1, 0, 0,
      3, 0, 0
    ], 3));
    const hLine = new THREE.LineSegments(hLineGeometry, lineMaterial);
    trackingGroup.add(hLine);
    
    // Vertical line
    const vLineGeometry = new THREE.BufferGeometry();
    vLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, -3, 0,
      0, -1, 0,
      0, 1, 0,
      0, 3, 0
    ], 3));
    const vLine = new THREE.LineSegments(vLineGeometry, lineMaterial);
    trackingGroup.add(vLine);
    
    this.trackingIndicator = trackingGroup;
    this.trackingIndicator.renderOrder = 996;
    this.scene.scene.add(this.trackingIndicator);
    
    // Hide all initially
    this.lockOnIndicator.visible = false;
    this.lockProgressIndicator.visible = false;
    this.targetBoxIndicator.visible = false;
    this.trackingIndicator.visible = false;
    
    console.log('Lock-on indicators created');
  }
  
  updateLockOnIndicator(lockData) {
    if (!lockData || !lockData.hasTarget || !lockData.targetPosition) {
      // Hide all indicators when no target
      if (this.lockOnIndicator) this.lockOnIndicator.visible = false;
      if (this.lockProgressIndicator) this.lockProgressIndicator.visible = false;
      if (this.targetBoxIndicator) this.targetBoxIndicator.visible = false;
      if (this.trackingIndicator) this.trackingIndicator.visible = false;
      return;
    }
    
    // Ensure indicators exist
    if (!this.lockOnIndicator || !this.lockProgressIndicator || !this.targetBoxIndicator || !this.trackingIndicator) {
      console.warn('Lock-on indicators not initialized, creating them now');
      this.createLockOnIndicator();
    }
    
    // Get camera and target positions
    const targetPos = lockData.targetPosition.clone();
    const cameraPos = this.scene.camera.position.clone();
    
    // Convert to world space if camera has parent
    if (this.scene.camera.parent) {
      this.scene.camera.parent.localToWorld(cameraPos);
    }
    
    // Calculate distance for scaling
    const distance = cameraPos.distanceTo(targetPos);
    const scale = Math.max(distance * 0.02, 1); // Scale based on distance
    
    // Update all indicators to target position
    this.lockOnIndicator.position.copy(targetPos);
    this.lockProgressIndicator.position.copy(targetPos);
    this.targetBoxIndicator.position.copy(targetPos);
    this.trackingIndicator.position.copy(targetPos);
    
    // Make indicators face camera
    this.lockOnIndicator.lookAt(cameraPos);
    this.lockProgressIndicator.lookAt(cameraPos);
    this.trackingIndicator.lookAt(cameraPos);
    
    // Scale indicators based on distance
    this.lockOnIndicator.scale.setScalar(scale);
    this.lockProgressIndicator.scale.setScalar(scale);
    this.targetBoxIndicator.scale.setScalar(scale * 0.5); // Box should be smaller
    this.trackingIndicator.scale.setScalar(scale);
    
    // Show appropriate indicators based on lock state
    if (lockData.lockProgress < 1) {
      // Tracking phase - show tracking crosshairs and progress
      this.trackingIndicator.visible = true;
      this.lockProgressIndicator.visible = lockData.lockProgress > 0;
      this.lockOnIndicator.visible = false;
      this.targetBoxIndicator.visible = false;
      
      // Update lock progress ring
      if (lockData.lockProgress > 0) {
        const angle = lockData.lockProgress * Math.PI * 2;
        
        // Recreate geometry with current progress
        this.lockProgressIndicator.geometry.dispose();
        const progressGeometry = new THREE.RingGeometry(2.5, 2.7, 32, 1, 0, angle);
        this.lockProgressIndicator.geometry = progressGeometry;
        
        // Update color based on progress
        const color = new THREE.Color().lerpColors(
          new THREE.Color(0xffff00),
          new THREE.Color(0xff0000),
          lockData.lockProgress
        );
        this.lockProgressIndicator.material.color = color;
        
        // Flash tracking indicator while locking
        const flash = Math.sin(Date.now() * 0.01) * 0.4 + 0.4;
        this.trackingIndicator.children.forEach(child => {
          child.material.opacity = 0.4 + flash * 0.4;
        });
      }
    } else {
      // Locked phase - show lock indicator and target box
      this.lockOnIndicator.visible = true;
      this.targetBoxIndicator.visible = true;
      this.trackingIndicator.visible = false;
      this.lockProgressIndicator.visible = false;
      
      // Solid red lock indicator
      this.lockOnIndicator.material.color.setHex(0xff0000);
      this.lockOnIndicator.material.opacity = 0.9;
      
      // Pulsing effect for locked state
      const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 0.9;
      this.lockOnIndicator.scale.setScalar(scale * pulse);
      
      // Rotate lock indicator
      this.lockOnIndicator.rotation.z = Date.now() * 0.001;
      
      // Animate target box
      const boxPulse = Math.sin(Date.now() * 0.003) * 0.2 + 1.0;
      this.targetBoxIndicator.scale.setScalar(scale * 0.5 * boxPulse);
      this.targetBoxIndicator.rotation.y = Date.now() * 0.0005;
      
      // Flash target box color
      const colorFlash = Math.sin(Date.now() * 0.008) * 0.5 + 0.5;
      this.targetBoxIndicator.material.color.setRGB(1, colorFlash, 0);
    }
    
    // Add distance text (optional)
    if (lockData.targetDistance && this.scene.HUD) {
      // Update HUD with target distance
      const distanceText = `Target: ${Math.round(lockData.targetDistance)}m`;
      // This would need to be implemented in your HUD system
    }
  }
  
  updateAllTargetIndicators(allTargets, lockData) {
    // Create/update indicators for all targets
    const seenTargets = new Set();
    
    allTargets.forEach(target => {
      const key = target.id || `${target.type}_${target.position.x}_${target.position.z}`;
      seenTargets.add(key);
      
      // Get or create indicator for this target
      let indicator = this.targetIndicators.get(key);
      if (!indicator) {
        indicator = this.createTargetIndicator();
        this.targetIndicators.set(key, indicator);
      }
      
      // Update indicator position
      indicator.group.position.copy(target.position);
      indicator.group.visible = true;
      
      // Calculate distance for scaling
      const cameraPos = this.scene.camera.position.clone();
      if (this.scene.camera.parent) {
        this.scene.camera.parent.localToWorld(cameraPos);
      }
      const distance = cameraPos.distanceTo(target.position);
      const scale = Math.max(distance * 0.015, 0.5);
      indicator.group.scale.setScalar(scale);
      
      // SIMPLIFIED: Orange = locked, white = not in cone
      const isLockedTarget = lockData.targetPosition && 
                           target.position.distanceTo(lockData.targetPosition) < 0.1;
      
      if (isLockedTarget && lockData.isLocked) {
        // === LOCKED TARGET - ORANGE WITH STRONG ANIMATIONS ===
        indicator.diamond.material.color.setHex(0xff8800);
        indicator.diamond.material.emissive.setHex(0xff4400);
        indicator.diamond.material.emissiveIntensity = 1.0;
        indicator.diamond.material.opacity = 1.0;
        indicator.diamond.visible = true;
        indicator.box.visible = true;
        indicator.box.material.color.setHex(0xff8800);
        
        // Strong pulsing animation for locked state
        const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 1.0;
        indicator.group.scale.setScalar(scale * pulse);
        indicator.diamond.rotation.z = Date.now() * 0.002;
        
        // Flash the box
        const boxPulse = Math.sin(Date.now() * 0.01) * 0.4 + 1.0;
        indicator.box.scale.setScalar(boxPulse);
        
        // Hide progress ring - no need for it with instant lock
        if (indicator.progressRing) {
          indicator.progressRing.visible = false;
        }
        
      } else if (target.inLockCone) {
        // === IN LOCK CONE (POTENTIAL TARGET) - YELLOW ===
        indicator.diamond.material.color.setHex(0xffff00);
        indicator.diamond.material.emissive.setHex(0x888800);
        indicator.diamond.material.emissiveIntensity = 0.5;
        indicator.diamond.material.opacity = 0.8;
        indicator.diamond.visible = true;
        indicator.box.visible = false;
        
        // Subtle pulse
        const pulse = Math.sin(Date.now() * 0.005) * 0.1 + 1.0;
        indicator.diamond.scale.setScalar(pulse);
        
        if (indicator.progressRing) {
          indicator.progressRing.visible = false;
        }
        
      } else {
        // === NOT IN LOCK CONE - WHITE/GRAY ===
        indicator.diamond.material.color.setHex(0xcccccc);
        indicator.diamond.material.emissive.setHex(0x222222);
        indicator.diamond.material.emissiveIntensity = 0.1;
        indicator.diamond.material.opacity = 0.4;
        indicator.diamond.visible = true;
        indicator.box.visible = false;
        
        if (indicator.progressRing) {
          indicator.progressRing.visible = false;
        }
      }
      
      // Make indicator face camera
      indicator.group.lookAt(cameraPos);
    });
    
    // Remove indicators for targets that no longer exist
    this.targetIndicators.forEach((indicator, key) => {
      if (!seenTargets.has(key)) {
        this.scene.scene.remove(indicator.group);
               indicator.group.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.targetIndicators.delete(key);
      }
    });
  }
  
  createTargetIndicator() {
    const group = new THREE.Group();
    group.renderOrder = 999;
    
    // Diamond shape indicator - USE MeshStandardMaterial for emissive properties
    const diamondGeometry = new THREE.RingGeometry(2, 2.2, 4);
    diamondGeometry.rotateZ(Math.PI / 4);
    const diamondMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x222222,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false

    });
    const diamond = new THREE.Mesh(diamondGeometry, diamondMaterial);
    group.add(diamond);
    
    // Target box indicator
    const boxGeometry = new THREE.BoxGeometry(4, 4, 4);
    const edges = new THREE.EdgesGeometry(boxGeometry);
    const boxMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false
    });
    const box = new THREE.LineSegments(edges, boxMaterial);
    box.visible = false;
    group.add(box);
    
    this.scene.scene.add(group);
    
    return {
      group: group,
      diamond: diamond,
      box: box,
      progressRing: null
    };
  }
  
  clear() {
    // Remove all pickups
    this.weaponPickups.forEach((pickup, id) => {
      this.removePickup(id);
    });
    this.weaponPickups.clear();
    
    // Clear lock-on indicators
    if (this.lockOnIndicator) {
      this.scene.scene.remove(this.lockOnIndicator);
      this.lockOnIndicator.geometry.dispose();
      this.lockOnIndicator.material.dispose();
    }
    if (this.lockProgressIndicator) {
           this.scene.scene.remove(this.lockProgressIndicator);
      this.lockProgressIndicator.geometry.dispose();
      this.lockProgressIndicator.material.dispose();
    }
    if (this.targetBoxIndicator) {
      this.scene.scene.remove(this.targetBoxIndicator);
      this.targetBoxIndicator.geometry.dispose();
      this.targetBoxIndicator.material.dispose();
    }
    if (this.trackingIndicator) {
      this.scene.scene.remove(this.trackingIndicator);
      this.trackingIndicator.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    
    // Clear view model
    this.viewModelGroup.clear();
    
    // Clear third-person weapon
    if (this.thirdPersonWeaponGroup.parent) {
      this.thirdPersonWeaponGroup.parent.remove(this.thirdPersonWeaponGroup);
    }
    this.thirdPersonWeaponGroup.clear();
    
    // Clean up any lingering spotlight targets
    if (this.currentFlashlightTarget) {
      this.scene.scene.remove(this.currentFlashlightTarget);
      this.currentFlashlightTarget = null;
    }
    
    // Clean up external weapon model
    if (this.externalWeaponModel) {
      if (this.externalWeaponModel.parent) {
        this.externalWeaponModel.parent.remove(this.externalWeaponModel);
      }
      if (this.externalWeaponModel.geometry) this.externalWeaponModel.geometry.dispose();
      if (this.externalWeaponModel.material) this.externalWeaponModel.material.dispose();
      this.externalWeaponModel = null;
    }
    
    // Clear effects
    this.hitEffects.forEach(effect => {
      effect.particles.forEach(particle => {
        this.scene.scene.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
      });
    });
    this.hitEffects = [];
    
    // Reset inventory to empty state
    this.inventory = [
      null, // Slot 0: Empty
      null, // Slot 1: Empty
      null, // Slot 2: Empty
      null, // Slot 3: Empty
      null  // Slot 4: Empty
    ];
    this.currentSlot = -1;
    this.currentWeapon = null;
    
    // Update view model to show nothing
    this.updateViewModel();
    
    // Clear cooldowns
    this.pickupCooldowns.clear();
    
    // Clear all target indicators
    this.targetIndicators.forEach((indicator, key) => {
      this.scene.scene.remove(indicator.group);
      indicator.group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    });
    this.targetIndicators.clear();
  }
  
  setVisible(visible) {
    // FPS weapon visibility (only visible in first-person)
    if (this.viewModelGroup) {
      this.viewModelGroup.visible = visible;
    }
    
    // External weapon model is always visible when player is visible
    // It shows what weapon the player is holding for others to see
    if (this.externalWeaponModel) {
      this.externalWeaponModel.visible = true;
    }
  }

  switchWeapon(weaponType) {
    // All models are pre-loaded, no need to check loading
    // Find the weapon in inventory
    let slotIndex = -1;
    
    for (let i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i] && this.inventory[i].type === weaponType) {
        slotIndex = i;
        break;
      }
    }
    
    // If weapon not in inventory, try to add it
    if (slotIndex === -1) {
      console.log(`Weapon ${weaponType} not found in inventory, attempting to add`);
      
      // Check for empty slots first
      for (let i = 1; i < this.inventory.length; i++) {
        if (!this.inventory[i]) {
          slotIndex = i;
          break;
        }
      }
    }
    
    // If slotIndex is still -1, it means inventory is full
    if (slotIndex === -1) {
      console.log('No available slots to switch weapon');
      return false;
    }
    
    // Switch to the weapon in the found slot
    return this.switchToSlot(slotIndex);
  }
  
  getWeaponWorldPosition() {
    // Get weapon muzzle position in world space
    const isThirdPerson = this.player.tpController && this.player.tpController.isActive;
    
    if (isThirdPerson && this.thirdPersonWeapon) {
      // Use third-person weapon position
      const worldPos = new THREE.Vector3();
      this.thirdPersonWeapon.getWorldPosition(worldPos);
      return worldPos;
    } else if (this.weaponViewModel) {
      // Use first-person weapon position
      const worldPos = new THREE.Vector3();
      this.weaponViewModel.getWorldPosition(worldPos);
      return worldPos;
    } else {
      // Fallback to camera position
      const worldPos = new THREE.Vector3();
      this.scene.camera.getWorldPosition(worldPos);
      return worldPos;
    }
  }
  
  getMuzzleWorldPosition() {
    const isThirdPerson = this.player.tpController && this.player.tpController.isActive;
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    
    if (isThirdPerson && this.thirdPersonWeapon) {
      // For third-person, calculate muzzle position from weapon model
      const worldPos = new THREE.Vector3();
      const muzzleOffset = weaponType.muzzleOffset || new THREE.Vector3(0, 0, -0.5);
      
      // Apply muzzle offset in weapon's local space
      const localMuzzle = muzzleOffset.clone();
      this.thirdPersonWeapon.localToWorld(localMuzzle);
      
      return localMuzzle;
    } else if (this.weaponViewModel && this.muzzleFlash) {
      // For first-person, get the muzzle flash world position
      const worldPos = new THREE.Vector3();
      this.muzzleFlash.getWorldPosition(worldPos);
      return worldPos;
    } else {
      // Fallback to camera position with slight offset
      const worldPos = new THREE.Vector3();
      this.scene.camera.getWorldPosition(worldPos);
      
      // Add a small forward offset
      const forward = new THREE.Vector3();
      this.scene.camera.getWorldDirection(forward);
      worldPos.add(forward.multiplyScalar(0.5));
      
      return worldPos;
    }
  }
  
  updateLockOnSystem(deltaTime) {
    if (!this.player || !this.scene.scene) return;
    
    const position = this.player.getPosition();
    
    // Get forward direction from player's camera rotation
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.player.mesh.quaternion);
    forward.normalize();
    
    // Find all vehicles and potential lock targets
    let closestTarget = null;
    let closestDistance = this.lockOnSystem.maxLockRange;
    const allTargets = [];
    
    // Get all registered vehicles from scene
    const potentialTargets = [];
    
    // Use the vehicle registry if available
    if (this.scene.vehicles && this.scene.vehicles instanceof Map) {
      this.scene.vehicles.forEach((vehicle, id) => {
        if (vehicle && vehicle.getPosition) {
          potentialTargets.push({
            controller: vehicle,
            type: vehicle.constructor.name.toLowerCase().replace('controller', ''),
            id: id
          });
        }
      });
    }
    
    // Also check dynamic objects for vehicles
    if (this.scene.dynamicObjects && this.scene.dynamicObjects instanceof Map) {
      this.scene.dynamicObjects.forEach((obj, id) => {
        if (obj.controller && obj.controller.getPosition && !potentialTargets.find(t => t.id === id)) {
          potentialTargets.push({
            controller: obj.controller,
            type: obj.type,
            id: id
          });
        }
      });
    }
    
    // Process all targets
    potentialTargets.forEach(target => {
      if (!target.controller.getPosition) return;
      
      const targetPos = target.controller.getPosition();
      const toTarget = targetPos.clone().sub(position);
      const distance = toTarget.length();
      
      if (distance > this.lockOnSystem.maxLockRange) return;
      
      const angle = forward.angleTo(toTarget.normalize());
      const inCone = angle <= this.lockOnSystem.lockCone;
      
      // Check if target has active chaff (helicopters only)
      let isJammed = false;
      if (target.type === 'helicopter' && target.controller.isChaffActive) {
        isJammed = target.controller.isChaffActive();
      }
      
      // Add to all targets list for HUD
      allTargets.push({
        position: targetPos,
        distance: distance,
        inLockCone: inCone && !isJammed,
        type: target.type,
        id: target.id,
        controller: target.controller,
        isJammed: isJammed
      });
      
      // Check if this is the closest target in cone (and not jammed)
      if (inCone && !isJammed && distance < closestDistance) {
        closestTarget = {
          vehicle: target.controller,
          position: targetPos,
          distance: distance,
          type: target.type,
          id: target.id
        };
        closestDistance = distance;
      }
    });
    
    // Update lock state
    const previousLockState = this.lockOnSystem.isLocked;
    const previousTargetId = this.lockOnSystem.target ? this.lockOnSystem.target.id : null;
    
    if (closestTarget) {
      if (this.lockOnSystem.target && this.lockOnSystem.target.id === closestTarget.id) {
        // Continue locking onto same target
        this.lockOnSystem.lockProgress = Math.min(
          this.lockOnSystem.lockProgress + deltaTime / this.lockOnSystem.minLockTime,
          1.0
        );
        
        if (this.lockOnSystem.lockProgress >= 1.0) {
          this.lockOnSystem.isLocked = true;
          this.lockOnSystem.lastLockTime = Date.now();
        }
        
        // Update target position as it moves
        this.lockOnSystem.target.position = closestTarget.position;
        this.lockOnSystem.targetDistance = closestTarget.distance;
      } else {
        // New target, start locking
        this.lockOnSystem.target = closestTarget;
        this.lockOnSystem.targetVehicle = closestTarget.vehicle;
        this.lockOnSystem.targetDistance = closestTarget.distance;
        this.lockOnSystem.lockProgress = 0;
        this.lockOnSystem.isLocked = false;
      }
    } else {
      // No target, break lock
      this.lockOnSystem.target = null;
      this.lockOnSystem.targetVehicle = null;
      this.lockOnSystem.targetDistance = 0;
      this.lockOnSystem.lockProgress = 0;
      this.lockOnSystem.isLocked = false;
    }
    
    // Send lock-on update to network if state changed
    if (this.networkManager && (
      previousLockState !== this.lockOnSystem.isLocked ||
      previousTargetId !== (this.lockOnSystem.target ? this.lockOnSystem.target.id : null)
    )) {
      this.networkManager.sendLockOnUpdate({
        hasTarget: this.lockOnSystem.target !== null,
        targetId: this.lockOnSystem.target ? this.lockOnSystem.target.id : null,
        isLocked: this.lockOnSystem.isLocked,
        lockProgress: this.lockOnSystem.lockProgress
      });
    }
    
    // Update lock-on indicators
    this.updateLockOnIndicator({
      hasTarget: this.lockOnSystem.target !== null,
      isLocked: this.lockOnSystem.isLocked,
      lockProgress: this.lockOnSystem.lockProgress,
      targetDistance: this.lockOnSystem.targetDistance,
      targetPosition: this.lockOnSystem.target ? this.lockOnSystem.target.position : null
    });
    
    // Update all target indicators
    this.updateAllTargetIndicators(allTargets, {
      hasTarget: this.lockOnSystem.target !== null,
      isLocked: this.lockOnSystem.isLocked,
      lockProgress: this.lockOnSystem.lockProgress,
      targetDistance: this.lockOnSystem.targetDistance,
      targetPosition: this.lockOnSystem.target ? this.lockOnSystem.target.position : null
    });
  }
  
  // Add method to handle network lock-on updates from other players
  handleNetworkLockOn(playerId, lockData) {
    // Create or update lock indicators for other players
    if (!this.otherPlayersLockOns) {
      this.otherPlayersLockOns = new Map();
    }
    
    if (lockData.hasTarget && lockData.targetId) {
      // Find the target vehicle
      let targetController = null;
      let targetPosition = null;
      
      // Check vehicles
      if (this.scene.vehicles && this.scene.vehicles.has(lockData.targetId)) {
        targetController = this.scene.vehicles.get(lockData.targetId);
        if (targetController && targetController.getPosition) {
          targetPosition = targetController.getPosition();
        }
      }
      
      // Check dynamic objects
      if (!targetController && this.scene.dynamicObjects && this.scene.dynamicObjects.has(lockData.targetId)) {
        const obj = this.scene.dynamicObjects.get(lockData.targetId);
        if (obj.controller && obj.controller.getPosition) {
          targetController = obj.controller;
          targetPosition = obj.controller.getPosition();
        }
      }
      
      if (targetPosition) {
        // Get or create indicator for this player
        let indicator = this.otherPlayersLockOns.get(playerId);
        if (!indicator) {
          indicator = this.createNetworkLockIndicator();
          this.otherPlayersLockOns.set(playerId, indicator);
        }
        
        // Update indicator
        this.updateNetworkLockIndicator(indicator, {
          targetPosition: targetPosition,
          isLocked: lockData.isLocked,
          lockProgress: lockData.lockProgress,
          targetId: lockData.targetId
        });
      }
    } else {
      // Remove lock indicator for this player
      const indicator = this.otherPlayersLockOns.get(playerId);
      if (indicator) {
        this.removeNetworkLockIndicator(indicator);
        this.otherPlayersLockOns.delete(playerId);
      }
    }
  }
  
  createNetworkLockIndicator() {
    const group = new THREE.Group();
    group.renderOrder = 998;
    
    // Create a different style indicator for other players
    const lockGeometry = new THREE.RingGeometry(1.8, 2.0, 4);
    lockGeometry.rotateZ(Math.PI / 4);
    const lockMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8800, // Orange for other players
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    const lockMesh = new THREE.Mesh(lockGeometry, lockMaterial);
    group.add(lockMesh);
    
    // Progress ring
    const progressGeometry = new THREE.RingGeometry(2.3, 2.5, 32);
    const progressMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });
    const progressMesh = new THREE.Mesh(progressGeometry, progressMaterial);
    group.add(progressMesh);
    
    this.scene.scene.add(group);
    
    return {
      group: group,
      lockMesh: lockMesh,
      progressMesh: progressMesh
    };
  }
  
  updateNetworkLockIndicator(indicator, data) {
    if (!indicator || !data.targetPosition) return;
    
    // Update position to follow target
    indicator.group.position.copy(data.targetPosition);
    
    // Face camera
    const cameraPos = this.scene.camera.position.clone();
    if (this.scene.camera.parent) {
      this.scene.camera.parent.localToWorld(cameraPos);
    }
    indicator.group.lookAt(cameraPos);
    
    // Scale based on distance
    const distance = cameraPos.distanceTo(data.targetPosition);
    const scale = Math.max(distance * 0.015, 0.5);
    indicator.group.scale.setScalar(scale);
    
    // Update visual state
    indicator.group.visible = true;
    
    if (data.isLocked) {
      // Locked state - solid orange
      indicator.lockMesh.material.color.setHex(0xff4400);
      indicator.lockMesh.material.opacity = 0.8;
      indicator.progressMesh.visible = false;
      
      // Pulse effect
      const pulse = Math.sin(Date.now() * 0.004) * 0.1 + 0.9;
      indicator.lockMesh.scale.setScalar(pulse);
    } else {
      // Locking state - show progress
      indicator.lockMesh.material.color.setHex(0xff8800);
      indicator.lockMesh.material.opacity = 0.5;
      indicator.progressMesh.visible = true;
      indicator.progressMesh.material.opacity = data.lockProgress * 0.6;
    }
  }
  
  removeNetworkLockIndicator(indicator) {
    if (indicator && indicator.group) {
      this.scene.scene.remove(indicator.group);
      indicator.group.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
  }

  createExplosion(position, projectile) {
    console.log('Creating explosion at position:', position);
    
    if (!this.scene.pyrotechnics) {
      console.error('Pyrotechnics system not available');
      return;
    }
    
    // Create visual explosion effect - use missile explosion for rockets
    if (projectile.type === 'rocket') {
      this.scene.pyrotechnics.createMissileExplosion(position);
    } else {
      this.scene.pyrotechnics.createExplosion(position, {
        size: projectile.explosionRadius || 8,
        duration: 1.0,
        particleCount: 30
      });
    }
    
    // Deal damage in radius
    const explosionRadius = projectile.explosionRadius || 12;
    
    // Apply explosion force to nearby physics objects
    if (this.physics.world && this.scene.dynamicObjects) {
      // Get all bodies in range and apply explosion force
      this.scene.dynamicObjects.forEach((obj, id) => {
        if (obj.body && obj.mesh) {
          const objPos = obj.mesh.position;
          const distance = objPos.distanceTo(position);
          
          if (distance < explosionRadius) {
            // Calculate explosion force
            const force = objPos.clone().sub(position).normalize();
            const strength = (1 - distance / explosionRadius) * 1500;
            force.multiplyScalar(strength);
            
            // Apply impulse to dynamic bodies
            if (obj.body.isDynamic && obj.body.isDynamic()) {
              obj.body.applyImpulse({
                x: force.x,
                y: force.y,
                z: force.z
              }); // No second parameter for applyImpulse
            }
          }
        }
      });
      
      // Also check vehicles
      if (this.scene.vehicles) {
        this.scene.vehicles.forEach((vehicle, id) => {
          const vehiclePos = vehicle.getPosition();
          const distance = vehiclePos.distanceTo(position);
          
          if (distance < explosionRadius) {
            // Apply explosion force to vehicle
            const force = vehiclePos.clone().sub(position).normalize();
            const strength = (1 - distance / explosionRadius) * 2500;
            force.multiplyScalar(strength);
            
            // Add upward component
            force.y += Math.abs(force.y) * 0.5;
            
            if (vehicle.chassisBody) {
              vehicle.chassisBody.applyImpulse({
                x: force.x,
                y: force.y,
                z: force.z
              });
            } else if (vehicle.body) {
              vehicle.body.applyImpulse({
                x: force.x,
                y: force.y,
                z: force.z
              });
            }
          }
        });
      }
    }
    
    // Play explosion sound if available
    if (this.scene.audioSystem) {
      this.scene.audioSystem.playExplosion(position);
    }
    
    console.log('Explosion created with radius:', explosionRadius);
  }

  removeProjectile(projectile) {
    // Remove from projectiles array
    const index = this.projectiles.indexOf(projectile);
    if (index > -1) {
      this.projectiles.splice(index, 1);
    }
    
    // Clean up visual elements
    if (projectile.mesh) {
      this.scene.scene.remove(projectile.mesh);
      if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
      if (projectile.mesh.material) projectile.mesh.material.dispose();
    }
    
    if (projectile.trail) {
      this.scene.scene.remove(projectile.trail);
      if (projectile.trail.geometry) projectile.trail.geometry.dispose();
      if (projectile.trail.material) projectile.trail.material.dispose();
    }
    
    // Remove physics body and collider
    if (projectile.body && this.physics.world) {
      if (projectile.collider) {
        this.physics.world.removeCollider(projectile.collider, true);
      }
      this.physics.world.removeRigidBody(projectile.body);
    }
    
    console.log('Projectile removed');
  }
}
