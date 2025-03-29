import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import { Vector3, Box3 } from 'three'; // Ensure Box3 is imported

// Lower values create "moon-like" gravity, higher values "earth-like"
const GRAVITY_CONSTANT = 0.5;

// Handles gravity and ground detection for spherical planets
// SOI (Sphere of Influence) determines which planet affects the player
export default class Physics {

    // Finds the planet with strongest gravitational influence
    // Distance is scaled by planet radius to handle different sized planets
    static calculateSOI(position) {
        let closestPlanet = SceneManager.planets[0];
        let closestDistance = Infinity;

        // Check for the closest planet for gravitation influence.
        SceneManager.planets.map(planet => {
            // Get planet's radius for scaling
            const radius = planet.radius;

            // Raw euclidean distance from player to planet center
            // Uses Three.js distanceTo() which computes sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-x1)^2)
            const distance = position.distanceTo(planet.object.position);

            // Scale distance by planet radius to normalize influence
            // This makes bigger planets have stronger gravitational reach:
            // - A planet with R=2 and D=10 has scaledDistance = 5
            // - A planet with R=5 and D=10 has scaledDistance = 2
            // Therefore larger planets "win" the SOI check at greater distances
            const scaledDistance = distance / radius;

            // Track the planet with smallest scaled distance
            // This effectively finds the planet with strongest gravitational influence
            if (scaledDistance < closestDistance) {
                closestDistance = scaledDistance;
                closestPlanet = planet;
            }
        });

        return closestPlanet;
    };

    // Updates player physics:
    static update() {
        // Update player physics
        PlayersManager.players.map(player => {
            // Update positions
            player.position.add(player.velocity);
            player.handle.position.copy(player.position);
            player.soi = this.calculateSOI(player.position);

            // Check for collisions with planet objects
            if (player.soi.objects && player.soi.objects.length > 0) {
                const collide = ObjectManager.checkCollisions(player, player.soi.objects, 1);
                if (collide) {
                    const { collisionNormal, collisionPosition, closestObject, closestTime } = collide;
                    const restitution = 0;
                    const remainingTime = 1 - closestTime;

                    // Calculate reflection vector
                    const veldirection = player.velocity.clone().normalize();
                    const inDirection = veldirection.dot(collisionNormal) * (1 + restitution);
                    
                    // Remove velocity component in the direction of the normal
                    const velocityAdjustment = collisionNormal.clone().multiplyScalar(inDirection);
                    player.velocity.sub(velocityAdjustment);

                    // Move player to collision position plus remaining movement
                    const remainingMovement = player.velocity.clone().multiplyScalar(remainingTime);
                    player.position.copy(collisionPosition).add(remainingMovement);
                    player.handle.position.copy(player.position);
                }
            }

            // Calculate planet properties
            const planetRadius = player.soi.radius;
            const collisionDistance = planetRadius + 0.5;
            const soi = player.soi.object;
            const toPlayer = player.position.clone().sub(soi.position);
            const distance = toPlayer.length();
            toPlayer.normalize();

            // Calculate surface position once for all checks
            const surfacePosition = soi.position.clone()
                .add(toPlayer.clone().multiplyScalar(collisionDistance));

            // Apply gravity
            const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
            player.velocity.add(toPlayer.clone().multiplyScalar(-gravity));

            // Calculate how fast we are falling
            const downwardSpeed = player.velocity.dot(toPlayer);
            player.surfaceNormal = toPlayer.clone();

            const canLiftoff = (!player.falling && downwardSpeed < 0);
            const onPlanet = distance <= collisionDistance;

            // Handle ground contact
            if (onPlanet || canLiftoff) {
                player.position.copy(surfacePosition);
                player.handle.position.copy(surfacePosition);

                // If we're in a vehicle, don't call landing/liftoff on the controller
                const inVehicle = VehicleManager.currentVehicle &&
                    VehicleManager.currentVehicle.player === player;

                if (player.falling && !inVehicle) {
                    ControlManager.controller?.landing?.(toPlayer);
                }

                player.falling = false;

                // Apply ground friction (unless in a vehicle - controllers handle their own friction)
                if (!inVehicle) {
                    player.velocity.multiplyScalar(1 - player.soi.CoF); // Ground friction
                }
            } else {
                // Check if player left ground
                if (!player.falling) {
                    const inVehicle = VehicleManager.currentVehicle &&
                        VehicleManager.currentVehicle.player === player;

                    if (!inVehicle) {
                        ControlManager.controller?.liftoff?.(toPlayer);
                    }
                }

                player.falling = true;
            }
        });

        // Process all collidable objects only once
        for (const collidable of ObjectManager.collidableObjects) {
            // Skip inactive objects
            if (!collidable.active) continue;
            
            // Skip static objects (buildings, walls)
            if (collidable.isStatic) continue;
            
            // Skip players (already processed)
            if (collidable.type === 'player') continue;
            
            // Handle vehicles specially
            if (collidable.type === 'vehicle') {
                const vehicle = collidable.object;
                
                // IMPORTANT: Only apply physics to vehicles that aren't player-controlled
                // Prevents double physics processing with conflicting results
                if (!vehicle.userData.isOccupied || vehicle !== VehicleManager.currentVehicle) {
                    this.applyVehiclePhysics(vehicle);
                }
            } 
            // Handle other dynamic objects
            else {
                this.applyGravityToObject(collidable.object);
            }
        }
    };

    // Apply gravity to a dynamic object
    static applyGravityToObject(object) {
        // Skip if object doesn't have userData for physics or already has a planet
        if (!object.userData) {
            object.userData = {};
        }
        
        // Initialize velocity if needed
        if (!object.userData.velocity) {
            object.userData.velocity = new Vector3();
        }
        
        // Get or calculate planet influence
        if (!object.userData.planet) {
            object.userData.planet = this.calculateSOI(object.position);
        }
        
        const planet = object.userData.planet;
        if (!planet) return;
        
        // Calculate planet properties
        const planetCenter = planet.object.position;
        const toObject = object.position.clone().sub(planetCenter);
        const distance = toObject.length();
        const surfaceDistance = distance - planet.radius;
        toObject.normalize();
        
        // Apply gravity force
        const gravity = GRAVITY_CONSTANT / Math.pow(distance / planet.radius, 2);
        object.userData.velocity.addScaledVector(toObject, -gravity);
        
        // Update position
        object.position.add(object.userData.velocity);
        
        // Check for ground contact
        const collisionDistance = planet.radius + 1.0; // Adjust based on object size
        if (distance <= collisionDistance) {
            // Project to surface
            object.position.copy(planetCenter).addScaledVector(toObject, collisionDistance);
            
            // Apply friction
            object.userData.velocity.multiplyScalar(1 - (planet.CoF || 0.2));
            
            // Reflect vertical component of velocity (bounce)
            const downSpeed = object.userData.velocity.dot(toObject);
            if (downSpeed < 0) {
                // Only reflect if moving toward planet
                const restitution = 0.3; // Bounciness - adjust as needed
                object.userData.velocity.addScaledVector(toObject, -downSpeed * (1 + restitution));
            }
        }
    };

    // Apply complete physics simulation to a vehicle (gravity, landing, etc)
    static applyVehiclePhysics(vehicle) {
        if (!vehicle || !vehicle.userData) return;
        
        try {
            // Initialize velocity if needed
            if (!vehicle.userData.velocity) {
                vehicle.userData.velocity = new Vector3(0, -0.05, 0);
            }
            
            // Get or calculate the sphere of influence (planet)
            if (!vehicle.userData.planet) {
                vehicle.userData.planet = this.calculateSOI(vehicle.position);
            }
            const planet = vehicle.userData.planet;
            if (!planet) return;
            
            // IMPORTANT: Store original velocity magnitude for stability check
            const originalVelocityMagnitude = vehicle.userData.velocity.length();
            
            // Calculate gravity-related values
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // Determine height above surface for collision detection
            const heightOffset = vehicle.userData.type === 'car' ? 3 : 2;
            const collisionDistance = planet.radius + heightOffset;
            const onSurface = distance <= collisionDistance;
            const wasOnSurface = vehicle.userData.onSurface === true;
            
            // Only apply full physics processing once - avoid redundant operations
            const isStationaryVehicle = !vehicle.userData.isOccupied && 
                (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1);
            
            // Quick stabilization for almost-stationary vehicles to prevent oscillation
            if (isStationaryVehicle && onSurface) {
                // Hard reset velocity if very close to zero
                if (vehicle.userData.velocity.lengthSq() < 0.001) {
                    vehicle.userData.velocity.set(0, 0, 0);
                    vehicle.userData.speed = 0;
                } else {
                    // Apply very strong damping
                    vehicle.userData.velocity.multiplyScalar(0.3); // Even stronger damping (was 0.5)
                }
                
                // Force strong alignment to planet
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.95);
                vehicle.userData.onSurface = true;
                
                // Skip further physics processing for completely stationary vehicles
                if (vehicle.userData.velocity.lengthSq() < 0.0001) {
                    // Just make sure it stays exactly on the ground
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                    
                    // Update collision bounds
                    if (vehicle.collidable) {
                        ObjectManager.updateCollidableBounds(vehicle);
                    }
                    return;
                }
            }

            // For moving vehicles, apply normal physics...
            
            // AIRPLANES
            if (vehicle.userData.type === 'airplane' && vehicle.userData.altitude > 0) {
                // Reduced gravity for airplanes in flight
                const airGravity = GRAVITY_CONSTANT * 0.2;
                vehicle.userData.velocity.addScaledVector(surfaceNormal, -airGravity);
                
                // Gradually reduce altitude when not player-controlled
                if (!vehicle.userData.isOccupied) {
                    vehicle.userData.altitude -= 0.2;
                    if (vehicle.userData.altitude < 0) vehicle.userData.altitude = 0;
                }
                
                vehicle.userData.onSurface = false;
            } 
            // GROUND VEHICLES (CARS, LANDED PLANES)
            else {
                // Apply gravity force
                const gravity = GRAVITY_CONSTANT * 1.2;
                vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity);
                
                // Apply stronger velocity caps to prevent high-speed oscillations
                if (vehicle.userData.velocity.lengthSq() > 25) {
                    vehicle.userData.velocity.normalize().multiplyScalar(5);
                }
                
                // Handle surface contact
                if (onSurface) {
                    // Position on surface more precisely - avoid clipping through
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                    
                    // Handle landing event
                    if (!wasOnSurface) {
                        this.vehicleLanding(vehicle, surfaceNormal);
                    }
                    
                    // Apply friction - more for static vehicles, less for moving ones
                    const frictionFactor = vehicle.userData.speed > 0.1 ? 
                        (planet.CoF || 0.15) : (planet.CoF * 5 || 0.8);
                    
                    vehicle.userData.velocity.multiplyScalar(1 - frictionFactor);
                    
                    // Check for sudden velocity increases (potential instability)
                    const newVelocityMagnitude = vehicle.userData.velocity.length();
                    if (newVelocityMagnitude > originalVelocityMagnitude * 1.5 && newVelocityMagnitude > 0.1) {
                        console.debug(`Velocity spike detected on vehicle ${vehicle.userData.name}: ${originalVelocityMagnitude.toFixed(2)} → ${newVelocityMagnitude.toFixed(2)}`);
                        // Apply strong damping to prevent oscillation
                        vehicle.userData.velocity.multiplyScalar(0.5);
                    }
                    
                    // Cancel any velocity into the planet surface
                    const downSpeed = vehicle.userData.velocity.dot(surfaceNormal);
                    if (downSpeed < 0) {
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, -downSpeed);
                    }
                    
                    // More precise surface alignment
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 
                        isStationaryVehicle ? 0.9 : 0.5);
                    
                    vehicle.userData.onSurface = true;
                } else {
                    // Vehicle is in the air
                    vehicle.userData.onSurface = false;
                    
                    // Call liftoff if just left the ground
                    if (wasOnSurface) {
                        this.vehicleLiftoff(vehicle, surfaceNormal);
                    }
                }
            }
            
            // Apply velocity to update position
            vehicle.position.add(vehicle.userData.velocity);
            
            // Update collision bounds
            if (vehicle.collidable) {
                ObjectManager.updateCollidableBounds(vehicle);
            }
            
        } catch (e) {
            console.error("Error in vehicle physics:", e);
        }
    }
    
    // Handle vehicle landing on a planet surface
    static vehicleLanding(vehicle, surfaceNormal) {
        if (!vehicle || !vehicle.userData) return;
        
        try {
            console.log(`Vehicle ${vehicle.userData.name} landed on surface`);
            
            // Different behavior based on vehicle type
            if (vehicle.userData.type === 'car') {
                // Force immediate alignment to surface
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 1.0);
                
                // FIX: Kill most of the velocity to prevent bounce
                vehicle.userData.velocity.multiplyScalar(0.1);
            } 
            else if (vehicle.userData.type === 'airplane') {
                // Kill speed on landing
                vehicle.userData.speed *= 0.3;
                
                // Force altitude to zero
                vehicle.userData.altitude = 0;
                
                // Strong alignment to surface
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.8);
                
                // FIX: Reduce velocity for more stable landing
                vehicle.userData.velocity.multiplyScalar(0.2);
            }
        } catch (e) {
            console.error("Error in vehicle landing:", e);
        }
    }
    
    // Handle vehicle lifting off from a planet surface
    static vehicleLiftoff(vehicle, surfaceNormal) {
        if (!vehicle || !vehicle.userData) return;
        
        // Add any liftoff effects or behavior here
        console.log(`Vehicle ${vehicle.userData.name} lifted off surface`);
        
        // Different behavior based on vehicle type
        if (vehicle.userData.type === 'airplane') {
            // Airplanes should properly start gaining altitude
            if (vehicle.userData.speed > 20) {
                vehicle.userData.altitude = 5; // Initial altitude boost
            }
        }
    }

};
