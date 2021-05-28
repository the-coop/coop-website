import * as THREE from 'three';

export default function runEngine({ renderer, scene, camera, sunPivot, earthPivot, earthSphere, sunSphere, moonSphere, sateliteSphere, earthRadius }) {
    // Modifier for overall orbit speed.
    const orbitBaseSpeed = 10;

    // Orbital parameters in seconds.
    const earthPivotPeriod = 50 * orbitBaseSpeed;
    const sunPivotPeriod = 100 * orbitBaseSpeed;
    const earthSpherePeriod = 10 * orbitBaseSpeed;
    const moonSpherePeriod = 10 * orbitBaseSpeed;
    const sunSpherePeriod = 10 * orbitBaseSpeed;

    // Make camera zoom to planet onclick.
    const mouse = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    document.addEventListener('click', checkForClickedPlanets);

    // Time delta
    const clock = new THREE.Clock();

    // Deterministic time variable.
    let timeIncrement = 0;
    let focusTarget = null;

    // Makes lock animation gradually faster over time. Must always be reset to 0 for every new focus
    let focusLockAnimationIncrementor = 0;
    let lookatNeeded = false;

    let didLog = false;

    camera.position.z = 35;

    const animate = () => {
        timeIncrement += clock.getDelta();

        // Orbit the Earth around the sun.
        sunPivot.rotation.z = 2 * Math.PI * timeIncrement / sunPivotPeriod;

        // Orbit the moon around the Earth.
        earthPivot.rotation.z = 2 * Math.PI * timeIncrement / earthPivotPeriod;

        // Rotate the planets under their own motion/weight.
        earthSphere.rotation.z = 2 * Math.PI * timeIncrement / earthSpherePeriod;

        // Improve the rotations? [Later]
        moonSphere.rotation.z = 2 * Math.PI * timeIncrement / moonSpherePeriod;
        sunSphere.rotation.z = 2 * Math.PI * timeIncrement / sunSpherePeriod;

        if (focusTarget) {
            focusLockAnimationIncrementor = 1;

            // Create a vector towards the focus target.
            const focusTargetVector = new THREE.Vector3(0, 0, 0);
            focusTarget.getWorldPosition(focusTargetVector);
            
            const focusTargetRadius = focusTarget.geometry.parameters.radius;

            const sateliteTarget = new THREE.Vector3(0, 0, 0);
            sateliteSphere.getWorldPosition(sateliteTarget);
            // Check if Camera is locked to camera
            if (camera.position.clone().floor() === focusTargetVector.clone().floor()) {
                camera.position.copy(focusTargetVector.clone().floor());
                resetFocusTarget();
            }
            // Move the camera to the Earth, with some buffering distance.
            if (camera.position.x < focusTargetVector.x + (focusTargetRadius * 1.5))
            camera.position.x += focusLockAnimationIncrementor;

            if (camera.position.y < focusTargetVector.y + (focusTargetRadius * 1.5))
            camera.position.y += focusLockAnimationIncrementor;

            // Comments?
            if (camera.position.x > focusTargetVector.x + (focusTargetRadius * 1.5))
            camera.position.x -= 1;

            if (camera.position.y > focusTargetVector.y + (focusTargetRadius * 1.5))
            camera.position.y -= 1;

            // Move the artifical satelite to the center of the Earth.
            sateliteSphere.position.x = focusTargetVector.x;
            sateliteSphere.position.y = focusTargetVector.y;
            sateliteSphere.position.z = focusTargetVector.z + earthRadius;
        }

        // Log the data of the of faces
        if (!didLog) {
            console.log(earthSphere);

            didLog = true;
        }

        // Render the scenes, planets, and other objects.
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }

    animate();

    const setFocusTarget = (target) => {
        console.log({...target.position})
        focusTarget = target;
        focusLockAnimationIncrementor = 0;
        lookatNeeded = true;
    }

    const resetFocusTarget = () => {
        focusTarget = null;
        lookatNeeded = false;
    }

    const checkForClickedPlanets = (clickEvent) => {
        mouse.x = (clickEvent.clientX / window.innerWidth) * 2 - 1
        mouse.y = - (clickEvent.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersections = raycaster.intersectObjects(scene.children, true);
        if (intersections.length) setFocusTarget(intersections[0].object);
    }
}