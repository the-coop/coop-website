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
    // FIX: Improved positioning on planet surface
    static positionObjectOnPlanet(object, planet, latitude, longitude, heightOffset = 0) {
        if (!planet || !planet.radius || !planet.object) {
            console.error("Invalid planet data for positioning object");
            return;
        }
        
        try {
            // Ensure latitude and longitude are numbers
            const latRad = Number(latitude) * (Math.PI / 180);
            const longRad = Number(longitude) * (Math.PI / 180);
            
            // Validate angles are not NaN
            if (isNaN(latRad) || isNaN(longRad)) {
                console.error(`Invalid latitude/longitude values: ${latitude}, ${longitude}`);
                return;
            }
            
            const planetRadius = planet.radius;
            
            // Calculate position on sphere
            const x = planetRadius * Math.cos(latRad) * Math.cos(longRad);
            const y = planetRadius * Math.sin(latRad);
            const z = planetRadius * Math.cos(latRad) * Math.sin(longRad);
            
            // Position relative to planet center
            const surfacePosition = new Vector3(x, y, z);
            const surfaceNormal = surfacePosition.clone().normalize();
            
            // Create orientation matrix to align with planet surface
            const objectUp = new Vector3(0, 1, 0); // Default up direction
            
            // Create quaternion to rotate from default orientation to surface orientation
            const alignmentQuaternion = new Quaternion();
            
            // Find rotation axis and angle between default up and surface normal
            const rotationAxis = new Vector3().crossVectors(objectUp, surfaceNormal).normalize();
            
            // Check for degenerate case where vectors are parallel or anti-parallel
            if (rotationAxis.lengthSq() < 0.001) {
                // If vectors are parallel, no rotation needed
                // If vectors are anti-parallel, rotate around any perpendicular axis
                if (objectUp.dot(surfaceNormal) < 0) {
                    rotationAxis.set(1, 0, 0); // Use X-axis for anti-parallel case
                    alignmentQuaternion.setFromAxisAngle(rotationAxis, Math.PI);
                }
            } else {
                // Normal case - calculate angle and set quaternion
                const angle = Math.acos(Math.min(1, Math.max(-1, objectUp.dot(surfaceNormal))));
                alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
            }
            
            // Apply rotation to align with surface
            object.quaternion.copy(alignmentQuaternion);
            
            // Add height offset along the normal direction
            const offsetPosition = surfacePosition.clone()
                .add(surfaceNormal.clone().multiplyScalar(heightOffset));
            
            // Apply planet's world position to get final position
            const planetPosition = planet.object.position;
            object.position.copy(planetPosition).add(offsetPosition);
            
            // Store reference to planet and height in object's userData
            if (!object.userData) object.userData = {};
            object.userData.planet = planet;
            object.userData.planetRadius = planetRadius;
            object.userData.heightOffset = heightOffset;
            object.userData.surfaceNormal = surfaceNormal.clone();
            object.userData.latitude = Number(latitude);
            object.userData.longitude = Number(longitude);
            
        } catch (err) {
            console.error("Error positioning object on planet:", err);
        }
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
        
        // NEW: Add wide cuboid for testing collision with non-cubic shapes
        const createWideCuboid = (position, size, color, rotation = null) => {
            const geometry = new BoxGeometry(size.x, size.y, size.z);
            const material = new MeshBasicMaterial({ color: color, wireframe: false });
            const cuboid = new Mesh(geometry, material);
            
            // Position the cuboid
            cuboid.position.copy(position);
            
            // Apply rotation if provided
            if (rotation) {
                cuboid.rotation.set(rotation.x, rotation.y, rotation.z);
            }
            
            // Store original size for potential geometry recreation
            cuboid.userData.originalSize = {
                width: size.x,
                height: size.y,
                depth: size.z
            };
            
            // Mark as a collision cuboid
            cuboid.userData.type = 'testCube';
            cuboid.userData.isCollisionCube = true;
            cuboid.userData.isSolid = true;
            cuboid.name = `TestCuboid-${testCubes.length}`;
            
            // Add to scene
            Engine.scene.add(cuboid);
            
            // Register with collision system
            cuboid.collidable = ObjectManager.registerGameObject(cuboid, 'testCube', {
                width: size.x,
                height: size.y,
                depth: size.z
            }, true); // Static object
            
            console.log(`Created test cuboid at position ${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}, size: ${size.x}x${size.y}x${size.z}`);
            
            // Add to tracking array
            testCubes.push(cuboid);
            return cuboid;
        };
        
        // NEW: Add significantly wider test cubes in different areas
        
        // Wide horizontal platform (very wide but thin)
        createWideCuboid(
            new Vector3(5040, 10, 20),
            new Vector3(40, 1, 8), // Extra wide platform
            0x22aaff
        );
        
        // Extra-wide horizontal platform with minimal height (like a floor)
        createWideCuboid(
            new Vector3(5020, 5, -30),
            new Vector3(50, 0.5, 15), // Very wide, very thin
            0x44cc88
        );
        
        // Super-wide but narrow barrier (like a fence)
        createWideCuboid(
            new Vector3(5060, 7, -20),
            new Vector3(60, 3, 0.5), // Extremely wide, medium height, very thin depth
            0xff8822
        );
        
        // Wide barrier at an angle (test collision with angled wide objects)
        createWideCuboid(
            new Vector3(5080, 12, 15),
            new Vector3(30, 2, 1), // Wide but thin wall
            0xaa44dd,
            new Vector3(0, Math.PI/6, Math.PI/12) // Rotated at an angle
        );
        
        // Create a wide-flat block that's slightly above ground level 
        // (like a wide step - good for testing when walking onto it)
        createWideCuboid(
            new Vector3(5030, 1, 40),
            new Vector3(25, 0.5, 10), // Wide step
            0x88ccff
        );
        
        // Create a wide barrier with a narrow gap in the middle (by creating two separate objects)
        // First part of split wall
        createWideCuboid(
            new Vector3(5010, 8, 50),
            new Vector3(15, 5, 1), // Wide but thin wall segment
            0xff4488
        );
        
        // Second part with gap between (for testing navigating through narrow spaces)
        createWideCuboid(
            new Vector3(5040, 8, 50),
            new Vector3(15, 5, 1), // Matching wall segment with gap in middle
            0xff4488
        );
        
        // Create a wide platform near spawn point
        createWideCuboid(
            new Vector3(5020, 10, 0),
            new Vector3(20, 1, 10), // Wide but thin platform
            0x8844ff
        );
        
        // Create a tall narrow wall
        createWideCuboid(
            new Vector3(5030, 15, -10),
            new Vector3(2, 15, 10), // Tall and thin wall
            0xff6600
        );
        
        // Create a long bridge-like structure
        createWideCuboid(
            new Vector3(5050, 20, 10),
            new Vector3(30, 2, 5), // Long bridge
            0x44aaff
        );
        
        // Create a rotated wide platform
        createWideCuboid(
            new Vector3(5060, 15, 30),
            new Vector3(15, 2, 8), // Wide platform
            0x22dd88,
            new Vector3(0, Math.PI/6, Math.PI/12) // Rotated platform
        );
        
        // Create a diagonal ramp
        createWideCuboid(
            new Vector3(5070, 5, 40),
            new Vector3(20, 2, 8), // Ramp dimensions
            0xdd2288,
            new Vector3(Math.PI/12, 0, 0) // Tilted upward
        );
                
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
            
            // Add some wide cuboids on Alpha planet surface
            const cuboidLocations = [
                { lat: 20, lon: 60, size: new Vector3(15, 2, 5), color: 0x2288ff },
                { lat: -40, lon: 10, size: new Vector3(8, 1, 20), color: 0x88ff22 },
                { lat: 10, lon: -80, size: new Vector3(10, 8, 3), color: 0xff8822 }
            ];
            
            cuboidLocations.forEach(loc => {
                // Using a higher offset to clearly see cuboids above surface
                placePlanetCube(loc.lat, loc.lon, loc.size, loc.color, 2);
            });
            
            // NEW: Add more wide boxes specifically on planet surface for collision testing
            console.log("Adding wide surface boxes for planetary collision testing");
            
            // Large platform-like structures with very low height
            const wideSurfaceBoxes = [
                // Very wide, flat platform on equator
                { lat: 0, lon: 0, size: new Vector3(30, 0.5, 20), color: 0x66ccff, heightOffset: 0.5 },
                
                // Large square platform at northern point
                { lat: 45, lon: 45, size: new Vector3(25, 1, 25), color: 0xff9900, heightOffset: 0.8 },
                
                // Extremely elongated path (like a wide road or bridge)
                { lat: -20, lon: 120, size: new Vector3(50, 0.8, 6), color: 0xffcc00, heightOffset: 0.6 },
                
                // Wide but very short wall-like structure
                { lat: 30, lon: -60, size: new Vector3(40, 3, 1.5), color: 0xff5566, heightOffset: 1.5 },
                
                // T-shaped structure (cross path intersection)
                { lat: -50, lon: -30, size: new Vector3(35, 1, 4), color: 0x22aadd, heightOffset: 0.7 }
            ];
            
            // Add these wide surface boxes
            wideSurfaceBoxes.forEach(box => {
                placePlanetCube(box.lat, box.lon, box.size, box.color, box.heightOffset);
                
                // For the T-shaped structure, add the crossing piece
                if (box.lat === -50 && box.lon === -30) {
                    // Add perpendicular piece to create T-shape
                    placePlanetCube(box.lat - 2, box.lon, new Vector3(4, 1, 20), box.color, box.heightOffset);
                }
            });
            
            // Add a special wide ramp on the planet surface
            const rampLat = 15;
            const rampLon = 15;
            const ramp = placePlanetCube(
                rampLat, 
                rampLon, 
                new Vector3(20, 0.5, 10), // Wide but thin
                0x22cc99, 
                3 // Higher offset to create a raised platform
            );
            
            // Add second part of the ramp connected to the first but lower
            const ramp2 = placePlanetCube(
                rampLat - 8, // Slightly offset in latitude 
                rampLon,
                new Vector3(20, 0.5, 10), // Same width
                0x22cc99,
                0.5 // Much lower - creates a ramp effect with the sloped transition
            );
            
            console.log("Added wide surface boxes on planet for collision testing");
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
            
            // NEW: Add some wide boxes on Beta planet too
            // These will be larger and more varied in type
            console.log("Adding wide boxes on Beta planet for collision testing");
            
            // Calculate some positions on the planet surface
            const positions = [
                { lat: 0, lon: 0 },      // equator point
                { lat: 30, lon: 60 },    // northern quarter
                { lat: -45, lon: 120 },  // southern half
                { lat: 15, lon: -90 },   // western side
                { lat: -60, lon: -150 }  // far southern point
            ];
            
            // Create different wide structures at these positions
            positions.forEach((pos, index) => {
                // Convert lat/long to radians
                const latRad = pos.lat * (Math.PI / 180);
                const longRad = pos.lon * (Math.PI / 180);
                
                // Calculate surface normal at this point
                const surfaceNormal = new Vector3(
                    Math.cos(latRad) * Math.cos(longRad),
                    Math.sin(latRad),
                    Math.cos(latRad) * Math.sin(longRad)
                ).normalize();
                
                // Different structure types based on index
                let size, color, heightOffset;
                
                switch(index) {
                    case 0: // Equator - wide flat platform
                        size = new Vector3(30, 0.8, 18);
                        color = 0x33bbff;
                        heightOffset = 1;
                        break;
                    case 1: // Northern - long thin bridge 
                        size = new Vector3(45, 1, 3);
                        color = 0xffaa22;
                        heightOffset = 3;
                        break;
                    case 2: // Southern - very wide but shallow step
                        size = new Vector3(25, 0.3, 25); 
                        color = 0x66dd99;
                        heightOffset = 0.3;
                        break;
                    case 3: // Western - medium barrier wall
                        size = new Vector3(20, 4, 1);
                        color = 0xff3366;
                        heightOffset = 2;
                        break;
                    case 4: // Far south - zigzag platform
                        size = new Vector3(35, 1, 5);
                        color = 0xbb44ff;  
                        heightOffset = 1.5;
                        break;
                    default:
                        size = new Vector3(10, 1, 10);
                        color = 0xffffff;
                        heightOffset = 1;
                }
                
                // Calculate position including height offset
                const radius = betaPlanet.radius + heightOffset + (size.y / 2);
                const position = new Vector3()
                    .copy(betaPlanet.object.position)
                    .addScaledVector(surfaceNormal, radius);
                
                // Create the cube
                const cube = createFloatingCube(position, size, color);
                
                // Store planet reference
                cube.userData.planet = betaPlanet;
                
                // Align cube with planet surface
                const yAxis = new Vector3(0, 1, 0);
                const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
                const angle = Math.acos(yAxis.dot(surfaceNormal));
                
                // Apply rotation to align with planet surface
                if (rotationAxis.lengthSq() > 0.001) {
                    cube.quaternion.setFromAxisAngle(rotationAxis, angle);
                }
                
                // For the zigzag, add a crossing piece
                if (index === 4) {
                    const crossSize = new Vector3(5, 1, 20);
                    const crossPos = position.clone().addScaledVector(
                        new Vector3(0, 0, 1).applyQuaternion(cube.quaternion), 
                        10 // Offset in local z direction
                    );
                    
                    const crossCube = createFloatingCube(crossPos, crossSize, color);
                    crossCube.userData.planet = betaPlanet;
                    crossCube.quaternion.copy(cube.quaternion);
                    
                    // Update collision bounds
                    ObjectManager.updateCollidableBounds(crossCube);
                }
                
                // Update collision bounds
                ObjectManager.updateCollidableBounds(cube);
                
                console.log(`Added wide structure at lat=${pos.lat}, lon=${pos.lon} on Beta planet`);
            });
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
            
            // Add a wide platform bridge in the tunnel
            createWideCuboid(
                new Vector3(courseCenter.x, courseCenter.y - 1, courseCenter.z + 5),
                new Vector3(6, 0.5, 15), // Wide but thin bridge
                0x66aaff
            );
            
            // Add an angled ramp in the tunnel
            createWideCuboid(
                new Vector3(courseCenter.x - 2, courseCenter.y - 3, courseCenter.z - 8),
                new Vector3(5, 0.5, 8), // Ramp dimensions
                0xffaa66,
                new Vector3(Math.PI/8, 0, 0) // Angled upward
            );
            
            // Add a vertical wall obstacle
            createWideCuboid(
                new Vector3(courseCenter.x + 3, courseCenter.y, courseCenter.z),
                new Vector3(1, 6, 8), // Tall wall
                0x66ffaa
            );
            
            // NEW: Add a super-wide floor section to test walking on wide flat surfaces
            createWideCuboid(
                new Vector3(courseCenter.x + 40, courseCenter.y - 5, courseCenter.z),
                new Vector3(50, 0.5, 20), // Very wide floor
                0x66bbcc
            );
            
            // NEW: Add a wide but low barrier to test stepping over/collision
            createWideCuboid(
                new Vector3(courseCenter.x + 40, courseCenter.y - 4, courseCenter.z + 15),
                new Vector3(30, 1, 1), // Wide but very low barrier
                0xddaa33
            );
        };
        
        createObstacleCourse();
        
        console.log(`Created ${testCubes.length} test cubes and cuboids for collision testing`);
    }
    
    static setupVehicles() {
        console.log("Setting up vehicles on planets - using higher heights for visible falling");
        
        // Clear any existing vehicles first to prevent duplicates
        if (VehicleManager.vehicles.length > 0) {
            VehicleManager.vehicles.forEach(vehicle => {
                if (vehicle && Engine.scene) {
                    Engine.scene.remove(vehicle);
                }
            });
            VehicleManager.vehicles = [];
        }
        
        // CRITICAL FIX: Verify planets exist before creating vehicles
        if (!this.planets || this.planets.length === 0) {
            console.error("No planets available for vehicle creation");
            return;
        }

        // Get the first planet
        const alpha = this.planets[0];
        if (!alpha || !alpha.object) {
            console.error("First planet is invalid");
            return;
        }
        
        console.log(`Creating vehicles on ${alpha.name} at position ${alpha.object.position.toArray()}`);
        
        // IMPROVED: Better distribution - spread cars around the planet at various locations
        // Use specific positions that are well-separated
        const carPositions = [
            { lat: 0, lon: 0, height: 20 },
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
                    car.name = `Car-${alpha.name}-${index}`;
                    console.log(`Created car ${car.name} at lat=${lat}, lon=${lon}, absolute height=${alpha.radius + height}`);
                }
            } catch (e) {
                console.error(`Error creating ${alpha.name} planet car ${index}:`, e);
            }
        });
        
        // Create airplanes ABOVE the planet surface
        try {
            // Only create airplanes if the function exists
            if (typeof VehicleManager.createAirplane === 'function') {
                const planePositions = [
                    { lat: 10, lon: 20, height: 60 },
                    { lat: -20, lon: -30, height: 70 },
                    { lat: 45, lon: 140, height: 80 }
                ];
                
                planePositions.forEach(({lat, lon, height}, index) => {
                    const airplane = VehicleManager.createAirplane(alpha, lat, lon, height);
                    if (airplane) {
                        airplane.name = `Airplane-${alpha.name}-${index}`;
                        console.log(`Created airplane ${airplane.name} at lat=${lat}, lon=${lon}, height=${height}`);
                    }
                });
            } else {
                console.warn("VehicleManager.createAirplane function is not defined - skipping airplane creation");
            }
        } catch (e) {
            console.error("Error creating airplanes:", e);
        }
        
        // Create vehicles on second planet if it exists
        if (this.planets.length > 1) {
            const beta = this.planets[1];
            if (beta && beta.object) {
                // Use random positions for Beta planet
                for (let i = 0; i < 4; i++) {
                    try {
                        // Generate random positions for variety
                        const lat = (Math.random() * 170) - 85; // -85 to +85
                        const lon = (Math.random() * 360) - 180; // -180 to +180
                        const height = 20 + (i * 10); // Increasing heights
                        
                        const car = VehicleManager.createCar(beta, lat, lon, height);
                        if (car) {
                            car.name = `Car-${beta.name}-${i}`;
                            console.log(`Created car ${car.name} at lat=${lat}, lon=${lon}, absolute height=${beta.radius + height}`);
                        }
                    } catch (e) {
                        console.error(`Error creating ${beta.name} planet car ${i}:`, e);
                    }
                }
                
                // Create airplanes on Beta only if function exists
                if (typeof VehicleManager.createAirplane === 'function') {
                    for (let i = 0; i < 2; i++) {
                        try {
                            // Generate random positions
                            const lat = (Math.random() * 170) - 85;
                            const lon = (Math.random() * 360) - 180;
                            const height = 60 + (i * 15); // Higher than cars
                            
                            const airplane = VehicleManager.createAirplane(beta, lat, lon, height);
                            if (airplane) {
                                airplane.name = `Airplane-${beta.name}-${i}`;
                                console.log(`Created airplane ${airplane.name} at lat=${lat}, lon=${lon}, height=${height}`);
                            }
                        } catch (e) {
                            console.error(`Error creating ${beta.name} planet airplane ${i}:`, e);
                        }
                    }
                }
            }
        }
        
        // Log the final count of vehicles
        const carCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'car').length;
        const airplaneCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'airplane').length;
        console.log(`Created ${carCount} cars and ${airplaneCount} airplanes`);
        
        // Log all vehicle positions for debugging
        VehicleManager.vehicles.forEach((vehicle, i) => {
            if (vehicle) {
                console.log(`Vehicle ${i}: type=${vehicle.userData.type}, position=${vehicle.position.toArray()}, falling=${vehicle.userData.falling}`);
            }
        });
    }
};
