import * as THREE from 'three';

export default function updateControls() {
    const { controls, earthSphere } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    if (focusTarget) {
        // Move camera and update its rotation.
        if (cameraTween) cameraTween.update();
        
        // Create a vector towards the focus target.
        const focusTargetVector = new THREE.Vector3(0, 0, 0);
        focusTarget.getWorldPosition(focusTargetVector);

        // Move the controls target to the center.
        controls.target = earthSphere.position;
    }

    // Update and smooth camera.
    controls.update();
}