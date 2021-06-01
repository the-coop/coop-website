import { Tween, Easing } from '@tweenjs/tween.js';
import { ENTITY_TYPES } from '../interfaces';

const cameraTween = (cameraRef, target) => 
    window.CONQUEST.VIEW.cameraTween = new Tween(cameraRef.position)
        .to({ x: target.x, y: target.y }, 1500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => window.CONQUEST.VIEW.cameraTween = null)
        .start();

export default function setFocusTarget(meshTarget) {
    const { controls, camera } = window.CONQUEST;

    // Set the new target.
    window.CONQUEST.VIEW.focusTarget = meshTarget;

    // Lock camera to target planet.
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);
    
    if (meshTarget.entity_type === ENTITY_TYPES.STRUCTURE) {

        // Tween the position change of the camera.
        cameraTween(camera, controls.target);
    }

    if (meshTarget.entity_type === ENTITY_TYPES.PLANETARY) {
        // Modify the camera/control settings for this new target/diameter subject.

        // Tween the position change of the camera.
        cameraTween(camera, controls.target);
    }
}