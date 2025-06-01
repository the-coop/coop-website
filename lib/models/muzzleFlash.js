import * as THREE from 'three';

export function createMuzzleFlash() {
  const muzzleFlash = new THREE.Group();
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
  
  muzzleFlash.userData.variations = flashVariations;
  
  // Muzzle flash light
  const muzzleLight = new THREE.PointLight(0xffaa00, 3, 10);
  muzzleLight.position.set(0, 0, 0);
  muzzleFlash.add(muzzleLight);
  muzzleFlash.userData.light = muzzleLight;
  
  // Smoke particles
  const smokeGeometry = new THREE.SphereGeometry(0.1, 4, 4);
  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x666666,
    transparent: true,
    opacity: 0.3
  });
  for (let i = 0; i < 3; i++) {
    const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
    smoke.visible = false;
    muzzleFlash.add(smoke);
    muzzleFlash.userData[`smoke${i}`] = smoke;
  }
  
  return muzzleFlash;
}
