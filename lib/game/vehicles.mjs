import { 
    CylinderGeometry, 
    MeshBasicMaterial, 
    Mesh, 
    Vector3, 
    Quaternion, 
    Matrix4,
    BoxGeometry,
    Object3D,
    Box3,
    Box3Helper
} from 'three';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';
import ObjectManager from './object.mjs';
import PlayersManager from './players.mjs';
import Physics from './physics.mjs';

// Define GRAVITY_CONSTANT locally to match the one in physics.mjs
const GRAVITY_CONSTANT = 0.5;

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;
    
    // Add interaction cooldown timer
    static interactionCooldown = 0;

    // Create a car on the specified planet at the given coordinates
    static createCar(planet, latitude, longitude, heightOffset = 3) {
        const car = this.createVehicleBase('car', planet, latitude, longitude, heightOffset);
        
        // Add a vehicle name
        car.userData.name = `Car-${Math.floor(Math.random() * 1000)}`;
        
        // Create car body
        const bodyGeometry = new BoxGeometry(6, 2, 10);
        const bodyMaterial = new MeshBasicMaterial({ color: 0xFF0000 });
        const body = new Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 2;
        car.add(body);
        
        // Create wheels collection for animation
        car.userData.wheels = {};
        
        // FIXED: Enhanced wheel setup with consistent rotation axes
        const wheelGeometry = new CylinderGeometry(1.5, 1.5, 1, 16);
        const wheelMaterial = new MeshBasicMaterial({ color: 0x333333 });
        
        // Front left wheel - Create wheel properly aligned for rotation
        const wheelFL = new Mesh(wheelGeometry, wheelMaterial);
        wheelFL.position.set(-3, 0.5, 3);
        // Rotate cylinder to lie flat (sideways) with axis of rotation along X
        wheelFL.rotation.z = Math.PI / 2;
        wheelFL.rotation.y = 0;
        car.add(wheelFL);
        car.userData.wheels.frontLeft = wheelFL;
        
        // Front right wheel
        const wheelFR = new Mesh(wheelGeometry, wheelMaterial);
        wheelFR.position.set(3, 0.5, 3);
        // Match the front left wheel orientation
        wheelFR.rotation.z = Math.PI / 2;
        wheelFR.rotation.y = 0;
        car.add(wheelFR);
        car.userData.wheels.frontRight = wheelFR;
        
        // Rear left wheel - ensure consistent orientation with front wheels
        const wheelRL = new Mesh(wheelGeometry, wheelMaterial);
        wheelRL.position.set(-3, 0.5, -3);
        // Match front wheel orientation exactly
        wheelRL.rotation.z = Math.PI / 2;
        wheelRL.rotation.y = 0;
        car.add(wheelRL);
        car.userData.wheels.rearLeft = wheelRL;
        
        // Rear right wheel
        const wheelRR = new Mesh(wheelGeometry, wheelMaterial);
        wheelRR.position.set(3, 0.5, -3);
        // Match front wheel orientation exactly
        wheelRR.rotation.z = Math.PI / 2;
        wheelRR.rotation.y = 0;
        car.add(wheelRR);
        car.userData.wheels.rearRight = wheelRR;
        
        // Add wheel rotation helper method
        car.userData.rotateWheels = function(angle, steeringAngle = 0) {
            // Roll all wheels (X-axis rotation after our setup)
            if (this.wheels.frontLeft) this.wheels.frontLeft.rotation.x = angle;
            if (this.wheels.frontRight) this.wheels.frontRight.rotation.x = angle;
            if (this.wheels.rearLeft) this.wheels.rearLeft.rotation.x = angle;
            if (this.wheels.rearRight) this.wheels.rearRight.rotation.x = angle;
            
            // Apply steering to front wheels only (Y-axis in our setup)
            if (this.wheels.frontLeft) this.wheels.frontLeft.rotation.y = steeringAngle;
            if (this.wheels.frontRight) this.wheels.frontRight.rotation.y = steeringAngle;
        };
        
        // Adjust physics handle position to align better with wheels
        const physicsHandle = new Mesh(
            new BoxGeometry(6, 4, 10),
            new MeshBasicMaterial({ color: 0xFF0000, wireframe: true, visible: false })
        );
        physicsHandle.position.set(0, 1.5, 0);
        car.add(physicsHandle);
        car.userData.physicsHandle = physicsHandle;
        
        // Add bounding box helper for debugging
        const boundingBox = new Box3().setFromObject(physicsHandle);
        const boxHelper = new Box3Helper(boundingBox, 0xFF0000);
        boxHelper.visible = false;
        car.add(boxHelper);
        car.userData.boundingBox = boundingBox;
        car.userData.boxHelper = boxHelper;
        
        // Register car as a DYNAMIC collidable object
        car.collidable = ObjectManager.registerCollidable(car, boundingBox, 'vehicle', false);
        
        // Set vehicle properties
        car.userData.type = 'car';
        car.userData.isDynamic = true;
        car.userData.speed = 0;
        car.userData.maxSpeed = 40;
        car.userData.acceleration = 0.5;
        car.userData.handling = 0.03;
        car.userData.friction = 0.90;
        car.userData.isOccupied = false;
        car.userData.maxSpeedReverse = 15;
        
        console.log(`Created car "${car.userData.name}" on ${planet.name} at ${latitude}°, ${longitude}°`);
        return car;
    }
    
    // Create an airplane on the specified planet at the given coordinates
    static createAirplane(planet, latitude, longitude, heightOffset = 5) {
        try {
            // CRITICAL FIX: Check if planet is valid before proceeding
            if (!planet || !planet.object || !planet.radius) {
                console.error("Cannot create airplane: invalid planet data", planet);
                return null;
            }
            
            console.log(`Creating airplane on planet ${planet.name} at lat=${latitude}, lon=${longitude}`);
            
            const airplane = this.createVehicleBase('airplane', planet, latitude, longitude, heightOffset);
            
            // CRITICAL FIX: Add null check to prevent "Cannot read properties of null"
            if (!airplane) {
                console.error("Failed to create airplane base vehicle");
                return null;
            }
            
            // Add a vehicle name
            airplane.userData.name = `Airplane-${Math.floor(Math.random() * 1000)}`;
            
            // Create airplane body
            const bodyGeometry = new BoxGeometry(4, 3, 15);
            const bodyMaterial = new MeshBasicMaterial({ color: 0x4444FF });
            const body = new Mesh(bodyGeometry, bodyMaterial);
            body.position.y = 1;
            airplane.add(body);
            
            // Create wings
            const wingGeometry = new BoxGeometry(20, 1, 5);
            const wingMaterial = new MeshBasicMaterial({ color: 0x7777FF });
            const wings = new Mesh(wingGeometry, wingMaterial);
            wings.position.y = 1;
            airplane.add(wings);
            
            // Create tail
            const tailGeometry = new BoxGeometry(8, 1, 3);
            const tailMaterial = new MeshBasicMaterial({ color: 0x7777FF });
            const tail = new Mesh(tailGeometry, tailMaterial);
            tail.position.set(0, 3, -6);
            airplane.add(tail);
            
            // Create physics handle for collision detection
            const physicsHandle = new Mesh(
                new BoxGeometry(20, 3, 15),
                new MeshBasicMaterial({ color: 0x4444FF, wireframe: true, visible: false })
            );
            physicsHandle.position.set(0, 1, 0);
            airplane.add(physicsHandle);
            airplane.userData.physicsHandle = physicsHandle;
            
            // Add bounding box helper for debugging
            const boundingBox = new Box3().setFromObject(physicsHandle);
            const boxHelper = new Box3Helper(boundingBox, 0x4444FF);
            boxHelper.visible = false;
            airplane.add(boxHelper);
            airplane.userData.boundingBox = boundingBox;
            airplane.userData.boxHelper = boxHelper;
            
            // Register airplane as a DYNAMIC collidable object
            airplane.collidable = ObjectManager.registerCollidable(airplane, boundingBox, 'vehicle', false);
            
            // Set vehicle properties
            airplane.userData.speed = 0;
            airplane.userData.maxSpeed = 80;
            airplane.userData.acceleration = 0.3;
            airplane.userData.handling = 0.02;
            airplane.userData.liftFactor = 0.5;
            airplane.userData.dragFactor = 0.02;
            airplane.userData.stallSpeed = 15;
            airplane.userData.takeoffSpeed = 25;
            airplane.userData.altitude = 0;
            airplane.userData.maxAltitude = 500;
            airplane.userData.isOccupied = false;
            
            console.log(`Created airplane "${airplane.userData.name}" on ${planet.name} at ${latitude}°, ${longitude}°`);
            return airplane;
        } catch (e) {
            console.error("Error creating airplane:", e);
            return null;
        }
    }

    // Generic method to create a vehicle object
    static createVehicleBase(type, planet, latitude, longitude, heightOffset = 2) {
        // CRITICAL FIX: Enhanced error handling
        if (!planet) {
            console.error("Cannot create vehicle: planet is null");
            return null;
        }
        
        if (!planet.object) {
            console.error(`Cannot create vehicle: invalid planet object for ${planet.name || 'unnamed planet'}`);
            return null;
        }
        
        try {
            console.log(`Creating ${type} on planet ${planet.name} at lat=${latitude}, lon=${longitude}, height=${heightOffset}`);
            
            // First check for any duplicate vehicles at this location
            for (const existing of this.vehicles) {
                if (!existing || !existing.userData) continue;
                
                const distThreshold = 5; // Consider vehicles within 5 units as duplicates
                // Check if there's already a vehicle of the same type at nearby coordinates
                if (existing.userData.type === type && 
                    existing.userData.planet === planet) {
                    
                    const distSq = existing.position.distanceToSquared(
                        SceneManager.calculatePositionOnPlanet(planet, latitude, longitude, heightOffset)
                    );
                    
                    if (distSq < distThreshold * distThreshold) {
                        console.warn(`Prevented creating duplicate ${type} near existing vehicle at ${latitude}°, ${longitude}°`);
                        return existing; // Return the existing vehicle instead of creating a new one
                    }
                }
            }
            
            // CRITICAL FIX: Add more robust error handling around vehicle creation
            let vehicle = null;
            try {
                vehicle = new Object3D();
                
                // CRITICAL FIX: Initialize userData first to prevent null access
                vehicle.userData = {
                    type: type,
                    planet: planet,
                    isVehicle: true,
                    isOccupied: false,
                    name: `Vehicle-${Math.floor(Math.random() * 1000)}`,
                    vehicleId: `${type}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                    velocity: new Vector3(),
                    independentStateInitialized: true
                };
                
                vehicle.name = vehicle.userData.vehicleId; // Makes it easier to debug in scene explorer
                
                // ENHANCED: Better error messages for positioning
                console.log(`Planet for positioning: name=${planet.name}, position=${planet.object.position.toArray()}, radius=${planet.radius}`);
                
                try {
                    SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, heightOffset);
                } catch (posError) {
                    console.error(`Error positioning vehicle on planet: ${posError}`);
                    // Try direct positioning if positioning on planet fails
                    vehicle.position.set(planet.object.position.x, planet.object.position.y + planet.radius + heightOffset, planet.object.position.z);
                }
                
                vehicle.userData.isDynamic = true;
                vehicle.userData.initialQuaternion = vehicle.quaternion.clone();
                
                const fallVelocity = Math.min(-0.05, -heightOffset * 0.01);
                vehicle.userData.velocity.set(0, fallVelocity, 0);
                
                const isSignificantHeight = heightOffset > 2;
                vehicle.userData.falling = isSignificantHeight;
                vehicle.userData.onSurface = !isSignificantHeight;
                vehicle.userData._checkedForLanding = !isSignificantHeight;
                
                console.log(`Created ${type} at position ${vehicle.position.toArray()} with falling=${vehicle.userData.falling}`);
                
                vehicle.userData.speed = heightOffset > 10 ? 0.2 : 0;
                
                Engine.scene.add(vehicle);
                
                // CRITICAL FIX: Validate vehicle before adding to array
                const alreadyExists = this.vehicles.some(v => 
                    v && v.userData && v.userData.vehicleId === vehicle.userData.vehicleId
                );
                
                if (!alreadyExists) {
                    this.vehicles.push(vehicle);
                    console.log(`Added ${type} to vehicles array, total count: ${this.vehicles.length}`);
                } else {
                    console.error(`Duplicate vehicle detected and prevented: ${vehicle.userData.vehicleId}`);
                }
                
                return vehicle;
            } catch (vehicleError) {
                console.error(`Error creating vehicle object: ${vehicleError}`);
                return null;
            }
        } catch (e) {
            console.error(`Error creating vehicle on planet ${planet?.name}:`, e);
            return null;
        }
    }
    
    static createPlanetVehicles() {
        console.warn('createPlanetVehicles is deprecated, use createCar and createAirplane instead');
    }
    
    static setupVehicleInteractions() {
        console.log('Vehicle interactions initialized (keys handled by ControlManager)');
        
        if (typeof window !== 'undefined') {
            window.enterVehicle = this.enterVehicle.bind(this);
            window.exitVehicle = this.exitVehicle.bind(this);
        }
    }
    
    static tryEnterNearbyVehicle() {
        if (this.interactionCooldown > 0) {
            console.log(`Vehicle interaction on cooldown: ${this.interactionCooldown}`);
            return false;
        }
        
        if (!PlayersManager.self || !PlayersManager.self.handle) {
            console.log('No player available for vehicle entry check');
            return false;
        }
        
        // CRITICAL FIX: Exit current vehicle first if we're already in one
        if (this.currentVehicle) {
            console.log('Already in a vehicle, exiting first');
            this.exitVehicle();
        }
        
        // CRITICAL FIX: Perform full vehicle validation before attempting to enter
        this.validateVehicles();
        
        const playerPosition = PlayersManager.self.position.clone();
        let closestVehicle = null;
        let closestDistance = 15;
        
        console.log(`Looking for vehicles near player position ${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}`);
        console.log(`Total vehicles available: ${this.vehicles.length}`);
        
        const occupiedVehicleIds = [];
        
        // First look for occupied vehicles - these would indicate an issue
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle || !vehicle.userData) return;
            
            if (vehicle.userData.isOccupied) {
                console.warn(`Found already occupied vehicle: ${vehicle.userData.name} (${vehicle.userData.vehicleId})`);
                occupiedVehicleIds.push(vehicle.userData.vehicleId);
            }
        });
        
        // If we found occupied vehicles but currentVehicle is null, we have orphaned "occupied" vehicles
        if (occupiedVehicleIds.length > 0 && !this.currentVehicle) {
            console.warn("Found orphaned 'occupied' vehicles - fixing state");
            for (const vehicle of this.vehicles) {
                if (vehicle && vehicle.userData && occupiedVehicleIds.includes(vehicle.userData.vehicleId)) {
                    vehicle.userData.isOccupied = false;
                    vehicle.userData.player = null;
                    vehicle.userData.hasPlayerInside = false;
                }
            }
        }
        
        // Now find the closest unoccupied vehicle
        for (const vehicle of this.vehicles) {
            if (!vehicle || !vehicle.userData || vehicle.userData.isOccupied) continue;
            
            const distance = playerPosition.distanceTo(vehicle.position);
            console.log(`Distance to ${vehicle.userData.type} (${vehicle.userData.vehicleId}): ${distance.toFixed(2)}`);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestVehicle = vehicle;
            }
        }
        
        if (closestVehicle) {
            console.log(`Entering ${closestVehicle.userData.type} "${closestVehicle.userData.name}" at distance ${closestDistance.toFixed(2)}`);
            
            this.interactionCooldown = 30;
            
            return this.enterVehicle(closestVehicle);
        } else {
            console.log('No vehicle found within range');
            return false;
        }
    }

    static enterVehicle(vehicle) {
        // CRITICAL FIX: Exit current vehicle first if we're already in one
        if (this.currentVehicle) {
            console.log('Already in a vehicle, exiting first');
            this.exitVehicle();
            
            // Add a small delay to ensure cleanup completes
            this.interactionCooldown = 15;
            return false;
        }
        
        // Basic validation
        if (!vehicle) {
            console.log('No valid vehicle to enter');
            return false;
        }
        
        // Verify it's in our vehicles array (prevent entering detached vehicles)
        if (!this.vehicles.includes(vehicle)) {
            console.warn(`Attempted to enter vehicle not in vehicles array: ${vehicle.userData?.name || 'unnamed'}`);
            return false;
        }
        
        if (vehicle.userData.isOccupied) {
            console.log('Vehicle is already occupied');
            return false;
        }
        
        console.log(`Entering ${vehicle.userData.type} "${vehicle.userData.name}" (${vehicle.userData.vehicleId})`);
        
        // CRITICAL FIX: Force reset all vehicles before setting current vehicle
        for (const otherVehicle of this.vehicles) {
            if (!otherVehicle || otherVehicle === vehicle) continue;
            
            // Reset other vehicle state
            if (otherVehicle.userData) {
                otherVehicle.userData.isOccupied = false;
                otherVehicle.userData.hasPlayerInside = false;
                otherVehicle.userData.player = null;
            }
        }
        
        // Set current vehicle
        this.currentVehicle = vehicle;
        vehicle.userData.isOccupied = true;
        vehicle.userData.hasPlayerInside = true;
        vehicle.userData.player = PlayersManager.self;
        
        // Save player's original position
        this.playerOriginalPosition = PlayersManager.self.position.clone();
        
        // ENHANCED FIX: Force initial stabilization for car when entering
        if (vehicle.userData.type === 'car') {
            // Add a stability flag and timer to prevent immediate camera movement
            vehicle.userData._stabilizationStarted = Date.now();
            vehicle.userData._stabilizationPeriod = 1500; // Increased to 1.5 seconds for better stability
            vehicle.userData._stabilizeUntil = Date.now() + 1500;
            vehicle.userData._cameraInitialized = false;
            vehicle.userData._cameraStable = false;
            vehicle.userData._lockCamera = true; // Add explicit camera locking flag
            
            // Reset camera status when entering
            if (Engine.camera) {
                vehicle.userData._pendingCameraAttach = true;
                
                // Completely reset camera rotation immediately to prevent carry-over issues
                if (Engine.camera.parent && Engine.camera.parent !== vehicle) {
                    const worldPos = new Vector3();
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                    Engine.camera.rotation.set(0, 0, 0);
                    Engine.camera.quaternion.identity();
                }
            }
            
            console.log("Starting car stabilization period to prevent rotation issues");
        }
        
        if (PlayersManager.self) {
            PlayersManager.self._savedVelocity = PlayersManager.self.velocity.clone();
            PlayersManager.self.velocity.set(0, 0, 0);
            PlayersManager.self.inVehicle = true;
            
            if (PlayersManager.self.handle && PlayersManager.self.handle.userData) {
                PlayersManager.self.handle.userData.inVehicle = true;
                PlayersManager.self.handle.userData.currentVehicle = vehicle;
            }
            
            PlayersManager.setPlayerVisibility(PlayersManager.self, false);
            PlayersManager.self._originalHandle = PlayersManager.self.handle;
            PlayersManager.self.handle = vehicle;
            
            console.log('Disabled player physics for vehicle entry');
        }
        
        if (typeof window !== 'undefined' && window.gameNotify) {
            window.gameNotify(`Entered ${vehicle.userData.type} "${vehicle.userData.name}". Press E to exit.`);
        }
        
        return true;
    }

    static exitVehicle() {
        if (!this.currentVehicle) {
            console.log('No vehicle to exit');
            return false;
        }
        
        console.log(`Exiting ${this.currentVehicle.userData.type} "${this.currentVehicle.userData.name}"`);
        
        try {
            const exitedVehicle = this.currentVehicle;
            const vehiclePos = new Vector3();
            exitedVehicle.getWorldPosition(vehiclePos);
            
            const exitOffset = exitedVehicle.userData.type === 'airplane' ?
                new Vector3(50, 20, 0) :
                new Vector3(0, 10, 30);
            
            exitOffset.applyQuaternion(exitedVehicle.quaternion);
            const exitPosition = vehiclePos.clone().add(exitOffset);
            
            const planetCenter = exitedVehicle.userData.planet?.object?.position;
            if (!planetCenter) {
                console.error('No planet data for camera orientation');
                return false;
            }
            
            const toPlayer = exitPosition.clone().sub(planetCenter).normalize();
            
            if (PlayersManager.self) {
                if (PlayersManager.self._originalHandle) {
                    PlayersManager.self.handle = PlayersManager.self._originalHandle;
                    PlayersManager.self._originalHandle = null;
                }
                
                PlayersManager.self.handle.position.copy(exitPosition);
                PlayersManager.self.position.copy(exitPosition);
                PlayersManager.self.handle.up.copy(toPlayer);
                PlayersManager.self.surfaceNormal = toPlayer.clone();
                
                const forward = new Vector3(0, 0, -1).applyQuaternion(exitedVehicle.quaternion);
                const right = new Vector3().crossVectors(toPlayer, forward).normalize();
                const surfaceForward = new Vector3().crossVectors(right, toPlayer).normalize();
                
                const lookTarget = exitPosition.clone().add(surfaceForward);
                PlayersManager.self.handle.lookAt(lookTarget);
                
                PlayersManager.self.falling = (exitedVehicle.userData.type === 'airplane');
                PlayersManager.self.inVehicle = false;
                
                if (PlayersManager.self.handle && PlayersManager.self.handle.userData) {
                    PlayersManager.self.handle.userData.inVehicle = false;
                    PlayersManager.self.handle.userData.currentVehicle = null;
                }
                
                if (PlayersManager.self.mesh && PlayersManager.self.handle) {
                    if (PlayersManager.self.mesh.parent !== PlayersManager.self.handle) {
                        if (PlayersManager.self.mesh.parent) {
                            PlayersManager.self.mesh.parent.remove(PlayersManager.self.mesh);
                        }
                        PlayersManager.self.handle.add(PlayersManager.self.mesh);
                    }
                }
                
                PlayersManager.setPlayerVisibility(PlayersManager.self, true);
                
                if (Engine.camera.parent) {
                    const worldPos = new Vector3();
                    Engine.camera.getWorldPosition(worldPos);
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                }
                
                Engine.camera.rotation.set(0, 0, 0);
                Engine.camera.quaternion.identity();
                Engine.camera.up.copy(toPlayer);
            }
            
            exitedVehicle.userData.isOccupied = false;
            exitedVehicle.userData.player = null;
            exitedVehicle.userData.hasPlayerInside = false;
            
            this.currentVehicle = null;
            this.interactionCooldown = 60;
            
            return true;
        } catch (e) {
            console.error('Error exiting vehicle:', e);
            return false;
        }
    }
    
    // ENHANCED FIX: Force complete immobility of non-current vehicles
    static updateCurrentVehicle(deltaTime = 1/60) {
        if (this.interactionCooldown > 0) {
            this.interactionCooldown--;
        }
        
        // CRITICAL FIX: Check for any ghost/duplicate vehicles and clean them up
        this.validateVehicles();
        
        // CRITICAL FIX: Use a separate input reference for each vehicle to prevent cross-contamination
        // Clear the input reference for non-current vehicles and force them to be stationary
        for (const vehicle of this.vehicles) {
            if (!vehicle) continue;
            
            if (vehicle !== this.currentVehicle) {
                // CRITICAL FIX: Explicitly zero out ALL movement properties
                // of non-current vehicles to prevent ghost movement
                // Ensure stationary vehicle has no velocity/speed
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                if ('speed' in vehicle.userData) {
                    vehicle.userData.speed = 0;
                }
                
                // FIXED: Ensure each vehicle has its own unique input object
                vehicle.userData.input = null;
                vehicle.userData.hasInput = false;
                
                // Reset wheel steering/rotation state to prevent animation
                if (vehicle.userData.wheels) {
                    if ('wheelSteerAngle' in vehicle.userData) {
                        vehicle.userData.wheelSteerAngle = 0;
                    }
                    if ('wheelRollAngle' in vehicle.userData) {
                        // Don't reset roll angle, just stop changing it
                        vehicle.userData.wheelRotationSpeed = 0;
                    }
                    
                    // Explicitly reset wheel rotations for non-used vehicles
                    this.resetVehicleWheels(vehicle);
                }
            }
        }
        
        // Only process the current vehicle if it exists
        if (this.currentVehicle && this.currentVehicle.userData.isOccupied) {
            const vehicle = this.currentVehicle;
            
            // ENHANCED FIX: Ensure current vehicle has its own input reference
            if (this.input) {
                if (!vehicle.userData.input) {
                    vehicle.userData.input = {
                        movement: new Vector3(),
                        rotation: new Vector3(),
                        action: false,
                        exit: false
                    };
                }
                vehicle.userData.input.movement.copy(this.input.movement);
                vehicle.userData.input.rotation.copy(this.input.rotation);
                vehicle.userData.input.action = this.input.action;
                vehicle.userData.input.exit = this.input.exit;
                vehicle.userData.hasInput = true;
            }
            
            // ENHANCED FIX: Update wheel rotation based on vehicle speed - for CURRENT vehicle only
            if (vehicle.userData.type === 'car' && vehicle.userData.wheels) {
                const wheelRadius = 1.5; // Match the cylinder radius
                const wheelCircumference = 2 * Math.PI * wheelRadius;
                const distanceTraveled = vehicle.userData.speed * deltaTime;
                const rotationAngle = (distanceTraveled / wheelCircumference) * 2 * Math.PI;
                
                // Get current wheel rotation
                const currentRotation = vehicle.userData.wheelRotation || 0;
                // Update total rotation
                const newRotation = currentRotation + rotationAngle;
                // Store for next frame
                vehicle.userData.wheelRotation = newRotation;
                
                // Calculate steering angle from input if available
                let steeringAngle = 0;
                if (vehicle.userData.input && vehicle.userData.input.movement) {
                    // Convert lateral input to steering angle, capped at 30 degrees (0.52 radians)
                    steeringAngle = vehicle.userData.input.movement.x * 0.52;
                }
                
                // Apply wheel rotations
                if (vehicle.userData.rotateWheels) {
                    vehicle.userData.rotateWheels(newRotation, steeringAngle);
                }
            }
            
            // ENHANCED FIX: Car camera handling with strict camera control
            if (vehicle.userData.type === 'car') {
                // Always ensure camera is properly attached to the car
                if (Engine.camera && vehicle.userData._lockCamera) {
                    // Handle stabilization period
                    const inStabilization = vehicle.userData._stabilizationStarted !== null && 
                                         vehicle.userData._stabilizationStarted !== undefined;
                    
                    // Ensure camera is properly attached to the car after initial delay
                    if (!vehicle.userData._cameraInitialized && 
                        (!inStabilization || 
                        Date.now() - vehicle.userData._stabilizationStarted > 300)) {
                        
                        // Detach camera from any existing parent
                        if (Engine.camera.parent && Engine.camera.parent !== vehicle) {
                            const worldPos = new Vector3();
                            Engine.camera.getWorldPosition(worldPos);
                            Engine.camera.parent.remove(Engine.camera);
                            Engine.scene.add(Engine.camera);
                            Engine.camera.position.copy(worldPos);
                        }
                        
                        // Clean attach to vehicle with fixed orientation
                        Engine.scene.remove(Engine.camera);
                        vehicle.add(Engine.camera);
                        
                        // Position behind and slightly above the car with fixed rotation
                        Engine.camera.position.set(0, 7, -15); // Adjusted for better view
                        Engine.camera.rotation.set(0.2, Math.PI, 0); // Slightly looking down at car
                        
                        vehicle.userData._cameraRotation = Engine.camera.rotation.clone();
                        vehicle.userData._cameraPosition = Engine.camera.position.clone();
                        vehicle.userData._cameraInitialized = true;
                        vehicle.userData._pendingCameraAttach = false;
                        
                        console.log("Camera rigidly attached to car with fixed position");
                    }
                    
                    // Force camera to maintain fixed rotation & position relative to car
                    if (vehicle.userData._cameraInitialized && Engine.camera.parent === vehicle) {
                        // Restore camera position if it somehow got changed
                        if (vehicle.userData._cameraPosition) {
                            const currentPos = Engine.camera.position;
                            // Only fix if position changed significantly
                            if (currentPos.distanceTo(vehicle.userData._cameraPosition) > 0.1) {
                                Engine.camera.position.copy(vehicle.userData._cameraPosition);
                                console.log("Camera position reset to fixed position");
                            }
                        }
                        
                        // Restore camera rotation if it somehow got changed
                        if (vehicle.userData._cameraRotation) {
                            // Always maintain fixed rotation - this is crucial
                            Engine.camera.rotation.copy(vehicle.userData._cameraRotation);
                        }
                    }
                    
                    // End stabilization period
                    if (inStabilization && 
                        Date.now() - vehicle.userData._stabilizationStarted > vehicle.userData._stabilizationPeriod) {
                        console.log("Car stabilization period complete");
                        vehicle.userData._stabilizationStarted = null;
                        vehicle.userData._cameraStable = true;
                    }
                }
                
                // Update ground detection
                const planet = vehicle.userData.planet;
                if (planet && planet.object) {
                    const planetCenter = planet.object.position;
                    const toVehicle = vehicle.position.clone().sub(planetCenter);
                    const distance = toVehicle.length();
                    const heightOffset = 3; // Car height offset
                    const groundThreshold = planet.radius + heightOffset * 1.2;
                    
                    // Set grounded state based on distance from planet center
                    const wasGrounded = vehicle.userData.grounded;
                    vehicle.userData.grounded = distance <= groundThreshold;
                    
                    // Only log significant state changes (not during initial stabilization)
                    if (wasGrounded !== vehicle.userData.grounded && 
                        !vehicle.userData._stabilizationStarted) {
                        console.log(`Car grounded state changed to: ${vehicle.userData.grounded}`);
                    }
                }
            }
            
            // Store input reference but don't process it here
            // (Movement is handled by the appropriate controller)
            if (!this.input) {
                this.input = {
                    movement: new Vector3(),
                    rotation: new Vector3(),
                    action: false,
                    exit: false
                };
            }
            
            // Ensure input is only applied to current vehicle
            this.currentVehicle.userData.hasInput = true;
        }
    }
    
    static updateVehicles(deltaTime = 1/60) {
        // ENHANCED: Check for and fix invalid vehicle state before updating
        this.validateVehicles();
        
        this.updateCurrentVehicle(deltaTime);
    }
    
    static handleVehicleInput(vehicle, deltaTime) {
        console.warn("VehicleManager.handleVehicleInput is deprecated, movement now handled by controllers");
    }
    
    // Fix any bugs in vehicle manager state
    static resetVehicleState() {
        // Check for issues with currentVehicle
        if (this.currentVehicle) {
            // Verify it's a valid object
            if (!this.currentVehicle.isObject3D || !this.currentVehicle.userData) {
                console.log("Detected invalid current vehicle, resetting");
                this.currentVehicle = null;
            }
            
            // Verify it's in our vehicles array
            if (this.currentVehicle && !this.vehicles.includes(this.currentVehicle)) {
                console.log("Current vehicle not in vehicles array, resetting");
                this.currentVehicle = null;
            }
        }
        
        // Reset state of all vehicles
        for (const vehicle of this.vehicles) {
            if (!vehicle) continue;
            
            // If not the current vehicle, ensure it's immobile
            if (vehicle !== this.currentVehicle) {
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                if ('speed' in vehicle.userData) {
                    vehicle.userData.speed = 0;
                }
                if (vehicle.userData.wheels) {
                    if (vehicle.userData.rotateWheels) {
                        vehicle.userData.rotateWheels(0, 0);
                    }
                }
                vehicle.userData.hasInput = false;
            }
        }
    }
    
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, slerpFactor = 0.2) {
        if (!vehicle) return;
        
        try {
            const up = surfaceNormal;
            
            // CRITICAL FIX: For cars, use a more stable alignment technique
            // and prevent alignment during critical periods
            if (vehicle.userData.type === 'car') {
                // If in stabilization period, use faster/stricter alignment
                const inStabilization = vehicle.userData._stabilizationStarted !== null && 
                                      vehicle.userData._stabilizationStarted !== undefined;
                
                // Use much stronger alignment during stabilization
                const alignFactor = inStabilization ? 1.0 : slerpFactor;
                
                vehicle.up.copy(up);
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                const projectedForward = currentForward.clone().projectOnPlane(up).normalize();
                
                if (projectedForward.lengthSq() < 0.001) {
                    // Better fallback for degenerate cases
                    const worldZ = new Vector3(0, 0, 1);
                    const worldX = new Vector3(1, 0, 0);
                    
                    // Try different reference vectors to find good projection plane
                    let referenceVector = Math.abs(up.dot(worldZ)) > 0.9 ? worldX : worldZ;
                    projectedForward.copy(referenceVector)
                        .sub(up.clone().multiplyScalar(up.dot(referenceVector)))
                        .normalize();
                }
                
                const lookTarget = new Vector3().copy(vehicle.position).add(projectedForward);
                const tempObj = new Object3D();
                tempObj.position.copy(vehicle.position);
                tempObj.up.copy(up);
                tempObj.lookAt(lookTarget);
                
                if (vehicle.userData._stabilizeUntil && Date.now() < vehicle.userData._stabilizeUntil) {
                    // During forced stabilization, immediately jump to correct orientation
                    vehicle.quaternion.copy(tempObj.quaternion);
                    
                    // Keep velocity at zero unless there's significant input
                    if (!vehicle.userData.isOccupied || !this.input || 
                        (Math.abs(this.input.movement.z) < 0.1 && 
                         Math.abs(this.input.movement.x) < 0.1)) {
                        if (vehicle.userData.velocity) {
                            vehicle.userData.velocity.set(0, 0, 0);
                        }
                        vehicle.userData.speed = 0;
                    }
                } else {
                    // Regular alignment with possibly increased factor
                    vehicle.quaternion.slerp(tempObj.quaternion, alignFactor);
                }
                
                return;
            }
            
            const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            const forwardDotUp = forward.dot(up);
            const tangentForward = forward.clone().sub(up.clone().multiplyScalar(forwardDotUp));
            
            if (tangentForward.lengthSq() < 0.001) {
                if (Math.abs(up.x) < 0.9) {
                    tangentForward.set(1, 0, 0).sub(up.clone().multiplyScalar(up.x)).normalize();
                } else {
                    tangentForward.set(0, 0, 1).sub(up.clone().multiplyScalar(up.z)).normalize();
                }
            } else {
                tangentForward.normalize();
            }
            
            const right = new Vector3().crossVectors(up, tangentForward).normalize();
            const correctedForward = new Vector3().crossVectors(right, up).normalize();
            const rotMatrix = new Matrix4().makeBasis(right, up, correctedForward);
            const targetQuat = new Quaternion().setFromRotationMatrix(rotMatrix);
            
            if (isNaN(targetQuat.x) || isNaN(targetQuat.y) || isNaN(targetQuat.z) || isNaN(targetQuat.w)) {
                console.error("Invalid quaternion generated for vehicle alignment");
                return;
            }
            
            const finalSlerpFactor = !vehicle.userData.isOccupied && 
                (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1) ? 
                Math.min(1.0, slerpFactor * 2) : slerpFactor;
            
            vehicle.quaternion.slerp(targetQuat, finalSlerpFactor);
        } catch (e) {
            console.error("Error aligning vehicle to surface:", e);
        }
    }
    
    static snapVehicleToGround(vehicle) {
        if (!vehicle || !vehicle.userData.planet) return;
        
        try {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            const heightOffset = vehicle.userData.type === 'car' ? 3 : 2;
            const targetDistance = planet.radius + heightOffset;
            const snapThreshold = vehicle.userData.isOccupied ? 0.5 : 0.1;
            
            if (vehicle.userData.type === 'car') {
                if (Math.abs(distance - targetDistance) > snapThreshold) {
                    const heightDelta = targetDistance - distance;
                    vehicle.position.addScaledVector(surfaceNormal, heightDelta);
                    console.log(`🚗 Snap: Adjusted car height by ${heightDelta.toFixed(2)}, preserving horizontal pos`);
                }
                
                if (!vehicle.userData.isOccupied && Math.abs(vehicle.userData.speed) < 0.05) {
                    vehicle.userData.velocity.set(0, 0, 0);
                    vehicle.userData.speed = 0;
                } else if (vehicle.userData.isOccupied && vehicle.userData.speed !== 0) {
                    const downVelocity = vehicle.userData.velocity.dot(surfaceNormal);
                    if (Math.abs(downVelocity) > 0.01) {
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, -downVelocity);
                        vehicle.userData.velocity.multiplyScalar(0.8);
                    }
                }
                
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.4);
                return;
            }
            
            if (Math.abs(distance - targetDistance) > snapThreshold) {
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
                
                if (vehicle.userData.velocity) {
                    const downwardVelocity = vehicle.userData.velocity.dot(surfaceNormal);
                    if (Math.abs(downwardVelocity) > 0.01) {
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, -downwardVelocity);
                        vehicle.userData.velocity.multiplyScalar(0.8);
                    }
                }
            }
            
            if (!vehicle.userData.isOccupied && (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1)) {
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.8);
                vehicle.userData.speed = 0;
                if (vehicle.userData.velocity) {
                    if (vehicle.userData.velocity.lengthSq() < 0.0001) {
                        vehicle.userData.velocity.set(0, 0, 0);
                    } else {
                        vehicle.userData.velocity.multiplyScalar(0.2);
                    }
                }
            } else {
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.4);
            }
        } catch (e) {
            console.error("Error snapping vehicle to ground:", e);
        }
    }
    
    // NEW: Helper method to reset wheel rotations without affecting other vehicles
    static resetVehicleWheels(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.wheels) return;
        
        try {
            // Don't change the wheels' rotation completely, just stop applying steering
            if (vehicle.userData.wheels.frontLeft) {
                vehicle.userData.wheels.frontLeft.rotation.y = 0; // Remove steering
            }
            if (vehicle.userData.wheels.frontRight) {
                vehicle.userData.wheels.frontRight.rotation.y = 0; // Remove steering
            }
            
            // Mark wheels as not actively controlled
            vehicle.userData.wheelsActive = false;
        } catch (e) {
            console.error("Error resetting vehicle wheels:", e);
        }
    }
    
    // CRITICAL FIX: Add new validation method to detect and remove ghost vehicles
    static validateVehicles() {
        // CRITICAL FIX: Detect any already occupied vehicles while currentVehicle is null
        if (!this.currentVehicle) {
            for (const vehicle of this.vehicles) {
                if (!vehicle || !vehicle.userData) continue;
                
                if (vehicle.userData.isOccupied || vehicle.userData.hasPlayerInside) {
                    console.warn(`Found incorrectly marked vehicle as occupied: ${vehicle.userData.name} - resetting state`);
                    vehicle.userData.isOccupied = false;
                    vehicle.userData.hasPlayerInside = false;
                    vehicle.userData.player = null;
                }
            }
        }
        
        // CRITICAL FIX: Detect overlapping vehicles in the same location
        const spatialCheck = new Map();
        const duplicatePositions = [];
        
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle || !vehicle.position) return;
            
            // Create a spatial hash key (simplistic grid approach)
            const gridSize = 5;  // Consider vehicles within 5 units as potentially overlapping
            const key = [
                Math.floor(vehicle.position.x / gridSize),
                Math.floor(vehicle.position.y / gridSize),
                Math.floor(vehicle.position.z / gridSize)
            ].join(',');
            
            if (!spatialCheck.has(key)) {
                spatialCheck.set(key, []);
            }
            
            spatialCheck.get(key).push({index, vehicle});
            
            // Check if we have multiple vehicles in same grid cell
            if (spatialCheck.get(key).length > 1) {
                duplicatePositions.push(key);
            }
        });
        
        // Report and handle overlapping vehicles
        if (duplicatePositions.length > 0) {
            console.warn(`Found ${duplicatePositions.length} locations with overlapping vehicles`);
            
            for (const key of duplicatePositions) {
                const vehicles = spatialCheck.get(key);
                console.log(`Cell ${key} has ${vehicles.length} vehicles:`);
                
                // Keep the occupied one if any, otherwise keep the first one
                const keepIndex = vehicles.findIndex(v => 
                    v.vehicle === this.currentVehicle || v.vehicle.userData?.isOccupied
                );
                
                const indexToKeep = keepIndex >= 0 ? keepIndex : 0;
                
                // Remove all except the one to keep
                for (let i = 0; i < vehicles.length; i++) {
                    if (i !== indexToKeep) {
                        const {index, vehicle} = vehicles[i];
                        console.log(`Removing duplicate vehicle at index ${index}: ${vehicle.userData?.name || 'unnamed'}`);
                        
                        // Actually remove from scene and dispose
                        if (vehicle.parent) {
                            vehicle.parent.remove(vehicle);
                        }
                        
                        this.disposeVehicleResources(vehicle);
                    }
                }
            }
        }
        
        // Remove null entries and check for duplicates
        const validVehicles = [];
        const knownIds = new Set();
        
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle) return;
            
            // Check if it's a valid THREE.Object3D and has required properties
            if (!vehicle.isObject3D || !vehicle.userData) {
                console.log(`Removing invalid vehicle at index ${index}`);
                return;
            }
            
            // ENHANCED: Ensure all vehicles have independent user data objects
            if (!vehicle.userData.independentStateInitialized) {
                // Ensure each vehicle has its own velocity vector
                if (!vehicle.userData.velocity) {
                    vehicle.userData.velocity = new Vector3(0, 0, 0);
                }
                
                // Ensure each vehicle has its own unique input object to prevent shared state
                vehicle.userData.input = null;
                
                // Mark as initialized
                vehicle.userData.independentStateInitialized = true;
            }
            
            // Check for duplicates by using uuid
            if (knownIds.has(vehicle.uuid)) {
                console.log(`Detected duplicate vehicle with uuid ${vehicle.uuid}, removing duplicate`);
                return;
            }
            
            // This is a valid unique vehicle
            knownIds.add(vehicle.uuid);
            validVehicles.push(vehicle);
        });
        
        // If we found any invalid vehicles, clean up the array
        if (validVehicles.length !== this.vehicles.length) {
            console.log(`Cleaned up vehicles array: was ${this.vehicles.length}, now ${validVehicles.length}`);
            this.vehicles = validVehicles;
        }
        
        // Fix any bugs in the current vehicle reference
        if (this.currentVehicle) {
            // Verify current vehicle is actually in our vehicles array
            if (!this.vehicles.includes(this.currentVehicle)) {
                console.error("Current vehicle is not in vehicles array - resetting");
                this.currentVehicle = null;
            }
        }
    }
    
    // NEW: Complete method to dispose vehicle resources
    static disposeVehicleResources(vehicle) {
        if (!vehicle) return;
        
        // Dispose geometries and materials
        vehicle.traverse(child => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        material.dispose();
                    });
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Unregister from collision system
        if (vehicle.collidable) {
            ObjectManager.unregisterCollidable(vehicle.collidable);
        }
        
        // Check if this was the current vehicle
        if (vehicle === this.currentVehicle) {
            console.warn("Disposed the current vehicle! Resetting currentVehicle reference");
            this.currentVehicle = null;
        }
        
        // Remove from vehicles array if present
        const index = this.vehicles.indexOf(vehicle);
        if (index > -1) {
            this.vehicles.splice(index, 1);
        }
    }
    
    // Fix ghost images and cleanup properly
    static cleanup() {
        // Remove all vehicles from the scene
        for (const vehicle of this.vehicles) {
            if (vehicle) {
                // Properly dispose of geometries and materials
                vehicle.traverse((child) => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
                
                // Remove from scene
                if (vehicle.parent) {
                    vehicle.parent.remove(vehicle);
                }
                
                // Unregister from collision system
                if (vehicle.collidable) {
                    ObjectManager.unregisterCollidable(vehicle.collidable);
                }
            }
        }
        
        // Clear vehicles array
        this.vehicles = [];
        this.currentVehicle = null;
    }
    
    // Function to remove a specific vehicle
    static removeVehicle(vehicle) {
        if (!vehicle) return;
        
        // Remove from scene
        if (vehicle.parent) {
            vehicle.parent.remove(vehicle);
        }
        
        // Clean up resources
        vehicle.traverse((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Unregister from collision system
        if (vehicle.collidable) {
            ObjectManager.unregisterCollidable(vehicle.collidable);
        }
        
        // Remove from vehicles array
        const index = this.vehicles.indexOf(vehicle);
        if (index > -1) {
            this.vehicles.splice(index, 1);
        }
    }
}