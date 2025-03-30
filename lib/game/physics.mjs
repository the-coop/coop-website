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
            // CRITICAL FIX: Skip physics for players in vehicles and ensure invisibility
            if (player.inVehicle) {
                // Make sure player position stays synced with vehicle
                if (VehicleManager.currentVehicle) {
                    // Keep player at the same position as vehicle but not visible
                    player.position.copy(VehicleManager.currentVehicle.position);
                    
                    // CRITICAL FIX: Only update handle position if it's not the vehicle itself
                    // This prevents the weird spinning effect
                    if (player.handle !== VehicleManager.currentVehicle) {
                        player.handle.position.copy(VehicleManager.currentVehicle.position);
                    }
                    
                    // CRITICAL FIX: Make sure player's handle remains invisible
                    if (player.handle && player.handle !== VehicleManager.currentVehicle) {
                        player.handle.visible = false;
                        
                        // Also make sure the handle's children are invisible
                        player.handle.traverse(child => {
                            if (child !== player.handle) {
                                child.visible = false;
                            }
                        });
                    }
                    
                    // CRITICAL FIX: Mark player's object that it's in a vehicle to prevent collisions
                    if (player.handle && player.handle.userData) {
                        player.handle.userData.inVehicle = true;
                        player.handle.userData.currentVehicle = VehicleManager.currentVehicle;
                    }
                }
                return; // Skip all other physics for this player
            } else if (player.handle && player.handle.userData) {
                // Clear vehicle relationship when not in vehicle
                player.handle.userData.inVehicle = false;
                player.handle.userData.currentVehicle = null;
            }

            // CRITICAL FIX: Cap maximum player velocity to prevent tunneling
            const maxVelocity = 15;
            if (player.velocity.lengthSq() > maxVelocity * maxVelocity) {
                player.velocity.normalize().multiplyScalar(maxVelocity);
                console.log("Player velocity capped to prevent tunneling");
            }

            // CRITICAL FIX: Use velocity-based sub-stepping for fast-moving players
            const velocity = player.velocity.clone();
            const speed = velocity.length();
            
            // Determine how many sub-steps to take based on velocity
            const numSteps = speed > 5 ? Math.ceil(speed / 5) : 1;
            const subStep = 1.0 / numSteps;
            
            // Apply movement in smaller sub-steps to prevent tunneling
            for (let step = 0; step < numSteps; step++) {
                // Apply fraction of velocity for this sub-step
                const stepVelocity = velocity.clone().multiplyScalar(subStep);
                player.position.add(stepVelocity);
                player.handle.position.copy(player.position);
                player.soi = this.calculateSOI(player.position);
                
                // IMPROVED: Make sure handle's userData is always updated with latest planet
                if (player.handle.userData) {
                    player.handle.userData.planet = player.soi;
                }

                // Check for collisions with planet objects in each sub-step
                if (player.soi.objects && player.soi.objects.length > 0) {
                    const collide = ObjectManager.checkCollisions(player, player.soi.objects, subStep);
                    if (collide) {
                        const { collisionNormal, collisionPosition, closestObject, closestTime } = collide;
                        const restitution = 0;
                        const remainingTime = subStep - closestTime;

                        // Calculate reflection vector
                        const velDirection = stepVelocity.clone().normalize();
                        const inDirection = velDirection.dot(collisionNormal) * (1 + restitution);
                        
                        // Remove velocity component in the direction of the normal
                        const velocityAdjustment = collisionNormal.clone().multiplyScalar(inDirection);
                        
                        // CRITICAL FIX: Update both step velocity and overall velocity
                        stepVelocity.sub(velocityAdjustment);
                        player.velocity.sub(velocityAdjustment);

                        // Move player to collision position plus remaining movement
                        const remainingMovement = stepVelocity.clone().multiplyScalar(remainingTime / closestTime);
                        player.position.copy(collisionPosition).add(remainingMovement);
                        player.handle.position.copy(player.position);
                        
                        // CRITICAL FIX: Apply sliding along surfaces for smoother collision response
                        const friction = 0.8; // Sliding friction coefficient
                        player.velocity.multiplyScalar(friction);
                        
                        // No need to continue with more sub-steps after a collision
                        break;
                    }
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

            // IMPROVED: Update player's collider after all position changes
            if (player.collidable) {
                ObjectManager.updateCollidableBounds(player.handle);
            }
        });

        // Process all collidable objects only once
        for (const collidable of ObjectManager.collidableObjects) {
            // Skip inactive objects
            if (!collidable.active) continue;
            
            // Skip static objects (buildings, walls)
            if (collidable.isStatic) continue;
            
            // Skip players (already processed above)
            if (collidable.type === 'player') continue;
            
            // Handle vehicles specially
            if (collidable.type === 'vehicle') {
                const vehicle = collidable.object;
                
                // CRITICAL FIX: Process physics for vehicles, giving player-controlled vehicles priority
                if (vehicle === VehicleManager.currentVehicle) {
                    // Handle player-controlled vehicle with high priority
                    this.applyVehiclePhysics(vehicle);
                    
                    // Store relationship with player to prevent collisions
                    if (vehicle.userData) {
                        vehicle.userData.hasPlayerInside = true;
                        vehicle.userData.player = PlayersManager.self;
                    }
                } else {
                    // Regular AI vehicles
                    this.applyVehiclePhysics(vehicle);
                    
                    // Clear player relationship for AI vehicles
                    if (vehicle.userData) {
                        vehicle.userData.hasPlayerInside = false;
                        vehicle.userData.player = null;
                    }
                }
            } 
            // Handle other dynamic objects
            else {
                this.applyGravityToObject(collidable.object);
            }

            // CRITICAL FIX: Ensure dynamic objects (like vehicles) also use velocity capping
            if (!collidable.isStatic && collidable.object.userData && collidable.object.userData.velocity) {
                const maxObjVelocity = 20;
                const velocity = collidable.object.userData.velocity;
                if (velocity.lengthSq() > maxObjVelocity * maxObjVelocity) {
                    velocity.normalize().multiplyScalar(maxObjVelocity);
                }
            }
        }

        // IMPROVED: Update all player colliders at the end of physics step
        PlayersManager.updatePlayerColliders();
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
            
            // CRITICAL FIX: Adjust heightOffset for better ground contact
            const heightOffset = vehicle.userData.type === 'car' ? 1.5 : 2;
            const collisionDistance = planet.radius + heightOffset;
            
            // IMPROVED: Make sure falling state is initialized if missing with better defaults
            if (vehicle.userData.falling === undefined) {
                const distanceAboveSurface = distance - planet.radius;
                // Use a more generous threshold especially for cars
                const fallThreshold = vehicle.userData.type === 'car' ? 3.0 : 2.0;
                vehicle.userData.falling = (distanceAboveSurface > fallThreshold);
                vehicle.userData.onSurface = !vehicle.userData.falling;
                vehicle.userData._checkedForLanding = !vehicle.userData.falling;
                console.log(`Initialized vehicle ${vehicle.userData.name} falling state: ${vehicle.userData.falling}`);
            }
            
            // CRITICAL FIX: Add hysteresis to prevent oscillation between falling/landed states
            // Once on surface, require more height to trigger falling again
            const heightAboveSurface = distance - planet.radius;
            const fallThreshold = vehicle.userData.onSurface ? 
                heightOffset * 1.5 : // Higher threshold to trigger falling again
                heightOffset * 1.1;  // Lower threshold to stay falling
            
            // Consider a vehicle on surface if it's below the threshold
            const onSurface = heightAboveSurface <= fallThreshold;
            
            // CRITICAL FIX: Stationary cars that were just created should immediately be set as on surface
            if (vehicle.userData.type === 'car' && 
                Math.abs(vehicle.userData.speed) < 0.1 && 
                heightAboveSurface <= heightOffset * 2) {
                
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                vehicle.userData.velocity.set(0, 0, 0);
                vehicle.userData.falling = false;
                vehicle.userData.onSurface = true;
                vehicle.userData._checkedForLanding = true;
                vehicle.userData._stabilizeUntil = Date.now() + 500; // Add brief stabilization
            }
            
            // IMPROVED FALLING LOGIC: Use a definitive state machine approach
            // If we're not on surface, we're falling (unless we have lift for airplanes)
            if (!onSurface) {
                // If we just left the surface, mark as falling
                if (!vehicle.userData.falling) {
                    vehicle.userData.falling = true;
                    vehicle.userData.onSurface = false;
                    vehicle.userData._checkedForLanding = false; // Reset landing check
                    console.log(`Vehicle ${vehicle.userData.name} started falling from height ${heightAboveSurface.toFixed(2)}`);
                }
                
                // Apply velocity during falling
                vehicle.position.add(vehicle.userData.velocity);
                
                // Apply lift for aircraft
                if (vehicle.userData.type === 'airplane') {
                    // ...existing airplane lift code...
                }
                
                // Check if we've hit the ground
                if (distance <= collisionDistance) {
                    // Process landing only ONCE per fall
                    if (!vehicle.userData._checkedForLanding) {
                        console.log(`Vehicle ${vehicle.userData.name} landing at height ${heightAboveSurface.toFixed(2)}`);
                        this.vehicleLanding(vehicle, surfaceNormal);
                        vehicle.userData._checkedForLanding = true;
                        vehicle.userData.falling = false;
                        vehicle.userData.onSurface = true;
                    }
                }
            } else {
                // We're on surface now
                vehicle.userData.onSurface = true;
                
                // If we were previously falling, mark as landed
                if (vehicle.userData.falling) {
                    // Only process landing once
                    if (!vehicle.userData._checkedForLanding) {
                        console.log(`Vehicle ${vehicle.userData.name} landing at height ${heightAboveSurface.toFixed(2)}`);
                        this.vehicleLanding(vehicle, surfaceNormal);
                        vehicle.userData._checkedForLanding = true;
                    }
                    vehicle.userData.falling = false;
                }
                
                // Surface-specific handling (already in your code)
                if (vehicle.userData.type === 'car') {
                    // ...existing car on surface code...
                    
                    // Force car to exact height
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                    
                    // Apply alignment
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.8);
                    
                    // Handle stationary cars
                    if (!vehicle.userData.isOccupied && (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.1)) {
                        vehicle.userData.velocity.set(0, 0, 0);
                        if (Math.abs(vehicle.userData.speed) < 0.1) {
                            vehicle.userData.speed = 0;
                        }
                    }
                    
                    // Handle car movement
                    if (Math.abs(vehicle.userData.speed) > 0.1) {
                        // ...existing car movement code...
                    }
                    
                    // CRITICAL FIX: Always ensure falling state is false when on surface
                    vehicle.userData.falling = false;
                    vehicle.userData.onSurface = true;
                    
                    // Update collision bounds
                    if (vehicle.collidable) {
                        ObjectManager.updateCollidableBounds(vehicle);
                    }
                    
                    return;
                }
                
                // ... rest of existing code for other vehicle types ...
            }
            
            // ... existing code for speed limits, etc ...
            
        } catch (e) {
            console.error("Error in vehicle physics:", e);
        }
    }
    
    // Handle vehicle landing on a planet surface
    static vehicleLanding(vehicle, surfaceNormal) {
        if (!vehicle || !vehicle.userData) return;
        
        try {
            // CRITICAL FIX: Log landing event with more details
            console.log(`Processing landing for ${vehicle.userData.name}, was falling=${vehicle.userData.falling}, is on surface=${vehicle.userData.onSurface}`);
            
            // Record the car's direction before alignment for better rotation preservation
            let originalForward = null;
            if (vehicle.userData.type === 'car') {
                originalForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            }
            
            // Calculate impact velocity
            const fallingSpeed = vehicle.userData.velocity.dot(surfaceNormal.clone().negate());
            console.log(`Vehicle ${vehicle.userData.name} landed on surface with impact speed: ${fallingSpeed.toFixed(2)}`);
            
            // Show crash notification for high-speed impacts
            if (fallingSpeed > 2 && typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify(`${vehicle.userData.name} crashed with impact speed: ${fallingSpeed.toFixed(1)}!`);
            }
            
            // Vehicle-specific landing behavior
            if (vehicle.userData.type === 'car') {
                // STABILITY FIX: Force exact position right away
                const planetCenter = vehicle.userData.planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter).normalize();
                
                vehicle.position.copy(planetCenter).addScaledVector(toVehicle, 
                    vehicle.userData.planet.radius + 1.5);
                
                // One-step perfect alignment with surface normal
                const up = toVehicle.clone();
                const projectedForward = originalForward.clone().projectOnPlane(up).normalize();
                const right = new Vector3().crossVectors(up, projectedForward).normalize();
                const correctedForward = new Vector3().crossVectors(right, up).normalize();
                
                vehicle.up.copy(up);
                const lookTarget = new Vector3().copy(vehicle.position).add(correctedForward);
                vehicle.lookAt(lookTarget);
                
                // Zero out velocity for stability
                vehicle.userData.velocity.set(0, 0, 0);
                
                // Add stabilization period
                vehicle.userData._stabilizeUntil = Date.now() + 800;
                
                // Dampen speed
                vehicle.userData.speed *= 0.05;
            }
            else if (vehicle.userData.type === 'airplane') {
                // ...existing airplane landing code...
            }
            
            // CRITICAL FIX: Always update falling state
            vehicle.userData.falling = false;
            vehicle.userData.onSurface = true;
            
        } catch (e) {
            console.error("Error in vehicle landing:", e);
        }
    }

};
