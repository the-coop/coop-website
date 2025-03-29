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

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;
    
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
        // Create vehicles on planets (now using the specific methods in SceneManager.setup)
    }
    
    // Setup event listeners for entering/exiting vehicles
    static setupVehicleInteractions() {
        if (typeof window === 'undefined') return;
        
        document.addEventListener('keydown', (event) => {
            // 'E' key to enter/exit vehicles
            if (event.key === 'e' || event.key === 'E') {
                if (this.currentVehicle) {
                    this.exitVehicle();
                } else {
                    this.tryEnterNearbyVehicle();
                }
            }
        });
        
        console.log('Vehicle interactions setup complete');
    }
    
    // Try to enter a nearby vehicle
    static tryEnterNearbyVehicle() {
        const playerPosition = Engine.camera.position;
        let closestVehicle = null;
        let closestDistance = 10; // Maximum distance to enter a vehicle
        
        for (const vehicle of this.vehicles) {
            if (vehicle.userData.isOccupied) continue;
            
            const distance = playerPosition.distanceTo(vehicle.position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestVehicle = vehicle;
            }
        }
        
        if (closestVehicle) {
            this.enterVehicle(closestVehicle);
        } else {
            console.log('No vehicle nearby to enter');
        }
    }
    
    // Enter a specific vehicle
    static enterVehicle(vehicle) {
        if (this.currentVehicle) return;
        
        console.log(`Entering ${vehicle.userData.type}`);
        this.currentVehicle = vehicle;
        vehicle.userData.isOccupied = true;
        
        // Store player's original position for when they exit
        this.playerOriginalPosition = Engine.camera.position.clone();
        
        // Move camera to vehicle position
        Engine.camera.position.copy(vehicle.position);
        
        // Attach camera to vehicle
        vehicle.add(Engine.camera);
        
        // Notify the player
        if (typeof document !== 'undefined') {
            const message = document.createElement('div');
            message.textContent = `Entered ${vehicle.userData.type}. Press E to exit.`;
            message.style.position = 'absolute';
            message.style.bottom = '20px';
            message.style.left = '50%';
            message.style.transform = 'translateX(-50%)';
            message.style.background = 'rgba(0,0,0,0.5)';
            message.style.color = 'white';
            message.style.padding = '10px';
            message.style.borderRadius = '5px';
            message.id = 'vehicle-message';
            document.body.appendChild(message);
            
            // Remove message after 3 seconds
            setTimeout(() => {
                if (document.getElementById('vehicle-message')) {
                    document.getElementById('vehicle-message').remove();
                }
            }, 3000);
        }
    }
    
    // Exit the current vehicle
    static exitVehicle() {
        if (!this.currentVehicle) return;
        
        console.log(`Exiting ${this.currentVehicle.userData.type}`);
        
        // Remove camera from vehicle
        this.currentVehicle.remove(Engine.camera);
        
        // Position player slightly away from the vehicle to avoid collisions
        const exitOffset = new Vector3(0, 3, 5);
        Engine.camera.position.copy(this.currentVehicle.position).add(exitOffset);
        
        // Reset vehicle state
        this.currentVehicle.userData.isOccupied = false;
        this.currentVehicle = null;
        
        // Notify the player
        if (typeof document !== 'undefined') {
            const message = document.createElement('div');
            message.textContent = 'Exited vehicle.';
            message.style.position = 'absolute';
            message.style.bottom = '20px';
            message.style.left = '50%';
            message.style.transform = 'translateX(-50%)';
            message.style.background = 'rgba(0,0,0,0.5)';
            message.style.color = 'white';
            message.style.padding = '10px';
            message.style.borderRadius = '5px';
            message.id = 'vehicle-message';
            document.body.appendChild(message);
            
            // Remove message after 3 seconds
            setTimeout(() => {
                if (document.getElementById('vehicle-message')) {
                    document.getElementById('vehicle-message').remove();
                }
            }, 3000);
        }
    }
    
    // Used by engine.mjs to update vehicle positions/physics
    static updateVehicles(deltaTime = 1/60) {
        if (!deltaTime) deltaTime = 1/60;
        
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