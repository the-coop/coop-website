import * as THREE from 'three';

export default function updateControls() {
    const { controls, earthSphere } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    // Move camera and update its rotation.
    if (focusTarget && cameraTween) cameraTween.update();

    // Move the controls target to the center.
    if (focusTarget) controls.target = earthSphere.position;

    // Update and smooth camera.
    controls.update();
}