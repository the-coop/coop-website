import * as THREE from 'three';

export function createShotgunModel() {
  const shotgunGroup = new THREE.Group();
  
  const gunMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.3,
    metalness: 0.7
  });
  
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
  
  // Flashlight
  const flashlightGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.12);
  const flashlightMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444,
    roughness: 0.3,
    metalness: 0.7
  });
  const flashlight = new THREE.Mesh(flashlightGeometry, flashlightMaterial);
  flashlight.rotation.x = Math.PI / 2;
  flashlight.position.set(-0.05, -0.03, -0.35);
  shotgunGroup.add(flashlight);
  
  // Flashlight lens
  const lensGeometry = new THREE.CircleGeometry(0.018, 16);
  const lensMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffaa,
    emissiveIntensity: 2.0,
    roughness: 0.1,
    metalness: 0.5
  });
  const lens = new THREE.Mesh(lensGeometry, lensMaterial);
  lens.position.set(-0.05, -0.03, -0.41);
  shotgunGroup.add(lens);
  
  // Glow effect
  const glowGeometry = new THREE.RingGeometry(0.015, 0.025, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffaa,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  const glowRing = new THREE.Mesh(glowGeometry, glowMaterial);
  glowRing.position.set(-0.05, -0.03, -0.411);
  shotgunGroup.add(glowRing);
  
  // Spotlight
  const flashlightLight = new THREE.SpotLight(0xffffaa, 3, 50, Math.PI / 8, 0.2, 1);
  flashlightLight.position.set(-0.05, -0.03, -0.41);
  shotgunGroup.add(flashlightLight);
  
  // Light target
  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(-0.05, -0.03, -5);
  shotgunGroup.add(lightTarget);
  flashlightLight.target = lightTarget;
  
  // Enable shadows
  flashlightLight.castShadow = true;
  flashlightLight.shadow.mapSize.width = 512;
  flashlightLight.shadow.mapSize.height = 512;
  flashlightLight.shadow.camera.near = 0.1;
  flashlightLight.shadow.camera.far = 50;
  
  // Store references
  shotgunGroup.userData.flashlight = flashlightLight;
  shotgunGroup.userData.flashlightLens = lens;
  shotgunGroup.userData.flashlightGlow = glowRing;
  
  return shotgunGroup;
}
