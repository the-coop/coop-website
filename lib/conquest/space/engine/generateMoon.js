import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const MOON_RADIUS = 1;

export default function generateMoon(orbitOffset) {

    const moonGeometry = new THREE.IcosahedronGeometry(.75, MOON_RADIUS);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffff1, wireframe: true });
    const MOON = new THREE.Mesh(moonGeometry, moonMaterial);

    MOON.radius = MOON_RADIUS;


    const body = MOON.body = new CANNON.Body({
      mass: MOON_RADIUS * 3,
      position: new CANNON.Vec3(orbitOffset, 0, 0),
      shape: new CANNON.Sphere(MOON_RADIUS)
    });
  
    // Add test impulse.
    // body.applyImpulse(new CANNON.Vec3(earthRadius * .5, earthRadius * .5, earthRadius * .5));
  
    window.CONQUEST.world.addBody(body);

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