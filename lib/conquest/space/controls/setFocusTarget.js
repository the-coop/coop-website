import { Tween, Easing } from '@tweenjs/tween.js';
import { Vector3 } from 'three';
import ENTITY_TYPES from '../entity-types';



const isFocusStructure = () => isFocusType('STRUCTURE');

const isFocusType = type => !!(window.CONQUEST.VIEW.focusTarget 
    && window.CONQUEST.VIEW.focusTarget.entity_type === ENTITY_TYPES[type]);

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
                setTimeout(() => zoomTween(cameraRef, 3), 500);
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
    
    // TODO: Replace below 4 lines with overlay menu toggled to locked/unlocked for camera
    // Prevent focus changing whilst locked into a structure to ease some jankiness.
    // This may be too excessive :D see below guard
    // if (prevWasStructure) return false;
    let prevWasStructure = isFocusStructure();

    window.CONQUEST.VIEW.focusTarget = meshTarget;

    // Lock camera to target center.
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    if (meshTarget.entity_type === ENTITY_TYPES.STRUCTURE) {       
        // Read and mutate to parent centre position.
        const parentPos = new Vector3();
        meshTarget.parent.getWorldPosition(parentPos);

        // Set the position to the calculated satelite position.
        structureTween(camera, {
            x: ((1 + camera.zoom) * controls.target.x - camera.zoom * parentPos.x),
            y: ((1 + camera.zoom) * controls.target.y - camera.zoom * parentPos.y),
            z: ((1 + camera.zoom) * controls.target.z - camera.zoom * parentPos.z)
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