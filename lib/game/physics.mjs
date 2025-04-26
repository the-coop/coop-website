import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import { Vector3, Box3, Object3D, Plane, Quaternion } from 'three'; // Added Quaternion

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
                    
                    // IMPORTANT: Only update collision bounds once per frame to prevent jitter
                    if (player.collidable) {
                        // Only do a single bounds update per frame
                        const updated = ObjectManager.updateCollidableBounds(player.handle);
                        if (!updated) {
                            PlayersManager.initializePlayerCollider(player, true);
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
                            
                            // REMOVE REDUNDANT UPDATE: Don't update collision bounds here
                            // This prevents multiple OBB updates per frame that cause jitter
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
                        
                        // IMPROVED COLLISION RESPONSE: Use a single unified approach
                        if (collide) {
                            hadOBBCollision = true;
                            player.currentlyColliding = true;
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
                            
                            // FIXED: Properly calculate penetration to block movement 
                            // Calculate penetration distance once
                            // FIX: The penetrationDistance calculation was broken (undeclared variable)
                            const stepDir = stepVelocity.clone().normalize();
                            const penetrationDistance = stepDir.dot(collisionNormal);
                            
                            // FIXED: Increase collision pushback distance to prevent movement through objects
                            // Apply position correction with larger buffer to prevent clipping
                            if (penetrationDistance < 0) {
                                // Increase buffer from 0.05 to 0.3 for guaranteed separation
                                const correctionDistance = -(penetrationDistance + 0.3);
                                
                                // FIXED: Use the original position before the collision
                                player.position.copy(originalPosition);
                                
                                // Add slight offset in normal direction to prevent sticking
                                player.position.addScaledVector(collisionNormal, 0.1);
                                
                                // Update handle position immediately to match
                                if (player.handle) {
                                    player.handle.position.copy(player.position);
                                }
                                
                                // IMPROVED: More aggressive velocity blocking to prevent continued penetration
                                if (player.velocity) {
                                    const velDot = player.velocity.dot(collisionNormal);
                                    if (velDot < 0) {
                                        // Remove velocity component toward collision
                                        player.velocity.addScaledVector(collisionNormal, -velDot * 1.2); // 20% extra to ensure separation
                                        
                                        // Apply stronger friction to sliding movement
                                        player.velocity.multiplyScalar(0.8);
                                        
                                        // FIXED: Set an explicit blocker flag for the FPSController to use
                                        player._movementBlocked = {
                                            normal: collisionNormal.clone(),
                                            time: Date.now(),
                                            object: closestObject
                                        };
                                        
                                        // Debug output to confirm collision response
                                        console.log("Movement blocked due to collision with " + 
                                                  (closestObject ? closestObject.type : "unknown"));
                                    }
                                }
                            }
                            
                            // Get planet up vector for collision classification
                            const upVector = player.soi ? 
                                player.position.clone().sub(player.soi.object.position).normalize() : 
                                new Vector3(0, 1, 0);
                                
                            const normalDotUp = collisionNormal.dot(upVector);
                            
                            // Classify collision type based on normal direction
                            const isUpwardCollision = normalDotUp > 0.6;
                            const isLateralCollision = Math.abs(normalDotUp) < 0.6;
                            const isDownwardCollision = normalDotUp < -0.5;
                            
                            // Handle special states based on collision type
                            if (isUpwardCollision && player.falling) {
                                // Landing on an object
                                player.falling = false;
                                player.standingOnObject = true;
                                player.surfaceNormal = collisionNormal.clone();
                                
                                // Trigger the controller's landing method if it exists
                                if (ControlManager.controller?.landing) {
                                    ControlManager.controller.landing(collisionNormal);
                                }
                            }
                            else if (isLateralCollision) {
                                // Handle lateral collisions - maintain grounded state if already grounded
                                const isOnSurface = !player.falling || player.standingOnObject;
                                if (isOnSurface) {
                                    player.falling = false;
                                }
                            }
                            else if (isDownwardCollision) {
                                // Handle hitting a ceiling
                                player.falling = true;
                                
                                // Zero any upward velocity
                                const upwardVel = player.velocity.dot(upVector);
                                if (upwardVel > 0) {
                                    player.velocity.addScaledVector(upVector, -upwardVel * 1.1);
                                }
                            }
                            
                            // SIMPLIFIED: Skip additional matrix and bounds updates here
                            // We'll do a single update after all physics is complete
                            
                            // Show collision notification for specific object types
                            if (typeof window !== 'undefined' && window.gameNotify) {
                                if (collide.isWallCollision) {
                                    window.gameNotify("Wall collision - sliding along surface");
                                } else if (closestObject && closestObject.type === 'testCube') {
                                    window.gameNotify(`Test cube collision - sliding along surface`);
                                }
                            }
                            
                            break; // Stop checking further steps after collision
                        }
                    } catch (stepErr) {
                        console.error("Error in physics step:", stepErr);
                    }
                }

                // IMPROVED: Process movement blockers even if no collision happened this frame
                // This prevents "squeezing" through objects due to frame timing
                if (!hadOBBCollision && player._movementBlocked) {
                    const now = Date.now();
                    const blockAge = now - player._movementBlocked.time;
                    
                    // Keep blocking for a short time even if no collision detected this frame
                    if (blockAge < 150) { // 150ms of continued blocking
                        if (player.velocity) {
                            const velDot = player.velocity.dot(player._movementBlocked.normal);
                            if (velDot < 0) {
                                // Continue to block movement in this direction for a short period
                                player.velocity.addScaledVector(player._movementBlocked.normal, -velDot);
                                console.log("Continued movement blocking from previous collision");
                            }
                        }
                    } else {
                        // Clear the blocker after the grace period
                        player._movementBlocked = null;
                    }
                }

                // SIMPLIFIED: Consolidate anti-tunneling logic to reduce redundancy
                // Only process active collisions if no collision happened this frame
                if (!hadOBBCollision && player._lastCollisions && player._lastCollisions.length > 0) {
                    const now = Date.now();
                    const activeCollisions = player._lastCollisions.filter(c => now - c.time < 300);
                    player._lastCollisions = activeCollisions; // Keep only active ones
                    
                    if (activeCollisions.length > 0) {
                        // Process each active collision once
                        activeCollisions.forEach(collision => {
                            const velDot = player.velocity.dot(collision.normal);
                            if (velDot < 0) {
                                player.velocity.addScaledVector(collision.normal, -velDot);
                                player.velocity.multiplyScalar(0.9);
                            }
                        });
                    }
                }

                // Apply planet gravity and surface handling
                try {
                    if (!player.soi || !player.soi.radius || !player.soi.object) return;

                    const planetRadius = player.soi.radius;
                    // FIXED: Increase distance above planet surface to prevent ground clipping
                    // Increased from 0.5 to 0.8 to keep player further above ground
                    const collisionDistance = planetRadius + 0.8;
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

                        // ENHANCED: Better detection for landing after jumping off objects
                        // Track time since object jump to improve detection reliability
                        const jumpingFromObject = player.wasOnObject;
                        const isFalling = player.falling;
                        
                        if ((isFalling || jumpingFromObject) && !inVehicle) {
                            // Log with enhanced debugging for state tracking
                            console.log(`Landing detected - from object: ${jumpingFromObject}, was falling: ${isFalling}`);
                            
                            // Always call the landing handler with proper surface normal
                            if (ControlManager.controller?.landing) {
                                console.log("Calling controller landing method with planet normal");
                                ControlManager.controller.landing(toPlayer);
                            }
                            
                            // Reset all transition flags to clean state
                            player.wasOnObject = false;
                            player._wasOnObjectTime = 0;  // Reset timer
                            player.standingOnObject = false;
                            
                            // Notify the user if in debug mode
                            if (window.gameNotify && player._debugMode) {
                                window.gameNotify("Landed on planet surface");
                            }
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
                        // ENHANCED: Improved detection for jumping off objects with more reliable tracking
                        else if (player.standingOnObject) {
                            // Check for vertical velocity away from object surface
                            const upwardVelocity = player.velocity.dot(player.surfaceNormal);
                            
                            // If we have significant upward motion, we're jumping off the object
                            if (upwardVelocity > 0.3) {
                                console.log("Player jumping off object - marking for proper landing");
                                player.wasOnObject = true;
                                player._wasOnObjectTime = Date.now(); // Start tracking jump time
                                player.standingOnObject = false; // Clear standing flag
                                player.falling = true;  // Mark as falling immediately
                                
                                // Trigger the liftoff handler for consistent behavior
                                if (ControlManager.controller?.liftoff) {
                                    ControlManager.controller.liftoff(player.surfaceNormal);
                                    
                                    // Notify the user if in debug mode
                                    if (window.gameNotify && player._debugMode) {
                                        window.gameNotify("Jumped off object");
                                    }
                                }
                            }
                        }
                    }
                } catch (gravityErr) {
                    console.error("Error in planet gravity processing:", gravityErr);
                }

                // ADDED: Run state validation at the end of each update
                // This ensures we don't have invalid combinations of flags
                this.validatePlayerPhysicsState(player);
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

            // Update player colliders as the last step - SINGLE UPDATE
            try {
                // Update player bounds ONCE after all movement is complete
                PlayersManager.updatePlayerColliders();
            } catch (err) {
                console.error("Error updating player colliders:", err);
            }
        } catch (mainErr) {
            console.error("CRITICAL ERROR in physics update:", mainErr);
        }
    };
    
    // ENHANCED: More robust player state validation
    static validatePlayerPhysicsState(player) {
        if (!player) return;
        
        try {
            // Fix impossible state combinations
            if (player.standingOnObject && player.falling) {
                // Can't be both standing on an object and falling
                console.warn("Fixing inconsistent player state: standingOnObject and falling");
                
                // Trust the standingOnObject flag and clear falling
                player.falling = false;
            }
            
            // If player is very far from any object but still marked as standing on one
            if (player.standingOnObject && !player.currentlyColliding) {
                // Check if any recent collisions exist
                const hasRecentCollisions = player.activeCollisions && 
                    player.activeCollisions.length > 0 && 
                    (Date.now() - player.activeCollisions[0].time < 500);
                
                if (!hasRecentCollisions) {
                    console.warn("Player marked as standing on object but no recent collisions - fixing");
                    player.standingOnObject = false;
                    player.falling = true;
                    player.wasOnObject = true; // Mark for proper landing
                }
            }
            
            // Check if we've been in wasOnObject state for too long without landing
            if (player.wasOnObject) {
                if (!player._wasOnObjectTime) {
                    player._wasOnObjectTime = Date.now();
                }
                
                // If it's been more than 3 seconds, player should have landed by now
                const timeSinceJump = Date.now() - player._wasOnObjectTime;
                if (timeSinceJump > 3000) {
                    console.warn(`Clearing stale wasOnObject flag after ${timeSinceJump}ms`);
                    player.wasOnObject = false;
                    player._wasOnObjectTime = 0;
                    
                    // If the player is on or very near a planet surface, force landing
                    if (player.soi) {
                        const planetDistance = player.position.distanceTo(player.soi.object.position);
                        const surfaceDistance = Math.abs(planetDistance - player.soi.radius);
                        
                        if (surfaceDistance < 1.0) {
                            console.log("Forcing landing state - player near planet surface");
                            player.falling = false;
                            
                            // Calculate surface normal for landing
                            const toPlayer = player.position.clone().sub(player.soi.object.position).normalize();
                            
                            // Call landing handler if available
                            if (ControlManager.controller?.landing) {
                                ControlManager.controller.landing(toPlayer);
                            }
                        }
                    }
                }
            } else {
                player._wasOnObjectTime = 0;
            }
            
            // IMPROVED: More accurate prevention of rapid falling/landing transitions
            // This prevents the camera glitch when bumping into objects
            if (!player.falling && player._lastLandingTime) {
                const timeSinceLanding = Date.now() - player._lastLandingTime;
                
                // Don't allow going into falling state for at least 500ms after landing
                // unless we have significant upward velocity (jumping)
                if (timeSinceLanding < 500) {
                    if (player.soi) {
                        const planetNormal = player.position.clone().sub(player.soi.object.position).normalize();
                        const upwardVelocity = player.velocity ? player.velocity.dot(planetNormal) : 0;
                        
                        // Only allow transition to falling if we have significant upward velocity (jumping)
                        // or the player is actually in the air (not on the surface)
                        if (upwardVelocity < 3.0 && !player.intentionalJump) {
                            player._preventFallingUntil = player._lastLandingTime + 500;
                            player.falling = false;
                        }
                    }
                }
            }
            
            // IMPROVED: Better handling of test cube collisions
            if (player.currentlyColliding && player.activeCollisions) {
                // Check if we're colliding with a test cube or wall
                const collidingWithFixedObject = player.activeCollisions.some(c => 
                    c.object && c.object.userData && 
                    (c.object.userData.type === 'testCube' || c.object.userData.type === 'wall')
                );
                
                if (collidingWithFixedObject) {
                    // When colliding with fixed objects on the surface, maintain grounded state
                    if (!player.jumpInProgress) {
                        player.falling = false;
                    }
                }
            }
            
            // Check if we're in a "no falling" grace period after landing
            if (player._preventFallingUntil && Date.now() < player._preventFallingUntil) {
                player.falling = false;
            }
        } catch (err) {
            console.error("Error validating player physics state:", err);
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
            
            // CRITICAL FIX: Apply a subtle anti-spin force when falling
            if (vehicle.userData.falling && vehicle.userData.rotationDamping) {
                // Calculate current rotational velocity by comparing current rotation to desired rotation
                const targetQuat = new Quaternion();
                
                // Align up with surface normal
                const upVector = new Vector3(0, 1, 0);
                const alignmentAxis = new Vector3().crossVectors(upVector, surfaceNormal).normalize();
                
                // Only calculate alignment if we have a valid axis
                if (alignmentAxis.lengthSq() > 0.001) {
                    const alignmentAngle = Math.acos(Math.max(-1, Math.min(1, upVector.dot(surfaceNormal))));
                    targetQuat.setFromAxisAngle(alignmentAxis, alignmentAngle);
                    
                    // Apply damping to current rotation to move toward desired orientation
                    const damping = vehicle.userData.rotationDamping;
                    vehicle.quaternion.slerp(targetQuat, damping * 0.05); // Small factor for gentle correction
                }
                
                // Add some minor forward-facing orientation
                // This helps vehicles retain proper forward orientation while falling
                const forwardDirection = new Vector3(0, 0, -1).applyQuaternion(vehicle.quaternion);
                const planetDirection = vehicle.position.clone().sub(planetCenter).normalize();
                
                // Project forward onto plane defined by planet normal
                const projectedForward = forwardDirection.clone()
                    .projectOnPlane(planetDirection)
                    .normalize();
                
                // Only apply forward bias if we have a valid projection
                if (projectedForward.lengthSq() > 0.1) {
                    const forwardQuat = new Quaternion();
                    const sideDirection = new Vector3().crossVectors(planetDirection, projectedForward).normalize();
                    
                    if (sideDirection.lengthSq() > 0.1) {
                        const forwardBias = 0.01; // Very subtle bias to maintain orientation
                        vehicle.quaternion.slerp(forwardQuat, forwardBias);
                    }
                }
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
            // CRITICAL FIX: Use consistent fixed height for landing detection but add a slight buffer
            const heightOffset = vehicle.userData.fixedHeightOffset || 
                                (vehicle.userData.type === 'car' ? 3.0 : 5.0);
            const groundLevel = planet.radius + heightOffset;
            const landingBuffer = 0.5; // Small buffer for clean landing detection
            
            if (distance <= groundLevel + landingBuffer) {
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
                
                // CRITICAL FIX: Always align vehicle with the planet surface when grounded
                // Use a more aggressive alignment factor when just landed
                const alignmentFactor = vehicle.userData.justLanded ? 0.5 : 0.1;
                if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, alignmentFactor);
                    
                    // Clear the "just landed" flag after first alignment
                    if (vehicle.userData.justLanded) {
                        vehicle.userData.justLanded = false;
                    }
                } else {
                    console.warn("VehicleManager.alignVehicleToPlanetSurface is not available");
                    
                    // Simple fallback alignment
                    const yAxis = new Vector3(0, 1, 0);
                    const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
                    const angle = Math.acos(yAxis.dot(surfaceNormal));
                    
                    if (rotationAxis.lengthSq() > 0.0001) {
                        const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                        vehicle.quaternion.slerp(alignQuat, alignmentFactor);
                    }
                }
            } else {
                // We're in the air
                vehicle.userData.falling = true;
                vehicle.userData.justLanded = true; // Mark for aggressive alignment when landing
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
                
                // SIMPLIFIED: We can infer surface contact from !falling
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
        if (!objects || objects.length === 0) {
            return null;
        }
        if (!player) {
            console.warn("checkCollisions called with null player");
            return null;
        }
        
        if (!player.velocity) {
            console.warn("checkCollisions: player has no velocity property");
            return null;
        }
        try {
            let closestTime = timeStep;
            let closestObject = null;
            let closestPosition = null;
            let closestNormal = null;
        
            const speed = player.velocity.length();
            if (speed === 0) return null;
            const effectiveSpeed = Math.min(speed, 20);
            
            // CRITICAL FIX: More accurate OBB collision detection for player handle
            try {
                // Get player OBB
                if (!player.handle || !player.collidable || !player.collidable.obb) {
                    console.warn("Player missing handle or collidable.obb for collision check");
                    return null;
                }
                // CRITICAL FIX: Validate player OBB before collision checks
                if (!this.validateOBB(player.collidable.obb, player.handle)) {
                    // Try to rebuild OBB if invalid
                    console.warn("Player OBB invalid - rebuilding for collision check");
                    this.updateCollidableBounds(player.handle);
                    // Check if rebuilding succeeded
                    if (!this.validateOBB(player.collidable.obb, player.handle)) {
                        console.error("Failed to rebuild player OBB - skipping collision checks");
                        return null;
                    }
                }

                // Get planet surface normal for ground plane calculation
                const planetNormal = player.soi ? 
                    player.position.clone().sub(player.soi.object.position).normalize() : 
                    new Vector3(0, 1, 0);

                // Process each object for collision
                for (const obj of objects) {
                    // Skip invalid objects
                    if (!obj || !obj.object || !obj.obb) continue;
                    // Skip objects identical to player
                    if (obj.object === player.handle) continue;
                    // CRITICAL FIX: Validate object OBB before collision checks
                    if (!this.validateOBB(obj.obb, obj.object)) {
                        console.warn(`Invalid OBB on ${obj.type} object - rebuilding`);
                        this.updateCollidableBounds(obj.object);
                        // Skip if still invalid
                        if (!this.validateOBB(obj.obb, obj.object)) {
                            console.error(`Unable to use ${obj.type} object for collision - skipping`);
                            continue;
                        }
                    }
                    // ENHANCED: Use both SAT test and edge collision for better reliability
                    // First check SAT for basic intersection
                    const satResult = this.runSATTest(player.collidable.obb, obj.obb);
                        
                    if (satResult && satResult.collides) {
                        // Direct collision found - handle it immediately
                        console.log(`SAT test detected collision with ${obj.type}`);
                        // Calculate position at collision point
                        const collisionPosition = satResult.point.clone();
                        
                        // CRITICAL FIX: Project collision normal onto the planet surface to prevent bouncing
                        let collisionNormal = satResult.normal.clone();
                        
                        // Only do this adjustment when player is on or near planet surface
                        if (player.soi && !player.falling) {
                            // Get dot product with planet normal to see if this would cause upward movement
                            const normalDotPlanet = collisionNormal.dot(planetNormal);
                            
                            // If collision would push player upward from surface, modify it
                            if (normalDotPlanet > 0.2) { // Significant upward component
                                // Project the normal onto the surface plane
                                const surfaceAlignedNormal = collisionNormal
                                    .projectOnPlane(planetNormal)
                                    .normalize();
                                
                                if (surfaceAlignedNormal.lengthSq() > 0.01) {
                                    collisionNormal = surfaceAlignedNormal;
                                    console.log("Collision normal projected onto surface plane to prevent bouncing");
                                }
                            }
                        }
                        
                        // Return collision result and edge collision for better reliability
                        return {
                            collisionNormal: collisionNormal,
                            collisionPosition: collisionPosition,
                            closestObject: obj,
                            closestTime: 0,
                            isWallCollision: obj.type === 'wall',
                            isTestCubeCollision: obj.type === 'testCube'
                        };
                    }

                    // If no direct collision, check for swept collision along velocity
                    // Only perform this for test cubes and static objects
                    if (obj.type === 'testCube' || obj.type === 'wall' || obj.isStatic) {
                        // Calculate minimum distance between OBBs
                        const distance = this.getMinimumDistanceBetweenOBBs(player.collidable.obb, obj.obb);
                        // Skip if out of range for the current step
                        const maxCollisionDistance = effectiveSpeed * timeStep * 1.5;
                        if (distance > maxCollisionDistance) {
                            continue;
                        }

                        // Get closest points between the OBBs
                        const closestPointResult = this.findContactPoint(player.collidable.obb, obj.obb);
                        if (closestPointResult) {
                            const contactNormal = closestPointResult.pointB.clone().sub(closestPointResult.pointA).normalize().negate();
                            
                            // Use these points and normal as potential collision
                            if (distance < closestTime * effectiveSpeed) {
                                closestTime = distance / effectiveSpeed;
                                closestObject = obj;
                                closestPosition = closestPointResult.pointA.clone();
                                closestNormal = contactNormal;
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error in collision detection:", err);
                return null;
            }
        
            if (closestPosition === null) return null;
            
            // ADDED: Also check if we need to adjust the collision normal to prevent bouncing
            if (closestNormal && player.soi && !player.falling) {
                // Get planet surface normal
                const planetNormal = player.position.clone().sub(player.soi.object.position).normalize();
                
                // Check if collision would push player upward from surface
                const normalDotPlanet = closestNormal.dot(planetNormal);
                
                // If collision would push player upward from surface, modify it
                if (normalDotPlanet > 0.2) { // Significant upward component
                    // Project the normal onto the surface plane
                    const surfaceAlignedNormal = closestNormal
                        .projectOnPlane(planetNormal)
                        .normalize();
                    
                    if (surfaceAlignedNormal.lengthSq() > 0.01) {
                        closestNormal = surfaceAlignedNormal;
                        console.log("Swept collision normal projected onto surface plane to prevent bouncing");
                    }
                }
            }
            
            return {
                collisionNormal: closestNormal || new Vector3(0, 1, 0),
                collisionPosition: closestPosition,
                closestObject,
                closestTime,
                isWallCollision: closestObject.type === 'wall',
                isTestCubeCollision: closestObject.type === 'testCube'
            };
        } catch (err) {
            console.error("Error in collision result creation:", err);
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
                
                // If moving toward the collision, remove that component
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
};
