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
import Physics from './physics.mjs'; // Add Physics import

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
        
        // Create wheels
        const wheelGeometry = new CylinderGeometry(1.5, 1.5, 1, 16);
        const wheelMaterial = new MeshBasicMaterial({ color: 0x333333 });
        
        // Front left wheel
        const wheelFL = new Mesh(wheelGeometry, wheelMaterial);
        wheelFL.position.set(-3, 0.5, 3);
        wheelFL.rotation.z = Math.PI / 2;
        car.add(wheelFL);
        
        // Front right wheel
        const wheelFR = new Mesh(wheelGeometry, wheelMaterial);
        wheelFR.position.set(3, 0.5, 3);
        wheelFR.rotation.z = Math.PI / 2;
        car.add(wheelFR);
        
        // Rear left wheel
        const wheelRL = new Mesh(wheelGeometry, wheelMaterial);
        wheelRL.position.set(-3, 0.5, -3);
        wheelRL.rotation.z = Math.PI / 2;
        car.add(wheelRL);
        
        // Rear right wheel
        const wheelRR = new Mesh(wheelGeometry, wheelMaterial);
        wheelRR.position.set(3, 0.5, -3);
        wheelRR.rotation.z = Math.PI / 2;
        car.add(wheelRR);
        
        // Create physics handle for collision detection
        const physicsHandle = new Mesh(
            new BoxGeometry(6, 4, 10),
            new MeshBasicMaterial({ color: 0xFF0000, wireframe: true, visible: false })
        );
        physicsHandle.position.set(0, 2, 0); // Position at center of car
        car.add(physicsHandle);
        car.userData.physicsHandle = physicsHandle;
        
        // Add bounding box helper for debugging
        const boundingBox = new Box3().setFromObject(physicsHandle);
        const boxHelper = new Box3Helper(boundingBox, 0xFF0000);
        boxHelper.visible = false; // Hide by default, enable for debugging
        car.add(boxHelper);
        car.userData.boundingBox = boundingBox;
        car.userData.boxHelper = boxHelper;
        
        // Register car as a DYNAMIC collidable object (not static)
        car.collidable = ObjectManager.registerCollidable(car, boundingBox, 'vehicle', false);
        
        // Set vehicle properties
        car.userData.speed = 0;
        car.userData.maxSpeed = 40;
        car.userData.acceleration = 0.5;
        car.userData.handling = 0.03;
        car.userData.friction = 0.98;
        car.userData.isOccupied = false;
        
        console.log(`Created car "${car.userData.name}" on ${planet.name} at ${latitude}°, ${longitude}°`);
        return car;
    }
    
    // Create an airplane on the specified planet at the given coordinates
    static createAirplane(planet, latitude, longitude, heightOffset = 5) {
        const airplane = this.createVehicleBase('airplane', planet, latitude, longitude, heightOffset);
        
        // Add a vehicle name
        airplane.userData.name = `Airplane-${Math.floor(Math.random() * 1000)}`;
        
        // Create airplane body (fuselage)
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
        physicsHandle.position.set(0, 1, 0); // Position at center of airplane
        airplane.add(physicsHandle);
        airplane.userData.physicsHandle = physicsHandle;
        
        // Add bounding box helper for debugging
        const boundingBox = new Box3().setFromObject(physicsHandle);
        const boxHelper = new Box3Helper(boundingBox, 0x4444FF);
        boxHelper.visible = false; // Hide by default, enable for debugging
        airplane.add(boxHelper);
        airplane.userData.boundingBox = boundingBox;
        airplane.userData.boxHelper = boxHelper;
        
        // Register airplane as a DYNAMIC collidable object (not static)
        airplane.collidable = ObjectManager.registerCollidable(airplane, boundingBox, 'vehicle', false);
        
        // Set vehicle properties
        airplane.userData.speed = 0;
        airplane.userData.maxSpeed = 80;
        airplane.userData.acceleration = 0.3;
        airplane.userData.handling = 0.02;
        airplane.userData.liftFactor = 0.5;
        airplane.userData.altitude = 0;
        airplane.userData.maxAltitude = 500;
        airplane.userData.isOccupied = false;
        
        console.log(`Created airplane "${airplane.userData.name}" on ${planet.name} at ${latitude}°, ${longitude}°`);
        return airplane;
    }

    // Generic method to create a vehicle object
    static createVehicleBase(type, planet, latitude, longitude, heightOffset = 2) {
        // Create a container object for the vehicle
        const vehicle = new Object3D();
        vehicle.userData.type = type;
        vehicle.userData.planet = planet;
        vehicle.userData.isVehicle = true;
        vehicle.userData.isOccupied = false;
        vehicle.userData.name = `Vehicle-${Math.floor(Math.random() * 1000)}`;
        
        // Position the vehicle on the planet surface at specified height
        SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, heightOffset);
        
        // Add more dramatic falling velocity for higher spawns
        vehicle.userData.velocity = new Vector3(0, -0.5, 0);  // Increased from -0.05 to -0.5
        
        // Add to scene
        Engine.scene.add(vehicle);
        
        // Add to vehicles array
        this.vehicles.push(vehicle);
        
        return vehicle;
    }
    
    // Old method kept for compatibility
    static createPlanetVehicles() {
        console.warn('createPlanetVehicles is deprecated, use createCar and createAirplane instead');
    }
    
    // Setup event listeners for entering/exiting vehicles
    static setupVehicleInteractions() {
        // Remove the duplicate event listener that was causing the need to press E twice
        // The ControlManager.update() already handles E key presses
        console.log('Vehicle interactions initialized (keys handled by ControlManager)');
        
        // Expose vehicle interaction methods for debugging
        if (typeof window !== 'undefined') {
            window.enterVehicle = this.enterVehicle.bind(this);
            window.exitVehicle = this.exitVehicle.bind(this);
        }
    }
    
    // Try to enter a nearby vehicle
    static tryEnterNearbyVehicle() {
        // Check for cooldown to prevent immediate re-entry after exiting
        if (this.interactionCooldown > 0) {
            console.log(`Vehicle interaction on cooldown: ${this.interactionCooldown}`);
            return false;
        }
        
        // Check if player exists and has a handle
        if (!PlayersManager.self || !PlayersManager.self.handle) {
            console.log('No player available for vehicle entry check');
            return false;
        }
        
        // Always use the player's actual position for vehicle proximity check
        const playerPosition = PlayersManager.self.position.clone();
        let closestVehicle = null;
        let closestDistance = 15; // Maximum distance to enter a vehicle
        
        console.log(`Looking for vehicles near player position ${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}`);
        console.log(`Total vehicles available: ${this.vehicles.length}`);
        
        // Log all vehicles and their positions for debugging
        this.vehicles.forEach((vehicle, index) => {
            if (!vehicle) return;
            console.log(`Vehicle ${index} (${vehicle.userData.type}): position ${vehicle.position.x.toFixed(2)}, ${vehicle.position.y.toFixed(2)}, ${vehicle.position.z.toFixed(2)}, occupied: ${vehicle.userData.isOccupied}`);
        });
        
        // Find the closest vehicle that's not occupied
        for (const vehicle of this.vehicles) {
            if (!vehicle || vehicle.userData.isOccupied) continue;
            
            const distance = playerPosition.distanceTo(vehicle.position);
            console.log(`Distance to ${vehicle.userData.type}: ${distance.toFixed(2)}`);
            
            if (distance < closestDistance) {
                closestDistance = distance;
                closestVehicle = vehicle;
            }
        }
        
        // Enter the closest vehicle if found
        if (closestVehicle) {
            console.log(`Entering ${closestVehicle.userData.type} "${closestVehicle.userData.name}" at distance ${closestDistance.toFixed(2)}`);
            
            // Set interaction cooldown when entering vehicle
            this.interactionCooldown = 30; // 30 frames (about 0.5 seconds)
            
            return this.enterVehicle(closestVehicle);
        } else {
            console.log('No vehicle found within range');
            return false;
        }
    }

    // Enter a specific vehicle
    static enterVehicle(vehicle) {
        if (this.currentVehicle) {
            console.log('Already in a vehicle, cannot enter another');
            return false;
        }
        
        if (!vehicle) {
            console.log('No valid vehicle to enter');
            return false;
        }
        
        // Ensure vehicle isn't already occupied
        if (vehicle.userData.isOccupied) {
            console.log('Vehicle is already occupied');
            return false;
        }
        
        console.log(`Entering ${vehicle.userData.type} "${vehicle.userData.name}"`);
        this.currentVehicle = vehicle;
        vehicle.userData.isOccupied = true;
        
        // Associate vehicle with the player for physics checks
        vehicle.userData.player = PlayersManager.self;
        
        // Store player's original position for when they exit
        this.playerOriginalPosition = PlayersManager.self.position.clone();
        
        if (typeof window !== 'undefined' && window.gameNotify) {
            window.gameNotify(`Entered ${vehicle.userData.type} "${vehicle.userData.name}". Press E to exit.`);
        }
        
        return true;
    }

    // Exit the current vehicle
    static exitVehicle() {
        if (!this.currentVehicle) {
            console.log('No vehicle to exit');
            return false;
        }
        
        console.log(`Exiting ${this.currentVehicle.userData.type} "${this.currentVehicle.userData.name}"`);
        
        try {
            // Step 1: Force detach camera from vehicle if attached
            if (Engine.camera.parent === this.currentVehicle) {
                const worldPos = new Vector3();
                Engine.camera.getWorldPosition(worldPos);
                
                this.currentVehicle.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(worldPos);
                console.log('Camera detached from vehicle');
            }
            
            // Step 2: Store vehicle reference and position before clearing
            const exitedVehicle = this.currentVehicle;
            const vehiclePos = new Vector3();
            exitedVehicle.getWorldPosition(vehiclePos);
            
            // Step 3: Calculate exit position with large offset to prevent re-entry
            const exitOffset = exitedVehicle.userData.type === 'airplane' ?
                new Vector3(50, 20, 0) : // Much larger offset for airplane
                new Vector3(0, 10, 30);  // Larger offset for other vehicles
            
            // Apply vehicle orientation to offset
            exitOffset.applyQuaternion(exitedVehicle.quaternion);
            
            // Calculate final exit position
            const exitPosition = vehiclePos.clone().add(exitOffset);
            
            // Step 4: Update player state
            if (PlayersManager.self) {
                // Set player position to exit position
                PlayersManager.self.position.copy(exitPosition);
                PlayersManager.self.handle.position.copy(exitPosition);
                
                // Update physics state
                if (exitedVehicle.userData.planet) {
                    const planetCenter = exitedVehicle.userData.planet.object.position;
                    const toPlayer = exitPosition.clone().sub(planetCenter).normalize();
                    PlayersManager.self.surfaceNormal = toPlayer.clone();
                    
                    // Set falling state based on vehicle type
                    const wasInAirplane = exitedVehicle.userData.type === 'airplane';
                    PlayersManager.self.falling = wasInAirplane;
                    
                    // Apply initial velocity if exiting aircraft
                    if (wasInAirplane) {
                        PlayersManager.self.velocity.set(0, -1, 0);
                        
                        if (typeof window !== 'undefined' && window.gameNotify) {
                            window.gameNotify('Exited aircraft. Free falling!');
                        }
                    } else {
                        if (typeof window !== 'undefined' && window.gameNotify) {
                            window.gameNotify(`Exited vehicle "${exitedVehicle.userData.name}".`);
                        }
                    }
                }
                
                // Force camera to scene first
                if (Engine.camera.parent !== PlayersManager.self.mesh) {
                    if (Engine.camera.parent) {
                        Engine.camera.parent.remove(Engine.camera);
                    }
                    Engine.scene.add(Engine.camera);
                    
                    // Position at eye level above exit position
                    Engine.camera.position.copy(exitPosition).add(new Vector3(0, 1.7, 0));
                    Engine.camera.rotation.set(0, 0, 0);
                }
            }
            
            // Step 5: Reset vehicle state
            exitedVehicle.userData.isOccupied = false;
            exitedVehicle.userData.player = null;
            
            if (typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify(`Exited ${exitedVehicle.userData.type} "${exitedVehicle.userData.name}".`);
            }
            
            this.currentVehicle = null;
            
            // Set cooldown to prevent immediate re-entry
            this.interactionCooldown = 60;
            
            // Log the player's new position after exiting
            if (PlayersManager.self) {
                console.log(`Player position after exit: ${PlayersManager.self.position.x.toFixed(2)}, ${PlayersManager.self.position.y.toFixed(2)}, ${PlayersManager.self.position.z.toFixed(2)}`);
                
                // Log all vehicles and their distances from the player's new position
                this.vehicles.forEach((vehicle, index) => {
                    if (!vehicle) return;
                    const distance = PlayersManager.self.position.distanceTo(vehicle.position);
                    console.log(`Vehicle ${index} (${vehicle.userData.type}) distance after exit: ${distance.toFixed(2)}`);
                });
            }
            
            console.log('Vehicle exited successfully');
            return true;
        } catch (e) {
            console.error('Error exiting vehicle:', e);
            return false;
        }
    }
    
    // Used by engine.mjs to update vehicle positions/physics
    static updateVehicles(deltaTime = 1/60) {
        // Decrease cooldown timer if active
        if (this.interactionCooldown > 0) {
            this.interactionCooldown--;
        }
        
        for (const vehicle of this.vehicles) {
            if (!vehicle) continue;
            
            // If the vehicle is being driven, handle input
            if (vehicle.userData.isOccupied && vehicle === this.currentVehicle) {
                this.handleVehicleInput(vehicle, deltaTime);
                
                // For player-controlled vehicles, apply special physics
                this.updatePlayerControlledVehiclePhysics(vehicle, deltaTime);
            }
            
            // Note: Non-player vehicles are handled by Physics.update via the collidable objects system
        }
    }
    
    // Handle player input for vehicle control - FIXED to properly apply movement
    static handleVehicleInput(vehicle, deltaTime) {
        // Check if we have any input to process
        if (!this.input && !Engine.keyStates) {
            return; // No input sources available
        }
        
        // Process input based on vehicle type
        if (vehicle.userData.type === 'car') {
            // Process throttle input
            let accelerationInput = 0;
            
            // Get input from controller if available
            if (this.input && this.input.movement) {
                // Forward/backward from controller's movement.z
                accelerationInput = -this.input.movement.z; // Negative because forward is -z
            }
            
            // Fallback to keyboard if no controller input
            if (Math.abs(accelerationInput) < 0.01 && Engine.keyStates) {
                if (Engine.keyStates['ArrowUp']) accelerationInput = 1;
                if (Engine.keyStates['ArrowDown']) accelerationInput = -1;
            }
            
            // Apply acceleration
            if (Math.abs(accelerationInput) > 0.01) {
                vehicle.userData.speed += vehicle.userData.acceleration * accelerationInput * deltaTime;
            } else {
                // Apply drag when no input
                vehicle.userData.speed *= 0.98;
            }
            
            // Process steering input
            let steeringInput = 0;
            
            // Get steering from controller if available
            if (this.input && this.input.movement && Math.abs(this.input.movement.x) > 0.01) {
                steeringInput = this.input.movement.x;
            }
            // Fallback to keyboard
            else if (Engine.keyStates) {
                if (Engine.keyStates['ArrowLeft']) steeringInput = -1;
                if (Engine.keyStates['ArrowRight']) steeringInput = 1;
            }
            
            // Apply steering when moving
            if (Math.abs(vehicle.userData.speed) > 0.1 && Math.abs(steeringInput) > 0.01) {
                // Turn in the direction of steering input, relative to current speed direction
                vehicle.rotateY(-vehicle.userData.handling * steeringInput * Math.sign(vehicle.userData.speed));
            }
        }
        else if (vehicle.userData.type === 'airplane') {
            // Similar improvements for airplane controls
            // Forward/backward acceleration (throttle)
            if (this.input && this.input.movement) {
                // Get throttle input from controller's movement.z
                const throttleInput = -this.input.movement.z; // Negative because forward is -z
                
                // Apply acceleration proportional to input
                if (Math.abs(throttleInput) > 0.01) {
                    vehicle.userData.speed += vehicle.userData.acceleration * throttleInput * deltaTime;
                } else {
                    // Gradual speed reduction when no input
                    vehicle.userData.speed *= 0.99;
                }
                
                // Pitch control (up/down) from movement.y if available, otherwise from keys
                let pitchInput = 0;
                if (Math.abs(this.input.movement.y) > 0.01) {
                    pitchInput = this.input.movement.y;
                } else {
                    if (Engine.keyStates['w'] || Engine.keyStates['W']) pitchInput = -1;
                    if (Engine.keyStates['s'] || Engine.keyStates['S']) pitchInput = 1;
                }
                
                if (Math.abs(pitchInput) > 0.01) {
                    vehicle.rotateX(vehicle.userData.handling * pitchInput);
                }
                
                // Roll/turning from rotation or keyboard
                let rollInput = 0;
                if (this.input.rotation && Math.abs(this.input.rotation.x) > 0.01) {
                    rollInput = this.input.rotation.x;
                } else {
                    if (Engine.keyStates['ArrowLeft']) rollInput = -1; 
                    if (Engine.keyStates['ArrowRight']) rollInput = 1;
                }
                
                if (Math.abs(rollInput) > 0.01) {
                    vehicle.rotateZ(vehicle.userData.handling * rollInput);
                }
                
                // Yaw control (left/right turning)
                let yawInput = 0;
                if (this.input.movement && Math.abs(this.input.movement.x) > 0.01) {
                    yawInput = this.input.movement.x;
                } else {
                    if (Engine.keyStates['a'] || Engine.keyStates['A']) yawInput = 1;
                    if (Engine.keyStates['d'] || Engine.keyStates['D']) yawInput = -1;
                }
                
                if (Math.abs(yawInput) > 0.01) {
                    vehicle.rotateY(vehicle.userData.handling * yawInput);
                }
            } else {
                // Legacy keyboard-only controls
                if (Engine.keyStates['ArrowUp']) {
                    vehicle.userData.speed += vehicle.userData.acceleration * deltaTime;
                }
                if (Engine.keyStates['ArrowDown']) {
                    vehicle.userData.speed -= vehicle.userData.acceleration * deltaTime;
                }
                
                // Turning (roll)
                if (Engine.keyStates['ArrowLeft']) {
                    vehicle.rotateZ(vehicle.userData.handling * Math.sign(vehicle.userData.speed));
                }
                if (Engine.keyStates['ArrowRight']) {
                    vehicle.rotateZ(-vehicle.userData.handling * Math.sign(vehicle.userData.speed));
                }
                
                // Pitch control (up/down)
                if (Engine.keyStates['w'] || Engine.keyStates['W']) {
                    vehicle.rotateX(-vehicle.userData.handling);
                }
                if (Engine.keyStates['s'] || Engine.keyStates['S']) {
                    vehicle.rotateX(vehicle.userData.handling);
                }
                
                // Yaw control (left/right turning)
                if (Engine.keyStates['a'] || Engine.keyStates['A']) {
                    vehicle.rotateY(vehicle.userData.handling);
                }
                if (Engine.keyStates['d'] || Engine.keyStates['D']) {
                    vehicle.rotateY(-vehicle.userData.handling);
                }
            }
            
            // Altitude control
            const liftInput = Engine.keyStates[' '] ? 1 : 0;
            if (liftInput > 0 && vehicle.userData.speed > 10) {
                vehicle.userData.altitude += vehicle.userData.liftFactor * vehicle.userData.speed * deltaTime;
            } else if (vehicle.userData.altitude > 0) {
                // Gravity pulls the plane down when not applying lift
                vehicle.userData.altitude -= 0.5 * deltaTime;
            }
            
            // Clamp altitude
            vehicle.userData.altitude = Math.max(0, Math.min(vehicle.userData.maxAltitude, vehicle.userData.altitude));
        }
        
        // Ensure speed stays within vehicle limits
        vehicle.userData.speed = Math.max(-vehicle.userData.maxSpeed * 0.5, 
                                 Math.min(vehicle.userData.maxSpeed, vehicle.userData.speed));
        
        console.log(`Vehicle ${vehicle.userData.name} speed: ${vehicle.userData.speed.toFixed(2)}`);
    }
    
    // Physics specifically for vehicles under player control
    static updatePlayerControlledVehiclePhysics(vehicle, deltaTime) {
        if (!vehicle || !vehicle.userData) return;
        
        // Get the planet for gravity calculations
        const planet = vehicle.userData.planet;
        if (!planet) return;
        
        // CRITICAL FIX: Initialize velocity if needed
        if (!vehicle.userData.velocity) {
            vehicle.userData.velocity = new Vector3(0, -0.05, 0);
        }
        
        // Calculate planet-related values only once
        const planetCenter = planet.object.position;
        const toVehicle = vehicle.position.clone().sub(planetCenter);
        const distance = toVehicle.length();
        const surfaceNormal = toVehicle.normalize();
        
        // Define collision distance depending on vehicle type
        const heightOffset = vehicle.userData.type === 'car' ? 3 : 2;
        const collisionDistance = planet.radius + heightOffset;
        
        // Check if vehicle is on the surface
        const onSurface = distance <= collisionDistance;
        
        // FIXED ISSUE: Apply gravity properly
        const gravity = GRAVITY_CONSTANT * (vehicle.userData.type === 'airplane' && 
                                           vehicle.userData.altitude > 0 ? 0.2 : 1.0);
        vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity * deltaTime);
        
        if (vehicle.userData.type === 'car') {
            // FIXED ISSUE: Handle car surface movement
            if (onSurface) {
                // Force car to stay on surface
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                
                // Apply vehicle movement along surface
                if (Math.abs(vehicle.userData.speed) > 0.01) {
                    // Get forward direction in car's local space
                    const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                    
                    // Project forward vector onto planet's tangent plane
                    const projectedForward = forward.clone().projectOnPlane(surfaceNormal).normalize();
                    
                    // Move car along surface based on speed
                    const movement = projectedForward.multiplyScalar(vehicle.userData.speed * deltaTime);
                    vehicle.position.add(movement);
                    
                    // Ensure car stays at correct height after movement
                    const newToVehicle = vehicle.position.clone().sub(planetCenter);
                    const newDist = newToVehicle.length();
                    newToVehicle.normalize();
                    vehicle.position.copy(planetCenter).addScaledVector(newToVehicle, collisionDistance);
                }
                
                // Align car to planet surface
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.3);
                vehicle.userData.onSurface = true;
            }
        } 
        else if (vehicle.userData.type === 'airplane') {
            // FIXED ISSUE: Handle airplane physics
            if (vehicle.userData.altitude > 0) {
                // In flight - apply forward movement in airplane's direction
                const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                
                // Move based on speed (this is what was missing)
                const movement = forward.clone().multiplyScalar(vehicle.userData.speed * deltaTime);
                vehicle.position.add(movement);
            }
            else if (onSurface) {
                // On ground - snap to surface like cars
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                
                // Apply surface movement for taxiing
                if (Math.abs(vehicle.userData.speed) > 0.01) {
                    const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                    const projectedForward = forward.clone().projectOnPlane(surfaceNormal).normalize();
                    const movement = projectedForward.multiplyScalar(vehicle.userData.speed * deltaTime);
                    vehicle.position.add(movement);
                    
                    // Maintain correct height
                    const newToVehicle = vehicle.position.clone().sub(planetCenter);
                    newToVehicle.normalize();
                    vehicle.position.copy(planetCenter).addScaledVector(newToVehicle, collisionDistance);
                }
                
                // Align airplane to ground
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.3);
                vehicle.userData.onSurface = true;
            }
        }
        
        // Apply velocity caps to prevent instability
        const maxVelocity = 5;
        if (vehicle.userData.velocity.lengthSq() > maxVelocity * maxVelocity) {
            vehicle.userData.velocity.normalize().multiplyScalar(maxVelocity);
        }
        
        // Update collision bounds
        if (vehicle.collidable) {
            ObjectManager.updateCollidableBounds(vehicle);
        }
    }
    
    // Helper method to align vehicles to planet surfaces with improved stability
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, slerpFactor = 0.2) {
        if (!vehicle) return;
        
        try {
            // Use the surface normal as up direction
            const up = surfaceNormal;
            
            // Get vehicle's current forward direction
            const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            
            // CRITICAL FIX: Simpler, more stable projection method
            // Project forward vector onto tangent plane
            const forwardDotUp = forward.dot(up);
            const tangentForward = forward.clone().sub(up.clone().multiplyScalar(forwardDotUp));
            
            // Check if the result is valid (not too small)
            if (tangentForward.lengthSq() < 0.001) {
                // Use world X or Z axis as fallback
                if (Math.abs(up.x) < 0.9) {
                    tangentForward.set(1, 0, 0).sub(up.clone().multiplyScalar(up.x)).normalize();
                } else {
                    tangentForward.set(0, 0, 1).sub(up.clone().multiplyScalar(up.z)).normalize();
                }
            } else {
                tangentForward.normalize();
            }
            
            // Calculate right vector
            const right = new Vector3().crossVectors(up, tangentForward).normalize();
            
            // Recalculate forward for perfect orthogonality
            const correctedForward = new Vector3().crossVectors(right, up).normalize();
            
            // Create rotation matrix
            const rotMatrix = new Matrix4().makeBasis(right, up, correctedForward);
            const targetQuat = new Quaternion().setFromRotationMatrix(rotMatrix);
            
            // Check for invalid quaternion
            if (isNaN(targetQuat.x) || isNaN(targetQuat.y) || isNaN(targetQuat.z) || isNaN(targetQuat.w)) {
                console.error("Invalid quaternion generated for vehicle alignment");
                return;
            }
            
            // Use full strength for stationary vehicles to eliminate wobble
            const finalSlerpFactor = !vehicle.userData.isOccupied && 
                (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1) ? 
                Math.min(1.0, slerpFactor * 2) : slerpFactor;
            
            // Apply rotation with appropriate damping
            vehicle.quaternion.slerp(targetQuat, finalSlerpFactor);
        } catch (e) {
            console.error("Error aligning vehicle to surface:", e);
        }
    }
    
    // Force vehicle to ground level with improved stability
    static snapVehicleToGround(vehicle) {
        if (!vehicle || !vehicle.userData.planet) return;
        
        try {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // Calculate appropriate height based on vehicle type
            const heightOffset = vehicle.userData.type === 'car' ? 3 : 2;
            const targetDistance = planet.radius + heightOffset;
            
            // FIX: Stronger snap threshold when parked
            const snapThreshold = vehicle.userData.isOccupied ? 0.5 : 0.1;
            
            // Snap to surface if needed
            if (Math.abs(distance - targetDistance) > snapThreshold) {
                // FIX: More precise positioning
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
                
                // Cancel vertical velocity
                if (vehicle.userData.velocity) {
                    const downwardVelocity = vehicle.userData.velocity.dot(surfaceNormal);
                    if (Math.abs(downwardVelocity) > 0.01) {
                        // Cancel velocity component into ground
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, -downwardVelocity);
                        
                        // Apply horizontal friction too
                        vehicle.userData.velocity.multiplyScalar(0.8);
                    }
                }
            }
            
            // Always align stationary vehicles to surface with strong damping
            if (!vehicle.userData.isOccupied && (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1)) {
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.8);
                
                // FIX: Complete velocity reset for parked vehicles
                vehicle.userData.speed = 0;
                
                // Apply very strong damping
                if (vehicle.userData.velocity) {
                    if (vehicle.userData.velocity.lengthSq() < 0.0001) {
                        vehicle.userData.velocity.set(0, 0, 0);
                    } else {
                        vehicle.userData.velocity.multiplyScalar(0.2);
                    }
                }
            } else {
                // Normal alignment for moving vehicles
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.4);
            }
        } catch (e) {
            console.error("Error snapping vehicle to ground:", e);
        }
    }
}