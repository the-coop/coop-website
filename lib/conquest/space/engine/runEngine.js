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

    //This should be the time from the last call, can just be aprox

 


    // Read the player positions into the render here.
    Object.keys(players).map(playerID => {
      const player = players[playerID];

      // Rotate the player by the rotation vector.
      player.mesh.lookAt(player.rotation);

      // Move the object according to network declaration.
      player.mesh.position.add(player.direction);

      // Get the SOI
      const soi = window.CONQUEST.SOIS[player.orbit_influence];

      // Apply gravity to player.
      // Compare SOI position and force to player position
      // Influence
      // the players parent is the soi so its position should be relative
      // player.position -> vector
      const gravationalAccelection = 1;
      const timeStep = 1;
      const PlanetSise = 10;
      const direction = player.position.clone().normalize();
      player.velocity.addScaledVector(direction, gravationalAccelection * timeStep);
      console.log(direction);
      player.position.addScaledVector(player.velocity, timeStep);

      player.position.clampLengthPlanetSise, 1000); 

      // Use this later and conditionally.
      // Reposition the camera over the moved mesh if player is me.
      // if (me && playerID === me.id) 
          // camera.position.add(player.direction);

      // Track the label to the player.
      // player.label.position.add(player.direction);

      // Track any speech to the player.
      // TODO: ... ^
    });

    // Process state changes to THREE scene and objects.
    renderer.render(scene, camera);
  }

  animate();
}














