import * as THREE from 'three';
import { ENTITY_TYPES } from '../../conquest/interfaces';

export default function updateControls() {
    const { controls, camera } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    // Move camera and update its rotation.
    if (focusTarget && cameraTween) cameraTween.update();

    // Move the controls target to the center.
    if (focusTarget) focusTarget.getWorldPosition(controls.target);

    // This is the correct code and placement, but it lacks the correct calculation.
    // If focussing on a structure, track camera to it.
    // if (focusTarget.entity_type === ENTITY_TYPES.STRUCTURE) 
        // camera.position.set(controls.target.x, controls.target.y, controls.target.z + 2);

    // Update controls, positioning depends upon it.
    controls.update();
}