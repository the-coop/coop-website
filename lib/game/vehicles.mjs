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
import ControlManager from './control.mjs'; // Add missing import for ControlManager

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
        // FIXED: Use a consistent height that never changes
        const adjustedHeightOffset = 3; // Always exactly 3 units above planet
        const car = this.createVehicleBase('car', planet, latitude, longitude, adjustedHeightOffset);
        
        // Add a vehicle name
        car.userData.name = `Car-${Math.floor(Math.random() * 1000)}`;
        
        // Create car body - REDUCED SIZE to better match player scale
        const bodyGeometry = new BoxGeometry(3, 1.5, 5); // Smaller from (6, 2, 10)
        const bodyMaterial = new MeshBasicMaterial({ color: 0xFF0000 });
        const body = new Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.0; // Adjusted from 0.05 to 0.0 (slightly lower)
        car.add(body);
        
        // Create wheels collection for animation
        car.userData.wheels = {};
        
        // Further reduced wheel size to be proportionate with smaller car
        const wheelGeometry = new CylinderGeometry(0.6, 0.6, 0.5, 16); // Smaller wheels
        const wheelMaterial = new MeshBasicMaterial({ 
            color: 0x111111, 
            transparent: false,
            wireframe: false
        });
        
        // FIXED: Position wheels for perfect ground contact
        const wheelFL = new Mesh(wheelGeometry, wheelMaterial);
        wheelFL.position.set(-1.5, -1.35, 1.8); // Adjusted from -1.3 to -1.35 (slightly lower)
        wheelFL.rotation.z = Math.PI / 2;
        wheelFL.rotation.y = 0;
        car.add(wheelFL);
        car.userData.wheels.frontLeft = wheelFL;
        
        // Front right wheel
        const wheelFR = new Mesh(wheelGeometry, wheelMaterial);
        wheelFR.position.set(1.5, -1.35, 1.8); // Adjusted from -1.3 to -1.35
        wheelFR.rotation.z = Math.PI / 2;
        wheelFR.rotation.y = 0;
        car.add(wheelFR);
        car.userData.wheels.frontRight = wheelFR;
        
        // Rear left wheel
        const wheelRL = new Mesh(wheelGeometry, wheelMaterial);
        wheelRL.position.set(-1.5, -1.35, -1.8); // Adjusted from -1.3 to -1.35
        wheelRL.rotation.z = Math.PI / 2;
        wheelRL.rotation.y = 0;
        car.add(wheelRL);
        car.userData.wheels.rearLeft = wheelRL;
        
        // Rear right wheel
        const wheelRR = new Mesh(wheelGeometry, wheelMaterial);
        wheelRR.position.set(1.5, -1.35, -1.8); // Adjusted from -1.3 to -1.35
        wheelRR.rotation.z = Math.PI / 2;
        wheelRR.rotation.y = 0;
        car.add(wheelRR);
        car.userData.wheels.rearRight = wheelRR;
        
        // SIMPLIFIED: Simple physics handle that covers the car - adjust for smaller size
        const physicsHandle = new Mesh(
            new BoxGeometry(3, 2, 5), // Smaller physics handle
            new MeshBasicMaterial({ color: 0xFF0000, wireframe: true, visible: false })
        );
        physicsHandle.position.set(0, -0.1, 0); // Adjusted from -0.05 to -0.1 (slightly lower)
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
        
        // Mark the vehicle as a solid object for better collision response with players
        car.userData.isSolid = true;
        car.userData.mass = 1000; // Heavy mass compared to player
        car.userData.friction = 0.95; // High friction when colliding with player
        
        // Set vehicle properties
        car.userData.type = 'car';
        car.userData.isDynamic = true;
        car.userData.speed = 0;
        car.userData.maxSpeed = 40;
        car.userData.acceleration = 0.5;
        car.userData.handling = 0.03;
        car.userData.friction = 0.98; // IMPROVED: Reduced from 0.90 for less aggressive deceleration
        car.userData.isOccupied = false;
        car.userData.maxSpeedReverse = 15;
        
        // Add steering properties to track the gradual wheel rotation
        car.userData.currentWheelAngle = 0;      // Current wheel angle
        car.userData.targetWheelAngle = 0;       // Target wheel angle
        car.userData.wheelTurnSpeed = 0.04;      // How quickly wheels turn (lower = more gradual)
        car.userData.maxWheelAngle = 0.4;        // Maximum wheel turning angle in radians (about 23 degrees)
        
        // FIXED: Store a fixed radius offset that will never change
        car.userData.fixedHeightOffset = 1.92; // Adjusted from 1.95 to 1.92 (slightly lower)
        
        // Add additional stabilization properties
        car.userData.landingDamping = 0.95; // Strong damping when landing
        car.userData.bounceFactor = 0.1;    // Very low bounce factor
        car.userData.heightStableTick = 0;  // Counter to track stable frames
        car.userData.heightStableThreshold = 30; // Frames of stability before considering landed
        
        // Improved wheel rotation with gradual turning animation
        car.userData.rotateWheels = function(targetAngle) {
            // Clamp the target angle to maximum wheel angle
            targetAngle = Math.max(-this.maxWheelAngle, Math.min(this.maxWheelAngle, targetAngle));
            this.targetWheelAngle = targetAngle;
            
            // Gradually move current wheel angle toward target angle
            if (this.currentWheelAngle < this.targetWheelAngle) {
                this.currentWheelAngle = Math.min(
                    this.currentWheelAngle + this.wheelTurnSpeed, 
                    this.targetWheelAngle
                );
            } else if (this.currentWheelAngle > this.targetWheelAngle) {
                this.currentWheelAngle = Math.max(
                    this.currentWheelAngle - this.wheelTurnSpeed, 
                    this.targetWheelAngle
                );
            }
            
            // Apply the current wheel angle to the wheels
            if (this.wheels.frontLeft) {
                this.wheels.frontLeft.rotation.set(0, this.currentWheelAngle, Math.PI/2);
            }
            
            if (this.wheels.frontRight) {
                this.wheels.frontRight.rotation.set(0, this.currentWheelAngle, Math.PI/2);
            }
            
            // Rear wheels stay straight
            if (this.wheels.rearLeft) {
                this.wheels.rearLeft.rotation.set(0, 0, Math.PI/2);
            }
            
            if (this.wheels.rearRight) {
                this.wheels.rearRight.rotation.set(0, 0, Math.PI/2);
            }
        };
        
        console.log(`Created car "${car.userData.name}" on ${planet.name} at ${latitude}°, ${longitude}°`);
        return car;
    }
    
    // Create an airplane on the specified planet at the given coordinates
    static createAirplane(planet, latitude, longitude, heightOffset = 5) {
        const airplane = this.createVehicleBase('airplane', planet, latitude, longitude, heightOffset);
        
        // Add airplane-specific properties and components here
        
        console.log(`Created airplane "${airplane.userData.name}" on ${planet.name} at ${latitude}°, ${longitude}°`);
        return airplane;
    }

    // Add the missing createVehicleBase method
    // Generic method to create a vehicle object
    static createVehicleBase(type, planet, latitude, longitude, heightOffset = 2) {
        // Validate planet input
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
            
            // Check for existing vehicles at this location to prevent duplicates
            for (const existing of this.vehicles) {
                if (!existing || !existing.userData) continue;
                
                const distThreshold = 5; // Consider vehicles within 5 units as duplicates
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
            
            // Create the vehicle object
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
                
                // Position the vehicle on the planet
                try {
                    // FIXED: Use EXACT consistent height for cars
                    const actualHeightOffset = type === 'car' ? 3 : Math.max(3, heightOffset);
                    SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, actualHeightOffset);
                    
                    // Mark vehicle as falling so physics will finish positioning it
                    vehicle.userData.falling = true;
                    vehicle.userData.onSurface = false;
                    
                    // Give it a small initial downward velocity to help it settle
                    vehicle.userData.velocity.set(0, -0.05, 0);
                } catch (posError) {
                    console.error(`Error positioning vehicle on planet: ${posError}`);
                    // Fallback positioning
                    vehicle.position.set(
                        planet.object.position.x, 
                        planet.object.position.y + planet.radius + heightOffset, 
                        planet.object.position.z
                    );
                }
                
                // Set initial orientation to align with planet surface
                const toVehicle = vehicle.position.clone().sub(planet.object.position).normalize();
                vehicle.up.copy(toVehicle);
                
                vehicle.userData.isDynamic = true;
                vehicle.userData.speed = 0;
                
                // Add the vehicle to the scene
                Engine.scene.add(vehicle);
                
                // Check if the vehicle already exists to avoid duplicates
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
    
    // Improved unified camera setup for all vehicle types
    static setupVehicleCamera(vehicle) {
        if (!Engine.camera || !vehicle) return;
        
        console.log(`Setting up camera for ${vehicle.userData.type}`);
        
        try {
            // First completely detach camera from current controller/parent
            if (Engine.camera.parent) {
                Engine.camera.parent.remove(Engine.camera);
            }
            
            // Directly attach to vehicle without intermediate steps
            vehicle.add(Engine.camera);
            
            // Configure camera position based on vehicle type
            if (vehicle.userData.type === 'car') {
                // IMPROVED: Much closer and lower camera with less tilt for more natural driving perspective
                Engine.camera.position.set(0, 2.5, -5); // Lower and closer (was 0, 4, -8)
                Engine.camera.rotation.set(0.1, Math.PI, 0); // Less tilt (was 0.15)
            } 
            else if (vehicle.userData.type === 'airplane') {
                // Airplane gets a higher, pulled-back perspective
                Engine.camera.position.set(0, 12, -20);
                Engine.camera.rotation.set(0.15, Math.PI, 0);
            }
            else {
                // Generic vehicle fallback
                Engine.camera.position.set(0, 10, -18);
                Engine.camera.rotation.set(0.2, Math.PI, 0);
            }
            
            // Store reference values
            vehicle.userData._cameraPosition = Engine.camera.position.clone();
            vehicle.userData._cameraRotation = Engine.camera.rotation.clone();
            vehicle.userData._cameraInitialized = true;
            
            // Force an immediate render to update the view
            if (Engine.renderer) {
                Engine.renderer.render(Engine.scene, Engine.camera);
            }
            
            console.log(`Camera setup complete for ${vehicle.userData.type}`);
        } catch (e) {
            console.error(`Error setting up ${vehicle.userData.type} camera:`, e);
        }
    }

    static updateCurrentVehicle(deltaTime = 1/60) {
        if (this.interactionCooldown > 0) {
            this.interactionCooldown--;
        }
        
        this.validateVehicles();
        
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
                
                vehicle.userData.input.movement.x = this.input.movement.x;
                vehicle.userData.input.movement.y = this.input.movement.y;
                vehicle.userData.input.movement.z = -this.input.movement.z;
                vehicle.userData.input.rotation.copy(this.input.rotation);
                vehicle.userData.input.action = this.input.action;
                vehicle.userData.input.exit = this.input.exit;
                vehicle.userData.hasInput = true;
                
                // Handle vehicle-specific movement based on type
                if (vehicle.userData.type === 'car') {
                    if (Math.abs(vehicle.userData.input.movement.z) > 0.05) {
                        const acceleration = vehicle.userData.acceleration || 0.5;
                        vehicle.userData.speed += vehicle.userData.input.movement.z * acceleration;
                        
                        const maxSpeed = vehicle.userData.input.movement.z > 0 ? 
                            vehicle.userData.maxSpeed : 
                            vehicle.userData.maxSpeedReverse;
                        vehicle.userData.speed = Math.max(
                            -maxSpeed,
                            Math.min(maxSpeed, vehicle.userData.speed)
                        );
                    } else {
                        // IMPROVED: More gradual speed decrease when not accelerating
                        vehicle.userData.speed *= 0.985; // Changed from 0.95 for less aggressive slowdown
                        // Only stop completely at very low speed
                        if (Math.abs(vehicle.userData.speed) < 0.05) { // Reduced from 0.1
                            vehicle.userData.speed = 0;
                        }
                    }
                    
                    // Calculate steering angle with a reduced multiplier for more realistic turning
                    const turnInputAmount = this.input.movement.x;
                    const rawSteeringAngle = turnInputAmount * 0.5; // Reduced from 1.0 to 0.5
                    
                    if (Math.abs(vehicle.userData.speed) > 0.8) {
                        const handling = vehicle.userData.handling || 0.03;
                        const speedFactor = Math.min(1.0, Math.abs(vehicle.userData.speed) / 10); 
                        const turnAmount = this.input.movement.x * handling * speedFactor;
                        const turnDirection = vehicle.userData.speed < 0 ? -1 : 1;
                        
                        vehicle.rotateY(turnAmount * turnDirection);
                    }
                    
                    // Apply wheel rotation with the gradually changing angle
                    if (vehicle.userData.wheels && vehicle.userData.rotateWheels) {
                        vehicle.userData.rotateWheels(rawSteeringAngle);
                    }
                }
                else if (vehicle.userData.type === 'airplane') {
                    // Apply airplane controls here
                    // (Similar logic to car but for 3D movement)
                }
            }
            
            // Vehicle-specific height stabilization
            if (vehicle.userData.type === 'car' && vehicle.userData.planet) {
                const planetCenter = vehicle.userData.planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter);
                const currentDistance = toVehicle.length();
                const surfaceNormal = toVehicle.normalize();
                
                // FIXED: Use adjusted height offset value
                const targetHeight = vehicle.userData.planet.radius + 
                    (vehicle.userData.fixedHeightOffset || 1.92); // Updated from 1.95 to 1.92
                
                // FIXED: Use a much more aggressive height correction and completely zero vertical velocity
                if (Math.abs(currentDistance - targetHeight) > 0.001) {
                    // Direct position correction
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
                    
                    // Completely zero any vertical velocity component
                    if (vehicle.userData.velocity) {
                        const verticalComponent = surfaceNormal.clone().multiplyScalar(
                            vehicle.userData.velocity.dot(surfaceNormal)
                        );
                        vehicle.userData.velocity.sub(verticalComponent);
                    }
                } else {
                    // We're at the correct height - increment stability counter
                    vehicle.userData.heightStableTick = (vehicle.userData.heightStableTick || 0) + 1;
                    
                    // After enough stable frames, zero vertical velocity to ensure stability
                    if (vehicle.userData.heightStableTick > 5 && vehicle.userData.velocity) {
                        // Just zero the vertical component once stable
                        const verticalComponent = surfaceNormal.clone().multiplyScalar(
                            vehicle.userData.velocity.dot(surfaceNormal)
                        );
                        if (Math.abs(verticalComponent.length()) > 0.01) {
                            vehicle.userData.velocity.sub(verticalComponent);
                        }
                    }
                }
            }
            else if (vehicle.userData.type === 'airplane' && vehicle.userData.planet) {
                // Airplane should have no height restriction
                // But we should still update the orientation based on the planet's gravity
                const planetCenter = vehicle.userData.planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                
                // Apply a very gentle orientation correction to keep airplane oriented to planet
                vehicle.up.lerp(surfaceNormal, 0.01);
            }
        }
    }

    static resetVehicleWheels(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.wheels) return;
        
        try {
            // Reset wheel animation state
            if (vehicle.userData.rotateWheels) {
                // Set target angle to 0 to start gradual return to center
                vehicle.userData.targetWheelAngle = 0;
                vehicle.userData.rotateWheels(0);
            } else {
                // Direct reset if rotateWheels is not available
                if (vehicle.userData.wheels.frontLeft) {
                    vehicle.userData.wheels.frontLeft.rotation.set(0, 0, Math.PI/2);
                }
                if (vehicle.userData.wheels.frontRight) {
                    vehicle.userData.wheels.frontRight.rotation.set(0, 0, Math.PI/2);
                }
                if (vehicle.userData.wheels.rearLeft) {
                    vehicle.userData.wheels.rearLeft.rotation.set(0, 0, Math.PI/2);
                }
                if (vehicle.userData.wheels.rearRight) {
                    vehicle.userData.wheels.rearRight.rotation.set(0, 0, Math.PI/2);
                }
            }
        } catch (e) {
            console.error("Error resetting vehicle wheels:", e);
        }
    }
    
    // Add missing validateVehicles method
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
    
    // Add missing alignVehicleToPlanetSurface method
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, slerpFactor = 0.2) {
        if (!vehicle) return;
        
        try {
            // Set vehicle's up vector to match surface normal
            const up = surfaceNormal;
            
            // Gradually align vehicle's up direction with the surface normal
            vehicle.up.copy(up);
            
            // For cars, we need to properly orient them on the curved surface
            if (vehicle.userData.type === 'car') {
                // Get current forward direction 
                const currentForward = new Vector3(0, 0, 1).applyQuaternion(vehicle.quaternion);
                
                // Project forward direction onto the tangent plane of the surface
                const projectedForward = currentForward.clone().projectOnPlane(up).normalize();
                
                // Only proceed if projection gives a meaningful direction vector
                if (projectedForward.lengthSq() > 0.001) {
                    // Create a look target in the projected forward direction
                    const lookTarget = new Vector3().copy(vehicle.position).add(projectedForward);
                    
                    // Create a temporary object to calculate the desired orientation
                    const tempObj = new Object3D();
                    tempObj.position.copy(vehicle.position);
                    tempObj.up.copy(up);
                    tempObj.lookAt(lookTarget);
                    
                    // Apply orientation immediately or gradually based on whether the vehicle is occupied
                    if (!vehicle.userData.isOccupied) {
                        // For unoccupied vehicles, set orientation immediately
                        vehicle.quaternion.copy(tempObj.quaternion);
                    } else {
                        // For occupied vehicles, use slerp for smooth orientation change
                        vehicle.quaternion.slerp(tempObj.quaternion, slerpFactor);
                    }
                }
                
                // ADDED: Additional logic to ensure car maintains proper height
                if (vehicle.userData.type === 'car' && vehicle.userData.planet) {
                    const planetCenter = vehicle.userData.planet.object.position;
                    const toVehicle = vehicle.position.clone().sub(planetCenter);
                    const distance = toVehicle.length();
                    
                    // Ensure consistent height with adjusted value
                    const targetHeight = vehicle.userData.planet.radius + 1.92; // Changed from 1.95 to 1.92
                    if (Math.abs(distance - targetHeight) > 0.1) {
                        vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
                    }
                }
            }
        } catch (e) {
            console.error("Error aligning vehicle to surface:", e);
        }
    }
    
    // Also add missing disposeVehicleResources method
    static disposeVehicleResources(vehicle) {
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
    
    // Add missing tryEnterNearbyVehicle method
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
        let closestDistance = 15; // Maximum distance to interact with vehicles
        
        console.log(`Looking for vehicles near player position ${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}`);
        console.log(`Total vehicles available: ${this.vehicles.length}`);
        
        // Check for orphaned "occupied" vehicles
        const occupiedVehicleIds = [];
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle || !vehicle.userData) return;
            
            if (vehicle.userData.isOccupied) {
                console.warn(`Found already occupied vehicle: ${vehicle.userData.name} (${vehicle.userData.vehicleId})`);
                occupiedVehicleIds.push(vehicle.userData.vehicleId);
            }
        });
        
        // Fix any orphaned vehicles
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
        
        // Find closest available vehicle
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
    
    // Add missing enterVehicle method if not already present
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
        
        // Make sure no other vehicle is marked as occupied
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
        
        // FIXED: Set up camera IMMEDIATELY during vehicle entry for ANY vehicle type
        // Unified camera setup regardless of vehicle type
        this.setupVehicleCamera(vehicle);
        
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
    
    // Add missing exitVehicle method if not already present
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
            
            // FIXED: Place player to the left side of car instead of far in front
            const exitOffset = exitedVehicle.userData.type === 'airplane' ?
                new Vector3(50, 20, 0) :
                new Vector3(-8, 5, 5); // Changed from (0, 10, 30) to (-8, 5, 5) - left side of car
            
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
                
                // IMPROVED: Completely rewritten camera transition when exiting vehicle
                if (Engine.camera && Engine.camera.parent) {
                    // Get current camera world state
                    const worldPos = new Vector3();
                    Engine.camera.getWorldPosition(worldPos);
                    const worldDir = new Vector3(0, 0, -1);
                    worldDir.applyQuaternion(Engine.camera.getWorldQuaternion(new Quaternion()));
                    
                    // Detach from vehicle
                    Engine.camera.parent.remove(Engine.camera);
                    
                    // Add to scene temporarily
                    Engine.scene.add(Engine.camera);
                    Engine.camera.position.copy(worldPos);
                    
                    // Make camera look in the same direction but with correct up vector
                    Engine.camera.up.copy(PlayersManager.self.surfaceNormal || new Vector3(0, 1, 0));
                    Engine.camera.lookAt(worldPos.clone().add(worldDir));
                    
                    // Reset the FPS controller to take control of the camera
                    if (ControlManager.controller && ControlManager.controller.reset) {
                        ControlManager.controller.reset();
                    }
                }
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
}