import * as THREE from 'three';

export function createWaterVolumeModel(width, height, depth, options = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  const material = new THREE.MeshStandardMaterial({
    color: options.color || '#4488ff',
    transparent: true,
    opacity: options.opacity || 0.5,
    roughness: 0.1,
    metalness: 0.8,
    side: THREE.DoubleSide,
  });
  
  const water = new THREE.Mesh(geometry, material);
  water.receiveShadow = true;
  
  return water;
}

export function createSphericalWaterVolumeModel(radius, options = {}) {
  const geometry = new THREE.SphereGeometry(radius, 32, 16);
  
  const material = new THREE.MeshStandardMaterial({
    color: options.color || '#3388ff',
    transparent: true,
    opacity: options.opacity || 0.5,  // Increased default opacity
    roughness: 0.1,
    metalness: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,  // Allow seeing through
    blending: THREE.AdditiveBlending  // Make it glow slightly
  });
  
  const water = new THREE.Mesh(geometry, material);
  water.receiveShadow = true;
  water.userData.isSpherical = true;
  
  return water;
}
