import { BoxGeometry, MeshStandardMaterial, Mesh, Vector3 } from 'three';
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
        // Update all vehicles
        for (const vehicle of this.vehicles) {
            vehicle.update();
        }
        
        // Find nearest vehicle within interaction range
        // Increase interaction distance to make it easier to find vehicles
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
            this.currentVehicle = this.nearbyVehicle;
            this.currentVehicle.occupied = true;
            player.mesh.visible = false;
            return this.currentVehicle.controller;
        }
        return null;
    }
    
    static exitVehicle(player) {
        if (this.currentVehicle) {
            // Store reference to current vehicle for positioning
            const vehicle = this.currentVehicle;
            
            // Reset current vehicle before positioning to avoid conflicts
            this.currentVehicle.occupied = false;
            this.currentVehicle = null;
            
            // If on a planet, align player with surface
            if (vehicle.planet) {
                // Calculate position slightly away from vehicle along surface tangent
                const planetCenter = vehicle.planet.object.position;
                const surfaceNormal = new Vector3().subVectors(vehicle.mesh.position, planetCenter).normalize();
                
                // Get a vector perpendicular to normal for offset
                const tangent = new Vector3(1, 0, 0).cross(surfaceNormal).normalize();
                if (tangent.lengthSq() < 0.1) {
                    tangent.set(0, 0, 1).cross(surfaceNormal).normalize();
                }
                
                // Position player behind the vehicle (opposite to its forward direction)
                const vehicleForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
                const exitPosition = vehicle.mesh.position.clone().add(
                    vehicleForward.multiplyScalar(-10) // Position player 10 units behind vehicle
                );
                
                player.position.copy(exitPosition);
                player.handle.position.copy(exitPosition);
                
                // Set player's orientation to match the vehicle's orientation initially
                player.handle.quaternion.copy(vehicle.mesh.quaternion);
                player.aim.copy(vehicle.mesh.quaternion);
            } else {
                // If not on a planet, position player behind vehicle
                const vehicleForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.mesh.quaternion);
                const exitPosition = vehicle.mesh.position.clone().add(
                    vehicleForward.multiplyScalar(-10)
                );
                
                player.position.copy(exitPosition);
                player.handle.position.copy(exitPosition);
                
                // Set player's orientation to match the vehicle's orientation
                player.handle.quaternion.copy(vehicle.mesh.quaternion);
                player.aim.copy(vehicle.mesh.quaternion);
            }
            
            player.mesh.visible = true;
            return true;
        }
        return false;
    }
}
