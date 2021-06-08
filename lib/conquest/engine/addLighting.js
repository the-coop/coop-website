import * as THREE from 'three';

export default function addLighting() {
    const { scene } = window.CONQUEST;
  
    // Make the light based on the sun.
    const sunLight = new THREE.PointLight(0xffeea6, 1.5);
    sunLight.castShadow = true;
    
    // Add ambient light so even dark things are visible.
    const ambientLight = new THREE.AmbientLight(0x050505);
    scene.add(ambientLight);
  
    // Add direct lighting from the sun.
    sunLight.position.set(0, 0, 0);

    scene.add(sunLight);
}