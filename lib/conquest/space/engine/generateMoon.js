import * as THREE from 'three';


const MOON_RADIUS = 1;

export default function generateMoon(orbitOffset) {

    const moonGeometry = new THREE.IcosahedronGeometry(.75, MOON_RADIUS);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffff1, wireframe: true });
    const MOON = new THREE.Mesh(moonGeometry, moonMaterial);

    MOON.radius = MOON_RADIUS;


    // Add meta name for UI.
    MOON.name = 'MOON';
  
    MOON.castShadow = true;
    MOON.receiveShadow = true;
  
    MOON.entity_type = 'PLANETARY';

    window.CONQUEST.SOIS.MOON = MOON;

    // Convenience method.
    window.CONQUEST.SOIS.MOON.mesh = MOON;

    return MOON;
  }