import * as THREE from 'three';
import { ENTITY_TYPES } from '../interfaces';

export function createEarthGroup() {
  const { BIOMES } = window.CONQUEST;

  const earthRadius = 5;
  window.CONQUEST.earthRadius;

  const earthGroup = new THREE.Group;
  window.CONQUEST.earthGroup = earthGroup;

  const earthGeometry = new THREE.IcosahedronGeometry(earthRadius, 4);

  const positionsRaw = earthGeometry.getAttribute('position').array;
  const vertices = _.chunk(positionsRaw, 3);
  const triangles = _.chunk(vertices, 3);

  const newvertices = [];
  const colors = [];

  const biomeKeys = Object.keys(BIOMES);

  triangles.map((triangle, index) => {
    // Add new non indexed face gometry
    newvertices.push(triangle[0][0], triangle[0][1], triangle[0][2]);
    newvertices.push(triangle[1][0], triangle[1][1], triangle[1][2]);
    newvertices.push(triangle[2][0], triangle[2][1], triangle[2][2]);
  
    const randomBiomeKey = biomeKeys[Math.floor(Math.random() * biomeKeys.length)];
    const randomBiomeColour = BIOMES[randomBiomeKey].colour;

    colors.push(randomBiomeColour.r, randomBiomeColour.g, randomBiomeColour.b);
    colors.push(randomBiomeColour.r, randomBiomeColour.g, randomBiomeColour.b);
    colors.push(randomBiomeColour.r, randomBiomeColour.g, randomBiomeColour.b);

    const facePointerGeometry = new THREE.BoxGeometry(.1, .1, .1);
    const facePointerMaterial = new THREE.MeshLambertMaterial();
    const faceStructureBox = new THREE.Mesh(facePointerGeometry, facePointerMaterial);

    // Attempt to pass it a type for camera treatment.
    faceStructureBox.entity_type = ENTITY_TYPES.STRUCTURE;
    

    faceStructureBox.position.x = (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3;
    faceStructureBox.position.y = (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3;
    faceStructureBox.position.z = (triangle[0][2] + triangle[1][2] + triangle[2][2]) / 3;

    // Lock its rotation onto the planet's surface using vector comparison.
    faceStructureBox.lookAt(0, 0, 0);

    // Add the pointer sphere to the scene and group.
    earthGroup.add(faceStructureBox);

    // Store the face data for access.
    window.CONQUEST.faces[index] = {
      biome: randomBiomeKey,
      position: faceStructureBox.position,
      structure: null,
      players: null
    };
  });


  // Make a face seperated geomtry
  const nonIndexedEarthGeometry = new THREE.BufferGeometry();
  nonIndexedEarthGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newvertices), 3));
  nonIndexedEarthGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));

  // Compute normals
  nonIndexedEarthGeometry.computeVertexNormals();


  const earthMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  const earthSphere = new THREE.Mesh(nonIndexedEarthGeometry, earthMaterial);

  earthSphere.entity_type = ENTITY_TYPES.PLANETARY;
  earthSphere.name = 'EARTH';

  window.CONQUEST.earthSphere = earthSphere;

  earthGroup.add(earthSphere);

  earthSphere.position.x = 0;
  earthGroup.add(earthSphere);

  return { earthSphere, earthGroup };
}


export default function createSolarSystemGeometry() {
  const { scene } = window.CONQUEST;

  // Set up the lighting.

  // Add the ambient light where the sun is... the sun never moves. :D
  scene.add(new THREE.PointLight(0xffffff, 0.1));

  // TODO: Make the light based on the sun.
  const light1 = new THREE.DirectionalLight(0xffffff, 0.75);
  light1.position.set(0, 0, 0);
  scene.add(light1);

  // Set up the geometry.
  const sunGeometry = new THREE.IcosahedronGeometry(20, 2);
  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xf6c801, wireframe: true });
  const sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
  sunSphere.entity_type = ENTITY_TYPES.PLANETARY;
  
  scene.add(sunSphere);

  // Generate the Earth group.
  createEarthGroup();

  const moonGeometry = new THREE.IcosahedronGeometry(.75, 1);
  const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffff1, wireframe: true });
  const moonSphere = new THREE.Mesh(moonGeometry, moonMaterial);
  moonSphere.entity_type = ENTITY_TYPES.PLANETARY;
  
  // Create the pivots for rotation as groups.
  const sunPivot = new THREE.Group();
  const earthPivot = new THREE.Group();

  // Add all to sun pivot (not sun to avoid rotating the sun...???)
  sunPivot.add(earthPivot);
  
  earthPivot.add(window.CONQUEST.earthGroup);

  window.CONQUEST.earthGroup.add(moonSphere);


  scene.add(sunPivot);
  scene.add(earthPivot);

  earthPivot.position.x = 80;
  // Impart moon's orbital offset from the Earth.
  moonSphere.position.x = 17;


  window.CONQUEST.sunPivot = sunPivot;
  window.CONQUEST.earthPivot = earthPivot;
  window.CONQUEST.sunSphere = sunSphere;
  window.CONQUEST.moonSphere = moonSphere;
}






