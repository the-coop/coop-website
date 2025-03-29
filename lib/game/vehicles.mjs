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
        // Car-specific properties
        this.groundSpeed = 0.8;
        this.turnSpeed = 0.05;
        
        // Make car more distinct with wider body
        this.mesh.scale.x = 1.2;
        this.mesh.scale.y = 0.6;
        this.mesh.scale.z = 2.2;
    }
    
    update() {
        if (this.occupied) {
            // Car-specific movement logic
            this.mesh.position.add(this.velocity);
            this.velocity.multiplyScalar(0.92); // Friction
        }
    }
}

export class Airplane extends Vehicle {
    constructor(position) {
        super(position, 0xcc6633, AirplaneController);
        // Make airplane mesh wider (wings)
        this.mesh.scale.x = 3;
        this.mesh.scale.y = 0.3;
        this.mesh.scale.z = 2.0;
        // Airplane-specific properties
        this.flyingSpeed = 1.2;
        this.liftRate = 0.05;
    }
    
    update() {
        if (this.occupied) {
            // Airplane-specific movement logic
            this.mesh.position.add(this.velocity);
            this.velocity.multiplyScalar(0.98); // Air resistance
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
        
        // Place cars and planes on the first planet at different locations
        const mainPlanet = planets[0];
        
        // Create cars at various locations
        const car1 = new Car(new Vector3());
        car1.placeOnPlanet(mainPlanet, 10, 20, 2);
        
        const car2 = new Car(new Vector3());
        car2.placeOnPlanet(mainPlanet, -15, 70, 2);
        
        const car3 = new Car(new Vector3());
        car3.placeOnPlanet(mainPlanet, 30, -45, 2);
        
        // Create airplanes at different locations
        const plane1 = new Airplane(new Vector3());
        plane1.placeOnPlanet(mainPlanet, 5, 110, 5); 
        
        const plane2 = new Airplane(new Vector3());
        plane2.placeOnPlanet(mainPlanet, -25, -130, 5);
        
        // If we have a second planet, place vehicles there too
        if (planets.length > 1) {
            const secondaryPlanet = planets[1];
            
            const car4 = new Car(new Vector3());
            car4.placeOnPlanet(secondaryPlanet, 5, 60, 2);
            
            const plane3 = new Airplane(new Vector3());
            plane3.placeOnPlanet(secondaryPlanet, -10, -45, 5);
            
            // Add to vehicle array
            this.vehicles.push(car4, plane3);
        }
        
        // Add all vehicles to the scene and our tracking array
        Engine.scene.add(car1.mesh, car2.mesh, car3.mesh, plane1.mesh, plane2.mesh);
        this.vehicles.push(car1, car2, car3, plane1, plane2);
    }
    
    static update(playerPosition) {
        // Update all vehicles
        for (const vehicle of this.vehicles) {
            vehicle.update();
        }
        
        // Find nearest vehicle within interaction range
        const maxInteractDistance = 2;
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
            // Position player next to vehicle
            player.mesh.position.copy(this.currentVehicle.mesh.position);
            
            // If on a planet, align player with surface
            if (this.currentVehicle.planet) {
                // Calculate position slightly away from vehicle along surface tangent
                const planetCenter = this.currentVehicle.planet.object.position;
                const surfaceNormal = new Vector3().subVectors(this.currentVehicle.mesh.position, planetCenter).normalize();
                
                // Get a vector perpendicular to normal for offset
                const tangent = new Vector3(1, 0, 0).cross(surfaceNormal).normalize();
                if (tangent.lengthSq() < 0.1) {
                    tangent.set(0, 0, 1).cross(surfaceNormal).normalize();
                }
                
                // Offset along the tangent
                player.mesh.position.add(tangent.multiplyScalar(2));
            } else {
                // If not on a planet, just offset to the side
                player.mesh.position.add(new Vector3(1.5, 0, 0));
            }
            
            player.mesh.visible = true;
            this.currentVehicle.occupied = false;
            this.currentVehicle = null;
            return true;
        }
        return false;
    }
}
