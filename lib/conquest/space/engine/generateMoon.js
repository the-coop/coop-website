import * as THREE from 'three';
import ENTITY_TYPES from '../entity-types';

export default function generateMoon() {
    const moonGeometry = new THREE.IcosahedronGeometry(.75, 1);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffff1, wireframe: true });
    const MOON = new THREE.Mesh(moonGeometry, moonMaterial);

    // Add meta name for UI.
    MOON.name = 'MOON';
  
    MOON.castShadow = true;
    MOON.receiveShadow = true;
  
    MOON.entity_type = ENTITY_TYPES.PLANETARY;

    return MOON;
  }