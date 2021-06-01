import * as THREE from 'three';

export default function updateControls() {
    const { controls } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    // Move camera and update its rotation.
    if (focusTarget && cameraTween) cameraTween.update();

    // Move the controls target to the center.
    if (focusTarget) focusTarget.getWorldPosition(controls.target);

    // Update and smooth camera if it isn't already being animated.
    if(!cameraTween) controls.update();
}