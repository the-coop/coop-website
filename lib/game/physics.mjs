import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ControlManager from './control.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import Engine from './engine.mjs'; // Added missing Engine import
import { Vector3, Box3, Object3D, Plane, Quaternion, Matrix4 } from 'three'; // Added Quaternion

// Lower values create "moon-like" gravity, higher values "earth-like"
// ADJUSTED: Reduced gravity constant from 0.5 to 0.35 for gentler falls
const GRAVITY_CONSTANT = 0.35;

// DEFAULT MASSES for different object types (kg)
const DEFAULT_MASSES = {
    player: 75,       // Average human mass
    testCube: 200,    // Default test cube mass
    lightCube: 50,    // Light cube that can be pushed
    heavyCube: 500,   // Heavy cube that resists pushing
    vehicle: 1000,    // Default vehicle mass
    car: 1500,        // Car mass
    airplane: 800     // Airplane mass
};

// Handles gravity and ground detection for spherical planets
// SOI (Sphere of Influence) determines which planet affects the player
export default class Physics {

    // Make constants available
    static GRAVITY_CONSTANT = GRAVITY_CONSTANT;
    static DEFAULT_MASSES = DEFAULT_MASSES;
    
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

    // IMPROVED: Get player's OBB in world space for collision checks
    static getPlayerWorldOBB(player) {
        if (!player || !player.handle) return null;
        
        // Ensure player has a collider
        if (!player.collidable || !player.collidable.obb) {
            if (typeof PlayersManager !== 'undefined' && PlayersManager.initializePlayerCollider) {
                PlayersManager.initializePlayerCollider(player);
            }
        }
        
        if (!player.collidable || !player.collidable.obb) return null;
        
        // CRITICAL FIX: Add margin to player OBB to prevent edge tunneling
        const obb = player.collidable.obb;
        
        // Add small safety margin to all dimensions
        const safetyMargin = 0.1;
        obb.halfSize.x += safetyMargin;
        obb.halfSize.y += safetyMargin;
        obb.halfSize.z += safetyMargin;
        
        return obb;
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
            
            // ADDED: More progressive height correction with increasing tolerance over time
            let heightTolerance = 0.1; // Base height tolerance
            
            // Increase tolerance for fully stabilized vehicles
            if (vehicle.userData.fullyStabilized) {
                heightTolerance = 0.5; // Much larger tolerance for stable vehicles
            }
            // Increase tolerance based on time since landing
            else if (vehicle.userData.landingTime) {
                const timeSinceLanding = Date.now() - vehicle.userData.landingTime;
                if (timeSinceLanding > 5000) {
                    // Gradually increase tolerance up to 0.3 units after 5 seconds
                    heightTolerance = Math.min(0.3, 0.1 + (timeSinceLanding / 5000) * 0.2);
                }
            }
            
            // ADDED: Detect when vehicle touches the ground and set falling=false
            if (vehicle.userData.falling && distance <= groundLevel + 3.0) {
                // Vehicle has landed
                vehicle.userData.falling = false;
                vehicle.userData.justLanded = true; // Flag for wheel alignment
                vehicle.userData.landingTime = Date.now();
                
                console.log(`Vehicle ${vehicle.userData.name || 'unnamed'} has landed on planet surface`);
                
                // ADDED: Create a hard freeze period immediately after landing
                vehicle.userData.velocity.set(0, 0, 0); // Zero out all velocity
                vehicle.userData.speed = 0; // Stop any movement
                vehicle.userData.hardFreeze = true; // Flag for total physics freeze
                vehicle.userData.hardFreezeEndTime = Date.now() + 1000; // 1 second hard freeze
                
                // ADDED: Zero out any angular velocity to prevent post-landing spin
                if (vehicle.userData.angularVelocity) {
                    vehicle.userData.angularVelocity.set(0, 0, 0);
                }
                
                // Store the initial landing surface normal for stable reference
                vehicle.userData.initialLandingNormal = surfaceNormal.clone();
                
                // Re-align to surface with strong correction
                if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                    VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.9, true);
                }
                
                // Reset wheel orientation for cars
                if (vehicle.userData.type === 'car' && typeof VehicleManager.resetWheelsBaseOrientation === 'function') {
                    VehicleManager.resetWheelsBaseOrientation(vehicle);
                }
            }
            
            // ADDED: Process hard freeze state
            if (vehicle.userData.hardFreeze && !vehicle.userData.falling) {
                const now = Date.now();
                if (now < vehicle.userData.hardFreezeEndTime) {
                    // During hard freeze, force vehicle to exact height and zero velocity
                    const newPosition = planetCenter.clone().addScaledVector(surfaceNormal, groundLevel);
                    vehicle.position.copy(newPosition); // Exact positioning
                    vehicle.userData.velocity.set(0, 0, 0); // No velocity at all
                    vehicle.userData.speed = 0; // No speed
                    
                    // ADDED: Make sure any angular velocity is completely zeroed
                    if (vehicle.userData.angularVelocity) {
                        vehicle.userData.angularVelocity.set(0, 0, 0);
                    }
                    
                    // Force strong alignment during hard freeze
                    if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                        // Use the initial landing normal for consistent alignment
                        const alignNormal = vehicle.userData.initialLandingNormal || surfaceNormal;
                        VehicleManager.alignVehicleToPlanetSurface(vehicle, alignNormal, 0.95, true);
                    }
                    
                    // ADDED: Stabilize rotation by zeroing any quaternion velocity
                    if (vehicle.userData.lastQuaternion) {
                        // Copy current quaternion to last to prevent any interpolation
                        vehicle.userData.lastQuaternion.copy(vehicle.quaternion);
                    }
                    
                    return; // Skip the rest of the physics during hard freeze
                } else {
                    // Hard freeze period has ended
                    vehicle.userData.hardFreeze = false;
                    
                    // ADDED: Enter enhanced stabilization phase for smooth transition
                    vehicle.userData.enhancedStabilization = true;
                    vehicle.userData.enhancedStabilizationEndTime = now + 2000; // 2 second enhanced stabilization
                    
                    // Keep the normal from hard freeze for consistent alignment
                    vehicle.userData.stabilizationNormal = 
                        vehicle.userData.initialLandingNormal || surfaceNormal.clone();
                    
                    console.log(`Vehicle ${vehicle.userData.name || 'unnamed'} exiting hard freeze into stabilization phase`);
                }
            }
            
            // ADDED: Handle enhanced stabilization phase after hard freeze
            if (vehicle.userData.enhancedStabilization && !vehicle.userData.falling && !vehicle.userData.hardFreeze) {
                const now = Date.now();
                if (now < vehicle.userData.enhancedStabilizationEndTime) {
                    // During enhanced stabilization, add extra angular damping
                    if (vehicle.userData.angularVelocity) {
                        // Apply extremely aggressive damping to angular velocity
                        vehicle.userData.angularVelocity.multiplyScalar(0.7); // 70% reduction per frame
                        
                        // If angular velocity is very small, just zero it completely
                        if (vehicle.userData.angularVelocity.lengthSq() < 0.0001) {
                            vehicle.userData.angularVelocity.set(0, 0, 0);
                        }
                    }
                    
                    // Apply strong alignment with consistent normal
                    if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                        // Use saved normal for consistent alignment during stabilization
                        const alignNormal = vehicle.userData.stabilizationNormal || surfaceNormal;
                        const timeFactor = (vehicle.userData.enhancedStabilizationEndTime - now) / 2000;
                        // Gradually reduce alignment strength over time (from 0.8 to 0.2)
                        const alignFactor = 0.2 + (timeFactor * 0.6); 
                        VehicleManager.alignVehicleToPlanetSurface(vehicle, alignNormal, alignFactor, false);
                    }
                } else {
                    // Enhanced stabilization complete
                    vehicle.userData.enhancedStabilization = false;
                    console.log(`Vehicle ${vehicle.userData.name || 'unnamed'} stabilization complete`);
                    
                    // Mark as fully stabilized for gentler physics
                    vehicle.userData.fullyStabilized = true;
                }
            }
            
            // Only adjust if significantly different from target height
            if (Math.abs(distance - groundLevel) > heightTolerance) {
                // Calculate new position at correct height
                const newPosition = planetCenter.clone().addScaledVector(
                    surfaceNormal,
                    groundLevel
                );
                
                // IMPROVED: Apply gentler correction based on stabilization state
                const correctionFactor = vehicle.userData.fullyStabilized ? 0.1 : 0.3;
                
                vehicle.position.lerp(newPosition, correctionFactor);
                
                // Update vehicle's matrix
                vehicle.updateMatrix();
                vehicle.updateMatrixWorld(true);
                
                // Vehicles that needed height adjustment are not fully stabilized
                if (Math.abs(distance - groundLevel) > heightTolerance * 2) {
                    vehicle.userData.fullyStabilized = false;
                }
                
                if (vehicle.userData.debug) {
                    console.log(`Maintaining vehicle height: ${(distance - planet.radius).toFixed(2)} → ${heightOffset.toFixed(2)}`);
                }
            } 
            // ADDED: Vehicle is at correct height - potential stabilization
            else if (!vehicle.userData.fullyStabilized && !vehicle.userData.falling && vehicle.userData.landingTime) {
                const timeSinceLanding = Date.now() - vehicle.userData.landingTime;
                
                // If landed for a while and height is stable, mark as fully stabilized
                if (timeSinceLanding > 5000) {
                    vehicle.userData.fullyStabilized = true;
                }
            }
            
            // ADDED: Apply very gentle gravity damping for stabilized vehicles
            if (!vehicle.userData.falling && vehicle.userData.landingTime && 
                vehicle.userData.velocity.lengthSq() > 0.001) {
                
                // Calculate how long vehicle has been on the ground
                const groundedTime = Date.now() - vehicle.userData.landingTime;
                
                // Stronger damping the longer it's been on the ground
                let dampingFactor = 0.7;
                if (groundedTime > 3000) {
                    dampingFactor = 0.95; // Very strong damping after 3 seconds
                } else if (groundedTime > 1000) {
                    dampingFactor = 0.85; // Strong damping after 1 second
                }
                
                // Apply damping to velocity
                vehicle.userData.velocity.multiplyScalar(1 - dampingFactor);
                
                // Zero out very small velocities to prevent perpetual tiny movements
                if (vehicle.userData.velocity.lengthSq() < 0.001) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
            }
            
            // Make sure vehicle is aligned to surface, but with reduced intensity for stable vehicles
            if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                // MODIFIED: Use much smaller alignment factor for fully stabilized vehicles
                const alignmentFactor = vehicle.userData.fullyStabilized ? 0.005 : 0.2;
                VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, alignmentFactor);
            }
            
            // ADDED: If vehicle has just landed, ensure wheels are properly aligned
            if (vehicle.userData.justLanded && vehicle.userData.type === 'car') {
                if (typeof VehicleManager.resetWheelsBaseOrientation === 'function') {
                    VehicleManager.resetWheelsBaseOrientation(vehicle);
                }
            }
            
            // Update collision bounds after position change with safety check
            if (vehicle.collidable) {
                if (typeof ObjectManager.updateCollidableBounds === 'function') {
                    ObjectManager.updateCollidableBounds(vehicle);
                } else {
                    this._fallbackUpdateCollidableBounds(vehicle);
                }
            }
            
        } catch (e) {
            console.error("Error in vehicle physics:", e);
        }
    }

    // NEW: Added separate method to process only vehicles with special physics
    static processVehiclePhysics() {
        try {
            // Process all vehicle objects with adjusted gravity
            for (const collidable of ObjectManager.collidableObjects) {
                if (!collidable || !collidable.active || collidable.type !== 'vehicle') continue;
                
                const vehicle = collidable.object;
                if (!vehicle || !vehicle.userData) continue;
                
                // Skip if this is the current player-controlled vehicle
                if (vehicle === VehicleManager.currentVehicle && vehicle.userData.isOccupied) {
                    this.maintainVehicleSurfaceHeight(vehicle);
                    continue;
                }
                
                try {
                    // IMPROVED: Apply vehicle-specific physics with reduced gravity
                    this.applyVehiclePhysics(vehicle);
                } catch (err) {
                    console.error("Error in vehicle physics:", err);
                }
                
                // Update collision bounds
                try {
                    if (typeof ObjectManager.updateCollidableBounds === 'function') {
                        ObjectManager.updateCollidableBounds(vehicle);
                    } else {
                        this._fallbackUpdateCollidableBounds(vehicle);
                    }
                } catch (err) {
                    console.error("Error updating vehicle bounds:", err);
                }
            }
        } catch (err) {
            console.error("Error processing vehicle physics:", err);
        }
    }

    // The standard update method that updates everything
    static update() {
        try {
            // Update player physics
            for (const player of PlayersManager.players) {
                if (!player) continue;
                this.updatePlayer(player);
            }
            
            // Update vehicle physics
            for (const vehicle of VehicleManager.vehicles) {
                if (!vehicle) continue;
                this.applyVehiclePhysics(vehicle);
                this.maintainVehicleSurfaceHeight(vehicle);
            }
            
            // Update other physical objects
            this.updateObjects();
            
            // Update collision detection
            PlayersManager.updatePlayerColliders();
            
            // Process any pending collisions
            this.processCollisions();
        } catch (err) {
            console.error("Error in Physics.update:", err);
        }
    }

    // Updates player physics, processes all collidable objects:
    static updatePlayer(player) {
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
            // SIMPLIFIED: Direct check if collidable object exists in the registry
            let isRegistered = ObjectManager.collidableObjects.some(c => 
                c && c.object === player.handle);
            
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
                        // console.log(`Found ${testCubeCount} nearby test cubes for collision check`);
                        
                        // ADDED: Detailed logging of distance to each test cube
                        nearbyObjects.filter(o => o.type === 'testCube').forEach(cube => {
                            const cubeDistance = player.position.distanceTo(cube.object.position);
                            const cubeSize = Math.max(
                                cube.object.userData?.width || 2, 
                                cube.object.userData?.height || 2,
                                cube.object.userData?.depth || 2
                            );
                            // console.log(`Test cube distance: ${cubeDistance.toFixed(2)} units (Size: ${cubeSize.toFixed(1)}, Collision threshold: 100.0)`);
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
                    
                    // ENHANCED: Much more aggressive collision deduplication 
                    // Check if we already have a collision with this exact object
                    const existingCollisionIndex = player.activeCollisions.findIndex(c => 
                        c.object === closestObject.object
                    );
                    
                    if (existingCollisionIndex >= 0) {
                        // Instead of adding a new collision, update the existing one
                        const existing = player.activeCollisions[existingCollisionIndex];
                        
                        // Update the time to keep it fresh
                        existing.time = Date.now();
                        
                        // Average the normals for smoother collision response
                        existing.normal.add(collisionNormal).normalize();
                        
                        console.log(`Updated existing collision with ${closestObject.type} - active collisions: ${player.activeCollisions.length}`);
                    } else {
                        // This is a new collision - add it to the list
                        player.activeCollisions.push({
                            normal: collisionNormal.clone(),
                            position: collisionPosition.clone(),
                            object: closestObject.object,
                            objectType: closestObject.type,
                            time: Date.now()
                        });
                        
                        // ADDED: Debug info about collision count
                        if (player === PlayersManager.self) {
                            console.log(`Added new collision with ${closestObject.type} - active collisions: ${player.activeCollisions.length}`);
                        }
                        
                        // Limit the number of stored collisions
                        if (player.activeCollisions.length > 5) {
                            // Remove the oldest collision
                            player.activeCollisions.shift();
                        }
                    }
                    
                    // ADDED: Clean up old collisions at the end of each frame
                    const now = Date.now();
                    player.activeCollisions = player.activeCollisions.filter(c => now - c.time < 100);

                    // FIXED: Properly calculate penetration to block movement 
                    const stepDir = stepVelocity.clone().normalize();
                    const penetrationDistance = stepDir.dot(collisionNormal);
                    
                    // CRITICAL FIX: Get player's pre-collision height above planet surface
                    let preCollisionHeight = null;
                    if (player.soi && player.soi.object) {
                        preCollisionHeight = player.position.clone().sub(player.soi.object.position).length() - player.soi.radius;
                    }
                    
                    // Get planet up vector for collision classification
                    const upVector = player.soi ? 
                        player.position.clone().sub(player.soi.object.position).normalize() : 
                        new Vector3(0, 1, 0);
                    
                    // Store planet normal
                    if (!player._planetSurfaceNormal) {
                        player._planetSurfaceNormal = upVector.clone();
                    }
                    
                    // Store grounded state BEFORE collision response
                    const wasGroundedBeforeCollision = !player.falling;
                    
                    // CRITICAL FIX: Check if this is a test cube collision
                    const isTestCubeCollision = closestObject.type === 'testCube';
                    
                    // CRITICAL FIX: NEVER use gradual correction - always push out immediately
                    // Calculate how much to move back with additional safety margin
                    const correctionDistance = -(penetrationDistance + 0.3); // Increased margin from 0.2 to 0.3
                    
                    // FIXED: Remove smoothing to make blocking immediate
                    // Old code used partial correction (0.65-0.8) causing gradual pushback
                    const smoothedCorrection = correctionDistance * 1.0; // Full immediate correction
                    
                    // FIXED: Add backwards momentum cancellation to prevent tunneling
                    // Store original position before any changes for tunneling detection
                    const originalPosition = player.position.clone();
                    
                    // Project collision normal for surface movement
                    let correctionNormal = collisionNormal.clone();
                    
                    if (isTestCubeCollision && player.soi) {
                        // For test cubes, ALWAYS project movement along the planet surface
                        correctionNormal = collisionNormal.clone().projectOnPlane(upVector).normalize();
                        
                        // If projection failed, use fallback strategy
                        if (correctionNormal.lengthSq() < 0.1) {
                            // If projection failed (normal nearly parallel to up vector)
                            // Create a reasonable lateral direction based on player orientation
                            if (player.handle) {
                                // Get player's current forward direction
                                const forward = new Vector3(0, 0, -1).applyQuaternion(player.handle.quaternion);
                                // Project forward onto planet surface
                                const surfaceForward = forward.projectOnPlane(upVector).normalize();
                                if (surfaceForward.lengthSq() > 0.1) {
                                    correctionNormal = surfaceForward;
                                } else {
                                    // Last resort - use arbitrary tangent vector
                                    correctionNormal = new Vector3(1, 0, 0).projectOnPlane(upVector).normalize();
                                }
                            }
                        }
                        
                        console.log("Using surface-aligned correction for test cube");
                        
                        // Explicitly preserve player's state
                        player.falling = false;
                        player.standingOnObject = true;
                        
                        // CRITICAL: Store original planet-relative orientation
                        if (!player._preCubeCollisionData) {
                            player._preCubeCollisionData = {
                                surfaceNormal: upVector.clone(),
                                height: preCollisionHeight,
                                time: Date.now()
                            };
                        }
                    }
                    // For other collisions, similar handling but with immediate blocking
                    else if (Math.abs(correctionNormal.dot(upVector)) < 0.6 && wasGroundedBeforeCollision) {
                        // This is a lateral collision while on ground - project onto surface
                        correctionNormal = collisionNormal.clone().projectOnPlane(upVector).normalize();
                        
                        if (correctionNormal.lengthSq() > 0.1) {
                            console.log("Using height-preserving lateral correction");
                            player.falling = false;
                            player.standingOnObject = true;
                        } else {
                            // Fall back to original normal if projection failed
                            correctionNormal = collisionNormal.clone();
                            
                            // Even on fallback, preserve grounded state
                            if (wasGroundedBeforeCollision) {
                                player.falling = false;
                                player.standingOnObject = true;
                            }
                        }
                    }
                    
                    // CRITICAL FIX: Apply full position correction IMMEDIATELY
                    // Calculate target position with full correction applied
                    const targetPosition = player.position.clone().addScaledVector(correctionNormal, smoothedCorrection);
                    
                    // For test cube collisions, maintain planet height
                    if (isTestCubeCollision && preCollisionHeight !== null && player.soi) {
                        // Get current vector from planet center to target position
                        const planetCenter = player.soi.object.position;
                        const targetToPlanet = targetPosition.clone().sub(planetCenter);
                        const newDistance = targetToPlanet.length();
                        
                        // Calculate what the height should be
                        const targetHeight = player.soi.radius + preCollisionHeight;
                        
                        // Adjust position to maintain exact same height
                        targetToPlanet.normalize().multiplyScalar(targetHeight);
                        targetPosition.copy(planetCenter).add(targetToPlanet);
                        
                        console.log(`Maintaining exact planet height during test cube collision: ${preCollisionHeight.toFixed(2)}`);
                    }
                    
                    // FIXED: Apply immediate position correction
                    player.position.copy(targetPosition);
                    
                    // ADDED: Calculate displacement to determine if tunneling occurred
                    const displacementFromOriginal = player.position.distanceTo(originalPosition);
                    const isSuspectedTunneling = displacementFromOriginal > 2.0; // Suspiciously large correction
                    
                    if (isSuspectedTunneling) {
                        console.warn("Possible tunneling detected - applying enhanced anti-tunneling measures");
                        
                        // ENHANCED ANTI-TUNNELING: Store this object in a "no-go" list
                        if (!player._noGoObjects) player._noGoObjects = new Set();
                        player._noGoObjects.add(closestObject.object.uuid);
                        
                        // This flag will block ALL movement toward this object next frame
                        player._blockMovementToward = {
                            objectId: closestObject.object.uuid,
                            normal: collisionNormal.clone(),
                            expireTime: Date.now() + 300 // Block for 300ms
                        };
                    }
                    
                    // Update handle position
                    if (player.handle) {
                        player.handle.position.copy(player.position);
                        
                        // CRITICAL FIX: ALWAYS maintain original orientation for test cubes
                        if (isTestCubeCollision && player._planetSurfaceNormal) {
                            // Force player's up direction to match planet normal
                            player.handle.up.copy(player._planetSurfaceNormal);
                            
                            // Force surface normal to be planet normal
                            player.surfaceNormal = player._planetSurfaceNormal.clone();
                        }
                    }
                    
                    // IMPROVED: Update camera immediately for test cube collisions
                    if (isTestCubeCollision && typeof Engine !== 'undefined' && Engine.camera && player === PlayersManager.self) {
                        // Force camera up to match planet normal
                        Engine.camera.up.copy(player._planetSurfaceNormal || upVector);
                        
                        // If we have stored orientation data, use it
                        if (player._lastStableCameraQuaternion) {
                            Engine.camera.quaternion.copy(player._lastStableCameraQuaternion);
                        }
                    }
                    
                    // CRITICAL FIX: COMPLETELY ZERO OUT movement velocity into collider
                    // This prevents any follow-through movement after collision
                    if (player.velocity) {
                        const velDot = player.velocity.dot(collisionNormal);
                        if (velDot < 0) {
                            // Remove ALL velocity component in the collision direction
                            const normalComponent = collisionNormal.clone().multiplyScalar(velDot);
                            player.velocity.sub(normalComponent);
                            
                            // Add slight backwards impulse to definitively prevent tunneling
                            player.velocity.addScaledVector(collisionNormal, 0.05);
                            
                            // Add dragging effect when colliding to slow movement along surfaces
                            player.velocity.multiplyScalar(0.8);
                        }
                    }
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
                        // MODIFIED: Simply cancel movement component in the blocked direction
                        // No additional deflection or bounce
                        const normalComponent = player._movementBlocked.normal.clone().multiplyScalar(velDot);
                        player.velocity.sub(normalComponent);
                        
                        // REMOVED: No velocity scaling to reduce "slip" effect
                        // player.velocity.multiplyScalar(0.9); - REMOVED
                        
                        console.log("Blocking movement in collision direction without deflection");
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
                // CRITICAL FIX: Don't set falling to true just because there was a collision
                // Only set falling to true if we're definitely in the air
                if (!player.standingOnObject && !player.falling && 
                    !hadOBBCollision && // NEW: Don't change falling state during collision
                    distance > collisionDistance + 0.5) { // NEW: Add margin to prevent false falling
                
                    const inVehicle = VehicleManager.currentVehicle &&
                        VehicleManager.currentVehicle.player === player;

                    if (!inVehicle && ControlManager.controller?.liftoff) {
                        console.log("Player leaving ground - triggering liftoff");
                        ControlManager.controller.liftoff(toPlayer);
                    }
                    
                    // NEW: Only set falling if we're clearly above the surface
                    player.falling = true;
                    console.log("Player set to falling state - height above planet:", 
                               (distance - planetRadius).toFixed(2));
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
        // this.validatePlayerPhysicsState(player);
    }

    // NEW: Modified vehicle physics method with reduced gravity
    static applyVehiclePhysics(vehicle) {
        if (!vehicle || !vehicle.userData) return;

        try {
            // Skip physics for player's current vehicle
            if (vehicle === VehicleManager.currentVehicle && vehicle.userData.isOccupied) {
                return;
            }
            
            // ADDED: Skip all complex physics for fully stabilized vehicles
            if (!vehicle.userData.falling && vehicle.userData.fullyStabilized) {
                // Maintain only height correction and zero velocity
                this.maintainVehicleSurfaceHeight(vehicle);
                
                // Force velocity to zero to prevent any drifting
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                vehicle.userData.speed = 0;
                
                return;
            }

            // ADDED: Skip physics during hard freeze period
            if (vehicle.userData.hardFreeze) {
                const now = Date.now();
                if (vehicle.userData.hardFreezeEndTime && now < vehicle.userData.hardFreezeEndTime) {
                    // Skip physics processing during hard freeze
                    return;
                } else {
                    // Hard freeze period has ended
                    vehicle.userData.hardFreeze = false;
                }
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
            
            // Store surface normal in vehicle for alignment and collision
            vehicle.userData.surfaceNormal = surfaceNormal;
            
            // ADDED: When vehicle is fully stabilized, completely disable OBB collision updates
            // This prevents subtle physics forces from making the vehicle spin
            if (!vehicle.userData.falling && vehicle.userData.fullyStabilized) {
                // If vehicle is fully stabilized, disable complex collision physics
                // and only maintain the correct height using simple sphere collision
                
                // Only adjust height using sphere-to-sphere collision with planet
                const planetCenter = planet.object.position;
                const toVehicle = vehicle.position.clone().sub(planetCenter);
                const distance = toVehicle.length();
                const surfaceNormal = toVehicle.normalize();
                
                const groundLevel = planet.radius + (vehicle.userData.fixedHeightOffset || 3.0);
                
                if (Math.abs(distance - groundLevel) > 0.1) {
                    // Use very gentle correction to avoid bouncing
                    const newPosition = planetCenter.clone().addScaledVector(surfaceNormal, groundLevel);
                    vehicle.position.lerp(newPosition, 0.05); // Very small adjustment
                    
                    // Update matrix after position change
                    vehicle.updateMatrix();
                    vehicle.updateMatrixWorld(true);
                }
                
                // CRITICAL: Zero out any remaining velocity and angular velocity
                if (vehicle.userData.velocity) {
                    vehicle.userData.velocity.set(0, 0, 0);
                }
                if (vehicle.userData.angularVelocity) {
                    vehicle.userData.angularVelocity.set(0, 0, 0);
                }
                
                // Keep OBB updated for visual debugging, but don't use it for physics
                if (vehicle.collidable && ObjectManager._debugEnabled) {
                    ObjectManager.updateCollidableBounds(vehicle);
                }
                
                return; // Skip standard physics processing
            }

            // Calculate gravity with vehicle-specific adjustment
            // Reduce gravity even more for smoother landings
            const vehicleGravityFactor = vehicle.userData.gravityFactor || 0.4;
            const effectiveGravity = GRAVITY_CONSTANT * vehicleGravityFactor;
            
            // Calculate gravity and apply to velocity with reduced strength
            const gravity = effectiveGravity / Math.pow(distance / planet.radius, 2);
            vehicle.userData.velocity.addScaledVector(surfaceNormal, -gravity);
            
            // Enhanced air resistance for falling vehicles - more aggressive braking
            if (vehicle.userData.falling) {
                // Air resistance increases with speed (quadratic drag)
                const speed = vehicle.userData.velocity.length();
                // Increased air resistance significantly for smoother landing
                const airResistance = Math.min(0.06 * speed * speed, 0.6); // Further increased from 0.04/0.5 to 0.06/0.6
                vehicle.userData.velocity.multiplyScalar(1 - airResistance * 0.025); // Increased from 0.02 to 0.025
            }
            
            // Apply velocity to position with smoother movement
            const speed = vehicle.userData.velocity.length();
            const steps = Math.max(1, Math.ceil(speed / 0.5)); // More steps for higher speeds
            const subStep = 1.0 / steps;
            
            // Store original position to detect collisions with ground
            const originalPosition = vehicle.position.clone();
            
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
            // Increased landing buffer for even earlier landing detection
            const heightOffset = vehicle.userData.fixedHeightOffset || 
                               (vehicle.userData.type === 'car' ? 3.0 : 5.0);
            const groundLevel = planet.radius + heightOffset;
            const landingBuffer = 3.0;
            
            // IMPROVED: Before position correction, store the original orientation
            const originalQuaternion = vehicle.quaternion.clone();
            
            // ADDED: Track approach speed for better landing response
            let approachSpeed = 0;
            if (vehicle.userData.velocity) {
                approachSpeed = -vehicle.userData.velocity.dot(surfaceNormal);
            }
            
            if (distance <= groundLevel + landingBuffer) {
                // IMPROVED: MORE aggressive height correction to keep object ON sphere radius
                vehicle.position.copy(planetCenter).addScaledVector(surfaceNormal, groundLevel);
                
                // Update surface normal after position correction
                vehicle.userData.surfaceNormal = surfaceNormal;
                
                // IMPROVED: Much more aggressive damping and reduced bounce for stable landing
                if (vehicle.userData.falling) {
                    // ADDED: Set falling to false when vehicle lands
                    vehicle.userData.falling = false;
                    vehicle.userData.justLanded = true;
                    
                    // Apply strong damping based on landing speed
                    const impactSpeed = -vehicle.userData.velocity.dot(surfaceNormal);
                    // INCREASED damping and REDUCED bounce factors even more
                    const landingDamping = vehicle.userData.landingDamping || 0.99; // Further increased to 0.99
                    const bounceFactor = vehicle.userData.bounceFactor || 0.02; // Further reduced to 0.02
                    
                    // Only allow tiny bounce for smooth landing
                    if (impactSpeed > 0.1) {
                        // Convert downward velocity to tiny upward bounce
                        vehicle.userData.velocity.addScaledVector(surfaceNormal, impactSpeed * bounceFactor);
                        
                        // Add aggressive damping to stop bouncing quickly
                        vehicle.userData.velocity.multiplyScalar(landingDamping);
                    } else {
                        // For very soft landings, just zero the vertical velocity
                        const verticalComponent = surfaceNormal.clone().multiplyScalar(
                            vehicle.userData.velocity.dot(surfaceNormal)
                        );
                        vehicle.userData.velocity.sub(verticalComponent);
                        vehicle.userData.velocity.multiplyScalar(0.98); // Increased from 0.95
                    }
                    
                    // Set the vehicle as landed
                    vehicle.userData.landingTime = Date.now();
                    vehicle.userData.landingImpactSpeed = impactSpeed;
                    
                    // ADDED: Mark this landing as needing stabilization if impact was significant
                    if (impactSpeed > 0.5) {
                        vehicle.userData.needsLandingStabilization = true;
                        vehicle.userData.stabilizationDuration = Math.min(3000, impactSpeed * 1000); // Up to 3 seconds based on impact
                    }
                    
                    // ADDED: For cars, make sure wheels are properly aligned on landing
                    if (vehicle.userData.type === 'car' && typeof VehicleManager.resetWheelsBaseOrientation === 'function') {
                        VehicleManager.resetWheelsBaseOrientation(vehicle);
                    }
                    
                    // ADDED: Log landing success if debug enabled
                    if (vehicle.userData.debug) {
                        console.log(`Vehicle ${vehicle.userData.name || 'unnamed'} landed successfully with impact speed ${impactSpeed.toFixed(2)}`);
                    }
                } else {
                    // For already grounded vehicles, apply rolling friction
                    const frictionFactor = 1.0 - ((planet.CoF || 0.2) * 0.5); // Halved friction coefficient
                    
                    // Split velocity into normal (vertical) and tangent (horizontal) components
                    const normalVel = vehicle.userData.velocity.dot(surfaceNormal);
                    const normalComponent = surfaceNormal.clone().multiplyScalar(normalVel);
                    const tangentComponent = vehicle.userData.velocity.clone().sub(normalComponent);
                    
                    // ZERO the normal component (prevent any bouncing)
                    vehicle.userData.velocity.copy(tangentComponent);
                    
                    // Apply friction to tangent component - lessened for rolling wheels
                    vehicle.userData.velocity.multiplyScalar(frictionFactor);
                    
                    // If very slow, just stop completely
                    if (vehicle.userData.velocity.lengthSq() < 0.001) { // Reduced threshold from 0.005 to 0.001
                        vehicle.userData.velocity.set(0, 0, 0);
                    }
                    
                    // ADDED: Check if we need post-landing stabilization
                    if (vehicle.userData.needsLandingStabilization) {
                        const stabilizationElapsed = Date.now() - vehicle.userData.landingTime;
                        const stabilizationDuration = vehicle.userData.stabilizationDuration || 2000;
                        
                        // If stabilization period has passed, clear flag
                        if (stabilizationElapsed > stabilizationDuration) {
                            vehicle.userData.needsLandingStabilization = false;
                            
                            // ADDED: Set fullyStabilized flag when landing stabilization completes
                            vehicle.userData.fullyStabilized = true;
                            
                            if (vehicle.userData.debug) {
                                console.log("Vehicle landing stabilization complete - now fully stabilized");
                            }
                        }
                    }
                    // ADDED: Consider setting fully stabilized flag if landed and stable for long enough
                    else if (!vehicle.userData.fullyStabilized && !vehicle.userData.falling && vehicle.userData.landingTime) {
                        const timeSinceLanding = Date.now() - vehicle.userData.landingTime;
                        
                        // If landed for a while and not needing stabilization, mark as stable
                        if (timeSinceLanding > 5000) {
                            vehicle.userData.fullyStabilized = true;
                        }
                    }
                }
                
                // IMPROVED: More aggressive vehicle alignment during landing phase
                // Use a higher alignment factor particularly for recent landings
                const recentlyLanded = vehicle.userData.landingTime && 
                                     (Date.now() - vehicle.userData.landingTime < 3000); // Increased from 2000 to 3000ms
                                     
                // ADDED: Check if we need landing stabilization
                const needsStabilization = vehicle.userData.needsLandingStabilization || false;
                
                // Use extremely aggressive alignment during stabilization phase
                const alignmentFactor = needsStabilization ? 0.95 : // Nearly instant alignment during stabilization
                                      (recentlyLanded ? 0.9 : 0.3); // Increased from 0.8/0.2 to 0.9/0.3
                
                if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                    // ADDED: Add a flag to force full alignment during stabilization phase
                    VehicleManager.alignVehicleToPlanetSurface(
                        vehicle, 
                        surfaceNormal, 
                        alignmentFactor, 
                        needsStabilization
                    );
                    
                    // Clear the "just landed" flag after first alignment
                    if (vehicle.userData.justLanded) {
                        vehicle.userData.justLanded = false;
                    }
                } else {
                    // Simple fallback alignment with stronger correction
                    const yAxis = new Vector3(0, 1, 0);
                    const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
                    const angle = Math.acos(yAxis.dot(surfaceNormal));
                    
                    if (rotationAxis.lengthSq() > 0.0001) {
                        const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                        vehicle.quaternion.slerp(alignQuat, alignmentFactor);
                    }
                }
                
                // ADDED: For stabilizing after landing, add artificial damping to any remaining rotation
                if (needsStabilization) {
                    // Force the forward direction to be aligned with the planet surface
                    const forward = new Vector3(0, 0, -1);
                    forward.applyQuaternion(vehicle.quaternion);
                    
                    // Project forward onto planet surface
                    const projectedForward = forward.projectOnPlane(surfaceNormal).normalize();
                    
                    // Construct a target quaternion with perfect surface alignment
                    if (projectedForward.lengthSq() > 0.001) {
                        // Create temporary basis vectors
                        const up = surfaceNormal.clone();
                        const right = new Vector3().crossVectors(projectedForward, up).normalize();
                        
                        // Create rotation matrix from orthogonal basis
                        const m = new Matrix4().makeBasis(right, up, projectedForward.clone().negate());
                        const targetQuaternion = new Quaternion().setFromRotationMatrix(m);
                        
                        // Apply very strong correction toward this perfectly aligned orientation
                        vehicle.quaternion.slerp(targetQuaternion, 0.2);
                    }
                    
                    // Dampen any velocity
                    if (vehicle.userData.velocity && vehicle.userData.velocity.lengthSq() > 0.001) {
                        vehicle.userData.velocity.multiplyScalar(0.8); // Strong velocity damping during stabilization
                    }
                }
            } else {
                // We're in the air
                vehicle.userData.falling = true;
                vehicle.userData.justLanded = false; // Reset landing flag when airborne
                
                // ADDED: Reset stabilization flags when falling
                vehicle.userData.fullyStabilized = false;
                vehicle.userData.needsLandingStabilization = false;
            }

            // Update OBB collision bounds after moving vehicle
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

    // Add missing updateNonVehicles method to handle physics for all objects except the current vehicle
    static updateNonVehicles() {
        try {
            // Track the current vehicle to exclude it from physics
            const currentVehicle = VehicleManager?.currentVehicle;
            
            // Update player physics
            for (const player of PlayersManager.players) {
                if (!player) continue;
                
                // Skip physics update if player is in current vehicle
                if (player.inVehicle && VehicleManager.currentVehicle) {
                    continue;
                }
                
                this.updatePlayer(player);
            }
            
            // Update non-player vehicles
            for (const vehicle of VehicleManager.vehicles) {
                if (!vehicle) continue;
                
                // Skip the current vehicle (player-controlled one)
                if (vehicle === currentVehicle) {
                    continue;
                }
                
                this.applyVehiclePhysics(vehicle);
                this.maintainVehicleSurfaceHeight(vehicle);
            }
            
            // Update other physical objects (test cubes, etc.)
            this.updateObjects();
            
            // Update collision detection
            PlayersManager.updatePlayerColliders();
            
            // Process any pending collisions
            this.processCollisions();
        } catch (err) {
            console.error("Error in Physics.updateNonVehicles:", err);
        }
    }
}