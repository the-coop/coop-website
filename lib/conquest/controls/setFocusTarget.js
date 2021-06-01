import { Tween, Easing } from '@tweenjs/tween.js';

export default function setFocusTarget(meshTarget) {
    const { controls, camera } = window.CONQUEST;

    // Lock camera to target planet.
    window.CONQUEST.VIEW.focusTarget = meshTarget;
    window.CONQUEST.VIEW.focusTarget.getWorldPosition(controls.target);

    // Modify the camera/control settings for this new target/diameter subject.
    console.log(meshTarget);

    console.log(window.CONQUEST.scene);

    let targetType = 'PLANETARY';

    // Read and update the target type from


    // TODO: If mesh target name is structure, treat it all very differently.
    if (meshTarget.userData.conquestType === 'STRUCTURE') {

    }

    // Tween the position change of the camera.
    window.CONQUEST.VIEW.cameraTween = new Tween(camera.position)
        .to({ x: controls.target.x, y: controls.target.y }, 1500)
        .easing(Easing.Quadratic.Out)
        .onComplete(() => window.CONQUEST.VIEW.cameraTween = null)
        .start();

    // TODO: Chain another animation into a nice camera position,
    // preferably the way josh intended.
}