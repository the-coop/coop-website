import { Clock } from 'three';

// Time delta
const clock = new Clock();

// Define the animation loop.
export default function runGroundEngine() {
    const { players, renderer, scene, camera, me, MOVEMENT, timeIncrement } = window.GROUND_LEVEL;

    // Apply the delta to the time.
    window.GROUND_LEVEL.timeIncrement += clock.getDelta();

    // Handle the framerate.
    requestAnimationFrame(runGroundEngine);
    
    // Read the player positions into the render here.
    Object.keys(players).map(playerID => {
        players[playerID].mesh.position.add(players[playerID].direction);
        players[playerID].mesh.lookAt(players[playerID].rotation);

        // Reposition the camera over the moved mesh if player is me.
        if (playerID === me.id) 
            camera.position.add(players[playerID].direction);
    });

    // Render the scene using the camera for frustum culling.
    renderer.render(scene, camera);
};