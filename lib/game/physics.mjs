import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import { Vector3, Box3, Object3D, Plane } from 'three'; // Added Plane

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
        // CRITICAL FIX: Add safety check for empty planets array
        if (!SceneManager.planets || SceneManager.planets.length === 0) {
            console.error("No planets available in SceneManager.planets - creating fallback planet");
            
            // Create a fallback planet if none exist
            if (!SceneManager._fallbackPlanet) {
                // Create a fallback planet for physics calculations
                SceneManager._fallbackPlanet = {
                    name: "FallbackPlanet",
                    radius: 200,
                    object: {
                        position: new Vector3(0, -4000, 0)
                    },
                    CoF: 0.2,
                    objects: []
                };
                
                // Try to add the fallback planet to the planets array
                if (!SceneManager.planets) {
                    SceneManager.planets = [];
                }
                
                SceneManager.planets.push(SceneManager._fallbackPlanet);
                console.warn("Created fallback planet for physics calculations");
            }
            
            // Return the fallback planet
            return SceneManager._fallbackPlanet;
        }

        let closestPlanet = SceneManager.planets[0];
        let closestDistance = Infinity;

        // CRITICAL FIX: Ensure planets are valid before processing
        SceneManager.planets.forEach(planet => {
            if (!planet || !planet.radius || !planet.object) {
                console.warn("Invalid planet in SceneManager.planets");
                return; // Skip this planet
            }

            const radius = planet.radius;
            const distance = position.distanceTo(planet.object.position);
            const scaledDistance = distance / radius;

            if (scaledDistance < closestDistance) {
                closestDistance = scaledDistance;
                closestPlanet = planet;
            }
        });

        // CRITICAL FIX: Ensure planet has objects array
        if (closestPlanet && !closestPlanet.objects) {
            closestPlanet.objects = [];
        }

        return closestPlanet;
    };

    // Updates player physics, processes all collidable objects:
    static update() {
        try {
            PlayersManager.players.forEach(player => {
                if (!player) return;
                
                // Handle vehicles
                if (player.inVehicle) {
                    if (VehicleManager.currentVehicle) {
                        player.position.copy(VehicleManager.currentVehicle.position);
                        if (player.handle !== VehicleManager.currentVehicle) {
                            player.handle.position.copy(VehicleManager.currentVehicle.position);
                        }
                        if (player.handle && player.handle !== VehicleManager.currentVehicle) {
                            player.handle.visible = false;
                            player.handle.traverse(child => {
                                if (child !== player.handle) {
                                    child.visible = false;
                                }
                            });
                        }
                        if (player.handle && player.handle.userData) {
                            player.handle.userData.inVehicle = true;
                            player.handle.userData.currentVehicle = VehicleManager.currentVehicle;
                        }
                    }
                    return;
                } else if (player.handle && player.handle.userData) {
                    player.handle.userData.inVehicle = false;
                    player.handle.userData.currentVehicle = null;
                }

                // SIMPLIFIED: Just stop player movement when extreme velocities are detected
                if (player.velocity && player.velocity.lengthSq() > 100) {
                    console.warn("Extreme velocity detected, might be collision error. Stopping player movement.");
                    player.velocity.set(0, 0, 0); // Simply stop movement entirely
                    
                    // Reset last collision data to avoid repeated bad collisions
                    player._lastCollidedWith = null;
                    player._lastCollisionTime = 0;
                    
                    // Notify player of the glitch
                    if (typeof window !== 'undefined' && window.gameNotify) {
                        window.gameNotify("Movement glitch detected - stopping movement");
                    }
                }

                // Cap velocity
                const maxVelocity = 15;
                if (player.velocity && player.velocity.lengthSq() > maxVelocity * maxVelocity) {
                    player.velocity.normalize().multiplyScalar(maxVelocity);
                    console.log("Player velocity capped to prevent tunneling");
                }

                // Safety check for velocity
                if (!player.velocity) {
                    console.error("Player missing velocity property");
                    player.velocity = new Vector3();
                    return;
                }

                const velocity = player.velocity.clone();
                const speed = velocity.length();
                const numSteps = speed > 5 ? Math.ceil(speed / 5) : 1;
                const subStep = 1.0 / numSteps;

                // CRITICAL FIX: Ensure player's handle is ALWAYS registered for collision
                if (player.handle && !player.collidable) {
                    PlayersManager.initializePlayerCollider(player, true);
                }
                
                // Ensure active flag is set for collisions
                if (player.collidable) {
                    player.collidable.active = true;
                }
                
                // Reset standing flag at the beginning of each frame
                // Will be set to true if we detect a collision that opposes gravity
                player.standingOnObject = false;
                
                let hadOBBCollision = false;
                
                // CRITICAL FIX: Force matrix update with complete reconstruction of world matrix
                if (player.handle) {
                    player.handle.updateMatrix();
                    player.handle.updateMatrixWorld(true);
                    
                    if (player.collidable) {
                        // Force a complete rebuild of collision bounds
                        ObjectManager.updateCollidableBounds(player.handle);
                        
                        // IMPROVED: Validate OBB before attempting to log center
                        if (player.collidable.obb) {
                            // Validate OBB components
                            if (ObjectManager.validateOBB(player.collidable.obb, player.handle)) {
                                // Log collision box state for debugging
                                console.log(`Player collision box: active=${player.collidable.active}, type=${player.collidable.type}`);
                                console.log(`OBB center: ${player.collidable.obb.center.x.toFixed(2)}, ${player.collidable.obb.center.y.toFixed(2)}, ${player.collidable.obb.center.z.toFixed(2)}`);
                            } else {
                                console.log(`Player collision box: active=${player.collidable.active}, type=${player.collidable.type} (OBB invalid)`);
                            }
                        }
                    }
                }
                
                // Step-wise movement logic with improved collision detection
                for (let step = 0; step < numSteps && !hadOBBCollision; step++) {
                    try {
                        const stepVelocity = velocity.clone().multiplyScalar(subStep);
                        
                        // Store original position for collision testing
                        const originalPosition = player.position.clone();
                        
                        // Apply movement
                        player.position.add(stepVelocity);
                        
                        if (player.handle) {
                            player.handle.position.copy(player.position);
                            
                            // Update collision bounds after position change
                            if (player.collidable) {
                                ObjectManager.updateCollidableBounds(player.handle);
                            }
                        }
                        
                        // Get sphere of influence (nearest planet)
                        player.soi = this.calculateSOI(player.position);
                        if (!player.soi) continue;

                        // Check player handle collision with all objects including walls
                        let collide = null;
                        if (player.handle && player.collidable) {
                            // CRITICAL FIX: Explicitly include walls in collision check
                            const nearbyObjects = ObjectManager.collidableObjects.filter(item => {
                                // Skip invalid objects
                                if (!item || !item.object || item.object === player.handle) return false;
                                
                                // CRITICAL FIX: Prioritize wall collisions
                                if (item.type === 'wall') {
                                    // Always check wall collisions within a reasonable distance
                                    const distSq = player.position.distanceToSquared(item.object.position);
                                    return distSq < 50 * 50; // Expanded distance for walls (50 units)
                                }
                                
                                // For other objects, use closer distance threshold
                                const maxCollisionDist = 25;
                                const distSq = player.position.distanceToSquared(item.object.position);
                                return distSq < maxCollisionDist * maxCollisionDist;
                            });
                            
                            // Log nearby wall objects for debugging
                            const wallCount = nearbyObjects.filter(o => o.type === 'wall').length;
                            if (wallCount > 0) {
                                console.log(`Found ${wallCount} nearby walls for collision check`);
                                
                                // ADDED: Detailed logging of distance to each wall
                                nearbyObjects.filter(o => o.type === 'wall').forEach(wall => {
                                    const wallDistance = player.position.distanceTo(wall.object.position);
                                    const wallSize = wall.object.userData?.wallWidth || 5;
                                    console.log(`Wall distance: ${wallDistance.toFixed(2)} units (Wall size: ${wallSize.toFixed(1)}, Collision threshold: 50.0)`);
                                    
                                    // Validate OBB after update
                                    ObjectManager.validateOBB(wall.obb, wall.object);
                                });
                            }
                            
                            if (nearbyObjects.length > 0) {
                                // ENHANCED: Use more aggressive collision checking
                                try {
                                    collide = ObjectManager.checkCollisions(player, nearbyObjects, subStep);
                                    
                                    // Debug collision result
                                    if (collide) {
                                        console.log(`Collision detected with ${collide.closestObject.type} object!`);
                                    }
                                } catch (err) {
                                    console.error("Error checking collisions:", err);
                                }
                            }
                        }
                        
                        // IMPROVED: Completely block movement in collision direction
                        if (collide) {
                            hadOBBCollision = true;
                            const { collisionNormal, collisionPosition, closestObject } = collide;
                            
                            // ENHANCED: Use much stronger position correction that completely blocks movement
                            // Get penetration factor based on collision type
                            const penetrationFactor = collide.isWallCollision ? 3.0 : 
                                                     (collide.penetration || 1.2);
                            
                            // Safety offset to push player away from collision
                            const safetyOffset = collisionNormal.clone().multiplyScalar(penetrationFactor);
                            
                            // CRITICAL FIX: For walls or other solid objects, completely revert position
                            // This ensures the player CANNOT move through solid objects
                            player.position.copy(originalPosition);
                            
                            // Add a small safety offset in the collision normal direction
                            // This prevents the player from getting stuck against the surface
                            player.position.add(safetyOffset.multiplyScalar(0.2));
                            
                            // Update handle position after correction
                            if (player.handle) {
                                player.handle.position.copy(player.position);
                            }
                            
                            // CRITICAL FIX: Completely eliminate velocity component in the collision normal direction
                            const velDot = player.velocity.dot(collisionNormal);
                            
                            if (velDot < 0) {
                                // Remove ALL velocity component in direction of collision
                                const normalVelocity = collisionNormal.clone().multiplyScalar(velDot);
                                player.velocity.sub(normalVelocity);
                                
                                // NEW: Check if this collision can support standing against gravity
                                if (player.soi && player.soi.object) {
                                    // Get the gravity direction (from player to planet center)
                                    const planetCenter = player.soi.object.position;
                                    const toPlayer = player.position.clone().sub(planetCenter).normalize();
                                    
                                    // Calculate dot product between gravity direction and collision normal
                                    // Negative means they point in opposite directions
                                    const gravityAlignment = toPlayer.dot(collisionNormal);
                                    
                                    // If collision normal opposes gravity direction (pointing up/away from planet)
                                    // then we can stand on this object
                                    if (gravityAlignment < -0.5) { // At least somewhat opposing gravity
                                        console.log("Player standing on object - gravity blocked");
                                        player.standingOnObject = true;
                                        player.falling = false;
                                        player.surfaceNormal = collisionNormal.clone();
                                    }
                                }
                                
                                // Apply additional damping for walls to reduce "sliding" effect 
                                if (collide.isWallCollision) {
                                    // Higher friction against walls
                                    player.velocity.multiplyScalar(0.5);
                                }
                                
                                console.log(`Collision blocked movement in direction: ${collisionNormal.x.toFixed(2)}, ${collisionNormal.y.toFixed(2)}, ${collisionNormal.z.toFixed(2)}`);
                            }
                            
                            // Update collision bounds again after position correction
                            if (player.handle && player.collidable) {
                                ObjectManager.updateCollidableBounds(player.handle);
                            }
                            
                            // Show collision notification for specific object types
                            if (typeof window !== 'undefined' && window.gameNotify) {
                                if (collide.isWallCollision) {
                                    window.gameNotify("Wall collision - movement blocked");
                                } else if (closestObject && closestObject.type) {
                                    window.gameNotify(`Collision with ${closestObject.type} - movement adjusted`);
                                }
                            }
                            
                            break; // Stop checking further steps after collision
                        }
                    } catch (stepErr) {
                        console.error("Error in physics step:", stepErr);
                    }
                }

                // Apply planet gravity and surface handling
                try {
                    if (!player.soi || !player.soi.radius || !player.soi.object) return;

                    const planetRadius = player.soi.radius;
                    const collisionDistance = planetRadius + 0.5;
                    const soi = player.soi.object;
                    
                    if (!soi || !soi.position) return;
                    
                    const toPlayer = player.position.clone().sub(soi.position);
                    const distance = toPlayer.length();
                    toPlayer.normalize();

                    // NEW: Only apply gravity if player is not standing on an object
                    if (!player.standingOnObject) {
                        const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
                        player.velocity.add(toPlayer.clone().multiplyScalar(-gravity));
                    } else {
                        // We are standing on an object, apply friction similar to planet surface
                        if (player.soi.CoF) {
                            player.velocity.multiplyScalar(1 - player.soi.CoF);
                        }
                    }

                    const downwardSpeed = player.velocity.dot(toPlayer);
                    
                    // Only update surfaceNormal if not standing on object
                    // This preserves the object's surface normal when standing on it
                    if (!player.standingOnObject) {
                        player.surfaceNormal = toPlayer.clone();
                    }

                    const canLiftoff = (!player.falling && downwardSpeed < 0);
                    const onPlanet = distance <= collisionDistance;

                    // IMPROVED: Only apply planet surface collision if we didn't already have an OBB collision
                    // AND we're not standing on an object
                    if ((onPlanet || canLiftoff) && !hadOBBCollision && !player.standingOnObject) {
                        const surfacePosition = soi.position.clone()
                            .add(toPlayer.clone().multiplyScalar(collisionDistance));
                        
                        player.position.copy(surfacePosition);
                        if (player.handle) {
                            player.handle.position.copy(surfacePosition);
                        }

                        const inVehicle = VehicleManager.currentVehicle &&
                            VehicleManager.currentVehicle.player === player;

                        if (player.falling && !inVehicle && ControlManager.controller?.landing) {
                            ControlManager.controller.landing(toPlayer);
                        }

                        player.falling = false;

                        if (!inVehicle && player.soi.CoF) {
                            player.velocity.multiplyScalar(1 - player.soi.CoF);
                        }

                        // ADDED: Update collision bounds after planet surface position change
                        if (player.handle && player.collidable) {
                            ObjectManager.updateCollidableBounds(player.handle);
                        }
                    } else {
                        // Only set falling to true if we're not standing on an object
                        if (!player.falling) {
                            const inVehicle = VehicleManager.currentVehicle &&
                                VehicleManager.currentVehicle.player === player;

                            if (!inVehicle && ControlManager.controller?.liftoff) {
                                ControlManager.controller.liftoff(toPlayer);
                            }
                        }
                        player.falling = true;
                    }
                } catch (gravityErr) {
                    console.error("Error in planet gravity processing:", gravityErr);
                }

                // Update player's collision bounds one final time after all movement
                if (player.handle && player.collidable) {
                    try {
                        ObjectManager.updateCollidableBounds(player.handle);
                    } catch (err) {
                        console.error("Error updating player collision bounds:", err);
                    }
                }
            });

            // Process all collidable objects
            try {
                for (const collidable of ObjectManager.collidableObjects) {
                    if (!collidable || !collidable.active || collidable.isStatic) continue;
                    if (collidable.type === 'player') continue;

                    if (collidable.type === 'vehicle' && collidable.object) {
                        try {
                            this.applyVehiclePhysics(collidable.object);
                            
                            // Update vehicle player relationship
                            if (collidable.object === VehicleManager.currentVehicle && collidable.object.userData) {
                                collidable.object.userData.hasPlayerInside = true;
                                collidable.object.userData.player = PlayersManager.self;
                            } else if (collidable.object.userData) {
                                collidable.object.userData.hasPlayerInside = false;
                                collidable.object.userData.player = null;
                            }
                        } catch (err) {
                            console.error("Error in vehicle physics:", err);
                        }
                    } else {
                        try {
                            this.applyGravityToObject(collidable.object);
                        } catch (err) {
                            console.error("Error in object gravity:", err);
                        }
                    }

                    // Cap object velocity
                    if (!collidable.isStatic && collidable.object && collidable.object.userData && collidable.object.userData.velocity) {
                        try {
                            const maxObjVelocity = 20;
                            const velocity = collidable.object.userData.velocity;
                            if (velocity.lengthSq() > maxObjVelocity * maxObjVelocity) {
                                velocity.normalize().multiplyScalar(maxObjVelocity);
                            }
                        } catch (err) {
                            console.error("Error capping object velocity:", err);
                        }
                    }
                    
                    // Mark the object has moved for collision detection
                    if (collidable.object && collidable.object.userData) {
                        collidable.object.userData.hasMovedSinceLastCheck = true;
                    }
                    
                    // Update collision bounds
                    try {
                        ObjectManager.updateCollidableBounds(collidable.object);
                    } catch (err) {
                        console.error("Error updating collidable bounds:", err);
                    }
                }
            } catch (objErr) {
                console.error("Error processing collidable objects:", objErr);
            }

            // Update player colliders as the last step
            try {
                PlayersManager.updatePlayerColliders();
            } catch (err) {
                console.error("Error updating player colliders:", err);
            }
        } catch (mainErr) {
            console.error("CRITICAL ERROR in physics update:", mainErr);
        }
    };

    // ENHANCED: Improved vehicle-object collision detection
    static applyVehiclePhysics(vehicle) {
        if (!vehicle || !vehicle.userData) return;

        try {
            // Skip physics for player's current vehicle
            if (vehicle === VehicleManager.currentVehicle && vehicle.userData.isOccupied) {
                // IMPORTANT FIX: Even for player-controlled vehicles, we should still
                // maintain the correct height above the planet surface
                this.maintainVehicleSurfaceHeight(vehicle);
                return;
            }

            // Calculate planet and get surface normal
            if (!vehicle.userData.planet) {
                vehicle.userData.planet = this.calculateSOI(vehicle.position);
            }
            const planet = vehicle.userData.planet;
            if (!planet) return;

            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // ADDED: Store surface normal in vehicle for alignment and collision
            vehicle.userData.surfaceNormal = surfaceNormal;
            
            // Apply gravity to unoccupied vehicles
            if (!vehicle.userData.velocity) {
                vehicle.userData.velocity = new Vector3();
            }
            
            // Calculate gravity and apply to velocity
            const gravity = GRAVITY_CONSTANT / Math.pow(distance / planet.radius, 2);
            vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity);
            
            // FIXED: Ensure we're calling the function that exists
            if (typeof ObjectManager.checkCollisionsWithObject === 'function') {
                const collisions = ObjectManager.checkCollisionsWithObject(vehicle);
                if (collisions && collisions.length > 0) {
                    // We hit something - handle collision response
                    for (const collision of collisions) {
                        if (!collision || !collision.normal) continue;
                        
                        const normal = collision.normal;
                        const otherObject = collision.other;
                        
                        // Simple collision response - reverse velocity along collision normal
                        const velAlongNormal = vehicle.userData.velocity.dot(normal);
                        
                        // ENHANCED: Handle vehicle-to-vehicle collisions with realistic physics
                        if (otherObject && otherObject.userData && otherObject.userData.type === 'vehicle') {
                            // Vehicle-to-vehicle collision detected
                            this.processVehicleCollision(vehicle, otherObject, normal, velAlongNormal);
                        } else {
                            // Standard collision with non-vehicle objects
                            if (velAlongNormal < 0) {
                                // We're moving toward the other object
                                vehicle.userData.velocity.addScaledVector(normal, -velAlongNormal * 1.2); // Bounce
                                
                                // Add some damping to prevent excessive bouncing
                                vehicle.userData.velocity.multiplyScalar(0.8);
                            }
                        }
                    }
                }
            } else {
                // If the function doesn't exist, log a warning and continue without collision checks
                console.warn("ObjectManager.checkCollisionsWithObject is not available - skipping vehicle collision checks");
            }
            
            // Apply velocity to position
            const speed = vehicle.userData.velocity.length();
            const steps = Math.max(1, Math.ceil(speed / 0.5)); // More steps for higher speeds
            const subStep = 1.0 / steps;
            
            for (let i = 0; i < steps; i++) {
                // Apply small fraction of velocity
                const stepVelocity = vehicle.userData.velocity.clone().multiplyScalar(subStep);
                vehicle.position.add(stepVelocity);
                
                // Check if we're now at/below the target height
                const newDistance = vehicle.position.clone().sub(planetCenter).length();
                const targetHeight = planet.radius + (vehicle.userData.fixedHeightOffset || 3.0);
                
                if (newDistance <= targetHeight) {
                    // We've hit the ground, break out of movement loop
                    break;
                }
            }
            
            // Detect landing on the planet surface
            // FIXED: Use consistent fixed height for car
            const heightOffset = vehicle.userData.type === 'car' ? 3.0 : 3.0;
            const groundLevel = planet.radius + heightOffset;
            
            if (distance <= groundLevel) {
                // IMPROVED: MORE aggressive height correction to keep object ON sphere radius
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, groundLevel);
                
                // ADDED: Update surface normal again after position correction
                vehicle.userData.surfaceNormal = surfaceNormal;
                
                // FIXED: Dramatically reduce bounce effect and velocity when landing
                if (vehicle.userData.falling) {
                    // Apply strong damping based on landing speed
                    const impactSpeed = -vehicle.userData.velocity.dot(surfaceNormal);
                    const landingDamping = vehicle.userData.landingDamping || 0.95;
                    const bounceFactor = vehicle.userData.bounceFactor || 0.1;
                    
                    // Only allow tiny bounce for smooth landing
                    if (impactSpeed > 0.1) {
                        // Convert downward velocity to tiny upward bounce
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, impactSpeed * bounceFactor);
                        
                        // Add aggressive damping to stop bouncing quickly
                        vehicle.userData.velocity.multiplyScalar(landingDamping);
                    } else {
                        // For very soft landings, just zero the vertical velocity completely
                        const verticalComponent = surfaceNormal.clone().multiplyScalar(
                            vehicle.userData.velocity.dot(surfaceNormal)
                        );
                        vehicle.userData.velocity.sub(verticalComponent);
                        vehicle.userData.velocity.multiplyScalar(0.9); // Slight overall damping
                    }
                } else {
                    // For already grounded vehicles, apply rolling friction
                    // IMPROVED: Reduced rolling friction for vehicles compared to players
                    const frictionFactor = 1.0 - ((planet.CoF || 0.2) * 0.5); // Halved friction coefficient
                    
                    // FIXED: Split velocity into normal (vertical) and tangent (horizontal) components
                    const normalVel = vehicle.userData.velocity.dot(surfaceNormal);
                    const normalComponent = surfaceNormal.clone().multiplyScalar(normalVel);
                    const tangentComponent = vehicle.userData.velocity.clone().sub(normalComponent);
                    
                    // ZERO the normal component (prevent any bouncing)
                    vehicle.userData.velocity.copy(tangentComponent);
                    
                    // Apply friction to tangent component - lessened for rolling wheels
                    vehicle.userData.velocity.multiplyScalar(frictionFactor);
                    
                    // If very slow, just stop completely
                    if (vehicle.userData.velocity.lengthSq() < 0.003) { // Reduced from 0.005 for smoother rolling
                        vehicle.userData.velocity.set(0, 0, 0);
                    }
                }
                
                // Properly align with surface
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal);
                vehicle.userData.onSurface = true;
                
                // Mark as not falling as soon as velocity is small
                if (vehicle.userData.velocity.lengthSq() < 0.01) {
                    vehicle.userData.falling = false;
                }
            } else {
                // We're in the air
                vehicle.userData.falling = true;
                vehicle.userData.onSurface = false;
            }

            // ENHANCED: Update OBB collision bounds after moving vehicle
            if (vehicle.collidable) {
                ObjectManager.updateCollidableBounds(vehicle);
            }
            
        } catch (e) {
            console.error("Error in vehicle physics:", e);
        }
    }
    
    // NEW: Process collisions between vehicles with realistic momentum transfer
    static processVehicleCollision(vehicle, otherVehicle, normal, velAlongNormal) {
        try {
            // Only process collision if we're moving toward the other vehicle
            if (velAlongNormal >= 0) return;
            
            console.log(`Vehicle collision: ${vehicle.userData.name || 'unnamed'} hit ${otherVehicle.userData.name || 'unnamed'}`);
            
            // Get vehicle velocities
            const vehicleVel = vehicle.userData.velocity || new Vector3();
            const otherVel = otherVehicle.userData.velocity || new Vector3();
            
            // Default masses if not specified (can be adjusted based on vehicle type)
            const vehicleMass = vehicle.userData.mass || (vehicle.userData.type === 'car' ? 1000 : 500);
            const otherMass = otherVehicle.userData.mass || (otherVehicle.userData.type === 'car' ? 1000 : 500);
            
            // Calculate total mass for momentum conservation
            const totalMass = vehicleMass + otherMass;
            
            // Calculate collision impulse using conservation of momentum and coefficient of restitution
            const restitution = 0.3; // Bounciness factor (0 = no bounce, 1 = perfect bounce)
            
            // Relative velocity along the normal
            const velRelative = vehicleVel.dot(normal) - (otherVel ? otherVel.dot(normal) : 0);
            
            // Calculate impulse scalar
            const impulseFactor = -(1 + restitution) * velRelative / (1/vehicleMass + 1/otherMass);
            
            // Apply impulse to both vehicles
            const impulse = normal.clone().multiplyScalar(impulseFactor);
            
            // Apply impulse scaled by inverse mass
            vehicle.userData.velocity.addScaledVector(impulse, 1/vehicleMass);
            
            // Only apply to other vehicle if it has velocity
            if (otherVehicle.userData.velocity) {
                otherVehicle.userData.velocity.addScaledVector(impulse, -1/otherMass);
                
                // Set speed property for car controller to recognize
                if (otherVehicle.userData.type === 'car') {
                    // Calculate new speed as the magnitude of velocity in the forward direction
                    const forward = new Vector3(0, 0, -1).applyQuaternion(otherVehicle.quaternion);
                    const forwardSpeed = otherVehicle.userData.velocity.dot(forward);
                    
                    // Update car's speed property
                    otherVehicle.userData.speed = forwardSpeed;
                    
                    console.log(`Car ${otherVehicle.userData.name || 'unnamed'} pushed to speed: ${forwardSpeed.toFixed(2)}`);
                }
            }
            
            // Add additional separation to prevent sticking
            const separationDistance = 0.2; // Small separation to prevent vehicles from getting stuck
            vehicle.position.addScaledVector(normal, separationDistance);
            if (otherVehicle.position) {
                otherVehicle.position.addScaledVector(normal, -separationDistance);
            }
            
            // Play collision sound or effect if available
            if (typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify(`Vehicle collision impact!`);
            }
            
            console.log(`Applied collision impulse: ${impulseFactor.toFixed(2)}`);
            
        } catch (err) {
            console.error("Error processing vehicle collision:", err);
        }
    }

    // Apply collision response for object-to-object collisions using OBB data
    static applyCollisionResponse(object, collision) {
        if (!object || !object.userData || !collision) return;
        
        try {
            // Get collision properties
            const normal = collision.normal;
            const other = collision.other;
            
            // ENHANCED: Special handling for vehicle collisions
            const isVehicle = object.userData.type === 'vehicle';
            const otherIsVehicle = other.userData && other.userData.type === 'vehicle';
            
            // If this is a vehicle-to-vehicle collision, use special handling
            if (isVehicle && otherIsVehicle) {
                const velAlongNormal = object.userData.velocity ? 
                    object.userData.velocity.dot(normal) : 0;
                this.processVehicleCollision(object, other, normal, velAlongNormal);
                return;
            }
            
            // Calculate mass ratio for momentum conservation
            const objectMass = object.userData.mass || 100;
            const otherMass = other.userData.mass || 100;
            const totalMass = objectMass + otherMass;
            const objectRatio = objectMass / totalMass;
            const otherRatio = otherMass / totalMass;
            
            // Check if this is a player object
            const isPlayer = object.userData.isPlayer || (object.userData.type === 'player');
            
            // Only apply physics to non-static objects
            if (object.userData.velocity) {
                // Store original velocity direction before modification
                const originalVelocity = object.userData.velocity.clone();
                const originalVelocityDir = originalVelocity.clone().normalize();
                const originalSpeed = originalVelocity.length();
                
                // Calculate impulse based on velocity alignment with normal
                const velDot = object.userData.velocity.dot(normal);
                
                if (velDot < 0) {
                    // CRITICAL CHANGE: Completely eliminate velocity component in collision direction
                    const normalVelocity = normal.clone().multiplyScalar(velDot);
                    object.userData.velocity.sub(normalVelocity);
                    
                    // NEW: For players, check if they can stand on this object
                    if (isPlayer) {
                        const player = PlayersManager.players.find(p => p.handle === object);
                        if (player && player.soi && player.soi.object) {
                            // Get gravity direction (from player to planet center)
                            const planetCenter = player.soi.object.position;
                            const toPlayer = object.position.clone().sub(planetCenter).normalize();
                            
                            // Calculate dot product between gravity direction and collision normal
                            const gravityAlignment = toPlayer.dot(normal);
                            
                            // If normal opposes gravity direction, mark as standing
                            if (gravityAlignment < -0.5) { // Threshold for determining "up" direction
                                player.standingOnObject = true;
                                player.falling = false;
                                player.surfaceNormal = normal.clone();
                                console.log("Player collision response: Standing on object");
                            }
                        }
                    }
                    
                    // Apply extra damping in collision direction to prevent residual movement
                    const dampingFactor = collision.isWallCollision ? 0.8 : 0.5;
                    object.userData.velocity.multiplyScalar(1 - dampingFactor);
                    
                    // Log that we're preventing movement in collision direction
                    if (ObjectManager._debugEnabled) {
                        console.log(`Blocked movement in collision direction: ${normal.x.toFixed(2)}, ${normal.y.toFixed(2)}, ${normal.z.toFixed(2)}`);
                    }
                }
                
                // ENHANCED: Apply stronger position correction to prevent penetration
                const correctionStrength = collision.isWallCollision ? 1.7 : 1.3; // Increased strength
                const minPenetration = 0.01; // Much smaller threshold to catch small penetrations
                const penetration = collision.penetration || 0.1;
                
                if (penetration > minPenetration) {
                    // Move object along normal by at least the penetration distance
                    const correction = normal.clone().multiplyScalar(penetration * correctionStrength);
                    
                    // Apply immediate position correction
                    object.position.add(correction);
                    
                    // Store original position for anti-tunneling check
                    if (!object.userData._lastPosition) {
                        object.userData._lastPosition = new Vector3();
                    }
                    object.userData._lastPosition.copy(object.position);
                }
                
                // Store collision data for future movement restriction
                if (!object.userData._collisions) {
                    object.userData._collisions = [];
                }
                
                // Store this collision to maintain movement restrictions
                object.userData._collisions.push({
                    normal: normal.clone(),
                    position: collision.position ? collision.position.clone() : object.position.clone(),
                    time: Date.now(),
                    other: other
                });
                
                // Limit stored collisions to prevent memory issues
                if (object.userData._collisions.length > 5) {
                    object.userData._collisions.shift(); // Remove oldest collision
                }
                
                // ADDED: Anti-tunneling check - verify we're not moving into collision
                // For the next few frames, check if we're moving back into collision
                if (!object.userData._collisionCheckTimer) {
                    object.userData._collisionCheckTimer = 3; // Check for 3 frames
                    object.userData._collisionNormal = normal.clone();
                } else {
                    object.userData._collisionCheckTimer = 3; // Reset timer
                }
            }
            
            // Apply physics to other object if it's dynamic
            if (other.userData && other.userData.isDynamic && other.userData.velocity) {
                // Calculate inverse impulse for other object
                const velDot = other.userData.velocity.dot(normal.clone().negate());
                
                if (velDot < 0) {
                    // CRITICAL CHANGE: Completely block other object's movement in collision direction too
                    const normalVelocity = normal.clone().negate().multiplyScalar(velDot);
                    other.userData.velocity.sub(normalVelocity);
                    
                    // Apply damping to other object
                    const friction = other.userData.friction || 0.9;
                    other.userData.velocity.multiplyScalar(friction);
                }
                
                // Position correction for other object
                const correctionStrength = collision.isWallCollision ? 1.5 : 1.2;
                const minPenetration = 0.01;
                const penetration = collision.penetration || 0.1;
                
                if (penetration > minPenetration) {
                    const correction = normal.clone().negate().multiplyScalar(penetration * correctionStrength);
                    other.position.add(correction);
                }
                
                // CRITICAL: Update OBB after position change
                ObjectManager.updateCollidableBounds(other);
            }
            
            // CRITICAL: Update OBB after position change
            ObjectManager.updateCollidableBounds(object);
        } catch (err) {
            console.error("Error applying collision response:", err);
        }
    }
    
    // Add a method to process all active collisions and restrict movement accordingly
    static processActiveCollisions(object) {
        if (!object || !object.userData || !object.userData._collisions || 
            !object.userData.velocity) return;
        
        // Get recent collisions (within the last 200ms)
        const recentCollisions = object.userData._collisions.filter(
            c => Date.now() - c.time < 200
        );
        
        // Remove old collisions
        object.userData._collisions = recentCollisions;
        
        // No recent collisions, nothing to process
        if (recentCollisions.length === 0) return;
        
        // Process each active collision to restrict movement
        for (const collision of recentCollisions) {
            const normal = collision.normal;
            
            // Check if we're trying to move into this collision again
            const movementDot = object.userData.velocity.dot(normal);
            
            // If we're trying to move into the collision surface
            if (movementDot < 0) {
                // Block that component of movement
                const normalVelocity = normal.clone().multiplyScalar(movementDot);
                object.userData.velocity.sub(normalVelocity);
                
                // Apply extra damping to prevent oscillation
                object.userData.velocity.multiplyScalar(0.85);
            }
        }
    }
    
    // Enhance the existing processAntiTunneling method
    static processAntiTunneling(object) {
        if (!object || !object.userData) return;
        
        // Process active collisions first
        this.processActiveCollisions(object);
        
        // Then handle anti-tunneling as before
        if (object.userData._collisionCheckTimer > 0) {
            object.userData._collisionCheckTimer--;
            
            // Verify we still have the needed information
            if (object.userData._collisionNormal && object.userData.velocity) {
                // Check if velocity is pointing into the collision normal
                const velDot = object.userData.velocity.dot(object.userData._collisionNormal);
                
                if (velDot < 0) {
                    // Still trying to move into collision, block this component again
                    const normalVelocity = object.userData._collisionNormal.clone().multiplyScalar(velDot);
                    object.userData.velocity.sub(normalVelocity);
                    
                    if (ObjectManager._debugEnabled) {
                        console.log("Anti-tunneling prevented movement into recent collision");
                    }
                }
            }
            
            // Clear collision data when timer expires
            if (object.userData._collisionCheckTimer <= 0) {
                object.userData._collisionNormal = null;
            }
        }
    }
};
