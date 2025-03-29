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

            // CRITICAL FIX: Ensure dynamic objects (like vehicles) also use velocity capping
            if (!collidable.isStatic && collidable.object.userData && collidable.object.userData.velocity) {
                const maxObjVelocity = 20;
                const velocity = collidable.object.userData.velocity;
                if (velocity.lengthSq() > maxObjVelocity * maxObjVelocity) {
                    velocity.normalize().multiplyScalar(maxObjVelocity);
                }
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
            
            // CRITICAL FIX: Adjust heightOffset for better ground contact
            const heightOffset = vehicle.userData.type === 'car' ? 1.5 : 2; // Car offset reduced from 3 to 1.5
            const collisionDistance = planet.radius + heightOffset;
            
            // CRITICAL WOBBLE FIX: Add stabilization period after landing
            const isInStabilizationPeriod = vehicle.userData._stabilizeUntil && 
                                         Date.now() < vehicle.userData._stabilizeUntil;

            // Modify stabilization period handling to allow movement when occupied
            if (isInStabilizationPeriod && vehicle.userData.type === 'car') {
                // Keep the car exactly at the right height
                const planetCenter = planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter);
                const surfaceNormal = toVehicle.normalize();
                const heightOffset = 1.5; // Reduced car height
                const collisionDistance = planet.radius + heightOffset;
                
                // Force exact position on surface
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                
                // CRITICAL FIX: Only zero out velocity if not occupied or not receiving input
                if (!vehicle.userData.isOccupied || !VehicleManager.input || 
                   (Math.abs(VehicleManager.input.movement.z) < 0.01 && 
                    Math.abs(VehicleManager.input.movement.x) < 0.01)) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                
                // CRITICAL FIX: Don't return early if player is in control
                // This allows the remaining physics/movement code to run
                if (!vehicle.userData.isOccupied) {
                    // Update collision bounds
                    if (vehicle.collidable) {
                        ObjectManager.updateCollidableBounds(vehicle);
                    }
                    return; // Only skip remaining physics if car is unoccupied
                }
                // Otherwise continue with movement processing
            }

            // CRITICAL FIX: Handle stationary cars with extra stability
            if (vehicle.userData.type === 'car' && (!vehicle.userData.speed || Math.abs(vehicle.userData.speed) < 0.5)) {
                // Force car exactly to ground and completely zero velocity 
                if (!vehicle.userData.isOccupied) {
                    vehicle.userData.velocity.set(0, 0, 0);
                    vehicle.userData.speed = 0;
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, collisionDistance);
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 1.0);
                    
                    // Update collision bounds
                    if (vehicle.collidable) {
                        ObjectManager.updateCollidableBounds(vehicle);
                    }
                    return; // Skip remaining physics
                }
            }
            
            // CRITICAL FIX: Handle vehicles that are currently falling
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
                
                // CRITICAL ADDITION: Apply lift force for aircraft based on speed and angle
                if (vehicle.userData.type === 'airplane') {
                    // Calculate lift force based on speed (lift increases with speed squared)
                    const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                    const speedFactor = Math.pow(vehicle.userData.speed / 20, 2); // Normalized speed factor
                    
                    // Calculate angle of attack (simplified - just uses planetward component)
                    const dotWithSurface = forward.dot(surfaceNormal);
                    const angleOfAttack = Math.abs(dotWithSurface); // 0 = perpendicular to surface, 1 = aligned with surface
                    
                    // More lift when perpendicular to surface (climbing)
                    const liftFactor = vehicle.userData.liftFactor || 0.5; // Default if not set
                    const liftForce = liftFactor * speedFactor * (1 - angleOfAttack * 0.5);
                    
                    // Apply lift force - counteract gravity
                    if (vehicle.userData.speed > 15) {
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, liftForce * (1/60));
                        
                        // Increase altitude value for game logic
                        vehicle.userData.altitude += liftForce * 2 * (1/60);
                        
                        // Cap altitude to max
                        vehicle.userData.altitude = Math.min(
                            vehicle.userData.altitude, 
                            vehicle.userData.maxAltitude || 500
                        );
                    }
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
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.8); // Increased from 0.5
                    
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
                if (playerControlled && onSurface) {
                    // CRITICAL FIX: Extremely simplified direct car movement code
                    // This bypasses all the complex projected motion code that may be causing issues
                    if (Math.abs(vehicle.userData.speed) > 0.01) {
                        // Get vehicle's forward direction using negative Z
                        const forward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                        
                        // CRITICAL FIX: Create movement directly along the forward vector
                        // Increased multiplier for more responsive feel
                        const movement = forward.clone().multiplyScalar(vehicle.userData.speed * (1/60) * 15);
                        
                        // CRITICAL FIX: Apply movement directly
                        vehicle.position.add(movement);
                        
                        console.log(`Car moving: speed=${vehicle.userData.speed.toFixed(2)}, dist=${movement.length().toFixed(2)}`);
                        
                        // CRITICAL FIX: After movement, ensure correct height above planet
                        vehicle.position.copy(planetCenter).addScaledVector(
                            vehicle.position.clone().sub(planetCenter).normalize(),
                            collisionDistance
                        );
                    }
                    
                    // CRITICAL FIX: Use adaptive alignment - weaker when moving, stronger when stationary
                    const speed = Math.abs(vehicle.userData.speed);
                    const adaptiveStrength = speed > 5 ? 0.3 : (speed > 2 ? 0.6 : 1.0);
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, adaptiveStrength);
                }
                
                // Handle regular AI vehicles...
                if (!playerControlled) {
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
                            
                            // Gradually reduce altitude when not maintaining enough speed
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
            
            // CRITICAL ADDITION: Apply maximum velocity limits
            if (vehicle.userData.type === 'airplane') {
                // Hard limit on aircraft max speed
                const maxAirplaneSpeed = vehicle.userData.maxSpeed || 100;
                if (Math.abs(vehicle.userData.speed) > maxAirplaneSpeed) {
                    vehicle.userData.speed = Math.sign(vehicle.userData.speed) * maxAirplaneSpeed;
                }
            } else if (vehicle.userData.type === 'car') {
                // Hard limit on car max speed
                const maxCarSpeed = vehicle.userData.maxSpeed || 50;
                if (Math.abs(vehicle.userData.speed) > maxCarSpeed) {
                    vehicle.userData.speed = Math.sign(vehicle.userData.speed) * maxCarSpeed;
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
            // Record the car's direction before alignment for better rotation preservation
            let originalForward = null;
            if (vehicle.userData.type === 'car') {
                originalForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            }
            
            // CRITICAL FIX: More dramatic landing effects
            const fallingSpeed = vehicle.userData.velocity.dot(surfaceNormal.clone().negate());
            
            console.log(`Vehicle ${vehicle.userData.name} landed on surface with impact speed: ${fallingSpeed.toFixed(2)}`);
            
            // Show crash notification for high-speed impacts
            if (fallingSpeed > 2 && typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify(`${vehicle.userData.name} crashed with impact speed: ${fallingSpeed.toFixed(1)}!`);
            }
            
            // Different behavior based on vehicle type
            if (vehicle.userData.type === 'car') {
                // STABILITY FIX: Force exact position right away
                const planetCenter = vehicle.userData.planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter).normalize();
                
                // Force position to exact surface height with no slop
                vehicle.position.copy(planetCenter).addScaledVector(toVehicle, 
                    vehicle.userData.planet.radius + 1.5);
                
                // CRITICAL FIX: One-step perfect alignment - inspired by FPS controller
                // Calculate a perfect basis with surface normal as up vector
                const up = toVehicle.clone();
                
                // Project the original forward direction onto the planet's surface
                const projectedForward = originalForward.clone().projectOnPlane(up).normalize();
                
                // Use a re-orthogonalized basis for maximum stability
                const right = new Vector3().crossVectors(up, projectedForward).normalize();
                const correctedForward = new Vector3().crossVectors(right, up).normalize();
                
                // Set vehicle's up direction directly
                vehicle.up.copy(up);
                
                // Calculate the desired orientation directly - no slerping for landing
                const lookTarget = new Vector3().copy(vehicle.position).add(correctedForward);
                vehicle.lookAt(lookTarget);
                
                // Zero out all velocity components for stability 
                vehicle.userData.velocity.set(0, 0, 0);
                
                // Add stronger stabilization period
                vehicle.userData._stabilizeUntil = Date.now() + 800; // 800ms of stabilization
                
                // More aggressive speed dampening
                vehicle.userData.speed *= 0.05;
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
            // IMPROVED: Better liftoff physics with smooth transition
            
            // Calculate initial lift based on speed
            const liftFactor = Math.max(0, (vehicle.userData.speed - 20) / 20); // 0 at speed 20, 1.0 at speed 40
            
            // Start gaining altitude
            vehicle.userData.altitude = Math.max(vehicle.userData.altitude || 0, 5 * liftFactor);
            
            // Apply some upward velocity
            if (liftFactor > 0.3) {
                // Add upward component to velocity (surfaceNormal is away from planet)
                vehicle.userData.velocity.addScaledVector(surfaceNormal, liftFactor * 0.5);
                
                // Show notification if player is controlling the aircraft
                if (vehicle.userData.isOccupied && typeof window !== 'undefined' && window.gameNotify) {
                    window.gameNotify(`Taking off! Current altitude: ${Math.floor(vehicle.userData.altitude)}m`);
                }
            }
            
            // Flag as no longer on surface
            if (liftFactor > 0.5) {
                vehicle.userData.onSurface = false;
            }
        }
    }

};
