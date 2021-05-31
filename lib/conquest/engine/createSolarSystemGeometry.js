import * as THREE from 'three';

export function createEarthGroup() {
    const { scene, BIOMES } = window.CONQUEST;

    const earthRadius = 5;
    window.CONQUEST.earthRadius;

    const earthGroup = new THREE.Group;
    window.CONQUEST.earthGroup = earthGroup;

    const earthGeometry = new THREE.IcosahedronGeometry(earthRadius, 4);
    const earthMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    const earthSphere = new THREE.Mesh(earthGeometry, earthMaterial);
    window.CONQUEST.earthSphere = earthSphere;

    // Impart Earth's orbital offset from the sun.
    earthSphere.position.x = 80;

    earthGroup.add(earthSphere);

    const positionsRaw = earthGeometry.getAttribute('position').array;
    const vertices = _.chunk(positionsRaw, 3);
    const triangles = _.chunk(vertices, 3);

    triangles.map((triangle, index) => {
    	const facePointerGeometry = new THREE.BoxGeometry(.1, .1, .1);
    	const facePointerMaterial = new THREE.MeshLambertMaterial();
    	const faceStructureBox = new THREE.Mesh(facePointerGeometry, facePointerMaterial);

    	faceStructureBox.position.x = earthSphere.position.x + (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3;
    	faceStructureBox.position.y = (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3;
    	faceStructureBox.position.z = (triangle[0][2] + triangle[1][2] + triangle[2][2]) / 3;

    	// Lock its rotation onto the planet's surface using vector comparison.
    	faceStructureBox.lookAt(earthSphere.position);

    	// Add the pointer sphere to the scene and group.
    	earthGroup.add(faceStructureBox);
    	scene.add(faceStructureBox);

    	const randomBiome = BIOMES[Math.floor(Math.random() * BIOMES.length)];

    	// Store the face data for access.
    	window.CONQUEST.faces[index] = {
    		biome: randomBiome,
    		position: faceStructureBox.position,
    		structure: null,
    		players: null
    	};
    });

    scene.add(earthSphere);

    return { earthSphere, earthGroup };
}


export default function createSolarSystemGeometry() {
    const { scene } = window.CONQUEST;

    // Setup the geometry
    const debuggingSatelite = new THREE.IcosahedronGeometry(0.15, 1);
    const debuggingSateliteMaterial = new THREE.MeshBasicMaterial({ color: 0xfdcf29, wireframe: true });

    const sateliteSphere = new THREE.Mesh(debuggingSatelite, debuggingSateliteMaterial);
    scene.add(sateliteSphere);

    // Add the ambient light where the sun is... the sun never moves. :D
    scene.add(new THREE.PointLight(0xffffff, 0.1));

    // TODO: Make the light based on the sun.
    const light1 = new THREE.DirectionalLight(0xffffff, 0.5);
    light1.position.set(1, 1, 1);
    scene.add(light1);

    const sunGeometry = new THREE.IcosahedronGeometry(20, 2);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xf6c801, wireframe: true });
    const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sunSphere);

    // Generate the Earth group.
    const { earthSphere, earthGroup } = createEarthGroup();


    const moonGeometry = new THREE.IcosahedronGeometry(.75, 1);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffff1, wireframe: true });
    const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
    scene.add(moonSphere);

    // Create the pivots for rotation as groups.
    const sunPivot = new THREE.Group();
    const earthPivot = new THREE.Group();

    // Add all to sun pivot (not sun to avoid rotating the sun...???)
    sunPivot.add(earthPivot);
    
    earthGroup.add(moonSphere);
    earthPivot.add(earthGroup);

    scene.add(sunPivot);
    scene.add(earthPivot);

    // Impart moon's orbital offset from the Earth.
    moonSphere.position.x = earthSphere.position.x + 17;


    window.CONQUEST.sunPivot = sunPivot;
    window.CONQUEST.earthPivot = earthPivot;
    window.CONQUEST.sunSphere = sunSphere;
    window.CONQUEST.moonSphere = moonSphere;
    window.CONQUEST.sateliteSphere = sateliteSphere;
}





// const color = new THREE.Color;
// const colors = [];
// vertices.push(triangle[0][0], triangle[0][1], triangle[0][2]);
// vertices.push(triangle[1][0], triangle[1][1], triangle[1][2]);
// vertices.push(triangle[2][0], triangle[2][1], triangle[2][2]);

// color.setRGB(Math.abs(triangle[2][1]) / earthRadius, 0.5, 0.5);
// colors.push(color.r, color.g, color.b);
// colors.push(color.r, color.g, color.b);
// colors.push(color.r, color.g, color.b);

// // Make a face seperated geomtry
// const earthFaceGeometry = new THREE.BufferGeometry();
// const earthPositionAttribute = new THREE.BufferAttribute(new Float32Array(vertices));
// earthFaceGeometry.setAttribute('position', earthPositionAttribute, 3);

// // Set the colour attribute
// const earthColourAttribute = new THREE.BufferAttribute(new Float32Array(colors));
// // earthFaceGeometry.setAttribute('color', earthColourAttribute, 3);

// // compute Normals - why?
// earthFaceGeometry.computeVertexNormals();

// // normalize the earthFaceGeometry - why?