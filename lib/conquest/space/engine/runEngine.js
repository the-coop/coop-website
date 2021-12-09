import * as THREE from 'three';
import _ from 'lodash';

import setupControls from '../controls/setupControls';
import updateControls from '../controls/updateControls';
import updateOrbits from '../physics/updateOrbits';
import setFocusTarget from '../controls/setFocusTarget';

export default function runEngine() {
  const { renderer, scene, camera, earthSphere } = window.CONQUEST;

  // Time delta
  const clock = new THREE.Clock();

  // Setup the rotating and clicking controls.
  setupControls();

  // Default to focussing on Earth.
  setFocusTarget(earthSphere);

  // The animation/render loop.
  const animate = () => {
    const { players } = window.CONQUEST;

    // Increment the delta.
    window.CONQUEST.timeIncrement += clock.getDelta();

    // Update the planetary orbits. :)
    updateOrbits();

    // Controls need updated due to manual updates/positioning.
    updateControls();
    
    // Render the scenes, planets, and other objects.
    requestAnimationFrame(animate);

    // Read the player positions into the render here.
    Object.keys(players).map(playerID => {
      const player = players[playerID];
      
      // Get the SOI
      const soi = window.CONQUEST.SOIS[player.orbit_influence];
      
      // Point player's feet at the SOI.
      player.mesh.lookAt(soi.position);

      // Move along surface in direction provided by player.
      const surfaceDistance = 5;
      const surfacePosition = player.mesh.position.normalize().multiplyScalar(surfaceDistance); 
      player.mesh.position.set(surfacePosition);

      // Old movement (inadequate).
      // player.mesh.position.add(player.direction);
    });

    // Process state changes to THREE scene and objects.
    renderer.render(scene, camera);
  }

  animate();
};




// A ground surface that holds the player up.
// if (player.mesh.position.length() < soi.radius) {
//   player.mesh.position.clampLength(soi.radius, 100000);
//   const reflection = player.velocity.projectOnVector(direction);
//   player.velocity.sub(reflection);
// }

// Apply friction and gravity to position.
// player.mesh.position.addScaledVector(player.velocity, clock.getDelta());