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
    static createAirplane(planet, latitude, longitude) {
        const airplane = this.createVehicleBase('airplane', planet, latitude, longitude, 5);
        
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
    
    // Physics specifically for vehicles under player control
    static updatePlayerControlledVehiclePhysics(vehicle, deltaTime) {
        if (!vehicle || !vehicle.userData) return;
        
        // Get the planet for gravity calculations
        const planet = vehicle.userData.planet;
        if (!planet) return;
        
        if (vehicle.userData.type === 'car') {
            // Cars always stay on the planet surface
            if (Math.abs(vehicle.userData.speed) > 0.01) {
                // Move car forward based on its orientation
                const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                const newPosition = vehicle.position.clone().addScaledVector(direction, vehicle.userData.speed * deltaTime);
                
                // Project new position onto planet surface
                const planetCenter = planet.object.position.clone();
                const toNewPos = newPosition.clone().sub(planetCenter);
                
                // Normalize and scale to planet radius + vehicle height
                const heightOffset = 3; // Height above ground
                toNewPos.normalize().multiplyScalar(planet.radius + heightOffset);
                
                // Set position on planet surface
                vehicle.position.copy(planetCenter).add(toNewPos);
                
                // Align to surface
                this.alignVehicleToPlanetSurface(vehicle, toNewPos.normalize(), 0.3);
                
                // Update collision bounds
                if (vehicle.collidable) {
                    ObjectManager.updateCollidableBounds(vehicle);
                }
            }
        } 
        else if (vehicle.userData.type === 'airplane') {
            // Handle in-flight physics for airplanes
            // Forward movement based on speed
            const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            vehicle.position.addScaledVector(direction, vehicle.userData.speed * deltaTime);
            
            // Apply minimal gravity for piloted airplanes
            if (vehicle.userData.altitude <= 0) {
                // Snap to ground if landed
                const planetCenter = planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter);
                const distance = toVehicle.length();
                const surfaceNormal = toVehicle.normalize();
                
                // Position on surface with correct height
                const heightOffset = 2;
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, planet.radius + heightOffset);
                
                // Align to runway
                this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.1);
            }
            
            // Update collision bounds
            if (vehicle.collidable) {
                ObjectManager.updateCollidableBounds(vehicle);
            }
        }
    }
    
    // Helper method to align vehicles to planet surfaces
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal, slerpFactor = 0.2) {
        if (!vehicle) return;
        
        // Always use up vector from planet surface normal
        const up = surfaceNormal;
        
        // Get vehicle's current forward direction
        const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
        
        // Project forward direction onto tangent plane to make it parallel to surface
        const projectedForward = forward.clone().projectOnPlane(up).normalize();
        
        // If projected forward is too small (nearly vertical), create a default forward direction
        if (projectedForward.lengthSq() < 0.01) {
            // Choose any perpendicular direction to up as forward
            if (Math.abs(up.y) < 0.9) {
                // If up is not closely aligned with world Y, use world Y to create forward
                projectedForward.set(0, 1, 0).cross(up).normalize();
            } else {
                // Otherwise use world Z
                projectedForward.set(0, 0, 1).cross(up).normalize();
            }
        }
        
        // Calculate right vector (perpendicular to up and projected forward)
        const right = new Vector3().crossVectors(up, projectedForward).normalize();
        
        // Recalculate forward to ensure orthogonality with up and right
        const correctedForward = new Vector3().crossVectors(right, up).normalize();
        
        // Create rotation matrix from orthogonal vectors
        const rotMatrix = new Matrix4().makeBasis(right, up, correctedForward);
        const targetQuat = new Quaternion().setFromRotationMatrix(rotMatrix);
        
        // Use adaptive damping based on vehicle state
        let damping = slerpFactor;
        
        // For stationary vehicles, use stronger damping to reduce wobbling
        if (Math.abs(vehicle.userData.speed) < 0.1) {
            damping = Math.min(0.9, slerpFactor * 3); // Stronger damping when not moving
        }
        
        // Apply smooth rotation with improved stability
        vehicle.quaternion.slerp(targetQuat, damping);
    }
    
    // Force vehicle to ground level
    static snapVehicleToGround(vehicle) {
        if (!vehicle || !vehicle.userData.planet) return;
        
        const planet = vehicle.userData.planet;
        const planetCenter = planet.object.position;
        const toVehicle = vehicle.position.clone().sub(planetCenter);
        const distance = toVehicle.length();
        const surfaceNormal = toVehicle.normalize();
        
        // Calculate appropriate height based on vehicle type
        const heightOffset = vehicle.userData.type === 'car' ? 3 : 2;
        const targetDistance = planet.radius + heightOffset;
        
        // Only snap if too far from surface
        if (Math.abs(distance - targetDistance) > 0.5) {
            vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
            
            // Stop any vertical movement
            if (vehicle.userData.velocity) {
                const downwardVelocity = vehicle.userData.velocity.dot(surfaceNormal);
                if (Math.abs(downwardVelocity) > 0.01) {
                    vehicle.userData.velocity.addScaledVector(surfaceNormal, -downwardVelocity);
                    
                    // Apply additional damping
                    vehicle.userData.velocity.multiplyScalar(0.9);
                }
            }
        }
        
        // Always align to surface but with stronger damping for stable parking
        this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.4);
        
        // For completely stopped vehicles, forcefully reset physics values
        if (!vehicle.userData.isOccupied && (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.05)) {
            vehicle.userData.speed = 0;
            if (vehicle.userData.velocity) {
                // Apply very strong damping to parked vehicles
                vehicle.userData.velocity.multiplyScalar(0.5);
                
                // If velocity is very small, zero it out completely
                if (vehicle.userData.velocity.lengthSq() < 0.0001) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
            }
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
        
        // Initialize velocity if needed
        if (!vehicle.userData.velocity) {
            vehicle.userData.velocity = new Vector3(0, -0.05, 0);
        }
        
        // Apply planet gravity for airplanes when they have altitude
        if (vehicle.userData.type === 'airplane' && vehicle.userData.altitude > 0) {
            // Airplane is flying, use its forward direction
            const direction = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            vehicle.position.addScaledVector(direction, vehicle.userData.speed * deltaTime);
            
            // Apply a small downward force (simplified gravity) when not occupied
            if (!vehicle.userData.isOccupied) {
                vehicle.userData.altitude -= 1.5 * deltaTime;
                if (vehicle.userData.altitude < 0) {
                    vehicle.userData.altitude = 0;
                    
                    // Reduce speed when landing
                    vehicle.userData.speed *= 0.5;
                }
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
                if (!planet) return;
                
                const planetCenter = planet.object.position.clone();
                const toNewPos = newPosition.clone().sub(planetCenter);
                
                // Normalize and scale to planet radius + vehicle height
                const heightOffset = 3; // Height above ground
                toNewPos.normalize().multiplyScalar(planet.radius + heightOffset);
                
                // Set position on planet surface
                vehicle.position.copy(planetCenter).add(toNewPos);
                
                // Align car to planet surface
                this.alignVehicleToPlanetSurface(vehicle, toNewPos.normalize());
            }
        } else {
            // For other vehicle types or when vehicle has no altitude
            // Make sure it stays on the ground
            this.snapVehicleToGround(vehicle);
        }
    }
    
    // Helper method to align vehicles to planet surfaces
    static alignVehicleToPlanetSurface(vehicle, surfaceNormal) {
        const up = surfaceNormal;
        const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
        
        // Remove the up component from forward to make it parallel to surface
        forward.addScaledVector(up, -forward.dot(up)).normalize();
        
        // Calculate right vector
        const right = new Vector3().crossVectors(up, forward).normalize();
        
        // Recalculate forward to ensure orthogonality
        forward.crossVectors(right, up).normalize();
        
        // Create rotation matrix from orthogonal vectors
        const rotMatrix = new Matrix4().makeBasis(right, up, forward);
        
        // Apply smooth rotation with improved stability
        const newQuaternion = new Quaternion().setFromRotationMatrix(rotMatrix);
        
        // Use a variable slerp factor based on vehicle type
        const slerpFactor = vehicle.userData.type === 'car' ? 0.15 : 0.05;
        vehicle.quaternion.slerp(newQuaternion, slerpFactor);
    }
    
    // Force vehicle to ground level
    static snapVehicleToGround(vehicle) {
        if (!vehicle || !vehicle.userData.planet) return;
        
        const planet = vehicle.userData.planet;
        const planetCenter = planet.object.position;
        const toVehicle = vehicle.position.clone().sub(planetCenter);
        const distance = toVehicle.length();
        const surfaceNormal = toVehicle.normalize();
        
        // Calculate appropriate height based on vehicle type
        const heightOffset = vehicle.userData.type === 'car' ? 3 : 2;
        const targetDistance = planet.radius + heightOffset;
        
        // Only snap if too far from surface
        if (Math.abs(distance - targetDistance) > 0.5) {
            vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetDistance);
            
            // Stop any vertical movement
            if (vehicle.userData.velocity) {
                const downwardVelocity = vehicle.userData.velocity.dot(surfaceNormal);
                if (Math.abs(downwardVelocity) > 0.01) {
                    vehicle.userData.velocity.addScaledVector(surfaceNormal, -downwardVelocity);
                    
                    // Apply additional damping
                    vehicle.userData.velocity.multiplyScalar(0.9);
                }
            }
        }
        
        // Always align to surface but with stronger damping for stable parking
        this.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.4);
        
        // For completely stopped vehicles, forcefully reset physics values
        if (!vehicle.userData.isOccupied && (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.05)) {
            vehicle.userData.speed = 0;
            if (vehicle.userData.velocity) {
                // Apply very strong damping to parked vehicles
                vehicle.userData.velocity.multiplyScalar(0.5);
                
                // If velocity is very small, zero it out completely
                if (vehicle.userData.velocity.lengthSq() < 0.0001) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
            }
        }
    }
}