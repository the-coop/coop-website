import { 
    BoxGeometry, 
    Mesh, 
    MeshBasicMaterial, 
    Vector3,
    Quaternion,
    Matrix4
} from 'three';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';

// Manages objects placed on planetary surfaces like walls, structures, etc.
export default class ObjectManager {
    // Store all created objects for reference
    static objects = [];
    
    // Initialize the object system
    static setup() {
        // Create walls and structures on each planet
        SceneManager.planets.forEach(planet => {
            // Add some walls to this planet
            this.createWallsOnPlanet(planet);
        });
    }
    
    // Create a set of walls on the given planet
    static createWallsOnPlanet(planet) {
        const planetRadius = planet.geometry.parameters.radius;
        const wallHeight = planetRadius * 0.05; // 5% of planet radius
        const wallWidth = planetRadius * 0.2;   // 20% of planet radius
        const wallDepth = planetRadius * 0.01;  // 1% of planet radius
        
        // Create walls at different positions around the planet
        const wallPositions = [
            { lat: 0, long: 0 },           // "Equator" position
            { lat: 45, long: 0 },          // North-East
            { lat: -30, long: 120 },       // South-West
            { lat: 15, long: -60 },        // North-West
            { lat: -45, long: -120 }       // South-East
        ];
        
        wallPositions.forEach(pos => {
            this.createWall(
                planet,
                wallWidth,
                wallHeight,
                wallDepth,
                pos.lat,
                pos.long
            );
        });
    }
    
    // Create a single wall on a planet at the specified latitude and longitude
    static createWall(planet, width, height, depth, latitude, longitude) {
        // Create the wall geometry
        const geometry = new BoxGeometry(width, height, depth);
        const material = new MeshBasicMaterial({ 
            color: 0x8844aa, 
            wireframe: true 
        });
        
        const wall = new Mesh(geometry, material);
        
        // Position the wall on the planet surface
        this.positionObjectOnPlanet(
            wall,
            planet,
            latitude,
            longitude,
            height / 2  // Offset so the bottom of the wall rests on surface
        );
        
        // Add the wall to the scene and our objects array
        Engine.scene.add(wall);
        this.objects.push(wall);
        
        return wall;
    }
    
    // Position an object on a planet's surface at given latitude/longitude
    static positionObjectOnPlanet(object, planet, latitude, longitude, heightOffset = 0) {
        const planetRadius = planet.geometry.parameters.radius;
        
        // Convert lat/long to radians
        const latRad = latitude * (Math.PI / 180);
        const longRad = longitude * (Math.PI / 180);
        
        // Calculate position on sphere
        const x = planetRadius * Math.cos(latRad) * Math.cos(longRad);
        const y = planetRadius * Math.sin(latRad);
        const z = planetRadius * Math.cos(latRad) * Math.sin(longRad);
        
        // Position relative to planet center
        const position = new Vector3(x, y, z);
        
        // Create orientation matrix to align with planet surface
        // This makes the object's "up" direction point away from planet center
        const surfaceNormal = position.clone().normalize();
        const objectUp = new Vector3(0, 1, 0); // Default up direction
        
        // Create quaternion to rotate from default orientation to surface orientation
        const alignmentQuaternion = new Quaternion();
        
        // Find rotation axis and angle between default up and surface normal
        const rotationAxis = new Vector3().crossVectors(objectUp, surfaceNormal).normalize();
        const angle = Math.acos(objectUp.dot(surfaceNormal));
        
        // Set quaternion from axis and angle
        if (rotationAxis.length() > 0.001) { // Avoid zero-length rotation axis
            alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
        }
        
        // Apply rotation to align with surface
        object.quaternion.copy(alignmentQuaternion);
        
        // Add height offset along the normal direction
        const offsetPosition = position.clone().add(
            surfaceNormal.clone().multiplyScalar(heightOffset)
        );
        
        // Position the object (relative to planet position)
        object.position.copy(planet.position).add(offsetPosition);
    }
    
    // Handle collisions with objects (could be implemented later)
    static checkCollisions(playerPosition, playerRadius) {
        // Future implementation for collision detection
    }
}
