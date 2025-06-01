import * as THREE from 'three';

export function createRampModel(width, height, depth, options = {}) {
  const geometry = new THREE.BoxGeometry(width, 1, depth);
  
  const material = new THREE.MeshStandardMaterial({
    color: options.color || 0xaa4444,
    roughness: options.roughness || 0.6,
    metalness: options.metalness || 0.2
  });
  
  const ramp = new THREE.Mesh(geometry, material);
  ramp.receiveShadow = true;
  ramp.castShadow = true;
  
  return ramp;
}
