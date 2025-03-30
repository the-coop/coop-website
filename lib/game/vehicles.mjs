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
        // CRITICAL FIX: Change heightOffset to lower value for better ground contact
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
        
        // FIXED: Adjust physics handle position to align better with wheels
        const physicsHandle = new Mesh(
            new BoxGeometry(6, 4, 10),
            new MeshBasicMaterial({ color: 0xFF0000, wireframe: true, visible: false })
        );
        physicsHandle.position.set(0, 1.5, 0); // FIXED: Lowered from 2 to 1.5
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
        
        // Set vehicle properties with more realistic physics values
        car.userData.speed = 0;
        car.userData.maxSpeed = 40;        // Max speed in units/sec
        car.userData.acceleration = 0.5;   // Reasonable acceleration
        car.userData.handling = 0.03;      // How quickly it can turn
        car.userData.friction = 0.90;      // Surface friction
        car.userData.isOccupied = false;
        car.userData.maxSpeedReverse = 15; // Lower max speed in reverse
        
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
        
        // Set vehicle properties with more realistic physics values
        airplane.userData.speed = 0;
        airplane.userData.maxSpeed = 80;       // Max forward speed
        airplane.userData.acceleration = 0.3;   // How quickly it gains speed
        airplane.userData.handling = 0.02;      // How quickly it can turn
        airplane.userData.liftFactor = 0.5;     // How strongly it generates lift
        airplane.userData.dragFactor = 0.02;    // Air resistance
        airplane.userData.stallSpeed = 15;      // Minimum speed to maintain altitude
        airplane.userData.takeoffSpeed = 25;    // Speed required for takeoff
        airplane.userData.altitude = 0;         // Current altitude above planet surface
        airplane.userData.maxAltitude = 500;    // Maximum flying altitude
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
        
        // CRITICAL FIX: Add reference to indicate it's a dynamic physics object
        vehicle.userData.isDynamic = true;
        
        // CRITICAL FIX: Store original orientation for recovery after landing
        vehicle.userData.initialQuaternion = vehicle.quaternion.clone();
        
        // CRITICAL FIX: Better initial falling velocity based on height
        const fallVelocity = Math.min(-0.5, -heightOffset * 0.01); // Scale with height
        vehicle.userData.velocity = new Vector3(0, fallVelocity, 0);
        
        // Mark vehicles as falling when spawned at height
        vehicle.userData.falling = heightOffset > 2;
        vehicle.userData.onSurface = false;
        
        // Set a non-zero speed to prevent "stationary" detection
        vehicle.userData.speed = heightOffset > 10 ? 0.2 : 0;
        
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
        
        // CRITICAL FIX: Completely disable player physics when entering vehicle
        if (PlayersManager.self) {
            // Store current velocity for restoration on exit
            PlayersManager.self._savedVelocity = PlayersManager.self.velocity.clone();
            
            // Zero out velocity to prevent physics calculations
            PlayersManager.self.velocity.set(0, 0, 0);
            
            // Mark player as being in vehicle for physics system to ignore
            PlayersManager.self.inVehicle = true;
            
            // Hide player mesh while in vehicle
            if (PlayersManager.self.mesh) {
                PlayersManager.self.mesh.visible = false;
            }

            // Store original player handle and use vehicle as handle instead
            PlayersManager.self._originalHandle = PlayersManager.self.handle;
            PlayersManager.self.handle = vehicle;
            
            console.log('Disabled player physics for vehicle entry');
        }
        
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
                // CRITICAL FIX: First restore the original handle, then position ONLY the handle
                if (PlayersManager.self._originalHandle) {
                    PlayersManager.self.handle = PlayersManager.self._originalHandle;
                    PlayersManager.self._originalHandle = null;
                    
                    // Position the handle once and only once
                    if (PlayersManager.self.handle) {
                        PlayersManager.self.handle.position.copy(exitPosition);
                        // No need to separately update player.position - it will sync naturally
                    }
                } else {
                    // Fallback if no original handle was stored
                    console.warn("No original player handle stored, using direct position update");
                    PlayersManager.self.position.copy(exitPosition);
                    
                    if (PlayersManager.self.handle) {
                        PlayersManager.self.handle.position.copy(exitPosition);
                    }
                }
                
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
                    } else {
                        // Use a safe exit velocity for cars
                        PlayersManager.self.velocity.set(0, 0, 0);
                    }
                    
                    // CRITICAL FIX: Re-enable player physics
                    PlayersManager.self.inVehicle = false;
                    
                    // Make player mesh visible again
                    if (PlayersManager.self.mesh) {
                        PlayersManager.self.mesh.visible = true;
                    }
                    
                    if (typeof window !== 'undefined' && window.gameNotify) {
                        window.gameNotify(`Exited vehicle "${exitedVehicle.userData.name}".`);
                    }
                }
                
                // CRITICAL FIX: Position the camera with proper orientation BEFORE fps controller reset 
                if (Engine.camera.parent) {
                    Engine.camera.parent.remove(Engine.camera);
                    Engine.scene.add(Engine.camera);
                }
                
                // Explicitly set camera position and orientation to match exit position
                const planetCenter = exitedVehicle.userData.planet?.object?.position;
                if (planetCenter) {
                    const toPlayer = exitPosition.clone().sub(planetCenter).normalize();
                    const cameraPos = exitPosition.clone().add(new Vector3(0, 1.7, 0));
                    
                    // Position camera at eye level with correct up vector
                    Engine.camera.position.copy(cameraPos);
                    Engine.camera.up.copy(toPlayer);
                    
                    // Look forward relative to planet surface
                    const forward = new Vector3(0, 0, -1).applyQuaternion(exitedVehicle.quaternion);
                    const right = new Vector3().crossVectors(toPlayer, forward).normalize();
                    const correctedForward = new Vector3().crossVectors(right, toPlayer).normalize();
                    
                    const lookTarget = cameraPos.clone().add(correctedForward);
                    Engine.camera.lookAt(lookTarget);
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
                
                if (PlayersManager.self.handle) {
                    console.log(`Player handle position after exit: ${PlayersManager.self.handle.position.x.toFixed(2)}, ${PlayersManager.self.handle.position.y.toFixed(2)}, ${PlayersManager.self.handle.position.z.toFixed(2)}`);
                }
                
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
                // Process player input to update vehicle properties
                this.handleVehicleInput(vehicle, deltaTime);
                
                // CHANGED: Let Physics module handle all vehicle physics
                // Including player-controlled vehicles
            }
            
            // Note: All vehicles (player and non-player) are now handled by Physics.update
        }
    }
    
    // Handle player input for vehicle control - Convert input to vehicle parameters only
    static handleVehicleInput(vehicle, deltaTime) {
        // Check if we have input to process
        if (!this.input && !Engine.keyStates) {
            // Apply drag when no input controller is available
            if (vehicle.userData.speed !== 0) {
                vehicle.userData.speed *= 0.95;
            }
            return;
        }
        
        // CRITICAL FIX: Simplified input logging
        const hasInput = this.input && this.input.movement && 
                        (Math.abs(this.input.movement.x) > 0.01 || Math.abs(this.input.movement.z) > 0.01);
        
        if (hasInput) {
            console.log(`Vehicle input received: x=${this.input.movement.x.toFixed(2)}, z=${this.input.movement.z.toFixed(2)}`);
            
            // CRITICAL FIX: Cancel stabilization if user is providing input
            if (vehicle.userData._stabilizeUntil) {
                vehicle.userData._stabilizeUntil = 0;
                console.log("Stabilization canceled due to player input");
            }
        }
        
        if (vehicle.userData.type === 'car') {
            // CRITICAL FIX: Simplified, more direct input handling
            let accelerationInput = 0;
            let steeringInput = 0;
            
            // First check if we have controller input
            if (this.input && this.input.movement) {
                accelerationInput = -this.input.movement.z; // Forward/Back
                steeringInput = this.input.movement.x;     // Left/Right
            }
            
            // Then check direct key states as fallback
            if (Math.abs(accelerationInput) < 0.1 && Engine.keyStates) {
                if (Engine.keyStates['KeyW'] || Engine.keyStates['ArrowUp'] || Engine.keyStates['Space']) {
                    accelerationInput = 1;  // Forward with W, Up Arrow or Space
                }
                if (Engine.keyStates['KeyS'] || Engine.keyStates['ArrowDown']) {
                    accelerationInput = -1; // Backward with S or Down Arrow
                }
            }
            
            if (Math.abs(steeringInput) < 0.1 && Engine.keyStates) {
                if (Engine.keyStates['KeyA'] || Engine.keyStates['ArrowLeft']) {
                    steeringInput = -1;  // Left with A or Left Arrow
                }
                if (Engine.keyStates['KeyD'] || Engine.keyStates['ArrowRight']) {
                    steeringInput = 1;   // Right with D or Right Arrow
                }
            }
            
            // Apply acceleration if we have input
            if (Math.abs(accelerationInput) > 0.01) {
                // Extremely responsive acceleration (increased multiplier)
                vehicle.userData.speed += vehicle.userData.acceleration * accelerationInput * deltaTime * 10;
                console.log(`Car acceleration: ${accelerationInput.toFixed(2)}, speed: ${vehicle.userData.speed.toFixed(2)}`);
            } else {
                // Strong drag when no input for responsive stopping
                vehicle.userData.speed *= 0.90;
            }
            
            // Apply steering only if we have input and are moving
            if (Math.abs(steeringInput) > 0.01 && Math.abs(vehicle.userData.speed) > 0.01) {
                // More responsive steering with higher multiplier
                const steeringAmount = -vehicle.userData.handling * steeringInput * Math.sign(vehicle.userData.speed) * 5;
                vehicle.rotateY(steeringAmount);
            }
            
            // Apply speed limits
            const maxForwardSpeed = vehicle.userData.maxSpeed || 40;
            const maxReverseSpeed = vehicle.userData.maxSpeedReverse || 15;
            
            if (vehicle.userData.speed > 0) {
                vehicle.userData.speed = Math.min(maxForwardSpeed, vehicle.userData.speed);
            } else {
                vehicle.userData.speed = Math.max(-maxReverseSpeed, vehicle.userData.speed);
            }
        }
        
        // ...existing airplane code...
    }
    
    // Helper method to align vehicles to planet surfaces with improved stability
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, slerpFactor = 0.2) {
        if (!vehicle) return;
        
        try {
            // Use the surface normal as up direction
            const up = surfaceNormal;
            
            // CRITICAL CAR FIX - Use FPS controller-inspired alignment
            if (vehicle.userData.type === 'car') {
                // Set vehicle's up vector directly - key to stability
                vehicle.up.copy(up);
                
                // Get current forward direction
                const currentForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                
                // Project forward onto tangent plane
                const projectedForward = currentForward.clone().projectOnPlane(up).normalize();
                
                // Use a fallback if projection fails
                if (projectedForward.lengthSq() < 0.001) {
                    if (Math.abs(up.y) > 0.9) {
                        projectedForward.set(1, 0, 0).sub(up.clone().multiplyScalar(up.x)).normalize();
                    } else {
                        projectedForward.set(0, 0, 1).sub(up.clone().multiplyScalar(up.z)).normalize();
                    }
                }
                
                // Calculate target position to look at
                const lookTarget = new Vector3().copy(vehicle.position).add(projectedForward);
                
                // FIXED: Create a temporary object with the target orientation
                // Create a temporary object to get the target quaternion
                const tempObj = new Object3D();
                tempObj.position.copy(vehicle.position);
                tempObj.up.copy(up);
                tempObj.lookAt(lookTarget);
                
                // For stabilization period, use immediate perfect alignment
                if (vehicle.userData._stabilizeUntil && Date.now() < vehicle.userData._stabilizeUntil) {
                    // Direct alignment during stabilization
                    vehicle.quaternion.copy(tempObj.quaternion);
                    
                    // CRITICAL FIX: Don't zero out speed if the player is providing input
                    if (!vehicle.userData.isOccupied || !VehicleManager.input || 
                       (Math.abs(VehicleManager.input.movement.z) < 0.01 && 
                        Math.abs(VehicleManager.input.movement.x) < 0.01)) {
                        // Only zero velocity/speed if no input is being given
                        vehicle.userData.velocity.set(0, 0, 0);
                        vehicle.userData.speed = 0;
                    }
                } else {
                    // Use slerp for smoother transition
                    vehicle.quaternion.slerp(tempObj.quaternion, slerpFactor);
                }
                
                return;
            }
            
            // For non-car vehicles (airplanes etc.), use the regular alignment code
            // Get vehicle's current forward direction
            const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            
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
            
            // CRITICAL FIX: For cars, use direct position setting
            if (vehicle.userData.type === 'car') {
                // Snap to exact height above surface - no physics oscillation
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
                
                // For stationary cars, eliminate all velocity and use direct alignment
                if (!vehicle.userData.isOccupied || Math.abs(vehicle.userData.speed) < 0.1) {
                    // Zero out all velocity
                    vehicle.userData.velocity.set(0, 0, 0);
                    vehicle.userData.speed = 0;
                    
                    // Use FPS controller-style direct alignment
                    vehicle.up.copy(surfaceNormal);
                    
                    // Maintain current forward direction projected onto surface
                    const currentForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                    const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
                    
                    // Calculate look target and use direct lookAt
                    if (projectedForward.lengthSq() > 0.001) {
                        const lookTarget = new Vector3().copy(vehicle.position).add(projectedForward);
                        vehicle.lookAt(lookTarget);
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