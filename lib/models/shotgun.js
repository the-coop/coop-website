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
  shotgunBarrel.position.set(0, 0, -0.4);
  shotgunGroup.add(shotgunBarrel);
  
  // Stock
  const stockGeometry = new THREE.BoxGeometry(0.06, 0.08, 0.25);
  const stock = new THREE.Mesh(stockGeometry, gunMaterial);
  stock.position.set(0, -0.01, 0.22);
  shotgunGroup.add(stock);
  
  // Pump
  const pumpGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.12);
  const pump = new THREE.Mesh(pumpGeometry, gunMaterial);
  pump.rotation.x = Math.PI / 2;
  pump.position.set(0, -0.03, -0.25);
  shotgunGroup.add(pump);
  
  // Flashlight attachment
  const flashlightGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.08);
  const flashlightMaterial = new THREE.MeshStandardMaterial({
    color: 0x000000,
    roughness: 0.2,
    metalness: 0.8
  });
  const flashlight = new THREE.Mesh(flashlightGeometry, flashlightMaterial);
  flashlight.rotation.x = Math.PI / 2;
  flashlight.position.set(-0.05, -0.03, -0.3);
  shotgunGroup.add(flashlight);
  
  // Flashlight beam
  const spotLight = new THREE.SpotLight(0xffffff, 2, 30, Math.PI / 6, 0.5, 1);
  spotLight.position.set(-0.05, -0.03, -0.35);
  spotLight.castShadow = true;
  shotgunGroup.add(spotLight);
  
  // Create target for spotlight
  const target = new THREE.Object3D();
  target.position.set(-0.05, -0.03, -5);
  shotgunGroup.add(target);
  spotLight.target = target;
  
  return shotgunGroup;
}
