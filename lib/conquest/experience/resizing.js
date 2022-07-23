export default function resizer() {
    // Update camera
    WORLD.camera.aspect = window.innerWidth / window.innerHeight;
    WORLD.camera.updateProjectionMatrix();

    // Update renderer
    WORLD.renderer.setSize(window.innerWidth, window.innerHeight);
    WORLD.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    //todo super sampleing, this might be laggy
    WORLD.composer.setSize(window.innerWidth * 2, window.innerHeight * 2);
};