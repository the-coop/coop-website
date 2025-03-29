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

    // Make GRAVITY_CONSTANT export available
    static GRAVITY_CONSTANT = GRAVITY_CONSTANT;

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

    // Updates player physics, processes all collidable objects:
    static update() {
        // Update player physics
        PlayersManager.players.map(player => {
            // CRITICAL FIX: Skip physics for players in vehicles
            if (player.inVehicle) {
                // Make sure player position stays synced with vehicle
                if (VehicleManager.currentVehicle) {
                    // Keep player at the same position as vehicle but not visible
                    player.position.copy(VehicleManager.currentVehicle.position);
                    player.handle.position.copy(VehicleManager.currentVehicle.position);
                }
                return; // Skip all other physics for this player
            }

            // Regular physics for players not in vehicles
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
                
                // CRITICAL FIX: Process physics for vehicles, giving player-controlled vehicles priority
                if (vehicle === VehicleManager.currentVehicle) {
                    // Handle player-controlled vehicle with high priority
                    this.applyVehiclePhysics(vehicle);
                } else {
                    // Regular AI vehicles
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
            
            // Calculate gravity-related values
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // Determine height above surface for collision detection
            const heightOffset = vehicle.userData.type === 'car' ? 3 : 2;
            const collisionDistance = planet.radius + heightOffset;
            
            // CRITICAL FIX: Handle falling vehicles differently from grounded ones
            const wasOnSurface = vehicle.userData.onSurface === true;
            const heightAboveSurface = distance - planet.radius;
            
            // Check if vehicle is close enough to surface to be considered "on surface"
            // But don't consider it on surface if it's marked as falling and still high up
            const onSurface = distance <= collisionDistance && 
                             !(vehicle.userData.falling === true && heightAboveSurface > heightOffset * 1.5);
            
            // CRITICAL FIX: Apply gravity to all vehicles regardless of state
            // Apply stronger gravity for dramatic effect
            const gravity = GRAVITY_CONSTANT * 1.2; // Increased gravity for more dramatic falls
            
            // Add gravity to velocity
            vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity * (1/60));
            
            // CRITICAL FIX: Handle vehicles that are currently falling
            if (!onSurface || vehicle.userData.falling) {
                // Apply velocity to position for falling vehicles
                vehicle.position.add(vehicle.userData.velocity);
                
                // Flag as falling
                vehicle.userData.falling = true;
                vehicle.userData.onSurface = false;
                
                // Log for dramatic falls (only high-altitude ones to avoid spam)
                if (heightAboveSurface > 20 && Math.random() < 0.05) {
                    console.log(`${vehicle.userData.name} falling from height ${heightAboveSurface.toFixed(0)}!`);
                }
                
                // Check if vehicle has hit the ground
                if (distance <= collisionDistance + 1) {
                    // Handle landing
                    this.vehicleLanding(vehicle, surfaceNormal);
                    vehicle.userData.falling = false;
                    vehicle.userData.onSurface = true;
                }
            }
            // Handle all the rest of the vehicle physics code for when it's on the surface
            else if (onSurface) {
                // If we've just landed, mark as on surface
                if (vehicle.userData.falling) {
                    // Handle landing event
                    this.vehicleLanding(vehicle, surfaceNormal);
                    vehicle.userData.falling = false;
                }
                
                vehicle.userData.onSurface = true;
                
                // Special handling for cars to prevent wobbling
                if (vehicle.userData.type === 'car') {
                    // CRITICAL FIX: Force cars to exact height on planet surface
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                    
                    // CRITICAL FIX: Apply stronger alignment for cars
                    const carSlerpFactor = wasOnSurface ? 1.0 : 0.5; // Increased from 0.3
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, carSlerpFactor);
                    
                    // CRITICAL FIX: For stationary cars, completely kill all velocity components
                    if (!vehicle.userData.isOccupied && 
                        (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1)) {
                        vehicle.userData.velocity.set(0, 0, 0);
                        
                        // Zero out any remaining speed for completely stationary cars
                        if (Math.abs(vehicle.userData.speed) < 0.1) {
                            vehicle.userData.speed = 0;
                        }
                    }
                    
                    // Process normal physics if car is moving
                    if (Math.abs(vehicle.userData.speed) > 0.1) {
                        // Apply surface movement based on speed
                        if (Math.abs(vehicle.userData.speed) > 0.01) {
                            // Regular movement code
                            const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                            const projectedForward = forward.clone().projectOnPlane(surfaceNormal).normalize();
                            const movement = projectedForward.multiplyScalar(vehicle.userData.speed * (1/60) * 3);
                            
                            vehicle.position.add(movement);
                            
                            // CRITICAL FIX: Additional realignment after movement to prevent drift
                            vehicle.position.copy(planetCenter).addScaledVector(
                                vehicle.position.clone().sub(planetCenter).normalize(), 
                                collisionDistance
                            );
                        }
                        
                        // CRITICAL FIX: Stronger friction for cars to reduce bouncing
                        const frictionFactor = 0.3; // Increased from 0.15
                        vehicle.userData.velocity.multiplyScalar(1 - frictionFactor);
                        
                        // CRITICAL FIX: More aggressively cancel gravity-aligned velocity
                        const downSpeed = vehicle.userData.velocity.dot(surfaceNormal);
                        if (downSpeed < 0) {
                            vehicle.userData.velocity.addScaledVector(surfaceNormal, -downSpeed * 1.2);
                        }
                    }
                    
                    vehicle.userData.onSurface = true;
                    
                    // Force update collision bounds
                    if (vehicle.collidable) {
                        ObjectManager.updateCollidableBounds(vehicle);
                    }
                    
                    // Early return for cars to avoid applying other physics
                    return;
                }
                
                // Handle stationary vehicles (primarily for airplanes on ground)
                if (!vehicle.userData.isOccupied && onSurface) {
                    // Snap to surface and zero out velocity
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                    vehicle.userData.velocity.set(0, 0, 0);
                    vehicle.userData.speed = 0;
                    vehicle.userData.onSurface = true;
                    
                    // Strong alignment to prevent any wobble
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 1.0);
                    
                    // Update collision bounds
                    if (vehicle.collidable) {
                        ObjectManager.updateCollidableBounds(vehicle);
                    }
                    return;
                }
                
                // CRITICAL FIX: Special handling for player-controlled vehicles
                const playerControlled = vehicle === VehicleManager.currentVehicle;
                if (playerControlled) {
                    // Apply movement for player controlled vehicles with higher responsiveness
                    if (Math.abs(vehicle.userData.speed) > 0.01) {
                        // Get vehicle's forward direction
                        const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                        
                        // Create direct movement based on vehicle type
                        if (vehicle.userData.type === 'car' && onSurface) {
                            // Car movement on surface - needs projection
                            const projectedForward = forward.clone().projectOnPlane(surfaceNormal).normalize();
                            const movement = projectedForward.multiplyScalar(vehicle.userData.speed * (1/60) * 5); // Increased multiplier
                            
                            // Apply movement directly
                            vehicle.position.add(movement);
                            console.log(`Car moving: speed=${vehicle.userData.speed.toFixed(2)}, distance=${movement.length().toFixed(2)}`);
                            
                            // Ensure car stays on surface
                            vehicle.position.copy(planetCenter).addScaledVector(
                                vehicle.position.clone().sub(planetCenter).normalize(),
                                collisionDistance
                            );
                        }
                        else if (vehicle.userData.type === 'airplane') {
                            if (vehicle.userData.altitude > 0) {
                                // Direct movement for airplanes in flight
                                const movement = forward.clone().multiplyScalar(vehicle.userData.speed * (1/60) * 5);
                                vehicle.position.add(movement);
                                console.log(`Airplane moving: speed=${vehicle.userData.speed.toFixed(2)}, distance=${movement.length().toFixed(2)}`);
                            }
                            else if (onSurface) {
                                // Taxiing on ground
                                const projectedForward = forward.clone().projectOnPlane(surfaceNormal).normalize();
                                const movement = projectedForward.multiplyScalar(vehicle.userData.speed * (1/60) * 5);
                                vehicle.position.add(movement);
                                
                                // Maintain correct height
                                vehicle.position.copy(planetCenter).addScaledVector(
                                    vehicle.position.clone().sub(planetCenter).normalize(),
                                    collisionDistance
                                );
                            }
                        }
                    }
                    
                    // Use stronger alignment for player-controlled vehicles
                    const alignFactor = vehicle.userData.type === 'car' ? 1.0 : 0.5;
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, alignFactor);
                    
                    // Apply minimal gravity for player-controlled vehicles
                    vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity * (1/60) * 0.5);
                }
                else {
                    // Regular handling for AI vehicles...
                    if (vehicle.userData.type === 'airplane') {
                        if (vehicle.userData.altitude > 0) {
                            // Handle airplane in flight
                            if (Math.abs(vehicle.userData.speed) > 0.01) {
                                const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                                const movement = forward.clone().multiplyScalar(vehicle.userData.speed * (1/60) * 3);
                                
                                vehicle.position.add(movement);
                                
                                // Log movement for debugging
                                if (vehicle.userData.isOccupied) {
                                    console.log(`Airplane movement: ${movement.length().toFixed(2)} units at altitude ${vehicle.userData.altitude.toFixed(2)}`);
                                }
                            }
                            
                            // Gradually reduce altitude when not player-controlled
                            if (!vehicle.userData.isOccupied) {
                                vehicle.userData.altitude -= 0.2 * (1/60);
                                if (vehicle.userData.altitude < 0) vehicle.userData.altitude = 0;
                            }
                            
                            vehicle.userData.onSurface = false;
                        }
                        else if (onSurface) {
                            // Handle airplane on ground (like car)
                            vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                            
                            // Apply taxiing movement
                            if (Math.abs(vehicle.userData.speed) > 0.01) {
                                const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                                const projectedForward = forward.clone().projectOnPlane(surfaceNormal).normalize();
                                const movement = projectedForward.multiplyScalar(vehicle.userData.speed * (1/60) * 3);
                                
                                vehicle.position.add(movement);
                                
                                // Maintain height above ground
                                const newToVehicle = vehicle.position.clone().sub(planetCenter);
                                newToVehicle.normalize();
                                vehicle.position.copy(planetCenter).addScaledVector(newToVehicle, collisionDistance);
                            }
                            
                            // Handle landing event
                            if (!wasOnSurface) {
                                this.vehicleLanding(vehicle, surfaceNormal);
                            }
                            
                            vehicle.userData.onSurface = true;
                            
                            // Apply friction to slow down vehicle
                            const frictionFactor = vehicle.userData.speed > 0.1 ? 0.15 : 0.8;
                            vehicle.userData.velocity.multiplyScalar(1 - frictionFactor);
                            
                            // Align to surface
                            VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.3);
                        } else {
                            vehicle.userData.onSurface = false;
                            
                            // Call liftoff if just left ground
                            if (wasOnSurface) {
                                this.vehicleLiftoff(vehicle, surfaceNormal);
                            }
                            
                            // Apply velocity to position
                            vehicle.position.add(vehicle.userData.velocity);
                        }
                    }
                }
            }
            
            // Cap velocity to prevent instability
            const maxVelocity = 10; // Increased from 5 for more dramatic falls
            if (vehicle.userData.velocity.lengthSq() > maxVelocity * maxVelocity) {
                vehicle.userData.velocity.normalize().multiplyScalar(maxVelocity);
            }
            
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
            // CRITICAL FIX: More dramatic landing effects
            const fallingSpeed = vehicle.userData.velocity.dot(surfaceNormal.clone().negate());
            
            console.log(`Vehicle ${vehicle.userData.name} landed on surface with impact speed: ${fallingSpeed.toFixed(2)}`);
            
            // Show crash notification for high-speed impacts
            if (fallingSpeed > 2 && typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify(`${vehicle.userData.name} crashed with impact speed: ${fallingSpeed.toFixed(1)}!`);
            }
            
            // Different behavior based on vehicle type
            if (vehicle.userData.type === 'car') {
                // Force immediate alignment to surface
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 1.0);
                
                // Kill most of the velocity but keep some horizontal momentum
                const horizontalVelocity = vehicle.userData.velocity.clone().projectOnPlane(surfaceNormal);
                vehicle.userData.velocity.copy(horizontalVelocity.multiplyScalar(0.6)); // 60% of horizontal speed
            } 
            else if (vehicle.userData.type === 'airplane') {
                // Kill speed on landing
                vehicle.userData.speed *= 0.3;
                
                // Force altitude to zero
                vehicle.userData.altitude = 0;
                
                // Strong alignment to surface
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.8);
                
                // Reduce velocity for more stable landing but keep some horizontal momentum
                const horizontalVelocity = vehicle.userData.velocity.clone().projectOnPlane(surfaceNormal);
                vehicle.userData.velocity.copy(horizontalVelocity.multiplyScalar(0.5)); // 50% of horizontal speed
            }
            
            // CRITICAL FIX: Clear falling state
            vehicle.userData.falling = false;
            vehicle.userData.onSurface = true;
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
