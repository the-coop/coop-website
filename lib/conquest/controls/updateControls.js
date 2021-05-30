export default function updateControls() {
    const { controls, focusTarget } = window.CONQUEST;
    
    // Update and smooth camera.
    controls.update();

    if (focusTarget) {
        // Move Camera and update its rotation.
        cameraTween.update();
        
        // Create a vector towards the focus target.
        const focusTargetVector = new THREE.Vector3(0, 0, 0);
        focusTarget.getWorldPosition(focusTargetVector);
        
        // Move the artifical satelite to the center of the Earth.
        sateliteSphere.position.x = focusTargetVector.x;
        sateliteSphere.position.y = focusTargetVector.y;
        sateliteSphere.position.z = focusTargetVector.z + earthRadius;
    }
}