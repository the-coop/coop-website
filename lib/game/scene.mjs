import { SphereGeometry, Mesh, MeshBasicMaterial, Color, BufferAttribute, Vector3, Quaternion, BoxGeometry } from 'three';
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
        if (!Engine || !Engine.scene) {
            console.error("Engine.scene is not initialized. Make sure Engine.setup() is called before SceneManager.setup()");
            return;
        }

        // ADDED: Debug logging for planet initialization
        console.log("SceneManager.setup: Initializing planets...");

        // Planet configuration array
        this.planets = [
            {
                name: "Alpha",
                radius: 200, color: 0x800080, watercolor: 0x0000ff, position: [0, -4000, 0], CoF: 0.2, objects:[
                    { type: "Wall", latitude: 45, longitude: 0, scale: 1.0 },          // North-East
                    { type: "Wall", latitude: -30, longitude: 120, scale: 1.5 },       // South-West (larger wall)
                    { type: "Wall", latitude: 15, longitude: -60, scale: 1.0 },        // North-West
                    { type: "Wall", latitude: -45, longitude: -120, scale: 1.2 }       // South-East
                ]
            },
            {
                name: "Beta",
                radius: 120, color: 0x404040, watercolor: 0x0000ff, position: [5000, 0, 0], CoF: 0.2, objects: [
                    { type: "Wall", latitude: 45, longitude: 0, scale: 1.2 },          // North-East
                    { type: "Wall", latitude: -30, longitude: 120, scale: 1.5 },       // South-West (larger wall)
                    { type: "Wall", latitude: 15, longitude: -60, scale: 1.3 },        // North-West
                    { type: "Wall", latitude: -45, longitude: -120, scale: 1.0 }       // South-East
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
                console.log(`Added planet ${planetData.name} to scene`);
            } else {
                console.error(`Failed to add planet ${planetData.name} to scene: Engine.scene is undefined`);
                return planetData; // Return data even if we couldn't add to scene
            }

            // Assign planet object to planetData
            planetData.object = planet;

            // CRITICAL FIX: Ensure objects array exists before iterating
            if (!planetData.objects) {
                console.log(`Initializing empty objects array for planet ${planetData.name}`);
                planetData.objects = [];
            }
            
            // Process wall objects
            if (planetData.objects && Array.isArray(planetData.objects)) {
                console.log(`Creating ${planetData.objects.length} walls for planet ${planetData.name}`);
                
                // ADDED: Validate that ObjectManager.createWall exists
                if (!ObjectManager.createWall) {
                    console.error("ObjectManager.createWall method doesn't exist!");
                } else {
                    planetData.objects.forEach(wall => {
                        // Pass along any scale information for the wall
                        ObjectManager.createWall(planetData, wall);
                    });
                }
            }
            
            return planetData;
        });

        console.log(`Created ${this.planets.length} planets`);
        this.planets.forEach(planet => {
            console.log(`Planet ${planet.name}: radius=${planet.radius}, position=${planet.object.position.toArray()}`);
        });

        // ADDED: Debug check for planets array
        if (!this.planets || this.planets.length === 0) {
            console.error("Failed to initialize planets array!");
        } else {
            console.log("Planet initialization successful");
        }

        // Create vehicles on planets
        this.setupVehicles();
        
        // Create test collision cubes
        this.setupTestCubes();
        
        // Set up vehicle entry interaction - FIX: Check if method exists first
        if (VehicleManager && typeof VehicleManager.setupVehicleInteractions === 'function') {
            VehicleManager.setupVehicleInteractions();
        } else {
            console.warn("VehicleManager.setupVehicleInteractions is not available - skipping vehicle interactions setup");
            // Fallback behavior - implement basic vehicle interactions if needed
            if (VehicleManager) {
                // If VehicleManager exists but lacks the method, we'll add a minimal implementation
                VehicleManager.checkVehicleProximity = function(player) {
                    // Simplified proximity check
                    if (!player || !player.position) return null;
                    
                    let closestVehicle = null;
                    let closestDistance = 10; // Maximum interaction distance
                    
                    for (const vehicle of this.vehicles) {
                        if (!vehicle) continue;
                        const distance = player.position.distanceTo(vehicle.position);
                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestVehicle = vehicle;
                        }
                    }
                    
                    return closestVehicle;
                };
            }
        }
    }

    // Create test cubes for collision testing
    static setupTestCubes() {
        console.log("Setting up test collision cubes");
        
        if (!this.planets || this.planets.length === 0) {
            console.error("No planets available for test cube creation!");
            return;
        }
        
        const alpha = this.planets[0];
        if (!alpha || !alpha.object) {
            console.error("First planet is not properly initialized!");
            return;
        }
        
        // Array to keep track of all cubes
        const testCubes = [];
        
        // 1. Create a few large cubes floating in mid-air near the first planet
        const createFloatingCube = (position, size, color) => {
            const geometry = new BoxGeometry(size.x, size.y, size.z);
            const material = new MeshBasicMaterial({ color: color, wireframe: false });
            const cube = new Mesh(geometry, material);
            
            // Position the cube
            cube.position.copy(position);
            
            // Store original size for potential geometry recreation
            cube.userData.originalSize = {
                width: size.x,
                height: size.y,
                depth: size.z
            };
            
            // Mark as a collision cube
            cube.userData.type = 'testCube';
            cube.userData.isCollisionCube = true;
            cube.userData.isSolid = true;
            cube.name = `TestCube-${testCubes.length}`;
            
            // Add to scene
            Engine.scene.add(cube);
            
            // Register with collision system
            cube.collidable = ObjectManager.registerGameObject(cube, 'testCube', {
                width: size.x,
                height: size.y,
                depth: size.z
            }, true); // Static object
            
            console.log(`Created test cube at position ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}`);
            
            // Add to tracking array
            testCubes.push(cube);
            return cube;
        };
        
        // 2. Add cubes near player spawn position (near planet Beta at 5000,0,0)
        // Set of mid-air cubes in a formation
        const spawnAreaCenter = new Vector3(5020, 20, 20);
        
        // Create a row of cubes
        for (let i = 0; i < 5; i++) {
            const position = new Vector3(
                spawnAreaCenter.x + (i * 10) - 20,
                spawnAreaCenter.y + 5,
                spawnAreaCenter.z
            );
            
            // Alternate colors and sizes
            const size = new Vector3(
                3 + Math.sin(i * 0.7) * 2,
                3 + Math.cos(i * 0.8) * 2,
                3 + Math.sin(i * 0.9) * 2
            );
            
            // Generate different colors
            const color = new Color(
                0.3 + 0.7 * Math.sin(i * 0.8),
                0.3 + 0.7 * Math.cos(i * 1.1),
                0.3 + 0.7 * Math.sin(i * 1.5)
            );
            
            createFloatingCube(position, size, color);
        }
        
        // Create a vertical stack
        for (let i = 0; i < 4; i++) {
            const position = new Vector3(
                spawnAreaCenter.x - 15,
                spawnAreaCenter.y + (i * 7),
                spawnAreaCenter.z + 15
            );
            
            const size = new Vector3(4, 4, 4);
            const color = new Color(1, 0.5 * i / 3, 0.2);
            
            createFloatingCube(position, size, color);
        }
        
        // Create a diagonal line
        for (let i = 0; i < 3; i++) {
            const position = new Vector3(
                spawnAreaCenter.x + 15 + (i * 7),
                spawnAreaCenter.y + 10 + (i * 7),
                spawnAreaCenter.z - 10 - (i * 7)
            );
            
            const size = new Vector3(5, 5, 5);
            const color = new Color(0.2, 1, 0.5 * i / 2);
            
            createFloatingCube(position, size, color);
        }
        
        // 3. Create some cubes on the planet surface
        const alphaPlanet = this.planets[0];
        if (alphaPlanet && alphaPlanet.object) {
            const planetPos = alphaPlanet.object.position;
            const planetRadius = alphaPlanet.radius;
            
            // Create cubes at different points on the planet
            const placePlanetCube = (latitude, longitude, size, color, heightOffset = 0) => {
                // Convert lat/long to radians
                const latRad = latitude * (Math.PI / 180);
                const longRad = longitude * (Math.PI / 180);

                // Calculate surface normal at this point
                const surfaceX = Math.cos(latRad) * Math.cos(longRad);
                const surfaceY = Math.sin(latRad);
                const surfaceZ = Math.cos(latRad) * Math.sin(longRad);
                const surfaceNormal = new Vector3(surfaceX, surfaceY, surfaceZ).normalize();
                
                // Adjust heightOffset to account for cube size
                // This ensures the bottom of the cube sits on the surface
                const adjustedHeightOffset = heightOffset + (size.y / 2);
                
                // Calculate position on sphere with adjusted height
                const radius = planetRadius + adjustedHeightOffset;
                const x = radius * surfaceNormal.x;
                const y = radius * surfaceNormal.y;
                const z = radius * surfaceNormal.z;
                
                // Calculate position relative to planet center
                const position = new Vector3(
                    planetPos.x + x,
                    planetPos.y + y,
                    planetPos.z + z
                );
                
                console.log(`Creating cube at lat=${latitude}, lon=${longitude}, height=${adjustedHeightOffset} above surface`);
                
                // Create the cube
                const cube = createFloatingCube(position, size, color);
                
                // Store planet data for physics
                cube.userData.planet = alphaPlanet;
                
                // Orient the cube to the planet surface
                cube.up = surfaceNormal.clone();
                
                // Create rotation that aligns cube with planet surface
                const yAxis = new Vector3(0, 1, 0);
                const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
                const angle = Math.acos(yAxis.dot(surfaceNormal));
                
                if (rotationAxis.lengthSq() > 0.001) {
                    cube.quaternion.setFromAxisAngle(rotationAxis, angle);
                    
                    // Log rotation info
                    console.log(`Cube aligned with surface normal: ${surfaceNormal.x.toFixed(2)}, ${surfaceNormal.y.toFixed(2)}, ${surfaceNormal.z.toFixed(2)}`);
                }
                
                // Update the collision bounds to match the rotation
                if (cube.collidable) {
                    ObjectManager.updateCollidableBounds(cube);
                }
                
                return cube;
            };
            
            // Place several cubes at different locations on the planet
            const cubeLocations = [
                { lat: 45, lon: 30, size: new Vector3(4, 4, 4), color: 0xff0000 },
                { lat: -30, lon: -45, size: new Vector3(5, 8, 5), color: 0x00ff00 },
                { lat: 0, lon: 90, size: new Vector3(10, 3, 3), color: 0x0000ff },
                { lat: 60, lon: -120, size: new Vector3(3, 10, 3), color: 0xffff00 },
                { lat: -60, lon: 150, size: new Vector3(6, 6, 6), color: 0xff00ff }
            ];
            
            cubeLocations.forEach(loc => {
                // Using a higher offset to clearly see cubes above surface
                placePlanetCube(loc.lat, loc.lon, loc.size, loc.color, 2); 
            });
        }
        
        // Add cubes on Beta planet too
        const betaPlanet = this.planets[1];
        if (betaPlanet && betaPlanet.object) {
            const planetPos = betaPlanet.object.position;
            const planetRadius = betaPlanet.radius;
            
            // Create a grid of cubes on Beta planet
            for (let lat = -60; lat <= 60; lat += 40) {
                for (let lon = -60; lon <= 60; lon += 40) {
                    // Convert lat/long to radians
                    const latRad = lat * (Math.PI / 180);
                    const longRad = lon * (Math.PI / 180);
                    
                    // Calculate surface normal
                    const surfaceNormal = new Vector3(
                        Math.cos(latRad) * Math.cos(longRad),
                        Math.sin(latRad),
                        Math.cos(latRad) * Math.sin(longRad)
                    ).normalize();
                    
                    // Create random sized cube
                    const size = new Vector3(
                        2 + Math.random() * 2,
                        2 + Math.random() * 2,
                        2 + Math.random() * 2
                    );
                    
                    // Calculate height offset to place cube on surface
                    const heightOffset = size.y / 2;
                    
                    // Calculate final position
                    const position = new Vector3().copy(planetPos).addScaledVector(
                        surfaceNormal,
                        planetRadius + heightOffset
                    );
                    
                    // Create a random colored cube
                    const color = new Color(Math.random(), Math.random(), Math.random());
                    const cube = createFloatingCube(position, size, color);
                    
                    // Align with surface
                    cube.up = surfaceNormal.clone();
                    const yAxis = new Vector3(0, 1, 0);
                    const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
                    const angle = Math.acos(yAxis.dot(surfaceNormal));
                    
                    if (rotationAxis.lengthSq() > 0.001) {
                        cube.quaternion.setFromAxisAngle(rotationAxis, angle);
                    }
                    
                    // Store planet reference
                    cube.userData.planet = betaPlanet;
                    
                    // Update collision bounds
                    if (cube.collidable) {
                        ObjectManager.updateCollidableBounds(cube);
                    }
                    
                    testCubes.push(cube);
                }
            }
        }
        
        // 4. Create an obstacle course near spawn
        const createObstacleCourse = () => {
            const courseCenter = new Vector3(5040, 10, 40);
            
            // Create a tunnel
            const tunnelLength = 30;
            const tunnelWidth = 8;
            const tunnelHeight = 8;
            
            // Tunnel floor
            createFloatingCube(
                new Vector3(courseCenter.x, courseCenter.y - tunnelHeight/2 + 1, courseCenter.z),
                new Vector3(tunnelWidth, 1, tunnelLength),
                0x888888
            );
            
            // Tunnel ceiling
            createFloatingCube(
                new Vector3(courseCenter.x, courseCenter.y + tunnelHeight/2, courseCenter.z),
                new Vector3(tunnelWidth, 1, tunnelLength),
                0x888888
            );
            
            // Tunnel left wall
            createFloatingCube(
                new Vector3(courseCenter.x - tunnelWidth/2, courseCenter.y, courseCenter.z),
                new Vector3(1, tunnelHeight, tunnelLength),
                0xaaaaaa
            );
            
            // Tunnel right wall
            createFloatingCube(
                new Vector3(courseCenter.x + tunnelWidth/2, courseCenter.y, courseCenter.z),
                new Vector3(1, tunnelHeight, tunnelLength),
                0xaaaaaa
            );
            
            // Add obstacles inside the tunnel
            createFloatingCube(
                new Vector3(courseCenter.x - 2, courseCenter.y - 2, courseCenter.z - 10),
                new Vector3(2, 4, 2),
                0xff5500
            );
            
            createFloatingCube(
                new Vector3(courseCenter.x + 2, courseCenter.y - 1, courseCenter.z),
                new Vector3(2, 6, 2),
                0xff5500
            );
            
            createFloatingCube(
                new Vector3(courseCenter.x - 1, courseCenter.y + 2, courseCenter.z + 10),
                new Vector3(4, 2, 2),
                0xff5500
            );
        };
        
        createObstacleCourse();
        
        console.log(`Created ${testCubes.length} test cubes for collision testing`);
    }
    
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
        
        // FIXED: Create airplanes ABOVE the planet surface
        try {
            // Calculate positions with large positive height offsets (relative to planet radius)
            const airplaneHeight1 = alpha.radius + 100; // Absolute height from planet center
            const airplaneHeight2 = alpha.radius + 120;
            
            // Create airplanes using absolute position from planet center
            const airplane1 = VehicleManager.createAirplane(alpha, 30, 120, airplaneHeight1);
            const airplane2 = VehicleManager.createAirplane(alpha, -30, -120, airplaneHeight2);
            
            console.log(`Created airplanes at heights ${airplaneHeight1} and ${airplaneHeight2} from planet center`);
            console.log(`This is ${100} and ${120} units above the planet surface (radius ${alpha.radius})`);
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
                        const height = beta.radius + 20 + i * 10; // FIXED: Use absolute height from planet center
                        
                        const car = VehicleManager.createCar(beta, lat, lon, height - beta.radius); // Convert to relative height
                        car.name = `Car-Beta-${i}`;
                        console.log(`Created car ${car.name} at lat=${lat}, lon=${lon}, absolute height=${height}`);
                        
                        // Let physics handle falling
                        car.userData.falling = true;
                        car.userData.onSurface = false;
                        
                        // Add random rotation
                        car.rotateY(Math.random() * Math.PI * 2);
                    } catch (e) {
                        console.error(`Error creating Beta planet car ${i}:`, e);
                    }
                }
                
                // FIXED: Add airplanes at higher heights (absolute from planet center)
                const airplaneHeight1 = beta.radius + 80;
                const airplaneHeight2 = beta.radius + 100;
                
                VehicleManager.createAirplane(beta, -15, 90, airplaneHeight1 - beta.radius); // Convert to relative height
                VehicleManager.createAirplane(beta, 15, -90, airplaneHeight2 - beta.radius);
                
                console.log(`Created airplanes on Beta at heights ${airplaneHeight1} and ${airplaneHeight2} from planet center`);
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
