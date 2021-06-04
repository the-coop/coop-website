import { Tween, Easing } from '@tweenjs/tween.js';
import { ENTITY_TYPES } from '../interfaces';

const structureTween = (cameraRef, target) => 
    window.CONQUEST.VIEW.cameraTween = new Tween(cameraRef.position)
        .to({ x: target.x, y: target.y, z: target.z }, 500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => window.CONQUEST.VIEW.cameraTween = null)
        .start();

const planetaryTween = (cameraRef, target) => 
    window.CONQUEST.VIEW.cameraTween = new Tween(cameraRef.position)
        .to({ x: target.x, y: target.y }, 1500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => window.CONQUEST.VIEW.cameraTween = null)
        .start();

export default function setFocusTarget(meshTarget) {
    const { controls, camera } = window.CONQUEST;

    // Set the new target.
    window.CONQUEST.VIEW.focusTarget = meshTarget;

    // Lock camera to target center.
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    if (meshTarget.entity_type === ENTITY_TYPES.STRUCTURE) {       
        // Generate a position slightly above the structure.
        const sateliteLockPosition = controls.target.addScaledVector(meshTarget.position, 2);
        
        // Set the position to the calculated satelite position.
        structureTween(camera, {...sateliteLockPosition});

        controls.noRotate = true;

        meshTarget.scale.x = meshTarget.scale.x * 2;
        meshTarget.scale.y = meshTarget.scale.y * 2;
        meshTarget.scale.z = meshTarget.scale.z * 4;
    }
    
    if (meshTarget.entity_type === ENTITY_TYPES.PLANETARY) {
        // Tween the position change of the camera.
        planetaryTween(camera, controls.target);

        controls.noRotate = false;
        // camera.zoom = 5;
    }

}