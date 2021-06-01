import _ from "lodash";
import setFocusTarget from "./setFocusTarget";

export default function clickControls(clickEvent) {
    const { raycaster, mouse } = window.CONQUEST.VIEW;
    const { scene, camera } = window.CONQUEST;

    // Only works if canvas takes up full screen size
    mouse.x = (clickEvent.clientX / window.innerWidth) * 2 - 1
    mouse.y = - (clickEvent.clientY / window.innerHeight) * 2 + 1;

    // Collision check children from the mouse-camera vector perspective.
    raycaster.setFromCamera(mouse, camera);

    // Recursively collect the raycast intersection/collections of click.
    const intersections = raycaster.intersectObjects(scene.children, true);
    const intersectionResult = intersections[0] || null;
    if (!intersectionResult) return false;

    const currentTarget = window.CONQUEST.VIEW.focusTarget;
    const newTarget = intersectionResult.object.uuid;

    // Check current target different from new target.
    if (currentTarget && currentTarget.uuid === newTarget)
        return false;
        
    console.log(currentTarget);

    console.log(window.CONQUEST.VIEW.focusTarget);
    console.log(currentTarget, newTarget);
    setFocusTarget(intersectionResult)
}