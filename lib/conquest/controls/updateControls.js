import * as THREE from 'three';

export default function updateControls() {
    const { controls, sateliteSphere, earthRadius } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    if (focusTarget) {
        // Move camera and update its rotation.
        if (cameraTween) cameraTween.update();
        
        // Create a vector towards the focus target.
        const focusTargetVector = new THREE.Vector3(0, 0, 0);
        focusTarget.getWorldPosition(focusTargetVector);
        // Move the artifical satelite to the center of the Earth.
        sateliteSphere.position.x = focusTargetVector.x;
        sateliteSphere.position.y = focusTargetVector.y;
        sateliteSphere.position.z = focusTargetVector.z + earthRadius;
    }

    // Update and smooth camera.
    controls.update();
}