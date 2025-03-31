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

    // Add missing calculatePositionOnPlanet method to fix references
    static calculatePositionOnPlanet(planet, latitude, longitude, heightOffset = 0) {
        // Validate planet data
        if (!planet || !planet.radius || !planet.object || !planet.object.position) {
            console.error('Invalid planet data for position calculation');
            return new Vector3();
        }

        const planetRadius = planet.radius;
        const planetPosition = planet.object.position;

        // Convert lat/long to radians
        const latRad = latitude * (Math.PI / 180);
        const longRad = longitude * (Math.PI / 180);

        // Calculate position on sphere
        const x = planetRadius * Math.cos(latRad) * Math.cos(longRad);
        const y = planetRadius * Math.sin(latRad);
        const z = planetRadius * Math.cos(latRad) * Math.sin(longRad);

        // Create position vector and add height offset
        const position = new Vector3(x, y, z);
        const normal = position.clone().normalize();
        const finalPosition = position.clone().add(normal.multiplyScalar(heightOffset));

        // Apply planet position offset
        return finalPosition.add(planetPosition);
    }
    
    static setup() {
        // CRITICAL FIX: Check if Engine.scene is initialized before using it
        if (!Engine || !Engine.scene) {
            console.error("Engine.scene is not initialized. Make sure Engine.setup() is called before SceneManager.setup()");
            return; // Exit early to prevent further errors
        }

        // Planet configuration array
        // Each entry defines properties like radius, color, etc.
        this.planets = [
            {
                name: "Alpha",
                radius: 200, color: 0x800080, watercolor: 0x0000ff, position: [0, -4000, 0], CoF: 0.2, objects:[
                    { type: "Wall", latitude: 45, longitude: 0 },          // North-East
                    { type: "Wall", latitude: -30, longitude: 120 },       // South-West
                    { type: "Wall", latitude: 15, longitude: -60 },        // North-West
                    { type: "Wall", latitude: -45, longitude: -120 }       // South-East
                ]
            },
            {
                name: "Beta",
                radius: 120, color: 0x404040, watercolor: 0x0000ff, position: [5000, 0, 0], CoF: 0.2, objects: [
                    { type: "Wall", latitude: 45, longitude: 0 },          // North-East
                    { type: "Wall", latitude: -30, longitude: 120 },       // South-West
                    { type: "Wall", latitude: 15, longitude: -60 },        // North-West
                    { type: "Wall", latitude: -45, longitude: -120 }       // South-East
                ]
            }
        ].map((planetData) => {
            const { radius, color, position, objects } = planetData;
            
            // Create planet geometry and mesh
            const geometry = new SphereGeometry(radius, 128, 128);
            this.buildPlanetMesh(geometry, planetData);
            
            const planet = new Mesh(
                geometry,
                new MeshBasicMaterial({ color: 0xFFFFFF, vertexColors: true, wireframe: false })
            );
            
            // Position planet in world space
            planet.position.set(...position);
            
            // Mark this object as a planet for physics and other systems
            planet.userData.isPlanet = true;
            planet.name = planetData.name; // Ensure name is set for debugging
            
            // CRITICAL FIX: Add safety check before adding to scene
            if (Engine.scene) {
                Engine.scene.add(planet);
            } else {
                console.error(`Failed to add planet ${planetData.name} to scene: Engine.scene is undefined`);
                return planetData; // Return data even if we couldn't add to scene
            }

            // Assign planet object to planetData
            planetData.object = planet;

            // CRITICAL FIX: Ensure objects array exists before iterating
            if (objects && Array.isArray(objects)) {
                console.log(`Creating ${objects.length} walls for planet ${planetData.name}`);
                objects.forEach(wall => {
                    // Add some walls to this planet
                    ObjectManager.createWall(planetData, wall);
                });
            } else {
                console.warn(`Planet ${planetData.name} has no objects array defined`);
            }

            return planetData;
        });

        console.log(`Created ${this.planets.length} planets`);
        this.planets.forEach(planet => {
            console.log(`Planet ${planet.name}: radius=${planet.radius}, position=${planet.object.position.toArray()}`);
        });

        // Create vehicles on planets
        this.setupVehicles();
        
        // Set up vehicle entry interaction
        VehicleManager.setupVehicleInteractions();
    }

    // Create vehicles on the planets
    static setupVehicles() {
        console.log("Setting up vehicles on planets - using higher heights for visible falling");
        
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
        
        // CRITICAL FIX: Verify planets exist before creating vehicles
        if (!this.planets || this.planets.length === 0) {
            console.error("No planets available for vehicle creation!");
            return;
        }

        // Get the first planet
        const alpha = this.planets[0];
        if (!alpha || !alpha.object) {
            console.error("First planet is not properly initialized!");
            return;
        }
        
        console.log(`Creating vehicles on ${alpha.name} at position ${alpha.object.position.toArray()}`);
        
        // SIMPLIFIED: Create cars at various heights so we can see them fall
        const carPositions = [
            { lat: 0, lon: 0, height: 20 },          // Higher heights to see them fall
            { lat: 30, lon: 45, height: 25 },
            { lat: -30, lon: 90, height: 30 },
            { lat: 45, lon: -45, height: 35 },
            { lat: -45, lon: -90, height: 40 },
            { lat: 15, lon: 180, height: 45 },
            { lat: 60, lon: 120, height: 50 },
            { lat: -60, lon: -120, height: 55 }
        ];
        
        // Create cars at different heights
        carPositions.forEach(({lat, lon, height}, index) => {
            try {
                const car = VehicleManager.createCar(alpha, lat, lon, height);
                if (car) {
                    car.name = `Car-Alpha-${index}`;
                    console.log(`Created car ${car.name} at lat=${lat}, lon=${lon}, height=${height}`);
                    
                    // Let the car fall naturally with physics
                    car.userData.falling = true;
                    
                    // Add random rotation for variety
                    car.rotateY(Math.random() * Math.PI * 2);
                }
            } catch (e) {
                console.error(`Error creating car ${index}:`, e);
            }
        });
        
        // Create airplanes at higher altitudes
        try {
            const airplane1 = VehicleManager.createAirplane(alpha, 30, 120, 100);
            const airplane2 = VehicleManager.createAirplane(alpha, -30, -120, 120);
            console.log(`Created airplanes at heights 100 and 120`);
        } catch (e) {
            console.error("Error creating airplanes:", e);
        }
        
        // Create vehicles on second planet if it exists
        if (this.planets.length > 1) {
            const beta = this.planets[1];
            if (beta && beta.object) {
                // Create cars at various heights on second planet
                for (let i = 0; i < 4; i++) {
                    try {
                        const lat = (Math.random() * 180) - 90;
                        const lon = (Math.random() * 360) - 180;
                        const height = 20 + i * 10; // Higher heights from 20-50
                        
                        const car = VehicleManager.createCar(beta, lat, lon, height);
                        car.name = `Car-Beta-${i}`;
                        console.log(`Created car ${car.name} at lat=${lat}, lon=${lon}, height=${height}`);
                        
                        // Let physics handle falling
                        car.userData.falling = true;
                        car.userData.onSurface = false;
                        
                        // Add random rotation
                        car.rotateY(Math.random() * Math.PI * 2);
                    } catch (e) {
                        console.error(`Error creating Beta planet car ${i}:`, e);
                    }
                }
                
                // Add airplanes at higher heights
                VehicleManager.createAirplane(beta, -15, 90, 80);
                VehicleManager.createAirplane(beta, 15, -90, 100);
            }
        }
        
        // Log the final count of vehicles
        const carCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'car').length;
        const airplaneCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'airplane').length;
        console.log(`Created ${carCount} cars and ${airplaneCount} airplanes at higher heights`);
        
        // Log all vehicle positions for debugging
        VehicleManager.vehicles.forEach((vehicle, i) => {
            if (vehicle) {
                console.log(`Vehicle ${i}: type=${vehicle.userData.type}, position=${vehicle.position.toArray()}, falling=${vehicle.userData.falling}`);
            }
        });
    }
};
