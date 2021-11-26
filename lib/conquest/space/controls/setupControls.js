import TrackballControls from './trackballControls';
import clickControls from './clickControls';


export default function setupControls() {
    const { camera, renderer } = window.CONQUEST;

    // Setup the controls
    const controls = new TrackballControls(camera, renderer.domElement);
    window.CONQUEST.controls = controls;

    controls.enablePan = false;
    controls.rotateSpeed = 5;

    controls.minDistance = 6.25;
    controls.maxDistance = 100;

    // Give the camera its initial position.
    camera.position.set(window.CONQUEST.SOIS.EARTH.position);

    // Update for manual controls change.
    controls.update();

    // Setup the click + focusing controls element.
    document.addEventListener('click', clickControls);
    document.addEventListener('touchend', clickControls, false);
}
