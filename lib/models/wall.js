import * as THREE from 'three';

export function createWallModel(width, height, depth, options = {}) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  
  const material = new THREE.MeshStandardMaterial({
    color: options.color || 0x4444aa,
    roughness: options.roughness || 0.5,
    metalness: options.metalness || 0.3
  });
  
  const wall = new THREE.Mesh(geometry, material);
  wall.receiveShadow = true;
  wall.castShadow = true;
  
  return wall;
}
