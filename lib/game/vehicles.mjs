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
                    
                    const checkPosition = SceneManager.calculatePositionOnPlanet(planet, latitude, longitude, heightOffset);
                    const distSq = existing.position.distanceToSquared(checkPosition);
                    
                    if (distSq < distThreshold * distThreshold) {
                        console.warn(`Prevented creating duplicate ${type} near existing vehicle at ${latitude}°, ${longitude}°`);
                        return existing; // Return the existing vehicle instead of creating a new one
                    }
                }
            }
            
            let vehicle = null;
            try {
                vehicle = new Object3D();
                
                // Initialize userData
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
                
                vehicle.name = vehicle.userData.vehicleId;
                
                // SIMPLIFIED: Position the vehicle directly on the planet surface with minimal height
                try {
                    // Use slightly reduced height offset for more stable initial placement
                    const actualHeightOffset = Math.max(3, heightOffset);
                    SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, actualHeightOffset);
                    
                    // Mark vehicle as falling so physics will finish positioning it
                    vehicle.userData.falling = true;
                    vehicle.userData.onSurface = false;
                    
                    // Give it a small initial downward velocity to help it settle
                    vehicle.userData.velocity.set(0, -0.05, 0);
                } catch (posError) {
                    console.error(`Error positioning vehicle on planet: ${posError}`);
                    // Fallback positioning
                    vehicle.position.set(planet.object.position.x, 
                                        planet.object.position.y + planet.radius + heightOffset, 
                                        planet.object.position.z);
                }
                
                // Set initial orientation to align with planet surface
                const toVehicle = vehicle.position.clone().sub(planet.object.position).normalize();
                vehicle.up.copy(toVehicle);
                
                vehicle.userData.isDynamic = true;
                vehicle.userData.speed = 0;
                
                Engine.scene.add(vehicle);
                
                // Validate vehicle before adding to array
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
        
        if (this.currentVehicle) {
            console.log('Already in a vehicle, exiting first');
            this.exitVehicle();
        }
        
        this.validateVehicles();
        
        const playerPosition = PlayersManager.self.position.clone();
        let closestVehicle = null;
        let closestDistance = 15;
        
        console.log(`Looking for vehicles near player position ${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}`);
        console.log(`Total vehicles available: ${this.vehicles.length}`);
        
        const occupiedVehicleIds = [];
        
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle || !vehicle.userData) return;
            
            if (vehicle.userData.isOccupied) {
                console.warn(`Found already occupied vehicle: ${vehicle.userData.name} (${vehicle.userData.vehicleId})`);
                occupiedVehicleIds.push(vehicle.userData.vehicleId);
            }
        });
        
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
        if (this.currentVehicle) {
            console.log('Already in a vehicle, exiting first');
            this.exitVehicle();
            
            this.interactionCooldown = 15;
            return false;
        }
        
        if (!vehicle) {
            console.log('No valid vehicle to enter');
            return false;
        }
        
        if (!this.vehicles.includes(vehicle)) {
            console.warn(`Attempted to enter vehicle not in vehicles array: ${vehicle.userData?.name || 'unnamed'}`);
            return false;
        }
        
        if (vehicle.userData.isOccupied) {
            console.log('Vehicle is already occupied');
            return false;
        }
        
        console.log(`Entering ${vehicle.userData.type} "${vehicle.userData.name}" (${vehicle.userData.vehicleId})`);
        
        for (const otherVehicle of this.vehicles) {
            if (!otherVehicle || otherVehicle === vehicle) continue;
            
            if (otherVehicle.userData) {
                otherVehicle.userData.isOccupied = false;
                otherVehicle.userData.hasPlayerInside = false;
                otherVehicle.userData.player = null;
            }
        }
        
        this.currentVehicle = vehicle;
        vehicle.userData.isOccupied = true;
        vehicle.userData.hasPlayerInside = true;
        vehicle.userData.player = PlayersManager.self;
        
        this.playerOriginalPosition = PlayersManager.self.position.clone();
        
        if (vehicle.userData.type === 'car') {
            vehicle.userData._stabilizationStarted = Date.now();
            vehicle.userData._stabilizationPeriod = 1500;
            vehicle.userData._stabilizeUntil = Date.now() + 1500;
            vehicle.userData._cameraInitialized = false;
            vehicle.userData._cameraStable = false;
            vehicle.userData._lockCamera = true;
            
            if (Engine.camera) {
                vehicle.userData._pendingCameraAttach = true;
                
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
    
    static updateCurrentVehicle(deltaTime = 1/60) {
        if (this.interactionCooldown > 0) {
            this.interactionCooldown--;
        }
        
        this.validateVehicles();
        
        for (const vehicle of this.vehicles) {
            if (!vehicle) continue;
            
            if (vehicle !== this.currentVehicle) {
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                if ('speed' in vehicle.userData) {
                    vehicle.userData.speed = 0;
                }
                
                vehicle.userData.input = null;
                vehicle.userData.hasInput = false;
                
                if (vehicle.userData.wheels) {
                    if ('wheelSteerAngle' in vehicle.userData) {
                        vehicle.userData.wheelSteerAngle = 0;
                    }
                    if ('wheelRollAngle' in vehicle.userData) {
                        vehicle.userData.wheelRotationSpeed = 0;
                    }
                    
                    this.resetVehicleWheels(vehicle);
                }
            }
        }
        
        if (this.currentVehicle && this.currentVehicle.userData.isOccupied) {
            const vehicle = this.currentVehicle;
            
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
                
                if (vehicle.userData.type === 'car') {
                    if (Math.abs(this.input.movement.z) > 0.05) {
                        const acceleration = vehicle.userData.acceleration || 0.5;
                        vehicle.userData.speed += this.input.movement.z * acceleration;
                        
                        const maxSpeed = this.input.movement.z > 0 ? 
                            vehicle.userData.maxSpeed : 
                            vehicle.userData.maxSpeedReverse;
                            
                        vehicle.userData.speed = Math.max(
                            -maxSpeed,
                            Math.min(maxSpeed, vehicle.userData.speed)
                        );
                    } else {
                        vehicle.userData.speed *= 0.95;
                        if (Math.abs(vehicle.userData.speed) < 0.1) {
                            vehicle.userData.speed = 0;
                        }
                    }
                    
                    if (Math.abs(vehicle.userData.speed) > 0.1) {
                        const forward = new Vector3(0, 0, 1).applyQuaternion(vehicle.quaternion);
                        
                        vehicle.position.addScaledVector(forward, vehicle.userData.speed * deltaTime);
                        
                        if (vehicle.userData.velocity) {
                            vehicle.userData.velocity.copy(forward).multiplyScalar(vehicle.userData.speed);
                        }
                        
                        if (Math.random() < 0.01) {
                            console.log(`Car moving: speed=${vehicle.userData.speed.toFixed(2)}, pos=${vehicle.position.toArray().map(v => v.toFixed(1))}`);
                        }
                    }
                    
                    if (Math.abs(this.input.movement.x) > 0.05 && Math.abs(vehicle.userData.speed) > 0.5) {
                        const handling = vehicle.userData.handling || 0.03;
                        const turnAmount = this.input.movement.x * handling;
                        
                        const turnDirection = vehicle.userData.speed < 0 ? -1 : 1;
                        vehicle.rotateY(-turnAmount * turnDirection);
                    }
                }
            }
            
            if (vehicle.userData.type === 'car' && vehicle.userData.wheels) {
                const wheelRadius = 1.5;
                const wheelCircumference = 2 * Math.PI * wheelRadius;
                const distanceTraveled = vehicle.userData.speed * deltaTime;
                const rotationAngle = (distanceTraveled / wheelCircumference) * 2 * Math.PI;
                
                const currentRotation = vehicle.userData.wheelRotation || 0;
                const newRotation = currentRotation + rotationAngle;
                vehicle.userData.wheelRotation = newRotation;
                
                let steeringAngle = 0;
                if (vehicle.userData.input && vehicle.userData.input.movement) {
                    steeringAngle = vehicle.userData.input.movement.x * 0.52;
                }
                
                if (vehicle.userData.rotateWheels) {
                    vehicle.userData.rotateWheels(newRotation, steeringAngle);
                }
            }
            
            if (vehicle.userData.type === 'car') {
                if (Engine.camera && vehicle.userData._lockCamera) {
                    const inStabilization = vehicle.userData._stabilizationStarted !== null && 
                                         vehicle.userData._stabilizationStarted !== undefined;
                    
                    if (!vehicle.userData._cameraInitialized && 
                        (!inStabilization || 
                        Date.now() - vehicle.userData._stabilizationStarted > 300)) {
                        
                        if (Engine.camera.parent && Engine.camera.parent !== vehicle) {
                            const worldPos = new Vector3();
                            Engine.camera.getWorldPosition(worldPos);
                            Engine.camera.parent.remove(Engine.camera);
                            Engine.scene.add(Engine.camera);
                            Engine.camera.position.copy(worldPos);
                        }
                        
                        Engine.scene.remove(Engine.camera);
                        vehicle.add(Engine.camera);
                        
                        Engine.camera.position.set(0, 7, -15);
                        Engine.camera.rotation.set(0.2, Math.PI, 0);
                        
                        vehicle.userData._cameraRotation = Engine.camera.rotation.clone();
                        vehicle.userData._cameraPosition = Engine.camera.position.clone();
                        vehicle.userData._cameraInitialized = true;
                        vehicle.userData._pendingCameraAttach = false;
                        
                        console.log("Camera rigidly attached to car with fixed position");
                    }
                    
                    if (vehicle.userData._cameraInitialized && Engine.camera.parent === vehicle) {
                        if (vehicle.userData._cameraPosition) {
                            const currentPos = Engine.camera.position;
                            if (currentPos.distanceTo(vehicle.userData._cameraPosition) > 0.5) {
                                Engine.camera.position.copy(vehicle.userData._cameraPosition);
                                console.log("Camera position reset to fixed position - significant drift");
                            }
                        }
                        
                        if (vehicle.userData._cameraRotation) {
                            const currentEuler = Engine.camera.rotation;
                            const savedEuler = vehicle.userData._cameraRotation;
                            const rotationDiff = 
                                Math.abs(currentEuler.x - savedEuler.x) +
                                Math.abs(currentEuler.y - savedEuler.y) +
                                Math.abs(currentEuler.z - savedEuler.z);
                                
                            if (rotationDiff > 0.05) {
                                Engine.camera.rotation.copy(vehicle.userData._cameraRotation);
                            }
                        }
                    }
                    
                    if (inStabilization && 
                        Date.now() - vehicle.userData._stabilizationStarted > vehicle.userData._stabilizationPeriod) {
                        console.log("Car stabilization period complete");
                        vehicle.userData._stabilizationStarted = null;
                        vehicle.userData._cameraStable = true;
                    }
                }
                
                const planet = vehicle.userData.planet;
                if (planet && planet.object) {
                    const planetCenter = planet.object.position;
                    const toVehicle = vehicle.position.clone().sub(planetCenter);
                    const distance = toVehicle.length();
                    const heightOffset = 3;
                    const groundThreshold = planet.radius + heightOffset * 1.2;
                    
                    const wasGrounded = vehicle.userData.grounded;
                    vehicle.userData.grounded = distance <= groundThreshold;
                    
                    if (wasGrounded !== vehicle.userData.grounded && 
                        !vehicle.userData._stabilizationStarted) {
                        console.log(`Car grounded state changed to: ${vehicle.userData.grounded}`);
                    }
                }
            }
            
            if (!this.input) {
                this.input = {
                    movement: new Vector3(),
                    rotation: new Vector3(),
                    action: false,
                    exit: false
                };
            }
            
            this.currentVehicle.userData.hasInput = true;
        }
    }
    
    static updateVehicles(deltaTime = 1/60) {
        this.validateVehicles();
        
        this.updateCurrentVehicle(deltaTime);
    }
    
    static handleVehicleInput(vehicle, deltaTime) {
        console.warn("VehicleManager.handleVehicleInput is deprecated, movement now handled by controllers");
    }
    
    static resetVehicleState() {
        if (this.currentVehicle) {
            if (!this.currentVehicle.isObject3D || !this.currentVehicle.userData) {
                console.log("Detected invalid current vehicle, resetting");
                this.currentVehicle = null;
            }
            
            if (this.currentVehicle && !this.vehicles.includes(this.currentVehicle)) {
                console.log("Current vehicle not in vehicles array, resetting");
                this.currentVehicle = null;
            }
        }
        
        for (const vehicle of this.vehicles) {
            if (!vehicle) continue;
            
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
    
    // Simplify alignment method - only used for occupied vehicles
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, slerpFactor = 0.2) {
        if (!vehicle) return;
        
        try {
            const up = surfaceNormal;
            
            // Always make vehicle up vector match surface normal
            vehicle.up.copy(up);
            
            if (vehicle.userData.type === 'car') {
                const currentForward = new Vector3(0, 0, 1).applyQuaternion(vehicle.quaternion);
                const projectedForward = currentForward.clone().projectOnPlane(up).normalize();
                
                if (projectedForward.lengthSq() > 0.001) {
                    const lookTarget = new Vector3().copy(vehicle.position).add(projectedForward);
                    const tempObj = new Object3D();
                    tempObj.position.copy(vehicle.position);
                    tempObj.up.copy(up);
                    tempObj.lookAt(lookTarget);
                    
                    // Use immediate alignment for unoccupied vehicles to prevent wobbling
                    if (!vehicle.userData.isOccupied) {
                        vehicle.quaternion.copy(tempObj.quaternion);
                    } else {
                        // Smooth alignment for player-controlled vehicles
                        vehicle.quaternion.slerp(tempObj.quaternion, slerpFactor);
                    }
                }
            }
        } catch (e) {
            console.error("Error aligning vehicle to surface:", e);
        }
    }
    
    // Simplify snap to ground method
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
            
            // For all vehicles, ensure they're exactly at the right height
            if (Math.abs(distance - targetDistance) > 0.1) {
                // Instantly move to correct height to prevent wobbling
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
                
                // If this is an unoccupied car on the ground, zero its velocity too
                if (!vehicle.userData.isOccupied && !vehicle.userData.falling && vehicle.userData.type === 'car') {
                    if (vehicle.userData.velocity) {
                        vehicle.userData.velocity.set(0, 0, 0);
                    }
                    vehicle.userData.speed = 0;
                }
            }
        } catch (e) {
            console.error("Error snapping vehicle to ground:", e);
        }
    }
    
    static resetVehicleWheels(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.wheels) return;
        
        try {
            if (vehicle.userData.wheels.frontLeft) {
                vehicle.userData.wheels.frontLeft.rotation.y = 0;
            }
            if (vehicle.userData.wheels.frontRight) {
                vehicle.userData.wheels.frontRight.rotation.y = 0;
            }
            
            vehicle.userData.wheelsActive = false;
        } catch (e) {
            console.error("Error resetting vehicle wheels:", e);
        }
    }
    
    static validateVehicles() {
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
        
        const spatialCheck = new Map();
        const duplicatePositions = [];
        
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle || !vehicle.position) return;
            
            const gridSize = 5;
            const key = [
                Math.floor(vehicle.position.x / gridSize),
                Math.floor(vehicle.position.y / gridSize),
                Math.floor(vehicle.position.z / gridSize)
            ].join(',');
            
            if (!spatialCheck.has(key)) {
                spatialCheck.set(key, []);
            }
            
            spatialCheck.get(key).push({index, vehicle});
            
            if (spatialCheck.get(key).length > 1) {
                duplicatePositions.push(key);
            }
        });
        
        if (duplicatePositions.length > 0) {
            console.warn(`Found ${duplicatePositions.length} locations with overlapping vehicles`);
            
            for (const key of duplicatePositions) {
                const vehicles = spatialCheck.get(key);
                console.log(`Cell ${key} has ${vehicles.length} vehicles:`);
                
                const keepIndex = vehicles.findIndex(v => 
                    v.vehicle === this.currentVehicle || v.vehicle.userData?.isOccupied
                );
                
                const indexToKeep = keepIndex >= 0 ? keepIndex : 0;
                
                for (let i = 0; i < vehicles.length; i++) {
                    if (i !== indexToKeep) {
                        const {index, vehicle} = vehicles[i];
                        console.log(`Removing duplicate vehicle at index ${index}: ${vehicle.userData?.name || 'unnamed'}`);
                        
                        if (vehicle.parent) {
                            vehicle.parent.remove(vehicle);
                        }
                        
                        this.disposeVehicleResources(vehicle);
                    }
                }
            }
        }
        
        const validVehicles = [];
        const knownIds = new Set();
        
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle) return;
            
            if (!vehicle.isObject3D || !vehicle.userData) {
                console.log(`Removing invalid vehicle at index ${index}`);
                return;
            }
            
            if (!vehicle.userData.independentStateInitialized) {
                if (!vehicle.userData.velocity) {
                    vehicle.userData.velocity = new Vector3(0, 0, 0);
                }
                
                vehicle.userData.input = null;
                
                vehicle.userData.independentStateInitialized = true;
            }
            
            if (knownIds.has(vehicle.uuid)) {
                console.log(`Detected duplicate vehicle with uuid ${vehicle.uuid}, removing duplicate`);
                return;
            }
            
            knownIds.add(vehicle.uuid);
            validVehicles.push(vehicle);
        });
        
        if (validVehicles.length !== this.vehicles.length) {
            console.log(`Cleaned up vehicles array: was ${this.vehicles.length}, now ${validVehicles.length}`);
            this.vehicles = validVehicles;
        }
        
        if (this.currentVehicle) {
            if (!this.vehicles.includes(this.currentVehicle)) {
                console.error("Current vehicle is not in vehicles array - resetting");
                this.currentVehicle = null;
            }
        }
    }
    
    static disposeVehicle(vehicle) {
        if (!vehicle) return;
        
        try {
            if (vehicle.parent) {
                vehicle.parent.remove(vehicle);
            }
            
            if (vehicle.collidable) {
                ObjectManager.unregisterCollidable(vehicle);
            }
            
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
            
            if (vehicle.userData) {
                vehicle.userData.planet = null;
                vehicle.userData.player = null;
                vehicle.userData.physicsHandle = null;
            }
            
            if (this.currentVehicle === vehicle) {
                this.currentVehicle = null;
            }
        } catch (e) {
            console.error("Error disposing vehicle:", e);
        }
    }
    
    static disposeVehicleResources(vehicle) {
        return this.disposeVehicle(vehicle);
    }
    
    static removeVehicle(vehicle) {
        if (!vehicle) return;
        
        if (vehicle.parent) {
            vehicle.parent.remove(vehicle);
        }
        
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
        
        if (vehicle.collidable) {
            ObjectManager.unregisterCollidable(vehicle.collidable);
        }
        
        const index = this.vehicles.indexOf(vehicle);
        if (index > -1) {
            this.vehicles.splice(index, 1);
        }
    }
}