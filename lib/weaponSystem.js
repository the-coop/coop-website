import * as THREE from 'three';

export class WeaponSystem {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    
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
        holdOffset: new THREE.Vector3(0.2, -0.15, -0.3),
        holdRotation: new THREE.Euler(0, Math.PI, 0)
      },
      rifle: {
        name: 'Rifle',
        model: null,
        damage: 35,
        fireRate: 600,
        range: 100,
        ammo: 30,
        maxAmmo: 30,
        holdOffset: new THREE.Vector3(0.25, -0.2, -0.4),
        holdRotation: new THREE.Euler(0, Math.PI, 0)
      },
      shotgun: {
        name: 'Shotgun',
        model: null,
        damage: 80,
        fireRate: 60,
        range: 20,
        ammo: 8,
        maxAmmo: 8,
        holdOffset: new THREE.Vector3(0.25, -0.2, -0.4),
        holdRotation: new THREE.Euler(0, Math.PI, 0)
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
    
    // Weapon pickups in world
    this.weaponPickups = new Map();
    
    // Create weapon models
    this.createWeaponModels();
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
    
    this.weaponTypes.shotgun.model = shotgunGroup;
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
    
    return pickupData;
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
  
  pickupWeapon(pickupId, player) {
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
        const dropPos = player.getPosition().clone();
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
    if (pickup.mesh.geometry) pickup.mesh.geometry.dispose();
    if (pickup.mesh.material) pickup.mesh.material.dispose();
    
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
    
    this.currentSlot = slot;
    this.currentWeapon = this.inventory[slot];
    
    console.log(`Switched to ${this.currentWeapon.type} (slot ${slot})`);
    return true;
  }
  
  getCurrentWeaponModel() {
    if (!this.currentWeapon) return null;
    return this.weaponTypes[this.currentWeapon.type].model.clone();
  }
  
  getCurrentWeaponInfo() {
    if (!this.currentWeapon) return null;
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    return {
      ...weaponType,
      currentAmmo: this.currentWeapon.ammo
    };
  }
  
  fire() {
    if (!this.currentWeapon) return false;
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    
    // Can't fire hands
    if (this.currentWeapon.type === 'hands') return false;
    
    // Check ammo
    if (this.currentWeapon.ammo <= 0) {
      console.log('Out of ammo!');
      return false;
    }
    
    // Decrease ammo
    this.currentWeapon.ammo--;
    
    console.log(`Fired ${weaponType.name}! Ammo: ${this.currentWeapon.ammo}/${weaponType.maxAmmo}`);
    return true;
  }
  
  reload() {
    if (!this.currentWeapon || this.currentWeapon.type === 'hands') return false;
    
    const weaponType = this.weaponTypes[this.currentWeapon.type];
    this.currentWeapon.ammo = weaponType.maxAmmo;
    
    console.log(`Reloaded ${weaponType.name}`);
    return true;
  }
  
  getInventoryState() {
    return {
      slots: this.inventory.map(item => item ? { type: item.type, ammo: item.ammo } : null),
      currentSlot: this.currentSlot
    };
  }
  
  clear() {
    // Remove all pickups
    this.weaponPickups.forEach((pickup, id) => {
      this.removePickup(id);
    });
    this.weaponPickups.clear();
    
    // Reset inventory
    this.inventory = [
      { type: 'hands', ammo: Infinity },
      null,
      null
    ];
    this.currentSlot = 0;
    this.currentWeapon = this.inventory[0];
  }
}
