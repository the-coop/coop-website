import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import { Vector3, Box3, Object3D } from 'three'; // Ensure Box3 and Object3D are imported

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

                    // Apply gravity regardless of collisions
                    const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
                    player.velocity.add(toPlayer.clone().multiplyScalar(-gravity));

                    const downwardSpeed = player.velocity.dot(toPlayer);
                    player.surfaceNormal = toPlayer.clone();

                    const canLiftoff = (!player.falling && downwardSpeed < 0);
                    const onPlanet = distance <= collisionDistance;

                    // IMPROVED: Only apply planet surface collision if we didn't already have an OBB collision
                    if ((onPlanet || canLiftoff) && !hadOBBCollision) {
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
                        
                        // Simple collision response - reverse velocity along collision normal
                        const velAlongNormal = vehicle.userData.velocity.dot(normal);
                        if (velAlongNormal < 0) {
                            // We're moving toward the other object
                            vehicle.userData.velocity.addScaledVector(normal, -velAlongNormal * 1.2); // Bounce
                            
                            // Add some damping to prevent excessive bouncing
                            vehicle.userData.velocity.multiplyScalar(0.8);
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
    
    static maintainVehicleSurfaceHeight(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.planet) return;

        try {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // CRITICAL FIX: Use appropriate height for car visual positioning
            if (vehicle.userData.type === 'car') {
                // Use saved fixed height offset with more moderate value
                const targetHeight = planet.radius + 
                    (vehicle.userData.fixedHeightOffset || 3.5); // Reduced from 5.5 to 3.5
                
                // If height is off by any amount, immediately fix it
                if (Math.abs(distance - targetHeight) > 0.001) {
                    vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
                
                    // Also zero any vertical velocity component to prevent bouncing
                    if (vehicle.userData.velocity) {
                        const verticalComponent = surfaceNormal.clone().multiplyScalar(
                            vehicle.userData.velocity.dot(surfaceNormal)
                        );
                        vehicle.userData.velocity.sub(verticalComponent);
                    }
                }
                
                // Only care about orientation, not height
                if (typeof VehicleManager === 'object' && 
                    typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.1);
                } else {
                    // Fallback if VehicleManager isn't available (avoids errors)
                    vehicle.up.copy(surfaceNormal);
                }
            }
        } catch (e) {
            console.error("Error maintaining vehicle orientation:", e);
        }
    }

    // ADDED: Simple vehicle stabilization helper to handle edge cases
    static ensureVehicleStability(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.planet) {
            return false;
        }
        
        try {
            const planet = vehicle.userData.planet;
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const surfaceNormal = toVehicle.normalize();
            
            // Just ensure vehicle up vector is aligned with surface normal
            vehicle.up.copy(surfaceNormal);
            
            return true;
        } catch (e) {
            console.error("Error in ensureVehicleStability:", e);
            return false;
        }
    }
    
    // Handle vehicle landing on a planet surface
    static vehicleLanding(vehicle, surfaceNormal) {
        if (!vehicle || !vehicle.userData) return;

        try {
            console.log(`Processing landing for ${vehicle.userData.name}, was falling=${vehicle.userData.falling}, is on surface=${vehicle.userData.onSurface}`);

            let originalForward = null;
            if (vehicle.userData.type === 'car') {
                originalForward = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
            }

            const fallingSpeed = vehicle.userData.velocity.dot(surfaceNormal.clone().negate());
            console.log(`Vehicle ${vehicle.userData.name} landed on surface with impact speed: ${fallingSpeed.toFixed(2)}`);

            if (fallingSpeed > 2 && typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify(`${vehicle.userData.name} crashed with impact speed: ${fallingSpeed.toFixed(1)}!`);
            }

            if (vehicle.userData.type === 'car') {
                const planetCenter = vehicle.userData.planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter).normalize();

                // FIXED: Use the vehicle's proper fixedHeightOffset without excessive height
                vehicle.position.copy(planetCenter).addScaledVector(toVehicle, 
                    vehicle.userData.planet.radius + (vehicle.userData.fixedHeightOffset || 3.5));

                const up = toVehicle.clone();
                const projectedForward = originalForward.clone().projectOnPlane(up).normalize();
                const right = new Vector3().crossVectors(up, projectedForward).normalize();
                const correctedForward = new Vector3().crossVectors(right, up).normalize();

                vehicle.up.copy(up);
                const lookTarget = new Vector3().copy(vehicle.position).add(correctedForward);
                vehicle.lookAt(lookTarget);

                // FIXED: Completely zero vertical velocity to prevent any bouncing
                const verticalComponent = up.clone().multiplyScalar(vehicle.userData.velocity.dot(up));
                vehicle.userData.velocity.sub(verticalComponent);
                
                // FIXED: Apply very strong horizontal damping too
                vehicle.userData.velocity.multiplyScalar(0.3);
                
                // If very small velocity, just zero it completely
                if (vehicle.userData.velocity.lengthSq() < 0.01) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                
                vehicle.userData._stabilizeUntil = Date.now() + 800;
                vehicle.userData.speed = 0;  // Reset speed completely upon landing
            }
            else if (vehicle.userData.type === 'airplane') {
                // Airplane landing code would go here
            }

            vehicle.userData.falling = false;
            vehicle.userData.onSurface = true;

        } catch (e) {
            console.error("Error in vehicle landing:", e);
        }
    }

    // ADDED: Utility to ensure planet has required properties
    static validatePlanet(planet) {
        if (!planet) return false;
        
        // Check essential properties
        if (!planet.radius || !planet.object || !planet.object.position) {
            console.warn("Planet missing essential properties");
            return false;
        }
        
        // Ensure objects array exists
        if (!planet.objects) {
            console.log(`Initializing empty objects array for planet ${planet.name || "unnamed"}`);
            planet.objects = [];
        }
        
        // Ensure CoF (Coefficient of Friction) exists
        if (typeof planet.CoF !== 'number') {
            planet.CoF = 0.2; // Default friction value
        }
        
        return true;
    }

    // ADDED: New utility function to ensure object is positioned properly on planet
    static ensureObjectOnPlanetRadius(object, planetOverride = null) {
        if (!object || !object.userData) return false;
        
        try {
            // Get planet from object or from override
            const planet = planetOverride || object.userData.planet;
            if (!planet || !planet.object || !planet.radius) return false;
            
            const planetCenter = planet.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const currentDistance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Get appropriate height offset
            let heightOffset = 0;
            if (object.userData.type === 'car') {
                heightOffset = object.userData.fixedHeightOffset || 1.94;
            } else if (object.userData.type === 'wall') {
                // Walls should have their base exactly on the surface
                heightOffset = (object.userData.wallHeight || 0) / 2;
            } else {
                // Default small offset to prevent z-fighting
                heightOffset = 0.1;
            }
            
            // Calculate target height
            const targetHeight = planet.radius + heightOffset;
            
            // If object isn't at correct height, fix it
            if (Math.abs(currentDistance - targetHeight) > 0.01) {
                object.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
                object.userData.surfaceNormal = surfaceNormal;
                
                // Also ensure object is properly oriented to planet
                if (object.up) {
                    object.up.copy(surfaceNormal);
                }
                
                return true; // Position was corrected
            }
            
            return false; // No correction needed
        } catch (err) {
            console.error("Error in ensureObjectOnPlanetRadius:", err);
            return false;
        }
    }

    // IMPROVED: Update non-vehicles method to use OBB collisions consistently
    static updateNonVehicles() {
        try {
            // Handle player physics - skip if in vehicle
            PlayersManager.players.forEach(player => {
                if (!player || player.inVehicle) return;
                
                // ENHANCED: Always use OBB collision detection for players
                if (player.handle && player.collidable) {
                    // Force update player OBB before collision checks
                    ObjectManager.updateCollidableBounds(player.handle);
                    
                    // Use OBB collision detection universally
                    const collidables = ObjectManager.collidableObjects.filter(c => 
                        c && c.active && c.object !== player.handle);
                    
                    // Check for collisions with all object types using OBB
                    const collisions = ObjectManager.checkCollisionsWithObject(player.handle);
                    
                    if (collisions.length > 0) {
                        // Apply collision response
                        collisions.forEach(collision => {
                            this.applyCollisionResponse(player.handle, collision);
                        });
                    }
                }
                
                // Process planet physics after OBB collisions
                try {
                    if (!player.soi || !player.soi.radius || !player.soi.object) return;

                    const planetRadius = player.soi.radius;
                    const collisionDistance = planetRadius + 0.5;
                    const soi = player.soi.object;
                    
                    if (!soi || !soi.position) return;
                    
                    const toPlayer = player.position.clone().sub(soi.position);
                    const distance = toPlayer.length();
                    toPlayer.normalize();

                    // Apply gravity regardless of collisions
                    const gravity = GRAVITY_CONSTANT / Math.pow(distance / planetRadius, 2);
                    player.velocity.add(toPlayer.clone().multiplyScalar(-gravity));

                    const downwardSpeed = player.velocity.dot(toPlayer);
                    player.surfaceNormal = toPlayer.clone();

                    const canLiftoff = (!player.falling && downwardSpeed < 0);
                    const onPlanet = distance <= collisionDistance;

                    // IMPROVED: Only apply planet surface collision if we didn't already have an OBB collision
                    if ((onPlanet || canLiftoff) && !hadOBBCollision) {
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

            // Process non-vehicle physics objects
            for (const collidable of ObjectManager.collidableObjects) {
                if (!collidable || !collidable.active || collidable.isStatic) continue;
                if (collidable.type === 'player') continue;
                if (collidable.type === 'vehicle') continue; // Skip vehicles
                
                // ENHANCED: Always use OBB for all object collisions
                if (collidable.object && collidable.object.userData && collidable.object.userData.velocity) {
                    // Apply OBB collision detection to this object
                    const collisions = ObjectManager.checkCollisionsWithObject(collidable.object);
                    
                    if (collisions.length > 0) {
                        collisions.forEach(collision => {
                            this.applyCollisionResponse(collidable.object, collision);
                        });
                    }
                }
                
                if (collidable.object && collidable.object.userData && collidable.object.userData.planet) {
                    // For any object on a planet, ensure it respects the planet radius
                    this.ensureObjectOnPlanetRadius(collidable.object);
                    
                    // Update object's collision bounds
                    ObjectManager.updateCollidableBounds(collidable.object);
                }
            }
            
            // Still update player colliders
            PlayersManager.updatePlayerColliders();
        } catch (err) {
            console.error("Error in updateNonVehicles:", err);
        }
    }

    // ENHANCED: Unified collision processing for both planet spheres and OBB
    static processCollisions(object) {
        if (!object || !object.userData || !object.position) return null;
        
        try {
            // IMPROVED: Always use OBB collisions first, regardless of environment
            // OBB collisions are more accurate in all scenarios, not just on planetary surfaces
            const collisions = ObjectManager.checkCollisionsWithObject(object);
            let hadOBBCollision = false;
            
            if (collisions.length > 0) {
                hadOBBCollision = true;
                for (const collision of collisions) {
                    // Apply collision response
                    this.applyCollisionResponse(object, collision);
                }
            }
            
            // Planet surface detection is a secondary collision check
            // Only applied when not conflicting with primary OBB collisions
            const planetCollision = this.checkPlanetSurfaceCollision(object);
            if (planetCollision) {
                // Only apply planet collision if it doesn't conflict with OBB collision
                if (!hadOBBCollision || !planetCollision.conflictsWithOBB) {
                    this.applyPlanetCollisionResponse(object, planetCollision);
                }
            }
            
            return {
                hadObjectCollision: hadOBBCollision,
                hadPlanetCollision: !!planetCollision,
                objectCollisions: collisions,
                planetCollision: planetCollision
            };
        } catch (err) {
            console.error("Error processing collisions:", err);
            return null;
        }
    }
    
    // Check if an object has collided with a planet surface
    static checkPlanetSurfaceCollision(object) {
        if (!object || !object.userData || !object.position) return null;
        
        try {
            // Get sphere of influence (nearest planet)
            const planet = object.userData.planet || this.calculateSOI(object.position);
            if (!planet || !planet.radius || !planet.object) return null;
            
            const planetCenter = planet.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const distance = toObject.length();
            const surfaceNormal = toObject.clone().normalize();
            
            // Determine collision parameters based on object type
            let collisionDistance = planet.radius;
            let collisionBuffer = 0.5; // Default buffer
            
            if (object.userData.type === 'player') {
                collisionBuffer = 0.5;
            } else if (object.userData.type === 'vehicle') {
                // Use vehicle's fixedHeightOffset if available
                collisionBuffer = object.userData.fixedHeightOffset || 
                    (object.userData.type === 'car' ? 1.94 : 3.0);
            } else if (object.userData.type === 'wall') {
                // Walls should have their base exactly on the surface
                collisionBuffer = (object.userData.wallHeight || 0) / 2;
            }
            
            // Calculate final collision distance
            const finalCollisionDistance = planet.radius + collisionBuffer;
            const isColliding = distance <= finalCollisionDistance;
            
            // Check if object is moving toward planet
            const velocity = object.userData.velocity;
            const movingToward = velocity ? velocity.dot(surfaceNormal) < 0 : false;
            
            if (isColliding || (movingToward && distance < finalCollisionDistance + 2.0)) {
                return {
                    planet: planet,
                    distance: distance,
                    surfaceNormal: surfaceNormal,
                    penetrationDepth: finalCollisionDistance - distance,
                    isColliding: isColliding,
                    movingToward: movingToward,
                    collisionPoint: planetCenter.clone().add(surfaceNormal.clone().multiplyScalar(planet.radius)),
                    conflictsWithOBB: false // Will be determined later if needed
                };
            }
            
            return null;
        } catch (err) {
            console.error("Error checking planet collision:", err);
            return null;
        }
    }

    // Apply collision response for object-to-object collisions using OBB data
    static applyCollisionResponse(object, collision) {
        if (!object || !object.userData || !collision) return;
        
        try {
            // Get collision properties
            const normal = collision.normal;
            const other = collision.other;
            
            // Calculate mass ratio for momentum conservation
            const objectMass = object.userData.mass || 100;
            const otherMass = other.userData.mass || 100;
            const totalMass = objectMass + otherMass;
            const objectRatio = objectMass / totalMass;
            const otherRatio = otherMass / totalMass;
            
            // Only apply physics to non-static objects
            if (object.userData.velocity) {
                // Calculate impulse based on velocity alignment with normal
                const velDot = object.userData.velocity.dot(normal);
                
                if (velDot < 0) {
                    // Moving toward the object, apply bounce
                    const restitution = 0.3; // Bounciness factor
                    const impulseStrength = -velDot * (1 + restitution) * otherRatio;
                    object.userData.velocity.addScaledVector(normal, impulseStrength);
                    
                    // Add some friction to slow sliding along surfaces
                    const friction = object.userData.friction || 0.9;
                    object.userData.velocity.multiplyScalar(friction);
                }
                
                // Apply position correction to prevent objects from getting stuck
                const correctionStrength = 0.8;
                const minPenetration = 0.05;
                const penetration = collision.penetration || 0.1; // Use provided value or estimate
                
                if (penetration > minPenetration) {
                    const correction = normal.clone().multiplyScalar(penetration * correctionStrength);
                    object.position.add(correction);
                }
            }
            
            // Apply physics to other object if it's dynamic
            if (other.userData && other.userData.isDynamic && other.userData.velocity) {
                // Calculate inverse impulse for other object
                const velDot = other.userData.velocity.dot(normal.clone().negate());
                
                if (velDot < 0) {
                    // Other object moving toward this object
                    const restitution = 0.3;
                    const impulseStrength = -velDot * (1 + restitution) * objectRatio;
                    other.userData.velocity.addScaledVector(normal.clone().negate(), impulseStrength);
                    
                    // Apply friction
                    const friction = other.userData.friction || 0.9;
                    other.userData.velocity.multiplyScalar(friction);
                }
                
                // Position correction for other object
                const correctionStrength = 0.8;
                const minPenetration = 0.05;
                const penetration = collision.penetration || 0.1; // Estimated
                
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
};
