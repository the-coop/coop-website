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
                    console.log("Player missing collidable in physics loop - creating");
                    PlayersManager.initializePlayerCollider(player, true);
                }
                
                // NEW: Additional validation that player handle is properly registered
                if (player.handle && player.collidable) {
                    // CRITICAL FIX: Check if function exists before calling it
                    let isRegistered = false;
                    if (typeof ObjectManager.validateCollidable === 'function') {
                        isRegistered = ObjectManager.validateCollidable(player.handle);
                    } else {
                        // Use fallback implementation
                        isRegistered = this._fallbackValidateCollidable(player.handle);
                    }
                    
                    if (!isRegistered) {
                        console.warn("Player handle not found in collidables despite having collidable reference");
                        PlayersManager.initializePlayerCollider(player, true);
                    }
                }
                
                // Ensure active flag is set for collisions
                if (player.collidable) {
                    player.collidable.active = true;
                }
                
                // Reset collision state at the beginning of each frame
                // We'll set this to true only when an actual collision is detected
                player.currentlyColliding = false;
                player.standingOnObject = false;
                
                let hadOBBCollision = false;
                
                // CRITICAL FIX: Force matrix update with complete reconstruction of world matrix
                if (player.handle) {
                    // NEW: Ensure handle position matches player position
                    if (!player.position.equals(player.handle.position)) {
                        player.handle.position.copy(player.position);
                    }
                    
                    player.handle.updateMatrix();
                    player.handle.updateMatrixWorld(true);
                    
                    if (player.collidable) {
                        // Force a complete rebuild of collision bounds
                        const updated = ObjectManager.updateCollidableBounds(player.handle);
                        if (!updated) {
                            console.warn("Failed to update player collision bounds - fixing");
                            PlayersManager.initializePlayerCollider(player, true);
                        }
                        
                        // IMPROVED: Validate OBB before attempting to log center
                        if (player.collidable.obb) {
                            // Validate OBB components
                            if (ObjectManager.validateOBB(player.collidable.obb, player.handle)) {
                                // Log collision box state for debugging - CLARIFIED "enabled" vs "colliding"
                                console.log(`Player collision detection: enabled=${player.collidable.active}, type=${player.collidable.type}, colliding=${player.currentlyColliding || false}`);
                                console.log(`OBB center: ${player.collidable.obb.center.x.toFixed(2)}, ${player.collidable.obb.center.y.toFixed(2)}, ${player.collidable.obb.center.z.toFixed(2)}`);
                            } else {
                                console.log(`Player collision box: enabled=${player.collidable.active}, type=${player.collidable.type} (OBB invalid)`);
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
                                
                                // IMPROVED: Include all test cubes and collision objects in proximity check
                                if (item.type === 'wall' || item.type === 'testCube') {
                                    // Always check wall and test cube collisions within a reasonable distance
                                    const distSq = player.position.distanceToSquared(item.object.position);
                                    return distSq < 100 * 100; // Extended distance for test objects (100 units)
                                }
                                
                                // For other objects, use closer distance threshold
                                const maxCollisionDist = 25;
                                const distSq = player.position.distanceToSquared(item.object.position);
                                return distSq < maxCollisionDist * maxCollisionDist;
                            });
                            
                            // Log nearby test objects for debugging
                            const testCubeCount = nearbyObjects.filter(o => o.type === 'testCube').length;
                            if (testCubeCount > 0) {
                                console.log(`Found ${testCubeCount} nearby test cubes for collision check`);
                                
                                // ADDED: Detailed logging of distance to each test cube
                                nearbyObjects.filter(o => o.type === 'testCube').forEach(cube => {
                                    const cubeDistance = player.position.distanceTo(cube.object.position);
                                    const cubeSize = Math.max(
                                        cube.object.userData?.width || 2, 
                                        cube.object.userData?.height || 2,
                                        cube.object.userData?.depth || 2
                                    );
                                    console.log(`Test cube distance: ${cubeDistance.toFixed(2)} units (Size: ${cubeSize.toFixed(1)}, Collision threshold: 100.0)`);
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
                        
                        // IMPROVED: COMPLETELY BLOCK MOVEMENT IN COLLISION DIRECTION
                        if (collide) {
                            hadOBBCollision = true;
                            player.currentlyColliding = true; // IMPORTANT: Mark that a collision is happening
                            const { collisionNormal, collisionPosition, closestObject } = collide;
                            
                            // Store collision info in player for FPS controller to use
                            if (!player.activeCollisions) {
                                player.activeCollisions = [];
                            }
                            
                            // Add this collision to player's active collisions list
                            player.activeCollisions.push({
                                normal: collisionNormal.clone(),
                                position: collisionPosition.clone(),
                                object: closestObject.object,
                                time: Date.now()
                            });
                            
                            // Limit the number of stored collisions
                            if (player.activeCollisions.length > 5) {
                                player.activeCollisions.shift(); // Remove oldest
                            }
                            
                            // CRITICAL FIX: Make sure detected collisions actually block movement
                            // Revert completely to original position instead of trying to slide
                            player.position.copy(originalPosition);
                            
                            // CRITICAL FIX: Apply additional offset in the collision normal direction
                            // This prevents "sticky" collisions by pushing player slightly away
                            player.position.addScaledVector(collisionNormal, 0.2);
                            
                            // Update handle position
                            if (player.handle) {
                                player.handle.position.copy(player.position);
                            }
                            
                            // CRITICAL FIX: COMPLETELY eliminate velocity in the collision normal direction
                            const velDot = player.velocity.dot(collisionNormal);
                            
                            if (velDot < 0) {
                                // Remove ALL velocity component in direction of collision
                                const normalVelocity = collisionNormal.clone().multiplyScalar(velDot);
                                player.velocity.sub(normalVelocity);
                                
                                // Apply additional damping to prevent oscillation
                                player.velocity.multiplyScalar(0.8);
                                
                                console.log("Collision blocked - Velocity corrected to prevent penetration");
                            }
                            
                            // NEW: Detect landing on objects by checking if collision is from above
                            // We consider it landing when:
                            // 1. The collision normal is pointing mostly upward
                            // 2. The player was falling before the collision
                            const upVector = player.soi ? 
                                player.position.clone().sub(player.soi.object.position).normalize() : 
                                new Vector3(0, 1, 0);
                                
                            const normalDotUp = collisionNormal.dot(upVector);
                            
                            // If collision normal is pointing up (dot > 0.7) and we were falling,
                            // then we've landed on the object
                            if (normalDotUp > 0.7 && player.falling) {
                                console.log("Player landed on object");
                                player.falling = false;
                                player.standingOnObject = true;
                                
                                // Set the surface normal to the collision normal
                                // This is critical for camera orientation in FPSController
                                player.surfaceNormal = collisionNormal.clone();
                                
                                // Trigger the controller's landing method if it exists
                                if (ControlManager.controller?.landing) {
                                    ControlManager.controller.landing(collisionNormal);
                                }
                            }
                            // Handle lateral collisions separately
                            else if (Math.abs(normalDotUp) < 0.3) {
                                console.log("Lateral collision with object");
                                // Don't change falling state - this is a wall collision
                            }
                            
                            // Update collision bounds again after position correction
                            if (player.handle && player.collidable) {
                                ObjectManager.updateCollidableBounds(player.handle);
                            }
                            
                            // Show collision notification for specific object types
                            if (typeof window !== 'undefined' && window.gameNotify) {
                                if (collide.isWallCollision) {
                                    window.gameNotify("Wall collision - movement blocked");
                                } else if (closestObject && closestObject.type === 'testCube') {
                                    window.gameNotify(`Test cube collision - movement blocked`);
                                } else if (closestObject && closestObject.type) {
                                    window.gameNotify(`Collision with ${closestObject.type} - movement blocked`);
                                }
                            }
                            
                            break; // Stop checking further steps after collision
                        }
                    } catch (stepErr) {
                        console.error("Error in physics step:", stepErr);
                    }
                }

                // ANTI-TUNNELING: Process active collisions from past frames
                if (player._lastCollisions && player._lastCollisions.length > 0) {
                    const now = Date.now();
                    const activeCollisions = player._lastCollisions.filter(c => now - c.time < 300);
                    player._lastCollisions = activeCollisions; // Keep only active ones
                    
                    if (activeCollisions.length > 0) {
                        // We still have active collisions from previous frames
                        player.currentlyColliding = true;
                    }
                    
                    // Process each active collision
                    activeCollisions.forEach(collision => {
                        // If we're still trying to move into this collision
                        const velDot = player.velocity.dot(collision.normal);
                        
                        if (velDot < 0) {
                            // Still trying to move into collision, block that component
                            const normalVelocity = collision.normal.clone().multiplyScalar(velDot);
                            player.velocity.sub(normalVelocity);
                            
                            // Apply extra damping to prevent oscillation
                            player.velocity.multiplyScalar(0.9);
                            console.log("Anti-tunneling blocked potential penetration");
                        }
                    });
                }

                // NEW: Enforce previously detected collisions for a short time
                // This prevents "jittering" through objects by repeatedly trying to move in the blocked direction
                if (player._lastBlockedDirections && player._lastBlockedDirections.length > 0) {
                    const now = Date.now();
                    const blockedMovement = new Vector3();
                    
                    player._lastBlockedDirections.forEach(dir => {
                        // Only consider fresh collisions (less than 300ms old)
                        if (now - dir.time < 300) {
                            // If still trying to move in blocked direction, cancel that component
                            const velDot = player.velocity.dot(dir.normal);
                            if (velDot < 0) {
                                const blockComponent = dir.normal.clone().multiplyScalar(velDot);
                                blockedMovement.add(blockComponent);
                            }
                        }
                    });
                    
                    // Apply the accumulated blocking effect
                    if (blockedMovement.lengthSq() > 0) {
                        player.velocity.sub(blockedMovement);
                        console.log("Anti-tunneling blocked continued penetration attempt");
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
                        
                        // Only update surfaceNormal if not standing on object
                        // This preserves the object's surface normal when standing on it
                        player.surfaceNormal = toPlayer.clone();
                    } else {
                        // We are standing on an object, apply friction similar to planet surface
                        if (player.soi.CoF) {
                            player.velocity.multiplyScalar(1 - player.soi.CoF);
                        }
                    }

                    const downwardSpeed = player.velocity.dot(toPlayer);
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

                        // FIXED: Ensure landing handler is called when transitioning from object to planet
                        // This fixes the camera orientation when jumping from objects to the planet
                        if ((player.falling || player.wasOnObject) && !inVehicle && ControlManager.controller?.landing) {
                            console.log("Landing on planet surface after object or fall");
                            ControlManager.controller.landing(toPlayer);
                            player.wasOnObject = false; // Clear the transition flag
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
                        // NEW: Only set falling to true if not standing on an object
                        if (!player.standingOnObject && !player.falling) {
                            const inVehicle = VehicleManager.currentVehicle &&
                                VehicleManager.currentVehicle.player === player;

                            if (!inVehicle && ControlManager.controller?.liftoff) {
                                ControlManager.controller.liftoff(toPlayer);
                            }
                            player.falling = true;
                        }
                        // NEW: Track when player was previously on an object but is now falling
                        // This helps ensure landing is called when returning to planet surface
                        else if (!player.falling && player.standingOnObject && 
                                 player.velocity.dot(player.surfaceNormal) > 0.5) {
                            // Player is jumping off an object (velocity going in surface normal direction)
                            player.wasOnObject = true;
                            console.log("Player jumping off object");
                        }
                    }
                } catch (gravityErr) {
                    console.error("Error in planet gravity processing:", gravityErr);
                }

                // Update player's collision bounds one final time after all movement
                if (player.handle && player.collidable) {
                    try {
                        // CRITICAL FIX: Check if method exists before calling it
                        if (typeof ObjectManager.updateCollidableBounds === 'function') {
                            ObjectManager.updateCollidableBounds(player.handle);
                        } else {
                            // Fallback implementation if method doesn't exist
                            console.warn("ObjectManager.updateCollidableBounds not available - using fallback");
                            this._fallbackUpdateCollidableBounds(player.handle);
                        }
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
                        // CRITICAL FIX: Check if method exists before calling it
                        if (typeof ObjectManager.updateCollidableBounds === 'function') {
                            ObjectManager.updateCollidableBounds(collidable.object);
                        } else {
                            // Fallback implementation
                            this._fallbackUpdateCollidableBounds(collidable.object);
                        }
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
    
    // NEW: Fallback implementation for updateCollidableBounds when ObjectManager method is unavailable
    static _fallbackUpdateCollidableBounds(object) {
        if (!object) return false;
        
        try {
            // Find the collidable in ObjectManager's registry
            const collidable = ObjectManager.collidableObjects.find(c => c && c.object === object);
            if (!collidable) return false;
            
            // Update AABB bounds from object
            if (collidable.aabb) {
                collidable.aabb.setFromObject(object);
            }
            
            // Update OBB if it exists
            if (collidable.obb) {
                // Update center to match object position
                if (collidable.obb.center && object.position) {
                    collidable.obb.center.copy(object.position);
                }
                
                // Force update of object matrix
                if (object.updateMatrixWorld) {
                    object.updateMatrixWorld(true);
                }
            }
            
            return true;
        } catch (err) {
            console.error("Error in fallback updateCollidableBounds:", err);
            return false;
        }
    }
    
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
            
            // FIXED: Ensure we're calling the function that exists and safely handle missing functions
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
                if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal);
                } else {
                    console.warn("VehicleManager.alignVehicleToPlanetSurface is not available");
                    
                    // Simple fallback alignment
                    const yAxis = new Vector3(0, 1, 0);
                    const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
                    const angle = Math.acos(yAxis.dot(surfaceNormal));
                    
                    if (rotationAxis.lengthSq() > 0.0001) {
                        const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                        vehicle.quaternion.slerp(alignQuat, 0.1);
                    }
                }
                
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

            // ENHANCED: Update OBB collision bounds after moving vehicle - with safety check
            if (vehicle.collidable) {
                // CRITICAL FIX: Check if method exists before calling it
                if (typeof ObjectManager.updateCollidableBounds === 'function') {
                    ObjectManager.updateCollidableBounds(vehicle);
                } else {
                    // Use our fallback implementation
                    this._fallbackUpdateCollidableBounds(vehicle);
                }
            }
            
        } catch (e) {
            console.error("Error in vehicle physics:", e);
        }
    }
    
    // Add missing maintainVehicleSurfaceHeight method
    static maintainVehicleSurfaceHeight(vehicle) {
        if (!vehicle || !vehicle.userData) return;
        
        try {
            // Get or calculate planet
            if (!vehicle.userData.planet) {
                vehicle.userData.planet = this.calculateSOI(vehicle.position);
            }
            const planet = vehicle.userData.planet;
            if (!planet) return;
            
            const planetCenter = planet.object.position;
            const toVehicle = vehicle.position.clone().sub(planetCenter);
            const distance = toVehicle.length();
            const surfaceNormal = toVehicle.normalize();
            
            // Store surface normal in vehicle for alignment and collision
            vehicle.userData.surfaceNormal = surfaceNormal;
            
            // Get fixed height offset or use default
            const heightOffset = vehicle.userData.fixedHeightOffset || 
                                (vehicle.userData.type === 'car' ? 3.0 : 5.0);
                                
            const groundLevel = planet.radius + heightOffset;
            
            // Only adjust if significantly different from target height
            if (Math.abs(distance - groundLevel) > 0.5) {
                // Calculate new position at correct height
                const newPosition = planetCenter.clone().addScaledVector(
                    surfaceNormal,
                    groundLevel
                );
                
                // Apply slight smoothing for less abrupt height correction
                vehicle.position.lerp(newPosition, 0.1);
                
                // Update vehicle's matrix
                vehicle.updateMatrix();
                vehicle.updateMatrixWorld(true);
                
                if (vehicle.userData.debug) {
                    console.log(`Maintaining vehicle height: ${(distance - planet.radius).toFixed(2)} → ${heightOffset.toFixed(2)}`);
                }
            }
            
            // Make sure vehicle is aligned to surface
            if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.1);
            }
            
            // CRITICAL FIX: Update collision bounds after position change with safety check
            if (vehicle.collidable) {
                if (typeof ObjectManager.updateCollidableBounds === 'function') {
                    ObjectManager.updateCollidableBounds(vehicle);
                } else {
                    this._fallbackUpdateCollidableBounds(vehicle);
                }
            }
            
        } catch (err) {
            console.error("Error maintaining vehicle surface height:", err);
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

    // Using OBB for accurate collision detection on planetary surfaces
    static checkCollisions(player, objects, timeStep) {
        if (!player || !objects || objects.length === 0) return null;

        let closestObject = null;
        let closestPosition = null;
        let closestTime = Infinity;

        try {
            objects.forEach(object => {
                if (!object || !object.collidable || !object.obb) return;

                // Check for collision using OBB
                const result = ObjectManager.checkOBBCollision(player, object, timeStep);
                if (result && result.time < closestTime) {
                    closestTime = result.time;
                    closestObject = object;
                    closestPosition = result.position;
                }
            });

            // CRITICAL FIX: More aggressive position correction to completely block player movement through objects
            if (closestPosition === null) return null;
            
            try {
                // Get more accurate collision normal by using OBB face normal
                const collisionNormal = this.getOBBNormalAtPoint(
                    closestPosition, 
                    closestObject.obb,
                    closestObject.object
                ).normalize();
                
                // ENHANCED: Log collision information for debugging
                if (this._debugEnabled) {
                    console.log(`COLLISION DETECTED: Player vs ${closestObject.type}`);
                    console.log(`Position: ${closestPosition.x.toFixed(2)}, ${closestPosition.y.toFixed(2)}, ${closestPosition.z.toFixed(2)}`);
                    console.log(`Normal: ${collisionNormal.x.toFixed(2)}, ${collisionNormal.y.toFixed(2)}, ${collisionNormal.z.toFixed(2)}`);
                }
                
                // CRITICAL FIX: Store collision information in player for stronger enforcement
                if (!player._lastBlockedDirections) {
                    player._lastBlockedDirections = [];
                }
                
                // Store this collision direction for additional movement restriction
                player._lastBlockedDirections.push({
                    normal: collisionNormal.clone(),
                    position: closestPosition.clone(),
                    time: Date.now(),
                    objectId: closestObject.object.id || closestObject.object.uuid
                });
                
                // Keep only recent collisions
                player._lastBlockedDirections = player._lastBlockedDirections.filter(
                    dir => Date.now() - dir.time < 500 // Keep only collisions from last 500ms
                );
                
                // Add special handling for vehicle collisions
                if (closestObject.type === 'vehicle') {
                    return {
                        collisionNormal,
                        collisionPosition: closestPosition,
                        closestObject,
                        closestTime,
                        isVehicleCollision: true  // Mark this as vehicle collision
                    };
                }
                
                return { collisionNormal, collisionPosition: closestPosition, closestObject, closestTime };
            } catch (err) {
                console.error("Error in collision result creation:", err);
                return null;
            }
        } catch (err) {
            console.error("CRITICAL ERROR in checkCollisions:", err);
            return null;
        }
    }

    // Add the applyCollisionResponse method to enforce collision physics
    static applyCollisionResponse(object, collision) {
        if (!object || !collision || !collision.normal) return;
        
        try {
            // Get the collision normal and penetration depth
            const normal = collision.normal;
            const penetrationDepth = collision.penetrationDepth || 0.2; // Default if not provided
            
            // CRITICAL: Move the object back along the normal to prevent penetration
            const pushbackDistance = Math.max(penetrationDepth, 0.1) * 1.1; // Add a small buffer
            object.position.addScaledVector(normal, pushbackDistance);
            
            // If object has velocity, modify it to prevent continued penetration
            if (object.velocity) {
                // Calculate how much velocity is going into the collision
                const velDot = object.velocity.dot(normal);
                
                // If moving toward the collision, remove that component of velocity
                if (velDot < 0) {
                    const removeVel = normal.clone().multiplyScalar(velDot);
                    object.velocity.sub(removeVel);
                    
                    // Add a small bounce effect
                    const bounceFactor = 0.1;
                    object.velocity.addScaledVector(normal, -velDot * bounceFactor);
                    
                    // Also apply some general friction/damping
                    object.velocity.multiplyScalar(0.8);
                }
            }
            
            // Update object's handle position if it exists
            if (object.handle) {
                object.handle.position.copy(object.position);
            }
            
            // If this is a player, mark collision for stronger enforcement
            if (object.type === 'player' && !object._collisionResponse) {
                object._collisionResponse = {
                    normal: normal.clone(),
                    time: Date.now(),
                    expires: Date.now() + 200  // Enforce for 200ms to prevent jittering
                };
            }
            
            return true;
        } catch (err) {
            console.error("Error in collision response:", err);
            return false;
        }
    }
    
    // ENHANCED: Improved anti-tunneling processing
    static processAntiTunneling(object) {
        if (!object || !object.userData) return;
        
        // Process active collisions first
        this.processActiveCollisions(object);
        
        // Process recent collisions with decay
        if (object.userData._recentCollisions && object.userData._recentCollisions.length > 0) {
            const now = Date.now();
            object.userData._recentCollisions = object.userData._recentCollisions.filter(c => {
                // Keep collisions from the last 500ms
                const age = now - c.time;
                if (age > 500) return false;
                
                // Decay strength over time
                c.strength = Math.max(0.1, 1.0 - (age / 500));
                return true;
            });
            
            // Only process if we have velocity
            if (object.userData.velocity && object.userData.velocity.lengthSq() > 0.001) {
                // Check against all recent collisions
                for (const collision of object.userData._recentCollisions) {
                    // Check if we're moving toward this collision again
                    const velDot = object.userData.velocity.dot(collision.normal);
                    
                    if (velDot < 0) {
                        // Apply repulsion proportional to collision strength and penetration attempt
                        const repulsionForce = -velDot * collision.strength;
                        const repulsion = collision.normal.clone().multiplyScalar(repulsionForce);
                        object.userData.velocity.add(repulsion);
                        
                        console.log(`Anti-tunneling: Applied repulsion force (${repulsionForce.toFixed(2)})`);
                    }
                }
            }
        }
        
        // Then handle standard anti-tunneling as before
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
                    
                    // Apply additional damping to prevent repeated attempts
                    object.userData.velocity.multiplyScalar(0.8);
                    
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
    
    // NEW: Fallback function to validate collidable objects when ObjectManager function is not available
    static _fallbackValidateCollidable(object) {
        if (!object || !ObjectManager.collidableObjects) return false;
        
        // Check if the object exists in the collidable registry
        const found = ObjectManager.collidableObjects.some(c => 
            c && c.object === object);
        
        return found;
    }
};
