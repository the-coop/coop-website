import * as THREE from 'three';
import { ENTITY_TYPES } from '../../conquest/interfaces';

export default function updateControls() {
    const { controls, camera, earthSphere } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    // Move camera and update its rotation.
    if (focusTarget && cameraTween) cameraTween.update();

    // Move the controls target to the center.
    if (focusTarget) {
        // Center the controls based on moving target position (references focus target position, updates vector).
        focusTarget.getWorldPosition(controls.target);
        
        // No special handling currently needed for planetary bodies camera focussing.
        // if (focusTarget.entity_type === ENTITY_TYPES.PLANETARY) {}

        // If focussing on a structure, track camera to it.
        if (focusTarget.entity_type === ENTITY_TYPES.STRUCTURE) {
            // This is the correct code and placement, but it lacks the correct calculation.
            if (!cameraTween) {
                // Read and mutate to parent centre position.
                const parentPos = new THREE.Vector3();
                focusTarget.parent.getWorldPosition(parentPos);

                // Set the position to the calculated satelite position.
                camera.position.set(
                    ((1 + camera.zoom) * controls.target.x - camera.zoom * parentPos.x),
                    ((1 + camera.zoom) * controls.target.y - camera.zoom * parentPos.y),
                    ((1 + camera.zoom) * controls.target.z - camera.zoom * parentPos.z),
                );

                // camera.zoom = 10;
                console.log(camera.zoom);
            }
        }
    }

    // Update controls, positioning depends upon it - do not pause even for tweening.
    controls.update();
}