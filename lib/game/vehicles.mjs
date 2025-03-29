import { 
    CylinderGeometry, 
    MeshBasicMaterial, 
    Mesh, 
    Vector3, 
    Quaternion 
} from 'three';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';
import ObjectManager from './object.mjs';

export default class VehicleManager {
    // Array of all vehicles in the scene
    static vehicles = [];
    static currentVehicle = null;

    // Create vehicles scattered across planet surfaces
    static createPlanetVehicles() {
        // Create vehicles on each planet
        SceneManager.planets.forEach(planet => {
            // Create 1-3 vehicles per planet
            const numVehicles = 1 + Math.floor(Math.random() * 3);
            
            for (let i = 0; i < numVehicles; i++) {
                // Random position on planet
                const latitude = Math.random() * 180 - 90;
                const longitude = Math.random() * 360 - 180;
                
                // Create the vehicle
                this.createVehicle(planet, latitude, longitude);
            }
        });
    }
    
    // Create a single vehicle on a planet at the specified latitude and longitude
    static createVehicle(planet, latitude, longitude) {
        const planetRadius = planet.radius;
        
        // Create a simple cylinder for the vehicle body
        const height = planetRadius * 0.05; // 5% of planet radius
        const radius = planetRadius * 0.04; // 4% of planet radius
        
        const geometry = new CylinderGeometry(radius, radius, height, 16);
        const material = new MeshBasicMaterial({ 
            color: 0x44aaff, 
            wireframe: true 
        });
        
        const vehicle = new Mesh(geometry, material);
        
        // Position slightly above surface
        const heightOffset = height / 2;
        SceneManager.positionObjectOnPlanet(
            vehicle,
            planet,
            latitude,
            longitude,
            heightOffset
        );
        
        // Add to scene
        Engine.scene.add(vehicle);
        
        // Create vehicle data object
        const vehicleData = {
            object: vehicle,
            planet: planet,
            latitude: latitude,
            longitude: longitude,
            player: null, // No player controlling it initially
            speed: 0
        };
        
        // Add collision box to vehicle
        vehicleData.aabb = ObjectManager.createCollisionBox(vehicle, radius * 2, height, radius * 2);
        
        // Add to vehicles array
        this.vehicles.push(vehicleData);
        
        // Add vehicle to planet's objects array for collision detection
        if (!planet.objects) {
            planet.objects = [];
        }
        
        planet.objects.push(vehicleData);
        
        return vehicleData;
    }
    
    // Enter/exit vehicle
    static toggleVehicle(player, vehicle) {
        if (this.currentVehicle && this.currentVehicle.player === player) {
            // Exit vehicle
            this.currentVehicle.player = null;
            this.currentVehicle = null;
            return false; // No longer in vehicle
        } else if (!vehicle.player) {
            // Enter vehicle
            vehicle.player = player;
            this.currentVehicle = vehicle;
            return true; // Now in vehicle
        }
        return false;
    }

    // Add update method that's called from control.mjs
    static update() {
        // Skip if no vehicle is currently being controlled
        if (!this.currentVehicle) return;
        
        // Update vehicle position to match player position
        if (this.currentVehicle.player) {
            // The vehicle should be at the player's position
            this.currentVehicle.object.position.copy(this.currentVehicle.player.position);
            
            // The vehicle should orient according to the surface normal and player aim
            if (this.currentVehicle.player.aim) {
                this.currentVehicle.object.quaternion.copy(this.currentVehicle.player.aim);
            }
            
            // Update the vehicle's matrix world for collision detection
            this.currentVehicle.object.updateMatrixWorld();
        }
    }
}
