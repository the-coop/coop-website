import * as THREE from 'three';
import _ from 'lodash';

import setupControls from '../controls/setupControls';
import updateControls from '../controls/updateControls';
import updateOrbits from '../physics/updateOrbits';

// SANITY COMMIT 2021
export default function runEngine() {
  const { renderer, scene, camera } = window.CONQUEST;

  // Time delta
  const clock = new THREE.Clock();

  // Setup the rotating and clicking controls.
  setupControls();

  const animate = () => {
    window.CONQUEST.timeIncrement += clock.getDelta();

    // Update the planetary orbits. :)
    updateOrbits();

    // Controls need updated due to manual updates/positioning.
    updateControls();
    
    // Render the scenes, planets, and other objects.
    requestAnimationFrame(animate);

    // Process state changes to THREE scene and objects.
    renderer.render(scene, camera);
  }

  animate();
}














