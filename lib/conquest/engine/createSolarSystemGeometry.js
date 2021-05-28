import * as THREE from 'three';

export default function createSolarSystemGeometry({ scene }) {
    // Setup the geometry
    const debuggingSatelite = new THREE.IcosahedronGeometry(0.15, 1);
    const debuggingSateliteMaterial = new THREE.MeshBasicMaterial({
        color: 0xfdcf29,
        wireframe: true
    });

    const sateliteSphere = new THREE.Mesh(debuggingSatelite, debuggingSateliteMaterial);
    scene.add(sateliteSphere);

    const sunGeometry = new THREE.IcosahedronGeometry(20, 2);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xf6c801,
        wireframe: true
    });
    const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sunSphere);

    const earthRadius = 5;
    const earthGeometry = new THREE.IcosahedronGeometry(earthRadius, 5);
    const earthMaterial = new THREE.MeshBasicMaterial({
        color: 0x4cff00,
        wireframe: true
    });
    const earthSphere = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthSphere);

    const moonGeometry = new THREE.IcosahedronGeometry(.75, 1);
    const moonMaterial = new THREE.MeshBasicMaterial({
        color: 0xfffff1,
        wireframe: true
    });
    const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
    scene.add(moonSphere);

    // Create the pivots for rotation as groups.
    const sunPivot = new THREE.Group();
    const earthPivot = new THREE.Group();

    // Add the ambient light where the sun is... the sun never moves. :D
    scene.add(new THREE.PointLight(0xffffff, 0.1));

    // Add all to sun pivot (not sun to avoid rotating the sun...???)
    sunPivot.add(earthPivot);
    
    earthPivot.add(earthSphere);
    earthPivot.add(moonSphere);

    scene.add(sunPivot);
    scene.add(earthPivot);

    // Impart Earth's orbital offset from the sun.
    earthSphere.position.x = 80;

    // Impart moon's orbital offset from the Earth.
    moonSphere.position.x = earthSphere.position.x + 17;


    return { sunPivot, earthPivot, earthSphere, sunSphere, moonSphere, sateliteSphere, earthRadius };
}
