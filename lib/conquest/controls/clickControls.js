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
    const clickedObject = intersections[0] || null;
    const differentTarget = clickedObject !== window.CONQUEST.VIEW.focusTarget;
    if (clickedObject && differentTarget) setFocusTarget(clickedObject);
}