import { BoxGeometry, MeshStandardMaterial, Mesh, Vector3, Quaternion } from 'three';
import Engine from './engine.mjs';
import CarController from './controllers/CarController.mjs';
import AirplaneController from './controllers/AirplaneController.mjs';
import SceneManager from './scene.mjs';

export class Vehicle {
    constructor(position, color, controller) {
        // Create basic vehicle mesh
        const geometry = new BoxGeometry(1, 0.5, 2);
        const material = new MeshStandardMaterial({ color });
        this.mesh = new Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.userData.vehicle = this;
        
        // Vehicle properties
        this.velocity = new Vector3();
        this.controller = controller;
        this.occupied = false;
        this.planet = null; // Reference to the planet the vehicle is on
    }
    
    update() {
        // Base update function, overridden by specific vehicle types
    }
    
    // Place vehicle on a planet at specified latitude and longitude
    placeOnPlanet(planet, latitude, longitude, heightOffset = 1) {
        this.planet = planet;
        SceneManager.positionObjectOnPlanet(this.mesh, planet, latitude, longitude, heightOffset);
    }
}

export class Car extends Vehicle {
    constructor(position) {
        super(position, 0x3366cc, CarController);
        // Car-specific properties - updated values
        this.groundSpeed = 1.2; // Increased for better feel
        this.turnSpeed = 0.08; // Increased for better responsiveness
        
        // Scale vehicle size relative to planet size
        this.mesh.scale.x = 10; 
        this.mesh.scale.y = 5;
        this.mesh.scale.z = 15;
    }
    
    update() {
        if (this.occupied) {
            // Car-specific movement logic
            this.mesh.position.add(this.velocity);
            // Friction is now handled in the controller for better planet-specific physics
        }
    }
}

export class Airplane extends Vehicle {
    constructor(position) {
        super(position, 0xcc6633, AirplaneController);
        // Scale vehicle size relative to planet size
        this.mesh.scale.x = 20;
        this.mesh.scale.y = 3;
        this.mesh.scale.z = 15;
        // Airplane-specific properties - updated values
        this.flyingSpeed = 1.5; // Increased for better feel
        this.liftRate = 0.08; // Increased for better liftoff
        this.turnSpeed = 0.08; // Increased for better responsiveness
    }
    
    update() {
        if (this.occupied) {
            // Airplane-specific movement logic
            this.mesh.position.add(this.velocity);
            // Air resistance is handled in controller for more complex physics
        }
    }
}

export default class VehicleManager {
    static vehicles = [];
    static nearbyVehicle = null;
    static currentVehicle = null;
    
    static createPlanetVehicles() {
        console.log('Initializing vehicles on planets');
        
        // Get all planets from scene manager
        const planets = SceneManager.planets;
        
        if (planets.length === 0) {
            console.warn('No planets available for vehicle placement');
            return;
        }
        
        // Place vehicles on planets
        this.createVehiclesForPlanet(planets[0], true); // Main planet
        
        if (planets.length > 1) {
            this.createVehiclesForPlanet(planets[1], false); // Secondary planet
        }
        
        console.log(`Created ${this.vehicles.length} vehicles on planets`);
    }
    
    // Helper method to create vehicles for a specific planet
    static createVehiclesForPlanet(planet, isMainPlanet) {
        // Calculate appropriate height offsets based on planet size
        const carHeightOffset = planet.radius * 0.02; // 2% of planet radius
        const planeHeightOffset = planet.radius * 0.05; // 5% of planet radius
        
        // Create vehicles with positions appropriate for this planet
        if (isMainPlanet) {
            // Main planet gets more vehicles
            const car1 = new Car(new Vector3());
            car1.placeOnPlanet(planet, 10, 20, carHeightOffset);
            
            const car2 = new Car(new Vector3());
            car2.placeOnPlanet(planet, -15, 70, carHeightOffset);
            
            const car3 = new Car(new Vector3());
            car3.placeOnPlanet(planet, 30, -45, carHeightOffset);
            
            const plane1 = new Airplane(new Vector3());
            plane1.placeOnPlanet(planet, 5, 110, planeHeightOffset);
            
            const plane2 = new Airplane(new Vector3());
            plane2.placeOnPlanet(planet, -25, -130, planeHeightOffset);
            
            // Add to scene and tracking array
            Engine.scene.add(car1.mesh, car2.mesh, car3.mesh, plane1.mesh, plane2.mesh);
            this.vehicles.push(car1, car2, car3, plane1, plane2);
        } else {
            // Secondary planet gets fewer vehicles
            const car = new Car(new Vector3());
            car.placeOnPlanet(planet, 5, 60, carHeightOffset);
            
            const plane = new Airplane(new Vector3());
            plane.placeOnPlanet(planet, -10, -45, planeHeightOffset);
            
            // Add to scene and tracking array
            Engine.scene.add(car.mesh, plane.mesh);
            this.vehicles.push(car, plane);
        }
    }
    
    static update(playerPosition) {
        // Update all unoccupied vehicles
        for (const vehicle of this.vehicles) {
            if (!vehicle.occupied) {
                vehicle.update();
            }
        }
        
        // Handle occupied vehicle - apply velocity from player physics
        if (this.currentVehicle && this.currentVehicle.player) {
            // Player handle now moves the vehicle - no need to update position
            // Just copy player velocity to vehicle for reference
            this.currentVehicle.velocity.copy(this.currentVehicle.player.velocity);
        }
        
        // Find nearest vehicle within interaction range
        const maxInteractDistance = 35; // Even larger for easier testing
        let closest = null;
        let closestDistance = maxInteractDistance;
        
        for (const vehicle of this.vehicles) {
            if (vehicle === this.currentVehicle) continue;
            
            const distance = playerPosition.distanceTo(vehicle.mesh.position);
            if (distance < closestDistance) {
                closest = vehicle;
                closestDistance = distance;
            }
        }
        
        this.nearbyVehicle = closest;
        
        // Debug info for nearby vehicles - less verbose
        if (closest && Math.random() < 0.01) { // Only log occasionally
            console.log(`Vehicle nearby at distance: ${closestDistance.toFixed(2)}`);
        }
    }
    
    static enterVehicle(player) {
        if (this.nearbyVehicle && !this.nearbyVehicle.occupied) {
            console.log("Entering vehicle");
            
            // Store the current vehicle
            this.currentVehicle = this.nearbyVehicle;
            this.currentVehicle.occupied = true;
            
            // Save player's original position and rotation
            player.lastPosition = player.position.clone();
            player.lastQuaternion = player.handle.quaternion.clone();
            
            // Hide player mesh
            player.mesh.visible = false;
            
            // Store vehicle's original parent and position
            this.currentVehicle.originalPosition = this.currentVehicle.mesh.position.clone();
            this.currentVehicle.originalParent = this.currentVehicle.mesh.parent;
            
            // Detach vehicle from scene
            if (this.currentVehicle.mesh.parent) {
                this.currentVehicle.mesh.parent.remove(this.currentVehicle.mesh);
            }
            
            // Copy vehicle position/rotation to player handle
            player.handle.position.copy(this.currentVehicle.mesh.position);
            
            // Attach vehicle to player handle
            player.handle.add(this.currentVehicle.mesh);
            
            // Reset vehicle mesh position relative to player handle
            this.currentVehicle.mesh.position.set(0, 0, 0);
            
            // Transfer vehicle velocity to player
            player.velocity.copy(this.currentVehicle.velocity);
            
            // Save reference to player for this vehicle
            this.currentVehicle.player = player;
            
            return this.currentVehicle.controller;
        }
        return null;
    }
    
    static exitVehicle(player) {
        if (this.currentVehicle) {
            console.log("Exiting vehicle");
            const vehicle = this.currentVehicle;
            
            // Get vehicle's world position before detaching
            const worldPos = new Vector3();
            const worldQuat = new Quaternion();
            vehicle.mesh.getWorldPosition(worldPos);
            vehicle.mesh.getWorldQuaternion(worldQuat);
            
            // First detach camera from vehicle
            if (Engine.camera.parent === vehicle.mesh) {
                const cameraWorldPos = new Vector3();
                const cameraWorldQuat = new Quaternion();
                Engine.camera.getWorldPosition(cameraWorldPos);
                Engine.camera.getWorldQuaternion(cameraWorldQuat);
                
                Engine.camera.parent.remove(Engine.camera);
                Engine.scene.add(Engine.camera);
                Engine.camera.position.copy(cameraWorldPos);
                Engine.camera.quaternion.copy(cameraWorldQuat);
            }
            
            // Detach vehicle from player handle
            player.handle.remove(vehicle.mesh);
            
            // Add vehicle back to scene
            Engine.scene.add(vehicle.mesh);
            
            // Restore vehicle position and rotation
            vehicle.mesh.position.copy(worldPos);
            vehicle.mesh.quaternion.copy(worldQuat);
            
            // Transfer player velocity to vehicle
            vehicle.velocity.copy(player.velocity);
            
            // Position player behind the vehicle
            const vehicleForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
            player.position.copy(worldPos).add(vehicleForward.multiplyScalar(-10));
            player.handle.position.copy(player.position);
            
            // Make player visible again
            player.mesh.visible = true;
            
            // Reset vehicle state
            this.currentVehicle.occupied = false;
            this.currentVehicle.player = null;
            this.currentVehicle = null;
            
            return true;
        }
        return false;
    }
}
