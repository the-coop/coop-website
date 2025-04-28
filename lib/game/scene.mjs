import { SphereGeometry, Mesh, MeshBasicMaterial, Color, BufferAttribute, Vector3, Quaternion, BoxGeometry } from 'three';
import Engine from './engine.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import Physics from './physics.mjs'; // Added missing Physics import

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
            
            // CRITICAL FIX: For very large height offsets (like 5000+), use direct calculation
            // rather than adding to surface position, to avoid numerical precision issues
            let finalPosition;
            if (heightOffset > 200) {
                // For high altitude spawns, calculate position directly from planet center
                // This avoids precision issues when trying to spawn very high above the planet
                const totalDistance = planetRadius + heightOffset;
                finalPosition = surfaceNormal.clone().multiplyScalar(totalDistance);
                console.log(`High altitude spawn: ${heightOffset} units above planet surface`);
                console.log(`Total distance from planet center: ${totalDistance}`);
            } else {
                // For normal offsets, use the standard additive approach
                const offsetPosition = surfacePosition.clone()
                    .add(surfaceNormal.clone().multiplyScalar(heightOffset));
                finalPosition = offsetPosition;
            }
            
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
            
            // Apply planet's world position to get final position
            const planetPosition = planet.object.position;
            object.position.copy(planetPosition).add(finalPosition);
            
            // Store reference to planet and height in object's userData
            if (!object.userData) object.userData = {};
            object.userData.planet = planet;
            object.userData.planetRadius = planetRadius;
            object.userData.heightOffset = heightOffset;
            object.userData.surfaceNormal = surfaceNormal.clone();
            object.userData.latitude = Number(latitude);
            object.userData.longitude = Number(longitude);
            
            // ADDED: Store the initial spawn position for reference
            if (heightOffset > 200) {
                object.userData.originalSpawnPosition = object.position.clone();
                console.log(`Positioned object at high altitude. Final position: ${object.position.toArray()}`);
                console.log(`Distance from planet center: ${object.position.distanceTo(planet.object.position)}`);
                console.log(`Expected distance: ${planetRadius + heightOffset}`);
            }
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
                radius: 200, color: 0x800080, watercolor: 0x0000ff, position: [0, -4000, 0], CoF: 0.2
            },
            {
                name: "Beta",
                radius: 120, color: 0x404040, watercolor: 0x0000ff, position: [5000, 0, 0], CoF: 0.2
            }
        ].map((planetData) => {
            const { radius, color, position } = planetData;
            
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
        console.log("Setting up test collision cuboids on planet surfaces");
        
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
        
        // Helper function to create a cuboid on a planet surface
        const createPlanetCuboid = (planet, latitude, longitude, size, color, heightOffset = 0.1) => {
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
            const radius = planet.radius + adjustedHeightOffset;
            const x = radius * surfaceNormal.x;
            const y = radius * surfaceNormal.y;
            const z = radius * surfaceNormal.z;
            
            // Calculate position relative to planet center
            const position = new Vector3(
                planet.object.position.x + x,
                planet.object.position.y + y,
                planet.object.position.z + z
            );
            
            console.log(`Creating cuboid at lat=${latitude}, lon=${longitude}, height=${adjustedHeightOffset} above surface`);
            
            // Create the cuboid with BoxGeometry instead of SphereGeometry
            const geometry = new BoxGeometry(size.x, size.y, size.z);
            const material = new MeshBasicMaterial({ color: color, wireframe: false });
            const cube = new Mesh(geometry, material);
            cube.position.copy(position);
            
            // Store planet data for physics
            cube.userData = {
                planet: planet,
                type: 'testCube',
                isCollisionCube: true,
                isSolid: true,
                originalSize: {
                    width: size.x,
                    height: size.y,
                    depth: size.z
                },
                width: size.x,
                height: size.y,
                depth: size.z
            };
            cube.name = `TestCube-${testCubes.length}`;
            
            // Orient the cuboid to the planet surface
            const yAxis = new Vector3(0, 1, 0);
            const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
            const angle = Math.acos(yAxis.dot(surfaceNormal));
            
            if (rotationAxis.lengthSq() > 0.001) {
                cube.quaternion.setFromAxisAngle(rotationAxis, angle);
                console.log(`Cuboid aligned with surface normal: ${surfaceNormal.x.toFixed(2)}, ${surfaceNormal.y.toFixed(2)}, ${surfaceNormal.z.toFixed(2)}`);
            }
            
            // Add to scene
            Engine.scene.add(cube);
            
            // Register with collision system
            cube.collidable = ObjectManager.registerGameObject(cube, 'testCube', {
                width: size.x,
                height: size.y,
                depth: size.z
            }, true); // Static object
            
            // Update the collision bounds to match the rotation
            if (cube.collidable) {
                ObjectManager.updateCollidableBounds(cube);
            }
            
            testCubes.push(cube);
            return cube;
        };
        
        // Create test cuboids on Alpha Planet
        // Define a range of cuboid locations on the planet
        const alphaPlanet = this.planets[0];
        if (alphaPlanet && alphaPlanet.object) {
            // Place several cuboids at different locations on the Alpha planet
            const cubeLocations = [
                { lat: 45, lon: 30, size: new Vector3(4, 4, 4), color: 0xff0000 },
                { lat: -30, lon: -45, size: new Vector3(5, 8, 5), color: 0x00ff00 },
                { lat: 0, lon: 90, size: new Vector3(10, 3, 3), color: 0x0000ff },
                { lat: 60, lon: -120, size: new Vector3(3, 10, 3), color: 0xffff00 },
                { lat: -60, lon: 150, size: new Vector3(6, 6, 6), color: 0xff00ff },
                // Add more with different sizes and shapes
                { lat: 20, lon: 60, size: new Vector3(15, 2, 5), color: 0x2288ff },
                { lat: -40, lon: 10, size: new Vector3(8, 1, 20), color: 0x88ff22 },
                { lat: 10, lon: -80, size: new Vector3(10, 8, 3), color: 0xff8822 }
            ];
            
            cubeLocations.forEach(loc => {
                createPlanetCuboid(alphaPlanet, loc.lat, loc.lon, loc.size, loc.color, 0.1); // 0.1 unit above surface
            });
            
            // Wide platform-like structures with very low height
            const wideSurfaceBoxes = [
                // Very wide, flat platform on equator
                { lat: 0, lon: 0, size: new Vector3(30, 0.5, 20), color: 0x66ccff },
                
                // Large square platform at northern point
                { lat: 45, lon: 45, size: new Vector3(25, 1, 25), color: 0xff9900 },
                
                // Extremely elongated path (like a wide road or bridge)
                { lat: -20, lon: 120, size: new Vector3(50, 0.8, 6), color: 0xffcc00 },
                
                // Wide but very short wall-like structure
                { lat: 30, lon: -60, size: new Vector3(40, 3, 1.5), color: 0xff5566 },
                
                // T-shaped structure (cross path intersection)
                { lat: -50, lon: -30, size: new Vector3(35, 1, 4), color: 0x22aadd }
            ];
            
            // Add these wide surface boxes
            wideSurfaceBoxes.forEach(box => {
                createPlanetCuboid(alphaPlanet, box.lat, box.lon, box.size, box.color, 0.05);
                
                // For the T-shaped structure, add the crossing piece
                if (box.lat === -50 && box.lon === -30) {
                    // Add perpendicular piece to create T-shape
                    createPlanetCuboid(alphaPlanet, box.lat - 2, box.lon, new Vector3(4, 1, 20), box.color, 0.05);
                }
            });
            
            // Add a special wide ramp on the planet surface
            const rampLat = 15;
            const rampLon = 15;
            const ramp = createPlanetCuboid(
                alphaPlanet, 
                rampLat, 
                rampLon, 
                new Vector3(20, 0.5, 10), // Wide but thin
                0x22cc99, 
                3 // Higher offset to create a raised platform
            );
            
            // Add second part of the ramp connected to the first but lower
            const ramp2 = createPlanetCuboid(
                alphaPlanet,
                rampLat - 8, // Slightly offset in latitude 
                rampLon,
                new Vector3(20, 0.5, 10), // Same width
                0x22cc99,
                0.5 // Much lower - creates a ramp effect with the sloped transition
            );
        }
        
        // Add cubes on Beta planet too
        const betaPlanet = this.planets[1];
        if (betaPlanet && betaPlanet.object) {
            // Create a grid of cuboids on Beta planet's surface
            for (let lat = -60; lat <= 60; lat += 40) {
                for (let lon = -60; lon <= 60; lon += 40) {
                    // Create random sized cuboid
                    const size = new Vector3(
                        2 + Math.random() * 2,
                        2 + Math.random() * 2,
                        2 + Math.random() * 2
                    );
                    
                    // Create a random colored cuboid directly on surface
                    const color = new Color(Math.random(), Math.random(), Math.random());
                    createPlanetCuboid(betaPlanet, lat, lon, size, color, 0.1);
                }
            }
            
            // Create different wide structures on Beta's surface
            const positions = [
                { lat: 0, lon: 0 },      // equator point
                { lat: 30, lon: 60 },    // northern quarter
                { lat: -45, lon: 120 },  // southern half
                { lat: 15, lon: -90 },   // western side
                { lat: -60, lon: -150 }  // far southern point
            ];
            
            // Create different wide structures at these positions
            positions.forEach((pos, index) => {
                let size, color, heightOffset;
                
                switch(index) {
                    case 0: // Equator - wide flat platform
                        size = new Vector3(30, 0.8, 18);
                        color = 0x33bbff;
                        heightOffset = 0.1;
                        break;
                    case 1: // Northern - long thin bridge 
                        size = new Vector3(45, 1, 3);
                        color = 0xffaa22;
                        heightOffset = 0.1;
                        break;
                    case 2: // Southern - very wide but shallow step
                        size = new Vector3(25, 0.3, 25); 
                        color = 0x66dd99;
                        heightOffset = 0.1;
                        break;
                    case 3: // Western - medium barrier wall
                        size = new Vector3(20, 4, 1);
                        color = 0xff3366;
                        heightOffset = 0.1;
                        break;
                    case 4: // Far south - zigzag platform
                        size = new Vector3(35, 1, 5);
                        color = 0xbb44ff;  
                        heightOffset = 0.1;
                        break;
                    default:
                        size = new Vector3(10, 1, 10);
                        color = 0xffffff;
                        heightOffset = 0.1;
                }
                
                const cube = createPlanetCuboid(betaPlanet, pos.lat, pos.lon, size, color, heightOffset);
                
                // For the zigzag, add a crossing piece
                if (index === 4) {
                    // Create a cross piece on planet surface slightly offset
                    const crossPos = {lat: pos.lat + 5, lon: pos.lon};
                    createPlanetCuboid(betaPlanet, crossPos.lat, crossPos.lon, 
                                     new Vector3(5, 1, 20), color, heightOffset);
                }
            });
        }
        
        // Add forms of obstacle course pieces on Alpha planet
        if (alphaPlanet && alphaPlanet.object) {
            // Create an obstacle course near equator
            const courseLatitude = 5;
            const courseLongitude = 35;
            
            // Create a tunnel-like structure using cuboids on planet surface
            const tunnelLength = 30;
            const tunnelWidth = 8;
            const tunnelHeight = 8;
            
            // Tunnel floor
            createPlanetCuboid(
                alphaPlanet,
                courseLatitude,
                courseLongitude,
                new Vector3(tunnelWidth, 1, tunnelLength),
                0x888888,
                0.1
            );
            
            // Tunnel side walls
            createPlanetCuboid(
                alphaPlanet,
                courseLatitude - 3,
                courseLongitude,
                new Vector3(1, tunnelHeight, tunnelLength),
                0xaaaaaa,
                0.1
            );
            
            createPlanetCuboid(
                alphaPlanet,
                courseLatitude + 3,
                courseLongitude,
                new Vector3(1, tunnelHeight, tunnelLength),
                0xaaaaaa,
                0.1
            );
            
            // Obstacles inside the "tunnel"
            createPlanetCuboid(
                alphaPlanet,
                courseLatitude - 1,
                courseLongitude - 5,
                new Vector3(2, 4, 2),
                0xff5500,
                0.1
            );
            
            createPlanetCuboid(
                alphaPlanet,
                courseLatitude + 1,
                courseLongitude,
                new Vector3(2, 6, 2),
                0xff5500,
                0.1
            );
            
            createPlanetCuboid(
                alphaPlanet,
                courseLatitude,
                courseLongitude + 5,
                new Vector3(4, 2, 2),
                0xff5500,
                0.1
            );
            
            // Wide platform bridge in the "tunnel" area
            createPlanetCuboid(
                alphaPlanet,
                courseLatitude,
                courseLongitude + 2,
                new Vector3(6, 0.5, 15),
                0x66aaff,
                1.5 // Elevated slightly above the surface
            );
        }
        
        // ADDED: Create pushable light test cubes with reduced mass
        const lightCubePositions = [
            { lat: 10, lon: 25, size: new Vector3(2, 2, 2), color: 0x00FFAA },
            { lat: -15, lon: -30, size: new Vector3(2.5, 1.5, 2.5), color: 0x88FFAA },
            { lat: 30, lon: 60, size: new Vector3(1.8, 1.8, 1.8), color: 0x22FFDD }
        ];
        
        lightCubePositions.forEach(pos => {
            const lightCube = createPlanetCuboid(
                alphaPlanet, 
                pos.lat, 
                pos.lon, 
                pos.size, 
                pos.color, 
                0.1
            );
            
            if (lightCube) {
                // Mark as light, pushable object
                lightCube.userData.isLightObject = true;
                lightCube.userData.mass = Physics.DEFAULT_MASSES.lightCube;
                lightCube.userData.name = "LightCube";
                
                // Add some initial velocity to make them move slightly
                lightCube.userData.velocity = new Vector3(
                    (Math.random() - 0.5) * 0.05,
                    0,
                    (Math.random() - 0.5) * 0.05
                );
                
                // Make sure physics can move these objects
                if (lightCube.collidable) {
                    lightCube.collidable.isStatic = false;
                }
                console.log(`Created pushable light cube at lat=${pos.lat}, lon=${pos.lon} with mass=${lightCube.userData.mass}kg`);
            }
        });
        
        // ADDED: Create heavy, immovable test cubes
        const heavyCubePositions = [
            { lat: -5, lon: 45, size: new Vector3(4, 4, 4), color: 0xFF4400 },
            { lat: 20, lon: -20, size: new Vector3(5, 5, 5), color: 0xDD3300 }
        ];
        
        heavyCubePositions.forEach(pos => {
            const heavyCube = createPlanetCuboid(
                alphaPlanet, 
                pos.lat, 
                pos.lon, 
                pos.size, 
                pos.color, 
                0.1
            );
            
            if (heavyCube) {
                // Mark as heavy, resistant object
                heavyCube.userData.isHeavyObject = true;
                heavyCube.userData.mass = Physics.DEFAULT_MASSES.heavyCube * 3; // Triple the heavy mass
                heavyCube.userData.name = "HeavyCube";
                
                console.log(`Created heavy immovable cube at lat=${pos.lat}, lon=${pos.lon} with mass=${heavyCube.userData.mass}kg`);
            }
        });
        
        console.log(`Created ${testCubes.length} test cuboids on planet surfaces for collision testing`);
    }
    
    static setupVehicles() {
        console.log("Setting up vehicles on planets - using EXTREME altitudes for dramatic entry");
        
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
        
        console.log(`Alpha planet position: ${alpha.object.position.toArray()}`);
        
        // DRAMATICALLY INCREASED: Extreme spawn heights compared to previous values
        // Alpha planet is at [0, -4000, 0]
        // The problem was the vehicles weren't spawning high enough above planet
        const alphaVehiclePositions = [
            // EXTREME HEIGHTS - ensure they're truly in space above the planet
            new Vector3(-800, 8000, 600),    // 12000 units above planet center (11800 above surface)
            new Vector3(800, 8500, -600),    // 12500 units above planet center
            new Vector3(600, 9000, 800),     // 13000 units above planet center 
            new Vector3(-600, 9500, -800),   // 13500 units above planet center
            new Vector3(-300, 10000, 900),   // 14000 units above planet center
            new Vector3(900, 10500, 300),    // 14500 units above planet center
            new Vector3(400, 11000, -900),   // 15000 units above planet center
            new Vector3(-900, 11500, -400)   // 15500 units above planet center
        ];
        
        // Create cars at different absolute positions rather than lat/lon/height
        alphaVehiclePositions.forEach((position, index) => {
            try {
                console.log(`Creating car at ABSOLUTE position: ${position.toArray()}`);
                console.log(`Car height above planet center: ${position.y - alpha.object.position.y}`);
                
                // Create vehicle with position and keep default orientation
                const car = VehicleManager.createVehicleWithPosition('car', alpha, position, true);
                
                if (car) {
                    car.name = `Car-${alpha.name}-${index}`;
                    console.log(`Created car ${car.name} at position ${car.position.toArray()}`);
                    
                    // Set basic properties
                    car.userData.type = 'car';
                    car.userData.falling = true;
                    car.userData.velocity = new Vector3(0, 0, 0);
                    car.userData.freshlySpawned = true;
                    car.userData.originalPosition = car.position.clone();
                    
                    // Set SOI (sphere of influence) for the vehicle
                    car.userData.soi = alpha;
                    
                    // ADDED: Set extremely low gravity factor for distant vehicles
                    car.userData.gravityFactor = 0.05; // Very low gravity to slow the fall
                    
                    // Calculate the height above planet surface for debugging
                    const heightAbovePlanet = car.position.distanceTo(alpha.object.position) - alpha.radius;
                    console.log(`Car height above planet surface: ${heightAbovePlanet}`);
                }
            } catch (e) {
                console.error(`Error creating ${alpha.name} planet car ${index}:`, e);
            }
        });
        
        // Create airplanes with absolute positions
        try {
            if (typeof VehicleManager.createVehicleWithPosition === 'function') {
                const planePositions = [
                    // EXTREME HEIGHTS - ensure they're truly visible in space
                    new Vector3(-700, 12000, -700),  // 16000 units above planet center 
                    new Vector3(700, 12500, 700),    // 16500 units above planet center
                    new Vector3(0, 13000, -1000)     // 17000 units above planet center
                ];
                
                planePositions.forEach((position, index) => {
                    console.log(`Creating airplane at ABSOLUTE position: ${position.toArray()}`);
                    console.log(`Airplane height above planet center: ${position.y - alpha.object.position.y}`);
                    
                    const airplane = VehicleManager.createVehicleWithPosition('airplane', alpha, position, true);
                    
                    if (airplane) {
                        airplane.name = `Airplane-${alpha.name}-${index}`;
                        console.log(`Created airplane ${airplane.name} at position ${airplane.position.toArray()}`);
                        
                        // Set basic properties
                        airplane.userData.type = 'airplane';
                        airplane.userData.falling = true;
                        airplane.userData.velocity = new Vector3(0, 0, 0);
                        airplane.userData.freshlySpawned = true;
                        airplane.userData.originalPosition = airplane.position.clone();
                        
                        // Set SOI (sphere of influence) for the vehicle
                        airplane.userData.soi = alpha;
                        
                        // ADDED: Set extremely low gravity factor for distant vehicles
                        airplane.userData.gravityFactor = 0.04; // Even lower gravity than cars
                    }
                });
            } else {
                console.warn("VehicleManager.createVehicleWithPosition function is not defined - using fallback");
            }
        } catch (e) {
            console.error("Error creating airplanes:", e);
        }
        
        // Create vehicles on second planet if it exists
        if (this.planets.length > 1) {
            const beta = this.planets[1];
            if (beta && beta.object) {
                console.log(`Beta planet position: ${beta.object.position.toArray()}`);
                
                // EXTREME HEIGHTS for Beta planet
                // Beta planet is at [5000, 0, 0]
                const betaVehiclePositions = [
                    new Vector3(9000, 1000, 800),   // 4000 units from planet center on X axis
                    new Vector3(1000, 1200, 600),   // 4000 units from planet center on X axis
                    new Vector3(9500, 1400, -800),  // 4500 units from planet center on X axis
                    new Vector3(500, 1600, -600)    // 4500 units from planet center on X axis
                ];
                
                betaVehiclePositions.forEach((position, index) => {
                    try {
                        console.log(`Creating car on Beta at ABSOLUTE position: ${position.toArray()}`);
                        const car = VehicleManager.createVehicleWithPosition('car', beta, position, true);
                        
                        if (car) {
                            car.name = `Car-${beta.name}-${index}`;
                            console.log(`Created car ${car.name} at position ${car.position.toArray()}`);
                            
                            // Set basic properties
                            car.userData.type = 'car';
                            car.userData.falling = true;
                            car.userData.velocity = new Vector3(0, 0, 0);
                            car.userData.freshlySpawned = true;
                            car.userData.originalPosition = car.position.clone();
                            
                            // Set SOI for the vehicle
                            car.userData.soi = beta;
                            
                            // ADDED: Set extremely low gravity factor for distant vehicles
                            car.userData.gravityFactor = 0.05; // Very low gravity
                            
                            // Calculate height above planet for debugging
                            const heightAbovePlanet = car.position.distanceTo(beta.object.position) - beta.radius;
                            console.log(`Car height above Beta planet surface: ${heightAbovePlanet}`);
                        }
                    } catch (e) {
                        console.error(`Error creating ${beta.name} planet car ${index}:`, e);
                    }
                });
                
                // Create airplanes on Beta with absolute positions
                if (typeof VehicleManager.createVehicleWithPosition === 'function') {
                    const betaPlanePositions = [
                        new Vector3(5600, 1800, -900),   // Right of planet, very high, far backward
                        new Vector3(4400, 2000, 900)     // Left of planet, highest, far forward
                    ];
                    
                    betaPlanePositions.forEach((position, index) => {
                        try {
                            console.log(`Creating airplane on Beta at ABSOLUTE position: ${position.toArray()}`);
                            const airplane = VehicleManager.createVehicleWithPosition('airplane', beta, position, true);
                            
                            if (airplane) {
                                airplane.name = `Airplane-${beta.name}-${index}`;
                                console.log(`Created airplane ${airplane.name} at position ${airplane.position.toArray()}`);
                                
                                // Set basic properties
                                airplane.userData.type = 'airplane';
                                airplane.userData.falling = true;
                                airplane.userData.velocity = new Vector3(0, 0, 0);
                                airplane.userData.freshlySpawned = true;
                                airplane.userData.originalPosition = airplane.position.clone();
                                
                                // Set SOI (sphere of influence) for the vehicle
                                airplane.userData.soi = beta;
                                
                                // ADDED: Set extremely low gravity factor for distant vehicles
                                airplane.userData.gravityFactor = 0.04; // Even lower gravity than cars
                            }
                        } catch (e) {
                            console.error(`Error creating ${beta.name} planet airplane ${index}:`, e);
                        }
                    });
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
