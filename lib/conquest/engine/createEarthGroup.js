import * as THREE from 'three';
import { ENTITY_TYPES } from '../interfaces';

export default async function createEarthGroup() {
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

    // Access face data as a creation reference.
    const basesResp = await fetch('https://cooperchickenbot.herokuapp.com/bases');
    const bases = await basesResp.json();

    console.log(bases);
  
    // Create the actual face data geometry.
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
  
      const facePointerMaterial = new THREE.MeshLambertMaterial();
  
      let facePointerGeometry = new THREE.BoxGeometry(.1, .1, .1);
      let faceStructureBox = new THREE.Mesh(facePointerGeometry, facePointerMaterial);
  
      faceStructureBox.castShadow = true;
      faceStructureBox.receiveShadow = true;
  
      // Attempt to pass it a type for camera treatment.
      faceStructureBox.entity_type = ENTITY_TYPES.STRUCTURE;

      // Position the structure at its position.
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
        structure: {
          mesh: faceStructureBox
        },
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
  
    earthSphere.castShadow = true;
    earthSphere.receiveShadow = true;
    
  
    window.CONQUEST.earthSphere = earthSphere;
  
    earthGroup.add(earthSphere);
  
    earthSphere.position.x = 0;
    earthGroup.add(earthSphere);
  
    return { earthSphere, earthGroup };
  }