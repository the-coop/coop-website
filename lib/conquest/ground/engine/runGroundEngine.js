// Define the animation loop.
export default function runGroundEngine() {
    requestAnimationFrame(runGroundEngine);

    // TODO: Read the player positions into the render here.
    // cube.rotation.x += 0.01; cube.rotation.y += 0.01;

    // Render the scene using the camera for frustum culling.
    window.GROUND_LEVEL.renderer.render(
        window.GROUND_LEVEL.scene, 
        window.GROUND_LEVEL.camera
    );
};