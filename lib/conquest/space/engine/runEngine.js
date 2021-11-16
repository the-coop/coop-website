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
      players[playerID].mesh.lookAt(players[playerID].rotation);

      // Move the object according to network declaration.
      players[playerID].mesh.position.add(players[playerID].direction);

      // Track the label to the player.
      players[playerID].label.position.add(players[playerID].direction);

      // Track any speech to the player.
      // TODO: ... ^

      // Use this later and conditionally.
      // Reposition the camera over the moved mesh if player is me.
      // if (me && playerID === me.id) 
          // camera.position.add(players[playerID].direction);
    });

    // Process state changes to THREE scene and objects.
    renderer.render(scene, camera);
  }

  animate();
}














