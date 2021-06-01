import * as THREE from 'three';
import { ENTITY_TYPES } from '../../conquest/interfaces';

export default function updateControls() {
    const { controls, camera } = window.CONQUEST;
    const { focusTarget, cameraTween } = window.CONQUEST.VIEW;

    let shouldUpdate = true;

    // Move camera and update its rotation.
    if (focusTarget && cameraTween) cameraTween.update();

    // Move the controls target to the center.
    if (focusTarget) focusTarget.getWorldPosition(controls.target);

    // Update and smooth camera if it isn't already being animated.
    if (cameraTween) shouldUpdate = false;

    // If focussing on a structure, track camera to it.
    if (focusTarget.entity_type === ENTITY_TYPES.STRUCTURE) 
        camera.position.set(controls.target.x, controls.target.y, controls.target.z);

    // Update controls if not locked/frozen.
    if (shouldUpdate) controls.update();
}