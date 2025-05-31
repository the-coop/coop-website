import * as THREE from 'three';

export class WeaponSystem {
  constructor(scene, physics, player) {
    this.scene = scene;
    this.physics = physics;
    this.player = player;
    
    // Initialize effects array
    this.effects = [];
    
    // Weapon definitions
    this.weaponTypes = {
      hands: {
        name: 'Hands',
        model: null,
        damage: 0,
        fireRate: 0,
        range: 2,
        ammo: Infinity,
        holdOffset: new THREE.Vector3(0.3, -0.2, -0.4),
        holdRotation: new THREE.Euler(0, 0, 0)
      },
      pistol: {
        name: 'Pistol',
        model: null,
        damage: 25,
        fireRate: 300, // rounds per minute
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
      }
    };
    
    // Player inventory
    this.inventory = [
      { type: 'hands', ammo: Infinity },
      null, // slot 1
      null  // slot 2
    ];
    
    this.currentSlot = 0;
    this.currentWeapon = this.inventory[0];
    
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
    
    // Create weapon models
    this.createWeaponModels();
    this.createMuzzleFlash();
    this.updateViewModel();
  }
  
  createWeaponModels() {
    // Create simple hand model
    const handGeometry = new THREE.BoxGeometry(0.1, 0.2, 0.1);
    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffdbac,
      roughness: 0.8,
      metalness: 0
    });
    
    const leftHand = new THREE.Mesh(handGeometry, skinMaterial);
    const rightHand = new THREE.Mesh(handGeometry, skinMaterial);
    rightHand.position.x = 0.3;
    
    const handsGroup = new THREE.Group();
    handsGroup.add(leftHand);
    handsGroup.add(rightHand);
    this.weaponTypes.hands.model = handsGroup;
    
    // Create pistol model
    const pistolGroup = new THREE.Group();
    
    // Grip
    const gripGeometry = new THREE.BoxGeometry(0.05, 0.15, 0.1);
    const gunMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.3,
      metalness: 0.7
    });
    const grip = new THREE.Mesh(gripGeometry, gunMaterial);
    pistolGroup.add(grip);
    
    // Barrel
    const barrelGeometry = new THREE.BoxGeometry(0.04, 0.04, 0.2);
    const barrel = new THREE.Mesh(barrelGeometry, gunMaterial);
    barrel.position.set(0, 0.05, -0.15);
    pistolGroup.add(barrel);
    
    // Trigger guard
    const guardGeometry = new THREE.TorusGeometry(0.03, 0.005, 4, 8, Math.PI);
    const guard = new THREE.Mesh(guardGeometry, gunMaterial);
    guard.position.set(0, -0.03, -0.02);
    guard.rotation.z = Math.PI;
    pistolGroup.add(guard);
    
    // Add laser sight to pistol
    const laserSightGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.1);
    const laserSightMaterial = new THREE.MeshStandardMaterial({
      color: 0x000000,
      roughness: 0.2,
      metalness: 0.8
    });
    const laserSight = new THREE.Mesh(laserSightGeometry, laserSightMaterial);
    laserSight.rotation.x = Math.PI / 2;
    laserSight.position.set(0, -0.025, -0.1);
    pistolGroup.add(laserSight);
    
    // Add laser beam (visible laser dot effect)
    const laserBeamGeometry = new THREE.CylinderGeometry(0.002, 0.002, 50);
    const laserBeamMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
      emissive: 0xff0000,
      emissiveIntensity: 2
    });
    const laserBeam = new THREE.Mesh(laserBeamGeometry, laserBeamMaterial);
    laserBeam.rotation.x = Math.PI / 2;
    laserBeam.position.set(0, -0.025, -25.1); // Position it extending forward
    pistolGroup.add(laserBeam);
    
    this.weaponTypes.pistol.model = pistolGroup;
    
    // Create rifle model
    const rifleGroup = new THREE.Group();
    
    // Stock
    const stockGeometry = new THREE.BoxGeometry(0.06, 0.1, 0.3);
    const stock = new THREE.Mesh(stockGeometry, gunMaterial);
    stock.position.z = 0.1;
    rifleGroup.add(stock);
    
    // Receiver
    const receiverGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.2);
    const receiver = new THREE.Mesh(receiverGeometry, gunMaterial);
    receiver.position.z = -0.1;
    rifleGroup.add(receiver);
    
    // Barrel
    const rifleBarrelGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5);
    const rifleBarrel = new THREE.Mesh(rifleBarrelGeometry, gunMaterial);
    rifleBarrel.rotation.x = Math.PI / 2;
    rifleBarrel.position.z = -0.45;
    rifleGroup.add(rifleBarrel);
    
    // Magazine
    const magGeometry = new THREE.BoxGeometry(0.03, 0.1, 0.05);
    const magazine = new THREE.Mesh(magGeometry, gunMaterial);
    magazine.position.set(0, -0.1, -0.05);
    rifleGroup.add(magazine);
    
    this.weaponTypes.rifle.model = rifleGroup;
    
    // Create shotgun model
    const shotgunGroup = new THREE.Group();
    
    // Receiver
    const shotgunReceiverGeometry = new THREE.BoxGeometry(0.08, 0.1, 0.25);
    const shotgunReceiver = new THREE.Mesh(shotgunReceiverGeometry, gunMaterial);
    shotgunGroup.add(shotgunReceiver);
    
    // Barrel
    const shotgunBarrelGeometry = new THREE.CylinderGeometry(0.03, 0.025, 0.6);
    const shotgunBarrel = new THREE.Mesh(shotgunBarrelGeometry, gunMaterial);
    shotgunBarrel.rotation.x = Math.PI / 2;
    shotgunBarrel.position.z = -0.425;
    shotgunGroup.add(shotgunBarrel);
    
    // Pump
    const pumpGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.15);
    const pump = new THREE.Mesh(pumpGeometry, gunMaterial);
    pump.rotation.x = Math.PI / 2;
    pump.position.z = -0.3;
    shotgunGroup.add(pump);
    
    // Stock
    const shotgunStockGeometry = new THREE.BoxGeometry(0.06, 0.08, 0.2);
    const shotgunStock = new THREE.Mesh(shotgunStockGeometry, gunMaterial);
    shotgunStock.position.z = 0.225;
    shotgunGroup.add(shotgunStock);
    
    // Add flashlight to shotgun
    const flashlightGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.12);
    const flashlightMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.3,
      metalness: 0.7
    });
    const flashlight = new THREE.Mesh(flashlightGeometry, flashlightMaterial);
    flashlight.rotation.x = Math.PI / 2;
    flashlight.position.set(-0.05, -0.03, -0.35); // Positioned on the side under barrel
    shotgunGroup.add(flashlight);
    
    // Add flashlight lens with emissive glow
    const lensGeometry = new THREE.CircleGeometry(0.018, 16);
    const lensMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffaa,
      emissiveIntensity: 2.0, // Increased for brighter appearance
      roughness: 0.1,
      metalness: 0.5
    });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(-0.05, -0.03, -0.41);
    shotgunGroup.add(lens);
    
    // Add a glow effect around the lens
    const glowGeometry = new THREE.RingGeometry(0.015, 0.025, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffaa,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const glowRing = new THREE.Mesh(glowGeometry, glowMaterial);
    glowRing.position.set(-0.05, -0.03, -0.411); // Slightly in front of lens
    shotgunGroup.add(glowRing);
    
    // Add spotlight for flashlight
    const flashlightLight = new THREE.SpotLight(0xffffaa, 3, 50, Math.PI / 8, 0.2, 1);
    // Position at the front of the flashlight/lens
    flashlightLight.position.set(-0.05, -0.03, -0.41);
    shotgunGroup.add(flashlightLight);
    
    // Create a target object that will be positioned forward from the muzzle
    const lightTarget = new THREE.Object3D();
    // Position target way out in front along the barrel direction (negative Z)
    // Match the flashlight's X and Y position, but far forward on Z
    lightTarget.position.set(-0.05, -0.03, -5); 
    shotgunGroup.add(lightTarget);
    
    // Set the light's target to our target object
    flashlightLight.target = lightTarget;
    
    // Enable shadows for the flashlight
    flashlightLight.castShadow = true;
    flashlightLight.shadow.mapSize.width = 512;
    flashlightLight.shadow.mapSize.height = 512;
    flashlightLight.shadow.camera.near = 0.1;
    flashlightLight.shadow.camera.far = 50;
    
    // Store reference to the light and glow materials so we can toggle them
    shotgunGroup.userData.flashlight = flashlightLight;
    shotgunGroup.userData.flashlightLens = lens;
    shotgunGroup.userData.flashlightGlow = glowRing;
    
    this.weaponTypes.shotgun.model = shotgunGroup;
  }
  
  createMuzzleFlash() {
    const flashGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.8
    });
    
    this.muzzleFlash = new THREE.Mesh(flashGeometry, flashMaterial);
    this.muzzleFlash.visible = false;
    
    // Don't add to scene yet - will be added to weapon view model
  }

  createTracer(startPos, endPos) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      startPos.x, startPos.y, startPos.z,
      endPos.x, endPos.y, endPos.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });
    
    const tracer = new THREE.Line(geometry, material);
    this.scene.scene.add(tracer);
    
    // Add to effects list
    this.effects.push({
      type: 'tracer',
      object: tracer,
      lifetime: 0,
      maxLifetime: 0.2
    });
  }
  
  updateViewModel() {
    // Clear current view model
    this.viewModelGroup.clear();
    
    // Clear third-person weapon
    if (this.thirdPersonWeaponGroup.parent) {
      this.thirdPersonWeaponGroup.parent.remove(this.thirdPersonWeaponGroup);
    }
    this.thirdPersonWeaponGroup.clear();
    
    // Clean up any previous spotlight targets
    if (this.currentFlashlightTarget) {
      this.scene.scene.remove(this.currentFlashlightTarget);
      this.currentFlashlightTarget = null;
    }
    
    if (!this.currentWeapon) return;
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    if (!weaponType.model) return;
    
    // Create first-person view model
    this.weaponViewModel = weaponType.model.clone();
    this.weaponViewModel.position.copy(weaponType.holdOffset);
    this.weaponViewModel.rotation.copy(weaponType.holdRotation);
    
    // Special handling for shotgun flashlight in FPS
    if (this.currentWeapon.type === 'shotgun') {
      // Find the cloned light and target in the view model
      let clonedLight = null;
      let clonedTarget = null;
      
      this.weaponViewModel.traverse((child) => {
        if (child.isSpotLight) {
          clonedLight = child;
        }
        // Find the target by checking position (it's far forward)
        if (child.isObject3D && !child.isMesh && !child.isLight && 
            Math.abs(child.position.z + 5) < 0.1) { // Target is at z = -5
          clonedTarget = child;
        }
      });
      
      // Re-establish the target relationship
      if (clonedLight && clonedTarget) {
        // Remove the target from the weapon model
        this.weaponViewModel.remove(clonedTarget);
        
        // Add the target to the viewModelGroup instead
        // This way it will rotate with the weapon
        clonedTarget.position.set(-0.05, -0.03, -5);
        this.viewModelGroup.add(clonedTarget);
        
        clonedLight.target = clonedTarget;
        this.currentFlashlightTarget = clonedTarget;
        
        // Store references for toggling
        this.weaponViewModel.userData.flashlight = clonedLight;
        this.weaponViewModel.userData.flashlightTarget = clonedTarget;
        
        // Also find and store lens and glow references
        this.weaponViewModel.traverse((child) => {
          if (child.isMesh && child.geometry.type === 'CircleGeometry') {
            this.weaponViewModel.userData.flashlightLens = child;
          }
          if (child.isMesh && child.geometry.type === 'RingGeometry') {
            this.weaponViewModel.userData.flashlightGlow = child;
          }
        });
      }
    }
    
    this.viewModelGroup.add(this.weaponViewModel);
    
    // Create third-person weapon model
    this.thirdPersonWeapon = weaponType.model.clone();
    // Position weapon in player's hand area for third-person
    this.thirdPersonWeapon.position.set(0.2, 0.3, -0.2);
    this.thirdPersonWeapon.rotation.set(0, Math.PI, 0);
    this.thirdPersonWeapon.scale.setScalar(0.8);
    
    // Handle flashlight for third-person model
    if (this.currentWeapon.type === 'shotgun') {
      let tpLight = null;
      let tpTarget = null;
      
      this.thirdPersonWeapon.traverse((child) => {
        if (child.isSpotLight) {
          tpLight = child;
        }
        // Find the target by checking position
        if (child.isObject3D && !child.isMesh && !child.isLight && 
            Math.abs(child.position.z + 5) < 0.1) {
          tpTarget = child;
        }
      });
      
      if (tpLight && tpTarget) {
        // For third-person, we need to adjust the target position
        // because the weapon is rotated 180 degrees
        tpTarget.position.set(-0.05, -0.03, 5); // Positive Z because weapon is rotated
        tpLight.target = tpTarget;
        // Add target to scene
        this.scene.scene.add(tpLight.target);
        
        this.thirdPersonWeapon.userData.flashlight = tpLight;
        this.thirdPersonWeapon.userData.flashlightTarget = tpTarget;
      }
    }
    
    this.thirdPersonWeaponGroup.add(this.thirdPersonWeapon);
    
    // Attach to player mesh if available
    if (this.player.mesh) {
      this.player.mesh.add(this.externalWeaponModel);
    }
    
    // Add muzzle flash if weapon can shoot
    if (weaponType.muzzleOffset && this.muzzleFlash) {
      const muzzleFlashClone = this.muzzleFlash.clone();
      muzzleFlashClone.position.copy(weaponType.muzzleOffset);
      this.weaponViewModel.add(muzzleFlashClone);
      this.muzzleFlash = muzzleFlashClone; // Update reference
    }
    
    // Create external weapon model
    this.createExternalWeaponModel(weaponType);
    
    // Update visibility based on current camera mode
    this.updateWeaponVisibility();
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
    
    // Don't create external model for hands
    if (weaponDef.name === 'hands') return;
    
    // Create simplified weapon model for external view based on weapon type
    let geometry;
    let scale = new THREE.Vector3(1, 1, 1);
    
    switch(weaponDef.name) {
      case 'pistol':
        geometry = new THREE.BoxGeometry(0.15, 0.2, 0.4);
        break;
      case 'rifle':
        geometry = new THREE.BoxGeometry(0.1, 0.15, 0.8);
        break;
      case 'shotgun':
        geometry = new THREE.BoxGeometry(0.12, 0.18, 0.6);
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
    
    // Hide all weapon models when in vehicle
    if (isInVehicle) {
      this.viewModelGroup.visible = false;
      this.thirdPersonWeaponGroup.visible = false;
      return;
    }
    
    // Normal visibility logic when not in vehicle
    this.viewModelGroup.visible = !isThirdPerson;
    this.thirdPersonWeaponGroup.visible = isThirdPerson && this.currentWeapon.type !== 'hands';
    
    // External weapon model is always visible when player is visible
    // It shows what weapon the player is holding for others to see
    if (this.externalWeaponModel) {
      this.externalWeaponModel.visible = true;
    }
  }
  
  spawnWeaponPickup(type, position) {
    if (!this.weaponTypes[type] || type === 'hands') return null;
    
    const pickupId = 'pickup_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create pickup visual
    const pickupGroup = new THREE.Group();
    
    // Clone weapon model
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
    if (!pickup) return false;
    
    // Find empty slot or replace current weapon
    let slotIndex = -1;
    
    // Check for empty slots first (skip slot 0 which is hands)
    for (let i = 1; i < this.inventory.length; i++) {
      if (!this.inventory[i]) {
        slotIndex = i;
        break;
      }
    }
    
    // If no empty slot, replace current weapon (if not hands)
    if (slotIndex === -1 && this.currentSlot > 0) {
      slotIndex = this.currentSlot;
      
      // Drop current weapon
      if (this.inventory[slotIndex]) {
        const dropPos = this.player.getPosition().clone();
        dropPos.y += 1;
        this.spawnWeaponPickup(this.inventory[slotIndex].type, dropPos);
      }
    }
    
    // If still no slot, can't pick up
    if (slotIndex === -1) {
      console.log('No available weapon slots');
      return false;
    }
    
    // Add weapon to inventory
    this.inventory[slotIndex] = {
      type: pickup.type,
      ammo: this.weaponTypes[pickup.type].maxAmmo || this.weaponTypes[pickup.type].ammo
    };
    
    // Remove pickup from world
    this.removePickup(pickupId);
    
    // Switch to picked up weapon
    this.switchToSlot(slotIndex);
    
    console.log(`Picked up ${pickup.type} in slot ${slotIndex}`);
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
    if (slot < 0 || slot >= this.inventory.length) return false;
    if (!this.inventory[slot]) return false;
    
    // Cancel reload if switching weapons
    this.isReloading = false;
    
    this.currentSlot = slot;
    this.currentWeapon = this.inventory[slot];
    
    // Update view model
    this.updateViewModel();
    
    console.log(`Switched to ${this.currentWeapon.type} (slot ${slot})`);
    return true;
  }
  
  fire() {
    if (!this.currentWeapon || this.isReloading) return false;
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    
    // Can't fire hands
    if (this.currentWeapon.type === 'hands') return false;
    
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
    
    // Show muzzle flash
    this.showMuzzleFlash();
    
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
    
    // Apply recoil
    if (this.player && weaponType.recoil) {
      this.player.cameraRotation.x -= weaponType.recoil;
    }
    
    console.log(`Fired ${weaponType.name}! Ammo: ${this.currentWeapon.ammo}/${weaponType.maxAmmo}`);
    return true;
  }
  
  fireProjectile(weaponType) {
    // Use the weaponType parameter if provided, otherwise use current weapon
    const weapon = weaponType || this.weaponTypes[this.currentWeapon.type];
    
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
    
    // Perform raycast
    const maxDistance = weapon.range || 100;
    const hit = this.physics.castRay(
      startPos,
      direction,
      maxDistance,
      this.player.colliderHandle
    );
    
    if (hit && hit.toi !== undefined) {
      console.log('Weapon hit at distance:', hit.toi);
      
      // Calculate hit point
      const hitPoint = startPos.clone().add(direction.clone().multiplyScalar(hit.toi));
      
      // Create visual tracer from weapon position to hit point
      const weaponWorldPos = this.getWeaponWorldPosition();
      this.createTracer(weaponWorldPos, hitPoint);
      
      // Create hit effect with valid normal
      const hitNormal = hit.normal ? 
        new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z) : 
        new THREE.Vector3(0, 1, 0);
      this.createHitEffect(hitPoint, hitNormal);
      
      // Apply damage if hitting a player or destructible
      if (hit.collider) {
        // Handle damage here
      }
    } else {
      // No hit - fire into distance
      const endPoint = startPos.clone().add(direction.clone().multiplyScalar(maxDistance));
      const weaponWorldPos = this.getWeaponWorldPosition();
      this.createTracer(weaponWorldPos, endPoint);
    }
  }
  
  showMuzzleFlash() {
    if (!this.muzzleFlash) return;
    
    this.muzzleFlash.visible = true;
    
    // Randomize size and rotation for variety
    const scale = 0.8 + Math.random() * 0.4;
    this.muzzleFlash.scale.setScalar(scale);
    this.muzzleFlash.rotation.z = Math.random() * Math.PI * 2;
    
    // Hide after duration
    setTimeout(() => {
      if (this.muzzleFlash) {
        this.muzzleFlash.visible = false;
      }
    }, this.muzzleFlashDuration);
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
    if (!this.currentWeapon || this.currentWeapon.type === 'hands' || this.isReloading) return false;
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    
    // Already full
    if (this.currentWeapon.ammo >= weaponType.maxAmmo) return false;
    
    this.isReloading = true;
    this.reloadStartTime = Date.now();
    
    console.log(`Reloading ${weaponType.name}...`);
    
    // Complete reload after duration
    setTimeout(() => {
      if (this.currentWeapon && this.currentWeapon.type === weaponType.name.toLowerCase()) {
        this.currentWeapon.ammo = weaponType.maxAmmo;
        this.isReloading = false;
        console.log(`${weaponType.name} reloaded!`);
      }
    }, this.reloadDuration);
    
    return true;
  }
  
  update(deltaTime) {
    // Update weapon visibility based on camera mode
    this.updateWeaponVisibility();
    
    // Update reload
    if (this.isReloading) {
      const reloadProgress = (Date.now() - this.reloadStartTime) / this.reloadDuration;
      if (reloadProgress >= 1.0) {
        this.isReloading = false;
        this.currentWeapon.ammo = this.weaponTypes[this.currentWeapon.type].maxAmmo;
        console.log(`${this.weaponTypes[this.currentWeapon.type].name} reloaded!`);
      }
    }
    
    // Auto-fire for automatic weapons
    if (this.isFiring && this.currentWeapon.automatic && !this.isReloading) {
      this.fire();
    }
    
    // Update visual effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.lifetime += deltaTime;
      
      if (effect.lifetime >= effect.maxLifetime) {
        // Remove effect
        this.scene.scene.remove(effect.object);
        effect.object.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.effects.splice(i, 1);
      } else {
        // Update effect
        const progress = effect.lifetime / effect.maxLifetime;
        
        if (effect.type === 'muzzleFlash') {
          effect.object.material.opacity = 1.0 - progress;
          effect.object.scale.setScalar(1.0 + progress * 0.5);
        } else if (effect.type === 'tracer') {
          effect.object.material.opacity = 1.0 - progress;
        } else if (effect.type === 'hit') {
          // Update particle positions
          effect.object.children.forEach(particle => {
            if (particle.userData.velocity) {
              particle.position.add(
                particle.userData.velocity.clone().multiplyScalar(deltaTime)
              );
              // Add gravity
              particle.userData.velocity.y -= 9.8 * deltaTime;
              // Fade out
              if (particle.material) {
                particle.material.opacity = 1.0 - progress;
              }
            }
          });
        }
      }
    }
    
    // Update pickups - collect IDs to pick up after iteration to avoid modifying map during iteration
    const pickupsToCollect = [];
    const playerPos = this.player.getPosition();
    
    this.weaponPickups.forEach((pickup, id) => {
      // Rotate pickup
      pickup.mesh.rotation.y += deltaTime * 2;
      
      // Bob up and down
      pickup.mesh.position.y = pickup.position.y + 0.5 + Math.sin(Date.now() * 0.003) * 0.1;
      
      // Check if player is near
      const distance = playerPos.distanceTo(pickup.position);
      
      if (distance < 2.0) {
        // Mark for pickup instead of picking up immediately
        pickupsToCollect.push(id);
      }
    });
    
    // Now pick up the weapons outside of the forEach loop
    for (const pickupId of pickupsToCollect) {
      this.pickupWeapon(pickupId);
    }
  }
  
  handleKeyPress(key) {
    switch(key) {
      case '1':
        this.switchToSlot(0);
        break;
      case '2':
        this.switchToSlot(1);
        break;
      case '3':
        this.switchToSlot(2);
        break;
      case 'r':
      case 'R':
        this.reload();
        break;
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
  
  clear() {
    // Remove all pickups
    this.weaponPickups.forEach((pickup, id) => {
      this.removePickup(id);
    });
    this.weaponPickups.clear();
    
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
    
    // Reset inventory
    this.inventory = [
      { type: 'hands', ammo: Infinity },
      null,
      null
    ];
    this.currentSlot = 0;
    this.currentWeapon = this.inventory[0];
    this.updateViewModel();
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
      // Find empty slot
      for (let i = 1; i < this.inventory.length; i++) {
        if (!this.inventory[i]) {
          slotIndex = i;
          this.inventory[i] = {
            type: weaponType,
            ammo: this.weaponTypes[weaponType].maxAmmo || this.weaponTypes[weaponType].ammo
          };
          break;
        }
      }
    }
    
    // Switch to the weapon if found or added
    if (slotIndex !== -1) {
      this.switchToSlot(slotIndex);
      return true;
    }
    
    console.log(`Cannot switch to ${weaponType} - not in inventory and no empty slots`);
    return false;
  }
  
  getWeaponWorldPosition() {
    // Get player position and facing direction
    const playerPos = this.player.getPosition();
    const playerFacing = this.player.getFacing();
    
    // Calculate weapon offset from player center
    // Weapon is slightly to the right and forward of the player
    const rightOffset = new THREE.Vector3(1, 0, 0);
    const playerRotation = this.player.body.rotation();
    const quaternion = new THREE.Quaternion(
      playerRotation.x,
      playerRotation.y,
      playerRotation.z,
      playerRotation.w
    );
    rightOffset.applyQuaternion(quaternion);
    
    // Position weapon at player's hand level
    const weaponPos = playerPos.clone();
    weaponPos.y += 0.5; // Roughly at chest/hand height
    weaponPos.add(rightOffset.multiplyScalar(0.3)); // 0.3 units to the right
    weaponPos.add(playerFacing.multiplyScalar(0.5)); // 0.5 units forward
    
    return weaponPos;
  }
}
