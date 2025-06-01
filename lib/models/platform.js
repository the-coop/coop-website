import * as THREE from 'three';

export function createPlatformModel(width, height, depth, options = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  const material = new THREE.MeshStandardMaterial({
    color: options.color || 0x888888,
    roughness: options.roughness || 0.7,
    metalness: options.metalness || 0.2
  });
  
  const platform = new THREE.Mesh(geometry, material);
  platform.receiveShadow = true;
  platform.castShadow = true;
  
  return platform;
}

export function createMovingPlatformModel(width, height, depth, options = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  const material = new THREE.MeshStandardMaterial({
    color: options.color || 0x4488ff,
    roughness: options.roughness || 0.5,
    metalness: options.metalness || 0.3,
    emissive: options.emissive || 0x224488,
    emissiveIntensity: options.emissiveIntensity || 0.2
  });
  
  const platform = new THREE.Mesh(geometry, material);
  platform.receiveShadow = true;
  platform.castShadow = true;
  
  return platform;
}

export function createDynamicPlatformModel(width, height, depth, options = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  const material = new THREE.MeshStandardMaterial({
    color: options.color || '#ff8844',
    roughness: options.roughness || 0.6,
    metalness: options.metalness || 0.3,
    emissive: options.emissive || '#ff8844',
    emissiveIntensity: options.emissiveIntensity || 0.1
  });
  
  const platform = new THREE.Mesh(geometry, material);
  platform.castShadow = true;
  platform.receiveShadow = true;
  
  return platform;
}
