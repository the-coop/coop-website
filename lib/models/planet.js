import * as THREE from 'three';

export class PlanetModel {
  constructor(radius = 200, terrainHeight = 30) {
    this.radius = radius;
    this.terrainHeight = terrainHeight;
    this.subdivisions = 5;
  }

  generateTerrain() {
    const geometry = new THREE.IcosahedronGeometry(this.radius, this.subdivisions);
    
    // Apply terrain displacement
    const positions = geometry.attributes.position.array;
    const vertex = new THREE.Vector3();
    
    for (let i = 0; i < positions.length; i += 3) {
      vertex.set(positions[i], positions[i + 1], positions[i + 2]);
      
      const dir = vertex.clone().normalize();
      const theta = Math.atan2(vertex.x, vertex.z);
      const phi = Math.acos(vertex.y / vertex.length());
      
      // Generate terrain height
      let height = 0;
      height += Math.sin(theta * 1.5) * Math.cos(phi * 2) * 0.3;
      height += Math.cos(theta * 1.2) * Math.sin(phi * 1.8) * 0.25;
      
      const mountainNoise = Math.sin(theta * 4) * Math.cos(phi * 3);
      if (mountainNoise > 0.3) {
        height += mountainNoise * 0.5;
      }
      
      height += Math.sin(theta * 8) * Math.cos(phi * 6) * 0.15;
      height += Math.cos(theta * 10) * Math.sin(phi * 8) * 0.1;
      height += Math.sin(theta * 20) * Math.cos(phi * 15) * 0.05;
      
      if (Math.abs(height) < 0.1) {
        height *= 0.3;
      }
      
      height = (height + 1) * 0.5;
      const finalRadius = this.radius + (height * this.terrainHeight) - this.terrainHeight * 0.3;
      
      const newPos = dir.multiplyScalar(finalRadius);
      positions[i] = newPos.x;
      positions[i + 1] = newPos.y;
      positions[i + 2] = newPos.z;
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    return geometry;
  }

  createMesh(position = new THREE.Vector3(0, -250, 0)) {
    const geometry = this.generateTerrain();
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a7c4a,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    
    return mesh;
  }

  createFromServerData(data) {
    let geometry;
    
    if (data.terrain_data && data.terrain_data.vertices && data.terrain_data.indices) {
      console.log('Using server terrain data with', data.terrain_data.vertices.length / 3, 'vertices');
      
      geometry = new THREE.BufferGeometry();
      
      const vertices = new Float32Array(data.terrain_data.vertices);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      
      const indices = new Uint32Array(data.terrain_data.indices);
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      
      geometry.computeVertexNormals();
    } else {
      console.log('Generating terrain locally (no server data)');
      geometry = this.generateTerrain();
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: 0x3a7c4a,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(data.position.x, data.position.y, data.position.z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    
    return mesh;
  }

  getCollisionData(geometry) {
    const positions = geometry.attributes.position.array;
    
    let indices;
    if (geometry.index) {
      indices = geometry.index.array;
    } else {
      const vertexCount = positions.length / 3;
      indices = new Uint32Array(vertexCount);
      for (let i = 0; i < vertexCount; i++) {
        indices[i] = i;
      }
    }
    
    const colliderVertices = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i++) {
      colliderVertices[i] = positions[i];
    }
    
    return { vertices: colliderVertices, indices };
  }
}
