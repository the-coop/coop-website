import * as THREE from 'three';
import ENTITY_TYPES from '../entity-types';

export default function generateMoon() {
    const moonGeometry = new THREE.IcosahedronGeometry(.75, 1);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffff1, wireframe: true });
    const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);

    // Add meta name for UI.
    moonSphere.name = 'MOON';
  
    moonSphere.castShadow = true;
    moonSphere.receiveShadow = true;
  
    moonSphere.entity_type = ENTITY_TYPES.PLANETARY;

    return moonSphere;
  }