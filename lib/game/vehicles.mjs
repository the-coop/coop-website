import { 
    BoxGeometry, 
    Mesh, 
    MeshBasicMaterial, 
    Vector3,
    Quaternion,
    Matrix4,
    CylinderGeometry,
    Object3D,
    Color
} from 'three';
import ObjectManager from './object.mjs';
import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import Engine from './engine.mjs';
import Physics from './physics.mjs';
import ControlManager from './control.mjs';
import CarController from './controllers/CarController.mjs'; // ADDED: Import CarController to fix reference error

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;

    // Improve vehicle positioning and prevent bouncing - simplified to use ObjectManager
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, lerpFactor = 0.1, forceFullAlignment = false) {
        if (!vehicle || !surfaceNormal) return;
        
        // FIXED: Check if CarController exists before accessing its properties or methods
        const isCarControllerAvailable = typeof CarController !== 'undefined' && 
                                        typeof CarController.align === 'function';
        
        // Check if vehicle is controlled by CarController
        if (vehicle === this.currentVehicle && 
            vehicle.userData?._controlledByCarController &&
            isCarControllerAvailable) {
            // Delegate to CarController's unified align method
            return CarController.align(vehicle, surfaceNormal, lerpFactor);
        }
        
        // Otherwise, use centralized alignment method
        return ObjectManager.alignObjectToSurface(vehicle, surfaceNormal, {
            lerpFactor: lerpFactor,
            forceFullAlignment: forceFullAlignment,
            maintainForwardDirection: vehicle.userData?.type === 'car', // Preserve steering direction for cars
            skipIfFalling: vehicle.userData?.falling && !forceFullAlignment,
            alignmentType: 'vehicle'
        });
    }

    // Create a car on the specified planet at the given coordinates
    static createCarOnSurface(planet, latitude, longitude, heightOffset = 3) {
        try {
            console.log(`Creating car on planet ${planet.name} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // FIXED: Use lower height offset for better stability on spawn
            const adjustedHeightOffset = heightOffset || 10; // Reduced from 50
            const car = this.createVehicleBase('car', planet, latitude, longitude, adjustedHeightOffset);
            
            if (!car) {
                console.error("Failed to create vehicle base object");
                return null;
            }
            
            // Setup the car components
            this.setupCarComponents(car);
            
            return car;
        } catch (err) {
            console.error("Error creating car on surface:", err);
            return null;
        }
    }

    // Helper method to set up airplane-specific components
    static setupAirplaneComponents(vehicle) {
        if (!vehicle) return;
        
        try {
            // Create airplane body
            const bodyGeometry = new BoxGeometry(4, 1.2, 6);
            const bodyMaterial = new MeshBasicMaterial({ color: 0x3366FF });
            const body = new Mesh(bodyGeometry, bodyMaterial);
            body.position.y = -0.2;
            vehicle.add(body);
            
            // Create wings
            const wingGeometry = new BoxGeometry(12, 0.5, 2);
            const wingMaterial = new MeshBasicMaterial({ color: 0x4477FF });
            const wings = new Mesh(wingGeometry, wingMaterial);
            wings.position.y = 0.3;
            wings.position.z = 0;
            vehicle.add(wings);
            
            // Create tail
            const tailGeometry = new BoxGeometry(3, 1.5, 1);
            const tailMaterial = new MeshBasicMaterial({ color: 0x4477FF });
            const tail = new Mesh(tailGeometry, tailMaterial);
            tail.position.y = 0.5;
            tail.position.z = -3;
            vehicle.add(tail);
            
            // Create propeller
            const propellerGeometry = new BoxGeometry(3, 0.2, 0.2);
            const propellerMaterial = new MeshBasicMaterial({ color: 0x333333 });
            const propeller = new Mesh(propellerGeometry, propellerMaterial);
            propeller.position.z = 3.1;
            vehicle.add(propeller);
            
            // Store reference to propeller for animation
            vehicle.userData.propeller = propeller;
            
            // Register proper collision dimensions
            const airplaneWidth = 12;
            const airplaneHeight = 2;
            const airplaneLength = 6;
            
            vehicle.userData.width = airplaneWidth;
            vehicle.userData.height = airplaneHeight;
            vehicle.userData.depth = airplaneLength;
            
            const dimensions = {
                width: airplaneWidth,
                height: airplaneHeight,
                depth: airplaneLength
            };
            
            // Register with collision system
            const collidable = ObjectManager.registerGameObject(vehicle, 'vehicle', dimensions, false);
            vehicle.collidable = collidable;
            vehicle.userData.collidable = collidable;
            
            // IMPROVED: Set up enhanced collision properties
            if (collidable && collidable.obb) {
                collidable.obb.userData = {
                    isVehicle: true,
                    vehicleReference: vehicle,
                    vehicleType: 'airplane'
                };
                
                // FIXED: Use userData.id instead of id property
                collidable.debugName = `Airplane-${vehicle.userData.id || Math.floor(Math.random() * 1000)}`;
            }
            
            // Set physics properties
            vehicle.userData.mass = 500;
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 50;
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.02;
            vehicle.userData.bounceFactor = 0.05;
            vehicle.userData.landingDamping = 0.97;
            
            // CRITICAL FIX: Increase fixed height offset to prevent clipping into planet
            vehicle.userData.fixedHeightOffset = 5.5;
            
            vehicle.userData.lift = 0.05;
            vehicle.userData.gravityFactor = 0.25;
            vehicle.userData.rotationDamping = 0.99;
            vehicle.userData.freshlySpawned = true;
            vehicle.userData.stabilizationFactor = 0.9;
            
            // CRITICAL FIX: Create a specialized method for tracking this vehicle's state
            vehicle.checkCollisions = function() {
                if (this.collidable && typeof ObjectManager.checkObjectCollisions === 'function') {
                    return ObjectManager.checkObjectCollisions(this);
                }
                return [];
            };
            
            // Add to registry
            this.vehicles.push(vehicle);
            
        } catch (err) {
            console.error("Error setting up airplane components:", err);
        }
        
        return vehicle;
    }

    // Create a basic vehicle object
    static createVehicleBase(type, planet, latitude, longitude, heightOffset = 2) {
        try {
            if (!planet || !planet.object) {
                console.error(`Invalid planet provided: ${planet ? 'missing object property' : 'null'}`);
                return null;
            }
            
            console.log(`Creating ${type} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // Create a new Object3D as the vehicle's container
            const vehicle = new Object3D();
            vehicle.name = `Vehicle-${type}-${Math.floor(Math.random() * 10000)}`;
            
            // Add initial userData
            vehicle.userData = {
                type: type,
                isVehicle: true,
                isOccupied: false,
                planet: planet,
                heightOffset: heightOffset,  // Store original height offset
                initialHeight: heightOffset, // Track initial height separately
                creationTime: Date.now()
            };
            
            // IMPROVED: For high altitude spawns, log detailed info
            if (heightOffset > 1000) {
                console.log(`Creating high-altitude ${type} above ${planet.name} with height=${heightOffset}`);
            }
            
            // Position the vehicle on the planet surface
            SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, heightOffset);
            
            // ADDED: Validate position after creation
            const distanceFromPlanet = vehicle.position.distanceTo(planet.object.position);
            const expectedDistance = planet.radius + heightOffset;
            
            console.log(`Vehicle created at distance ${distanceFromPlanet} from planet center`);
            console.log(`Expected distance: ${expectedDistance}`);
            
            if (Math.abs(distanceFromPlanet - expectedDistance) > 10) {
                console.warn(`Vehicle height is off by ${Math.abs(distanceFromPlanet - expectedDistance)}. Correcting...`);
                
                // Fix position directly
                const toVehicle = vehicle.position.clone().sub(planet.object.position).normalize();
                const correctedPosition = toVehicle.multiplyScalar(expectedDistance);
                vehicle.position.copy(planet.object.position).add(correctedPosition);
                
                // Log the correction
                const newDistance = vehicle.position.distanceTo(planet.object.position);
                console.log(`Corrected vehicle position. New distance: ${newDistance}`);
            }
            
            // Store the original position for physics to maintain
            vehicle.userData.originalPosition = vehicle.position.clone();
            
            // Add to scene
            Engine.scene.add(vehicle);
            
            return vehicle;
        } catch (err) {
            console.error("Error creating vehicle object:", err);
            return null;
        }
    }

    // NEW METHOD: Create a vehicle directly at a given position
    static createVehicleWithPosition(type, planet, position, suppressAlignment = false) {
        try {
            if (!planet || !planet.object) {
                console.error(`Invalid planet provided: ${planet ? 'missing object property' : 'null'}`);
                return null;
            }
            
            if (!position || !(position instanceof Vector3)) {
                console.error("Invalid position provided - must be a Vector3");
                return null;
            }
            
            // Create a new Object3D as the vehicle's container
            const vehicle = new Object3D();
            vehicle.name = `Vehicle-${type}-${Math.floor(Math.random() * 10000)}`;
            
            // IMPORTANT: Add to scene first, then set position to ensure world coordinates
            Engine.scene.add(vehicle);
            
            // ABSOLUTELY CRITICAL FIX: Copy position directly without any transforms
            vehicle.position.copy(position);
            
            // Debug logging for position tracing
            console.log(`VEHICLE CREATION - Initial position set: [${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)}]`);
            
            // Calculate height above planet for reference
            const distanceFromPlanet = vehicle.position.distanceTo(planet.object.position);
            const heightAboveSurface = distanceFromPlanet - planet.radius;
            
            // Add initial userData with physics properties
            vehicle.userData = {
                type: type,
                isVehicle: true,
                isOccupied: false,
                planet: planet,
                soi: planet, 
                heightOffset: heightAboveSurface,
                distanceFromPlanet: distanceFromPlanet,
                creationTime: Date.now(),
                initialSpawnInSpace: true,
                gravityFactor: 0.01, // Very low gravity for dramatic effect
                inSpace: heightAboveSurface > 1000, // Flag for high-altitude spawns
                
                // Debug tracking
                positionHistory: []
            };
            
            // Store the original position for physics reference
            vehicle.userData.originalPosition = vehicle.position.clone();
            
            // Calculate surface normal for orientation
            const surfaceNormal = vehicle.position.clone()
                .sub(planet.object.position)
                .normalize();
                
            // CRITICAL FIX: For suppressed alignment, don't apply any orientation
            if (suppressAlignment) {
                vehicle.userData.surfaceNormal = surfaceNormal;
                console.log("Vehicle alignment suppressed - maintaining space orientation");
            } else {
                // Apply initial orientation
                const defaultUp = new Vector3(0, 1, 0);
                const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal).normalize();
                
                if (rotationAxis.lengthSq() > 0.001) {
                    const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                    const alignmentQuaternion = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                    vehicle.quaternion.copy(alignmentQuaternion);
                }
                
                // Store surface normal for physics calculations
                vehicle.userData.surfaceNormal = surfaceNormal;
            }
            
            // Now add the type-specific components
            if (type === 'car') {
                this.setupCarComponents(vehicle);
            } else if (type === 'airplane') {
                this.setupAirplaneComponents(vehicle);
            }
            
            // CRITICAL FIX: Force update matrix world to lock in position
            vehicle.updateMatrix();
            vehicle.updateMatrixWorld(true);
            
            // Override physics settings for high altitude spawns
            if (heightAboveSurface > 1000) {
                vehicle.userData.velocity = new Vector3(0, 0, 0); // Start with zero velocity
                vehicle.userData.gravityFactor = 0.01; // Very low gravity for dramatic entry
                vehicle.userData.falling = true;
                vehicle.userData.freshlySpawned = true;
                vehicle.userData.bounceFactor = 0.01; // Almost no bounce
                vehicle.userData.landingDamping = 0.99; // Very high damping for smooth landing
            }
            
            // Add to registry
            this.vehicles.push(vehicle);
            
            // Final position check
            console.log(`VEHICLE FINAL POSITION: [${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)}]`);
            console.log(`Height above planet surface: ${heightAboveSurface.toFixed(2)}`);
            
            return vehicle;
        } catch (err) {
            console.error("Error creating vehicle at position:", err);
            return null;
        }
    }

    // Helper method to set up car-specific components
    static setupCarComponents(vehicle) {
        if (!vehicle) return;
        
        try {
            // Create car body
            const bodyGeometry = new BoxGeometry(3, 1.5, 5);        
            const bodyMaterial = new MeshBasicMaterial({ color: 0xFF0000 });
            const body = new Mesh(bodyGeometry, bodyMaterial);
            body.position.y = -0.2; // Raised body position slightly from -0.5 to -0.2
            vehicle.add(body);
            
            // Create wheels collection for animation
            vehicle.userData.wheels = {};
            
            const wheelGeometry = new CylinderGeometry(0.6, 0.6, 0.5, 16);        
            const wheelMaterial = new MeshBasicMaterial({ 
                color: 0x111111, 
                transparent: false,
                wireframe: false
            });
            
            // FIXED: Correct wheel positioning to match Three.js coordinate system
            // In Three.js: +Z is backwards (rear), -Z is forwards (front)
            
            // Front left wheel (visually in front - negative Z)
            const wheelFL = new Mesh(wheelGeometry, wheelMaterial);
            wheelFL.position.set(-1.7, -1.1, -1.8); // Front position (negative Z)
            wheelFL.rotation.z = Math.PI / 2;
            wheelFL.rotation.y = 0;
            vehicle.add(wheelFL);
            vehicle.userData.wheels.frontLeft = wheelFL;
            
            // Front right wheel (visually in front - negative Z)
            const wheelFR = new Mesh(wheelGeometry, wheelMaterial);
            wheelFR.position.set(1.7, -1.1, -1.8); // Front position (negative Z)
            wheelFR.rotation.z = Math.PI / 2;
            wheelFR.rotation.y = 0;
            vehicle.add(wheelFR);
            vehicle.userData.wheels.frontRight = wheelFR;
            
            // Rear left wheel (visually in back - positive Z)
            const wheelRL = new Mesh(wheelGeometry, wheelMaterial);
            wheelRL.position.set(-1.7, -1.1, 1.8); // Rear position (positive Z)  
            wheelRL.rotation.z = Math.PI / 2;
            wheelRL.rotation.y = 0;
            vehicle.add(wheelRL);
            vehicle.userData.wheels.rearLeft = wheelRL;
            
            // Rear right wheel (visually in back - positive Z)
            const wheelRR = new Mesh(wheelGeometry, wheelMaterial);
            wheelRR.position.set(1.7, -1.1, 1.8); // Rear position (positive Z)
            wheelRR.rotation.z = Math.PI / 2;
            wheelRR.rotation.y = 0;
            vehicle.add(wheelRR);
            vehicle.userData.wheels.rearRight = wheelRR;
            
            // Place windshield at front (negative Z)
            const windshieldGeometry = new BoxGeometry(2.8, 0.8, 0.1);
            const windshieldMaterial = new MeshBasicMaterial({ 
                color: 0x88CCFF, 
                transparent: true,
                opacity: 0.7
            });
            const windshield = new Mesh(windshieldGeometry, windshieldMaterial);
            windshield.position.set(0, 0.5, -0.7); // Front position (negative Z)
            windshield.rotation.x = Math.PI / 6; // Angled windshield
            vehicle.add(windshield);

            // Register collision dimensions
            const carWidth = 3;
            const carHeight = 1.5;
            const carLength = 5;
            
            vehicle.userData.width = carWidth;
            vehicle.userData.height = carHeight;
            vehicle.userData.depth = carLength;
            
            const dimensions = {
                width: carWidth,
                height: carHeight,
                depth: carLength
            };
            
            // Register with collision system
            const collidable = ObjectManager.registerGameObject(vehicle, 'vehicle', dimensions, false);
            vehicle.collidable = collidable;
            vehicle.userData.collidable = collidable;
            
            // IMPROVED: Set up enhanced collision properties
            if (collidable && collidable.obb) {
                collidable.obb.userData = {
                    isVehicle: true,
                    vehicleReference: vehicle,
                    vehicleType: 'car'
                };
                
                // FIXED: Use userData.id instead of id property
                collidable.debugName = `Car-${vehicle.userData.id || Math.floor(Math.random() * 1000)}`;
            }
            
            // FIXED: Lower car speed and adjust physics properties for better handling
            vehicle.userData.mass = 1000; 
            vehicle.userData.velocity = new Vector3(0, 0, 0);
            vehicle.userData.falling = true;
            vehicle.userData.speed = 0;
            vehicle.userData.maxSpeed = 12; // Reduced from 20
            vehicle.userData.acceleration = 0;
            vehicle.userData.drag = 0.08; // Increased from 0.05
            vehicle.userData.bounceFactor = 0.01;
            vehicle.userData.landingDamping = 0.98;
            
            // CRITICAL FIX: Increase fixed height offset to prevent wheel clipping
            vehicle.userData.fixedHeightOffset = 2.2; // Increased from 1.8 to 2.2
            
            vehicle.userData.gravityFactor = 0.2;
            vehicle.userData.rotationDamping = 0.99;
            vehicle.userData.freshlySpawned = true;
            vehicle.userData.stabilizationFactor = 0.98;
            
            // CRITICAL FIX: Create a specialized method for tracking this vehicle's state
            vehicle.checkCollisions = function() {
                if (this.collidable && typeof ObjectManager.checkObjectCollisions === 'function') {
                    return ObjectManager.checkObjectCollisions(this);
                }
                return [];
            };
            
            // Add to registry
            this.vehicles.push(vehicle);
            
        } catch (err) {
            console.error("Error setting up car components:", err);
        }
        
        return vehicle;
    }

    // Update the current vehicle based on user input, but leave physics to Physics class
    static updateCurrentVehicle(deltaTime = 1/60) {
        try {
            // Skip if there is no current vehicle
            if (!this.currentVehicle) {
                return;
            }
            
            // Ensure userData object exists
            if (!this.currentVehicle.userData) {
                this.currentVehicle.userData = {};
            }
            
            // IMPROVED: Let controllers handle all vehicle input processing
            // Input handling has been moved to respective controllers (CarController/AirplaneController)
            // VehicleManager is now only responsible for animations and non-controller vehicles
            const vehicleType = this.currentVehicle.userData.type;
            
            // Skip physics processing for controller-managed vehicles
            if (this.currentVehicle.userData?.isActivelyControlled || 
                this.currentVehicle.userData?._controlledByCarController) {
                // Controller is already handling this vehicle
            }
            // Only manage animations and other visual updates
            else {
                // Update any visual effects or animations regardless of controller
                this.updateVehicleAnimations(this.currentVehicle, deltaTime);
            }
            
            // ADDED: Always adjust height for non-falling vehicles to ensure proper ground contact
            if (!this.currentVehicle?.userData?.falling &&
                this.currentVehicle?.userData?.planet) {
                
                // Call Physics method to maintain correct height above surface
                Physics.maintainVehicleHeight(this.currentVehicle);
            }
            
        } catch (err) {
            console.error("Error updating current vehicle:", err);
        }
    }
    
    // Update vehicle visual animations (wheels, propellers, etc.)
    static updateVehicleAnimations(vehicle, deltaTime) {
        if (!vehicle || !vehicle.userData) return;
    
        try {
            const vehicleType = vehicle.userData.type;
            const speed = vehicle.userData.speed || 0;
            
            if (vehicleType === 'car') {
                // Animate car wheels if they exist
                const wheels = vehicle.userData.wheels;
                if (wheels) {
                    // Calculate wheel rotation based on speed
                    // Average car wheel is ~0.6m radius, so full rotation at ~3.8m travel
                    const rotationSpeed = speed / 0.6; // radians per second
                    
                    // MODIFIED: Ensure wheels are properly oriented only when not falling
                    // This maintains wheel orientation during jumps and preserves rotation after exit
                    if (!vehicle.userData.falling && Math.abs(speed) < 0.01) {
                        // When stationary on the ground, ensure wheels have the correct base rotation
                        this.resetWheelsBaseOrientation(vehicle);
                    } else {
                        // Rotate each wheel based on vehicle movement
                        Object.values(wheels).forEach(wheel => {
                            if (wheel) {
                                wheel.rotation.x += rotationSpeed * deltaTime;
                            }
                        });
                    }
                }
            } else if (vehicleType === 'airplane') {
                // Animate propeller if it exists
                const propeller = vehicle.userData.propeller;
                if (propeller) {
                    // Propeller rotation speed increases with airplane speed
                    const baseRotationSpeed = 5; // base rotation speed (radians per second)
                    const speedFactor = Math.abs(speed) / 10; // normalizes speed contribution
                    const rotationSpeed = baseRotationSpeed + speedFactor * 10;
                    
                    propeller.rotation.x += rotationSpeed * deltaTime;
                }
            }
        } catch (err) {
            console.error("Error updating vehicle animations:", err);
        }
    }
    
    
    // FIXED: Improved wheel orientation method that properly handles steering
    static resetWheelsBaseOrientation(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.wheels) return;
        
        try {
            // Skip wheel reorientation during hard freeze
            if (vehicle.userData.hardFreeze) return;
            
            // CRITICAL FIX: Skip wheel alignment for falling vehicles
            if (vehicle.userData.falling) return;
            
            // Check if car controller is actively managing this vehicle
            const isControllerManaged = vehicle === this.currentVehicle && 
                (vehicle.userData?.isActivelyControlled || vehicle.userData?._controlledByCarController);
                
            if (isControllerManaged) {
                // Let the controller handle wheel orientation
                return;
            }
            
            // Get steering angle from vehicle
            const steeringAngle = vehicle.userData.steeringAngle || 0;
            
            // Apply steering to front wheels, preserving roll rotation
            Object.entries(vehicle.userData.wheels).forEach(([wheelName, wheel]) => {
                if (!wheel) return;
                
                // Get current roll rotation (x-axis)
                const currentRoll = wheel.rotation.x;
                
                if (wheelName.includes('front')) {
                    // Apply steering to front wheels
                    wheel.rotation.set(
                        currentRoll,        // Keep current roll rotation
                        steeringAngle,      // Apply steering angle to y-axis
                        Math.PI/2           // Keep wheels perpendicular (z-axis)
                    );
                } else {
                    // Keep rear wheels straight
                    wheel.rotation.set(
                        currentRoll,        // Keep current roll rotation
                        0,                  // No steering for rear wheels
                        Math.PI/2           // Keep wheels perpendicular
                    );
                }
            });
            
            // Store that wheels have been properly oriented
            vehicle.userData.wheelsAligned = true;
            vehicle.userData.wheelAlignmentTime = Date.now();
            
        } catch (err) {
            console.error("Error resetting wheel orientation:", err);
        }
    }

    // Try to enter a nearby vehicle
    static tryEnterNearbyVehicle() {
        if (!PlayersManager.self) {
            console.log("No player available to enter vehicle");
            return false;
        }

        // Find the closest vehicle to the player
        const player = PlayersManager.self;
        const playerPosition = player.position || new Vector3();

        // CRITICAL FIX: Initialize a vehicle variable before using it
        let vehicle = null;
        let closestDistance = Infinity;

        // Find the closest vehicle
        for (const v of this.vehicles) {
            if (!v || !v.position) continue;
            if (v.userData && v.userData.isOccupied) continue; // Skip already occupied vehicles

            const distance = v.position.distanceTo(playerPosition);
            if (distance < closestDistance && distance < 5) { // Can enter within 5 units
                closestDistance = distance;
                vehicle = v;
            }
        }

        // CRITICAL FIX: Check if we found a vehicle before proceeding
        if (!vehicle) {
            console.log("No vehicles found nearby");
            return false;
        }

        console.log(`Found vehicle at distance ${closestDistance.toFixed(2)}, type: ${vehicle.userData?.type || 'unknown'}`);

        // Make sure player isn't already in a vehicle
        if (PlayersManager.self.inVehicle || this.currentVehicle) {
            console.log("Player is already in a vehicle");
            return false;
        }

        // CRITICAL FIX: Ensure vehicle is properly aligned to planet surface before entering
        if (vehicle.userData && vehicle.userData.planet) {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toSurface = vehicle.position.clone().sub(planetCenter).normalize();
            
            console.log("Aligning vehicle to surface before player entry");
            
            // Use strong alignment factor for immediate correction
            this.alignVehicleToPlanetSurface(vehicle, toSurface, 0.8, true);
            
            // FIXED: Check if CarController exists before accessing its methods
            if (vehicle.userData.type === 'car' && 
                typeof CarController !== 'undefined' && 
                typeof CarController.snapToSurface === 'function') {
                
                console.log("Using CarController.snapToSurface to position car correctly");
                CarController.snapToSurface(vehicle, planet);
            }
        }

        // Set cross-references
        vehicle.userData.isOccupied = true;
        vehicle.userData.player = PlayersManager.self;
        
        // ENHANCED: Set more explicit player-vehicle relationship for collision system
        vehicle.userData.occupiedBy = PlayersManager.self.handle;
        vehicle.userData.currentDriver = PlayersManager.self;
        
        // CRITICAL FIX: Add flag to ignore collision between player and vehicle
        vehicle._ignoreCollisionWith = PlayersManager.self.handle;
        if (PlayersManager.self.handle) {
            PlayersManager.self.handle._ignoreCollisionWith = vehicle;
            
            // ADDED: Explicitly disable player collisions when entering vehicle
            // Hide player mesh and disable collision processing
            PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            
            // Additional safety check - disable collision box
            if (PlayersManager.self.collidable) {
                PlayersManager.self.collidable.active = false;
                console.log("Player collision box explicitly disabled on vehicle entry");
            }
            
            // Add custom property to help debug collision issues
            PlayersManager.self.handle.userData._inVehicleTime = Date.now();
            PlayersManager.self.handle.userData._ignoreCollisionSince = Date.now();
        }

        // Update player state
        PlayersManager.self.inVehicle = true;
        PlayersManager.self.currentVehicle = vehicle;

        // Update global vehicle reference
        this.currentVehicle = vehicle;

        // Mark vehicle active for player controls
        vehicle.userData.hasInput = true;

        // Reset any velocity the player had
        if (PlayersManager.self.velocity) PlayersManager.self.velocity.set(0, 0, 0);

        console.log(`Player entered ${vehicle.userData?.type || 'unknown'} vehicle`);
        return true;
    }

    // Exit the current vehicle
    static exitVehicle() {
        if (!this.currentVehicle || !PlayersManager.self) {
            return false;
        }
        
        try {
            const vehicle = this.currentVehicle;
            
            console.log(`Exiting vehicle (${vehicle.userData?.type || 'unknown'})`);
            
            // Reset vehicle state
            vehicle.userData.isOccupied = false;
            vehicle.userData.player = null;
            vehicle.userData.hasInput = false;
            
            // REMOVED: Surface alignment/snapping on exit
            // This is unnecessary as the vehicle is already positioned correctly
            // and Physics.maintainObjectSurfaceHeight will handle any needed corrections
            
            // IMPROVED: Create a grace period to avoid vehicle-player collisions after exit
            vehicle.userData._entryGracePeriod = true;
            vehicle.userData._entryGraceEndTime = Date.now() + 1500;
            vehicle._ignoreCollisionWith = PlayersManager.self.handle;
            
            // Calculate exit position beside the vehicle, not in front of it
            // This prevents the player from getting stuck inside or under the vehicle
            const vehicleRight = new Vector3(1, 0, 0).applyQuaternion(vehicle.quaternion);
            
            // Calculate exit position 3 units to the right of the vehicle
            // This places the player beside the vehicle, not in front or under it
            const exitPosition = vehicle.position.clone().addScaledVector(vehicleRight, 3);
            
            // ENHANCED: Ensure proper height at exit position
            if (vehicle.userData.planet) {
                const planet = vehicle.userData.planet;
                const planetCenter = planet.object.position;
                const toSurface = exitPosition.clone().sub(planetCenter).normalize();
                
                // Set player at proper height above planet
                exitPosition.copy(planetCenter.clone().addScaledVector(
                    toSurface,
                    planet.radius + 1.0 // Player height offset (slightly higher than collision height)
                ));
            }
            
            // Set player position to exit position
            PlayersManager.self.position.copy(exitPosition);
            
            // Update handle position
            if (PlayersManager.self.handle) {
                PlayersManager.self.handle.position.copy(exitPosition);
                PlayersManager.self.handle.visible = true;
                
                // REMOVED: Additional player positioning code that was redundant
                
                // Clear vehicle references
                PlayersManager.self.handle.userData.inVehicle = false;
                PlayersManager.self.handle.userData.currentVehicle = null;
            }
            
            // Reset player state
            PlayersManager.self.inVehicle = false;
            PlayersManager.self.currentVehicle = null;
            
            // Reset vehicle references
            this.currentVehicle = null;
            
            return true;
        } catch (err) {
            console.error("Error exiting vehicle:", err);
            return false;
        }
    }
}