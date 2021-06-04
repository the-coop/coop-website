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
                // Generate a position slightly above the structure.
                const sateliteLockPosition = controls.target.addScaledVector(focusTarget.position, 2);
                
                // Set the position to the calculated satelite position.
                camera.position.set(
                    sateliteLockPosition.x, 
                    sateliteLockPosition.y, 
                    sateliteLockPosition.z
                );
            }
        }
    }

    // Update controls, positioning depends upon it - do not pause even for tweening.
    controls.update();
}