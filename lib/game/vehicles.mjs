import { 
    CylinderGeometry, 
    MeshBasicMaterial, 
    Mesh, 
    Vector3, 
    Quaternion, 
    Matrix4,
    BoxGeometry,
    Object3D
} from 'three';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';
import ObjectManager from './object.mjs';
import PlayersManager from './players.mjs'; // Add import for PlayersManager

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;
    
    // Add interaction cooldown timer
    static interactionCooldown = 0;

    // Create a car on the specified planet at the given coordinates
    static createCar(planet, latitude, longitude) {
        const car = this.createVehicleBase('car', planet, latitude, longitude, 3);
        
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
        
        // Set vehicle properties
        car.userData.speed = 0;
        car.userData.maxSpeed = 40;
        car.userData.acceleration = 0.5;
        car.userData.handling = 0.03;
        car.userData.friction = 0.98;
        car.userData.isOccupied = false;
        
        console.log(`Created car on ${planet.name} at ${latitude}°, ${longitude}°`);
        return car;
    }
    
    // Create an airplane on the specified planet at the given coordinates
    static createAirplane(planet, latitude, longitude) {
        const airplane = this.createVehicleBase('airplane', planet, latitude, longitude, 5);
        
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
        
        // Set vehicle properties
        airplane.userData.speed = 0;
        airplane.userData.maxSpeed = 80;
        airplane.userData.acceleration = 0.3;
        airplane.userData.handling = 0.02;
        airplane.userData.liftFactor = 0.5;
        airplane.userData.altitude = 0;
        airplane.userData.maxAltitude = 500;
        airplane.userData.isOccupied = false;
        
        console.log(`Created airplane on ${planet.name} at ${latitude}°, ${longitude}°`);
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
        
        // Position the vehicle on the planet surface
        SceneManager.positionObjectOnPlanet(vehicle, planet, latitude, longitude, heightOffset);
        
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
            console.log(`Entering ${closestVehicle.userData.type} at distance ${closestDistance.toFixed(2)}`);
            
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
        
        console.log(`Entering ${vehicle.userData.type}`);
        this.currentVehicle = vehicle;
        vehicle.userData.isOccupied = true;
        
        // Associate vehicle with the player for physics checks
        vehicle.userData.player = PlayersManager.self;
        
        // Store player's original position for when they exit
        this.playerOriginalPosition = PlayersManager.self.position.clone();
        
        if (typeof window !== 'undefined' && window.gameNotify) {
            window.gameNotify(`Entered ${vehicle.userData.type}. Press E to exit.`);
        }
        
        return true;
    }

    // Exit the current vehicle
    static exitVehicle() {
        if (!this.currentVehicle) {
            console.log('No vehicle to exit');
            return false;
        }
        
        console.log(`Exiting ${this.currentVehicle.userData.type}`);
        
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
                            window.gameNotify('Exited vehicle.');
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
            // If the vehicle is being driven, handle input
            if (vehicle.userData.isOccupied && vehicle === this.currentVehicle) {
                this.handleVehicleInput(vehicle, deltaTime);
            }
            
            // Apply vehicle-specific physics updates
            this.updateVehiclePhysics(vehicle, deltaTime);
        }
    }
    
    // Handle player input for vehicle control
    static handleVehicleInput(vehicle, deltaTime) {
        // This would need to be integrated with your existing input system
        // For example, using keyboard controls:
        const keyStates = Engine.keyStates || {};
        
        if (vehicle.userData.type === 'car') {
            // Accelerate/brake
            if (keyStates['ArrowUp']) {
                vehicle.userData.speed += vehicle.userData.acceleration * deltaTime;
            }
            if (keyStates['ArrowDown']) {
                vehicle.userData.speed -= vehicle.userData.acceleration * deltaTime;
            }
            
            // Apply turning when moving
            if (Math.abs(vehicle.userData.speed) > 0.1) {
                if (keyStates['ArrowLeft']) {
                    vehicle.rotateY(vehicle.userData.handling * Math.sign(vehicle.userData.speed));
                }
                if (keyStates['ArrowRight']) {
                    vehicle.rotateY(-vehicle.userData.handling * Math.sign(vehicle.userData.speed));
                }
            }
        } 
        else if (vehicle.userData.type === 'airplane') {
            // Accelerate/brake
            if (keyStates['ArrowUp']) {
                vehicle.userData.speed += vehicle.userData.acceleration * deltaTime;
            }
            if (keyStates['ArrowDown']) {
                vehicle.userData.speed -= vehicle.userData.acceleration * deltaTime;
            }
            
            // Turning (roll)
            if (keyStates['ArrowLeft']) {
                vehicle.rotateZ(vehicle.userData.handling * Math.sign(vehicle.userData.speed));
            }
            if (keyStates['ArrowRight']) {
                vehicle.rotateZ(-vehicle.userData.handling * Math.sign(vehicle.userData.speed));
            }
            
            // Pitch control (up/down)
            if (keyStates['w'] || keyStates['W']) {
                vehicle.rotateX(-vehicle.userData.handling);
            }
            if (keyStates['s'] || keyStates['S']) {
                vehicle.rotateX(vehicle.userData.handling);
            }
            
            // Yaw control (left/right turning)
            if (keyStates['a'] || keyStates['A']) {
                vehicle.rotateY(vehicle.userData.handling);
            }
            if (keyStates['d'] || keyStates['D']) {
                vehicle.rotateY(-vehicle.userData.handling);
            }
            
            // Altitude control
            if (keyStates[' '] && vehicle.userData.speed > 10) { // Spacebar for lift
                vehicle.userData.altitude += vehicle.userData.liftFactor * vehicle.userData.speed * deltaTime;
            } else if (vehicle.userData.altitude > 0) {
                // Gravity pulls the plane down when not applying lift
                vehicle.userData.altitude -= 0.5 * deltaTime;
            }
            
            // Clamp altitude
            vehicle.userData.altitude = Math.max(0, Math.min(vehicle.userData.maxAltitude, vehicle.userData.altitude));
        }
        
        // Clamp speed for all vehicles
        vehicle.userData.speed = Math.max(-vehicle.userData.maxSpeed * 0.5, 
                                  Math.min(vehicle.userData.maxSpeed, vehicle.userData.speed));
    }
    
    // Update vehicle physics
    static updateVehiclePhysics(vehicle, deltaTime) {
        // Apply friction to slow down vehicles
        if (Math.abs(vehicle.userData.speed) > 0.01) {
            vehicle.userData.speed *= vehicle.userData.friction;
        } else {
            vehicle.userData.speed = 0;
        }
        
        // Apply planet gravity for airplanes when they have altitude
        if (vehicle.userData.type === 'airplane' && vehicle.userData.altitude > 0) {
            // Airplane is flying, use its forward direction
            const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            vehicle.position.addScaledVector(direction, vehicle.userData.speed * deltaTime);
            
            // Apply a small downward force (simplified gravity)
            if (!vehicle.userData.isOccupied) {
                vehicle.userData.altitude -= 1 * deltaTime;
                if (vehicle.userData.altitude < 0) vehicle.userData.altitude = 0;
            }
        } 
        else if (vehicle.userData.type === 'car') {
            // Car stays on planet surface
            if (Math.abs(vehicle.userData.speed) > 0.01) {
                // Move car forward based on its orientation
                const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                const newPosition = vehicle.position.clone().addScaledVector(direction, vehicle.userData.speed * deltaTime);
                
                // Project new position onto planet surface
                const planet = vehicle.userData.planet;
                const planetCenter = planet.object.position.clone();
                const toNewPos = newPosition.clone().sub(planetCenter);
                
                // Normalize and scale to planet radius + vehicle height
                const heightOffset = 3; // Height above ground
                toNewPos.normalize().multiplyScalar(planet.radius + heightOffset);
                
                // Set position on planet surface
                vehicle.position.copy(planetCenter).add(toNewPos);
                
                // Align vehicle to planet surface
                const up = vehicle.position.clone().sub(planetCenter).normalize();
                const vehicleForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                
                // Calculate right vector (perpendicular to up and forward)
                const right = new Vector3().crossVectors(vehicleForward, up).normalize();
                
                // Recalculate forward to ensure it's perpendicular to up
                const correctedForward = new Vector3().crossVectors(up, right).normalize();
                
                // Create rotation matrix from these orthogonal vectors
                const rotMat = new Matrix4().makeBasis(right, up, correctedForward);
                vehicle.quaternion.setFromRotationMatrix(rotMat);
            }
        }
    }
}