import * as THREE from 'three';

export default function updateControls() {
    const { controls, camera } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    // Move camera and update its rotation.
    if (focusTarget && cameraTween) 
        cameraTween.update();

    // Move the controls target to the center.
    if (focusTarget) {
        // Center the controls based on moving target position (references focus target position, updates vector).
        focusTarget.getWorldPosition(controls.target);
        
        // No special handling currently needed for planetary bodies camera focussing.
        if (focusTarget.entity_type === 'PLANETARY') {
            // Set the position to the calculated satelite position.
            // camera.position.set(
            //     controls.target.x + (focusTarget.radius * 1.25),
            //     controls.target.y + (focusTarget.radius * 1.25),
            //     controls.target.z + (focusTarget.radius * 1.25)
            // );
        }

        // If focussing on a structure, track camera to it.
        if (!cameraTween && focusTarget.entity_type === 'STRUCTURE') {
            // Read and mutate to parent centre position.
            const parentPos = new THREE.Vector3();
            focusTarget.parent.getWorldPosition(parentPos);

            // Set the position to the calculated satelite position.
            camera.position.set(
                2 * controls.target.x - parentPos.x,
                2 * controls.target.y - parentPos.y,
                2 * controls.target.z - parentPos.z
            );
        }

        // If focussed on player and it's me, track the camera to it.
        if (focusTarget.entity_type === 'PLAYER') {
            camera.position.set(controls.target.x, controls.target.y, controls.target.z);
        }
    }

    // Update controls, positioning depends upon it - do not pause even for tweening.
    controls.update();
}
