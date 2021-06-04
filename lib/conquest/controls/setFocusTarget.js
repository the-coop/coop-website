import { Tween, Easing } from '@tweenjs/tween.js';
import { ENTITY_TYPES } from '../interfaces';
import * as THREE from 'three';

const zoomTween = (cameraRef, zoom) => 
    new Tween(cameraRef)
        .to({ zoom }, 2000)
        .easing(Easing.Quadratic.Out)
        .start();

const structureTween = (cameraRef, target, zoom = false) => 
    window.CONQUEST.VIEW.cameraTween = new Tween(cameraRef.position)
        .to({ x: target.x, y: target.y, z: target.z }, 500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => {
            window.CONQUEST.VIEW.cameraTween = null;

            if (zoom)
                setTimeout(() => zoomTween(cameraRef, 50), 500);
        })
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
    let prevWasStructure = false;
    if (window.CONQUEST.VIEW.focusTarget) {
        console.log(window.CONQUEST.VIEW.focusTarget)
        if (window.CONQUEST.VIEW.focusTarget.entity_type === ENTITY_TYPES.STRUCTURE)
            prevWasStructure = true;
    }
    window.CONQUEST.VIEW.focusTarget = meshTarget;

    // Lock camera to target center.
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    if (meshTarget.entity_type === ENTITY_TYPES.STRUCTURE) {       
        // Read and mutate to parent centre position.
        const parentPos = new THREE.Vector3();
        meshTarget.parent.getWorldPosition(parentPos);

        // Set the position to the calculated satelite position.
        structureTween(camera, {
            x: 2 * controls.target.x - parentPos.x, 
            y: 2 * controls.target.y - parentPos.y, 
            z: 2 * controls.target.z - parentPos.z
        }, !prevWasStructure);

        controls.noRotate = true;

        meshTarget.scale.x = meshTarget.scale.x * 2;
        meshTarget.scale.y = meshTarget.scale.y * 2;
        meshTarget.scale.z = meshTarget.scale.z * 4;

        camera.up.set(0, 0, 1);
    }
    
    if (meshTarget.entity_type === ENTITY_TYPES.PLANETARY) {
        // Tween the position change of the camera.
        planetaryTween(camera, controls.target);

        controls.noRotate = false;
    }

}