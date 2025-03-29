import { SphereGeometry, Mesh, MeshBasicMaterial, Color, BufferAttribute, Vector3, Quaternion } from 'three';
import Engine from './engine.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';

// Expose VehicleManager globally for debugging
if (typeof window !== 'undefined') {
    window.VehicleManager = VehicleManager;
}

// Manages all celestial bodies and their relationships
// Currently handles planet creation and placement
export default class SceneManager {
    // Array of all planets in the scene
    // Referenced by Physics system for gravity calculations
    static planets = [];


    static reallybasicNoise(x, y, z, scale) {
        return (Math.sin((y * 0.1) * scale) + Math.sin((x * 0.11 + 0.2) * scale) + Math.sin((z * 0.15 + 0.3) * scale)) / scale;
    }

    static buildPlanetMesh(geometry, planetData) {
        const positionNumComponents = 3;
        const colorNumComponents = 3;
        const vertexCount = geometry.attributes.position.array.length / positionNumComponents;
        const colours = new Float32Array(vertexCount * colorNumComponents);

        const water = new Color(planetData.watercolor);
        const land = new Color(planetData.color);

        for (let i = 0; i < vertexCount; i++) {
            const x = geometry.attributes.position.array[i * positionNumComponents + 0];
            const y = geometry.attributes.position.array[i * positionNumComponents + 1];
            const z = geometry.attributes.position.array[i * positionNumComponents + 2];

            let magnitude = this.reallybasicNoise(x, y, z, 1) + 
                          this.reallybasicNoise(x, y, z, 2) + 
                          this.reallybasicNoise(x, y, z, 0.5);
            const result = water.clone().lerp(land, (magnitude) /2);

            colours[i * colorNumComponents] = result.r;
            colours[i * colorNumComponents + 1] = result.g;
            colours[i * colorNumComponents + 2] = result.b;
        }
        
        geometry.setAttribute('color', new BufferAttribute(colours, 3));
    }

    // Position an object on a planet's surface at given latitude/longitude
    static positionObjectOnPlanet(object, planet, latitude, longitude, heightOffset = 0) {
        // Fix: Use planet.radius directly instead of planet.geometry.parameters.radius
        const planetRadius = planet.radius;

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
        // Fix: Use planet.object.position instead of planet.position
        object.position.copy(planet.object.position).add(offsetPosition);
    }
    
    static setup() {
        // Planet configuration array
        // Each entry defines:
        // - radius: Size of the planet (affects gravity strength)
        // - color: Visual appearance in wireframe mode
        // - position: [x,y,z] coordinates in world space
        // - CoF coefficent of terrain friction, 0 to 1
        this.planets = [
            {
                name: "Alpha", // Added planet name
                radius: 200, color: 0x800080, watercolor: 0x0000ff, position: [0, -4000, 0], CoF: 0.2, objects:[
                    //{ type: "Wall", latitude: 0, longitude: 0 },           // "Equator" position
                    { type: "Wall", latitude: 45, longitude: 0 },          // North-East
                    { type: "Wall", latitude: -30, longitude: 120 },       // South-West
                    { type: "Wall", latitude: 15, longitude: -60 },        // North-West
                    { type: "Wall", latitude: -45, longitude: -120 }       // South-East
                ] },    // Even larger main planet
            {
                name: "Beta", // Added planet name
                radius: 120, color: 0x404040, watercolor: 0x0000ff, position: [5000, 0, 0], CoF: 0.2, objects: [
                  //  { type: "Wall", latitude: 0, longitude: 0 },           // "Equator" position
                    { type: "Wall", latitude: 45, longitude: 0 },          // North-East
                    { type: "Wall", latitude: -30, longitude: 120 },       // South-West
                    { type: "Wall", latitude: 15, longitude: -60 },        // North-West
                    { type: "Wall", latitude: -45, longitude: -120 }       // South-East
                ] }      // Even larger second planet, further away
        ].map((planetData) => {
            const { radius, color, position, objects }  = planetData;
            // Create planet mesh:
            // - SphereGeometry(radius, widthSegments, heightSegments)
            // - More segments = smoother sphere but higher polygon count
            
            const geometry = new SphereGeometry(radius, 128, 128);
            this.buildPlanetMesh(geometry, planetData);
        
            const planet = new Mesh(
                geometry,
                new MeshBasicMaterial({ color: 0xFFFFFF, vertexColors: true, wireframe: false })
            );
            
            // Position planet in world space
            // spread operator converts array to individual arguments
            planet.position.set(...position);
            
            // Mark this object as a planet for physics and other systems
            planet.userData.isPlanet = true;
            
            // Add to Three.js scene for rendering
            Engine.scene.add(planet);

            planetData.object = planet;

            objects.forEach(wall => {
                // Add some walls to this planet
                ObjectManager.createWall(planetData, wall);
            });

            return planetData;
        });

        // Create vehicles on planets
        this.setupVehicles();
        
        // Set up vehicle entry interaction
        VehicleManager.setupVehicleInteractions();
    }

    // Create vehicles on the planets
    static setupVehicles() {
        console.log("Setting up vehicles on planets...");
        
        // Clear any existing vehicles first to prevent duplicates
        if (VehicleManager.vehicles.length > 0) {
            console.log("Clearing existing vehicles before spawning new ones");
            
            // Remove each vehicle from the scene
            VehicleManager.vehicles.forEach(vehicle => {
                if (vehicle) {
                    Engine.scene.remove(vehicle);
                    
                    // Clean up any collidables
                    if (vehicle.collidable) {
                        ObjectManager.unregisterCollidable(vehicle);
                    }
                }
            });
            
            // Clear the array
            VehicleManager.vehicles = [];
        }
        
        // Create vehicles on the first planet (Alpha) with better spacing to avoid overlaps
        if (this.planets[0]) {
            const alpha = this.planets[0];
            // Create cars at more varied locations
            VehicleManager.createCar(alpha, 0, 0);        // At equator intersection
            VehicleManager.createCar(alpha, 45, 45);      // Northeast
            VehicleManager.createCar(alpha, -45, -45);    // Southwest
            VehicleManager.createCar(alpha, 90, 0);       // North pole
            console.log(`Created 4 cars on ${alpha.name}`);
            
            // Create an airplane on Alpha planet
            VehicleManager.createAirplane(alpha, 30, 120);
        }
        
        // Create vehicles on the second planet (Beta) with better spacing
        if (this.planets[1]) {
            const beta = this.planets[1];
            // Create cars at varied locations
            VehicleManager.createCar(beta, 30, 30);       // Northeast
            VehicleManager.createCar(beta, -30, -30);     // Southwest
            VehicleManager.createCar(beta, 0, 90);        // East
            console.log(`Created 3 cars on ${beta.name}`);
            
            // Create an airplane on Beta planet with different coordinates
            VehicleManager.createAirplane(beta, -15, 90);  // Southeast
        }
        
        // Log the total number of vehicles created
        const carCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'car').length;
        const airplaneCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'airplane').length;
        console.log(`Created a total of ${VehicleManager.vehicles.length} vehicles: ${carCount} cars and ${airplaneCount} airplanes`);
    }
};
