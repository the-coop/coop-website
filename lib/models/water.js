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
