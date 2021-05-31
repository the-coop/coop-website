import OrbitControls from 'three-orbitcontrols';
import clickControls from './clickControls';

export default function setupControls() {
    const { camera, renderer } = window.CONQUEST;

    // Setup the controls
    const controls = new OrbitControls(camera, renderer.domElement);
    window.CONQUEST.controls = controls;

    controls.enablePan = false;
    controls.rotateSpeed = 5;

    controls.minDistance = 6.25;
    controls.maxDistance = 100;
    
    // Give the camera its initial position.
    camera.position.set(0, 0, 40);

    // Update for manual controls change.
    controls.update();

    // Setup the click + focusing controls element.
    document.addEventListener('click', clickControls);
}
