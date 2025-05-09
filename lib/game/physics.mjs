import { Vector3, Quaternion, Box3, Matrix4, Matrix3, Euler, Object3D } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';
import PlayersManager from './players.mjs';
import ObjectManager from './object.mjs';
import VehicleManager from './vehicles.mjs';
import ControlManager from './control.mjs';

// Lower values create "moon-like" gravity, higher values "earth-like"
const GRAVITY_CONSTANT = 0.2;

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

    // The standard update method that updates everything
    static update() {
        try {
            // Process all collidable objects with one unified approach
            this.updateAllObjects();
            
            // Update collision detection
            PlayersManager.updatePlayerColliders();
            
            // Process any pending collisions
            this.processCollisions();
        } catch (err) {
            console.error("Error in Physics.update:", err);
        }
        
        // CRITICAL FIX: Add global function to exclude planets from collision checks
        if (typeof window !== 'undefined' && !window.shouldCheckCollisionWith) {
            window.shouldCheckCollisionWith = function(object) {
                // Skip collision checks with planets - they're for gravity only
                if (object && object.userData && object.userData.isPlanet) {
                    return false;
                }
                
                // ADDED: Skip collision checks between player and occupied vehicle
                if (window.VehicleManager && window.VehicleManager.currentVehicle && 
                    window.PlayersManager && window.PlayersManager.self) {
                    const currentVehicle = window.VehicleManager.currentVehicle;
                    const player = window.PlayersManager.self;
                    
                    // Skip if this is the occupied vehicle and player
                    if (object === currentVehicle && player.inVehicle) {
                        return false;
                    }
                    if (object === player.handle && player.inVehicle) {
                        return false;
                    }
                }
                
                return true;
            };
        }
    }
    
    // Apply velocity to an object's position
    static applyVelocity(object) {
        if (!object || !object.position || !object.userData || !object.userData.velocity) {
            return;
        }
        
        try {
            // Skip if velocity is zero
            const velocity = object.userData.velocity;
            const speed = velocity.length();
            if (speed <= 0.001) return;
            
            // SIMPLIFIED: Remove hardFreeze check, just use isStatic
            if (object.userData.isStatic) return;
            
            // Apply velocity in steps to prevent tunneling through objects
            const steps = Math.max(1, Math.ceil(speed / 0.5));
            const subStep = 1.0 / steps;
            
            for (let i = 0; i < steps; i++) {
                const stepVelocity = velocity.clone().multiplyScalar(subStep);
                object.position.add(stepVelocity);
                
                // Check for ground collision
                if (object.userData.soi) {
                    const planet = object.userData.soi;
                    const planetCenter = planet.object.position;
                    const distance = object.position.distanceTo(planetCenter);
                    const surfaceHeight = planet.radius + (object.userData.heightOffset || 0.1);
                    
                    // If hitting ground, stop this step's movement
                    if (distance <= surfaceHeight) {
                        break;
                    }
                }
            }
            
            // Update object matrix after movement
            object.updateMatrix();
            object.updateMatrixWorld(true);
            
            // Track that movement has happened
            object.userData._lastMovedTime = Date.now();
        } catch (err) {
            console.error("Error applying velocity to object:", err);
        }
    }

    // NEW: Unified physics update for all objects
    static updateAllObjects() {
        try {
            // Get all collidable objects from ObjectManager
            const collidables = ObjectManager.collidableObjects;
            
            // Process each object based on its type
            for (const collidable of collidables) {
                if (!collidable || !collidable.active || !collidable.object) continue;
                
                const object = collidable.object;
                const objectType = collidable.type;
                
                // ADDED: Special handling for vehicles that have just been exited
                const isRecentlyExitedVehicle = objectType === 'vehicle' && 
                    object.userData?.isStatic &&
                    object.userData?.staticEndTime &&
                    Date.now() < object.userData?.staticEndTime;
                    
                if (isRecentlyExitedVehicle) {
                    // For recently exited vehicles, just maintain height and alignment
                    this.maintainObjectSurfaceHeight(object);
                    continue;
                }
                
                // Set default processing flags
                let processGravity = true;
                let processSurfaceAlignment = false;
                
                // Special case checks
                const isPlayerControlledVehicle = objectType === 'vehicle' && 
                    object === VehicleManager.currentVehicle && 
                    object.userData?.isOccupied;
                    
                const isPlayer = objectType === 'player';
                const isLightCube = objectType === 'testCube' && object.userData?.isLightObject;
                const isHeavyCube = objectType === 'testCube' && object.userData?.isHeavyObject;
                const isVehicle = objectType === 'vehicle';
                
                // Special handling for player-controlled vehicle
                if (isPlayerControlledVehicle) {
                    // Only maintain height for player-controlled vehicle
                    this.maintainObjectSurfaceHeight(object);
                    continue;
                }
                
                // Process player physics through the standard player handler
                if (isPlayer) {
                    const player = this.findPlayerByHandle(object);
                    if (player) {
                        this.updatePlayer(player);
                        continue;
                    }
                }
                
                // For all other objects, process standard physics
                if (object.userData) {
                    // Apply gravity based on object's current state
                    if (processGravity && !object.userData.isStatic) {
                        this.applyGravity(object);
                    }
                    
                    // Apply movement based on velocity
                    if (object.userData.velocity && !object.userData.isStatic) {
                        // FIXED: Now correctly calls this.applyVelocity since it's defined above
                        this.applyVelocity(object);
                    }
                    
                    // For vehicles, apply specific handling
                    if (isVehicle) {
                        this.maintainObjectSurfaceHeight(object);
                    }
                    
                    // For physics cubes, handle interactions
                    else if (isLightCube) {
                        this.updateLightTestCube(object, collidable);
                    }
                    
                    // Heavy objects just need basic surface alignment
                    else if (isHeavyCube) {
                        this.maintainObjectSurfaceHeight(object);
                    }
                    
                    // Update collision bounds after physics processing
                    if (typeof ObjectManager.updateCollidableBounds === 'function') {
                        ObjectManager.updateCollidableBounds(object);
                    }
                }
            }
        } catch (err) {
            console.error("Error in updateAllObjects:", err);
        }
    }
    
    // Helper method to find player object from its handle
    static findPlayerByHandle(handle) {
        if (!PlayersManager || !PlayersManager.players) {
            return null;
        }
        
        return PlayersManager.players.find(p => p && p.handle === handle);
    }
    
    // NEW: Dedicated method to maintain correct vehicle height above planet surface
    static maintainVehicleHeight(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.planet) return;
        
        try {
            const planet = vehicle.userData.planet;
            if (!planet || !planet.object) return;
            
            // Get planet center and radius
            const planetCenter = planet.object.position;
            const planetRadius = planet.radius;
            
            // Calculate direction from planet center to vehicle
            const toVehicle = vehicle.position.clone().sub(planetCenter).normalize();
            
            // Get appropriate height offset based on vehicle type
            let heightOffset;
            if (vehicle.userData.type === 'car') {
                heightOffset = 2.2; // Increased from 1.8 to 2.2 for better wheel clearance
            } else if (vehicle.userData.type === 'airplane') {
                heightOffset = 0.8;
            } else {
                heightOffset = vehicle.userData.fixedHeightOffset || 0.5;
            }
            
            // Update the stored offset to ensure consistency
            vehicle.userData.fixedHeightOffset = heightOffset;
            
            // Calculate correct position at exact height above surface
            const correctPosition = planetCenter.clone().addScaledVector(
                toVehicle,
                planetRadius + heightOffset
            );
            
            // Only adjust if vehicle is not falling and not controlled by a specific controller
            if (!vehicle.userData.falling && !vehicle.userData._controlledByCarController) {
                // Apply position correction with smoothing to avoid jarring changes
                vehicle.position.lerp(correctPosition, 0.3);
                
                // Update matrices after position change
                vehicle.updateMatrix();
                vehicle.updateMatrixWorld(true);
                
                // Ensure surface normal is updated
                vehicle.userData.surfaceNormal = toVehicle.clone();
                
                // Mark as adjusted by physics
                vehicle.userData._heightMaintainedByPhysics = true;
                vehicle.userData._lastHeightMaintenance = Date.now();
            }
            
        } catch (err) {
            console.error("Error maintaining vehicle height:", err);
        }
    }
    
    // ENHANCED: Generic gravity application for any object with improved landing detection
    static applyGravity(object) {
        if (!object || !object.position || !object.userData) return;
        
        try {
            // Get or calculate SOI (planet influence)
            if (!object.userData.soi) {
                object.userData.soi = this.calculateSOI(object.position);
            }
            
            const soi = object.userData.soi;
            if (!soi || !soi.object || !soi.object.position || !soi.radius) return;
            
            // Calculate gravity direction and strength
            const planetCenter = soi.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const distance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Store surface normal for later use
            object.userData.surfaceNormal = surfaceNormal;
            
            // Calculate height above planet surface
            const heightAboveSurface = distance - soi.radius;
            object.userData.heightAboveSurface = heightAboveSurface;
            
            // IMPROVED: Use object-specific gravity factor
            const gravityFactor = object.userData.gravityFactor || 
                                (object.userData.type === 'player' ? 0.85 :
                                 object.userData.type === 'vehicle' || 
                                 object.userData.type === 'car' || 
                                 object.userData.type === 'airplane' ? 0.3 : 0.4);
            
            const gravity = GRAVITY_CONSTANT * gravityFactor / 
                Math.pow(distance / soi.radius, 2);
            
            // Apply gravity if velocity exists
            if (object.userData.velocity) {
                object.userData.velocity.addScaledVector(surfaceNormal, -gravity);
                
                // Apply air resistance for falling objects
                if (object.userData.falling) {
                    const speed = object.userData.velocity.length();
                    const airResistance = Math.min(0.08 * speed * speed, 0.7);
                    object.userData.velocity.multiplyScalar(1 - airResistance * 0.03);
                }
            }
            
            // ADDED: Check for landing specifically for vehicles that are falling
            if (object.userData.falling && 
                (object.userData.type === 'vehicle' || 
                 object.userData.type === 'car' || 
                 object.userData.type === 'airplane')) {
                
                // Get appropriate height offset for this vehicle type
                // CRITICAL FIX: Use consistent height offsets that place vehicles correctly on surface
                let heightOffset;
                if (object.userData.type === 'car') {
                    heightOffset = 2.2; // Increased from 1.8 to 2.2
                } else if (object.userData.type === 'airplane') {
                    heightOffset = 0.8;
                } else {
                    heightOffset = object.userData.fixedHeightOffset || 0.5;
                }
                
                // Store the proper height offset
                object.userData.fixedHeightOffset = heightOffset;
                
                const groundLevel = soi.radius + heightOffset;
                
                // CRITICAL FIX: More aggressive landing detection for vehicles
                // Detect landing further above surface to prevent clipping
                if (distance <= groundLevel + 1.0) {
                    console.log(`Vehicle landing detected at height ${heightAboveSurface.toFixed(2)}`);
                    
                    // Mark as landed
                    object.userData.falling = false;
                    object.userData.justLanded = true;
                    object.userData.landingTime = Date.now();
                    
                    // SIMPLIFIED: Just use isStatic for temporary freeze, remove hardFreeze
                    object.userData.velocity.set(0, 0, 0);
                    object.userData.speed = 0;
                    object.userData.isStatic = true;
                    object.userData.staticEndTime = Date.now() + 500; // Brief static period
                    
                    // Zero out any angular velocity
                    if (object.userData.angularVelocity) {
                        object.userData.angularVelocity.set(0, 0, 0);
                    }
                    
                    // CRITICAL FIX: Immediately snap to correct height
                    const correctedPosition = planetCenter.clone().addScaledVector(
                        surfaceNormal, 
                        groundLevel
                    );
                    
                    // Apply the position correction
                    object.position.copy(correctedPosition);
                    
                    // Force update matrices
                    object.updateMatrix();
                    object.updateMatrixWorld(true);
                    
                    console.log(`Vehicle snapped to surface at height ${heightOffset.toFixed(2)}`);
                    
                    // Apply surface alignment
                    if (typeof window.VehicleManager?.alignVehicleToPlanetSurface === 'function') {
                        window.VehicleManager.alignVehicleToPlanetSurface(
                            object, surfaceNormal, 0.8, true
                        );
                    }
                }
            }
            
            // ...existing code...
            
        } catch (err) {
            console.error("Error applying gravity to object:", err);
        }
    }
    
    // Generalized version to maintain ANY object at proper height above surface
    static maintainObjectSurfaceHeight(object) {
        if (!object || !object.userData) return;
        
        // IMPROVED: Better check for controller-managed vehicles
        // Only skip if the car controller is actively managing height AND has done so recently
        const managedByController = object.userData._controlledByCarController && 
                                  object.userData._heightManagedByController && 
                                  object.userData._lastHeightManagement && 
                                  (Date.now() - object.userData._lastHeightManagement < 500); // Reduced from 1000ms
        
        if (managedByController && !object.userData._needsSurfaceCorrection) {
            // If actively managed by controller, skip physics height management
            return;
        }
        
        try {
            // Get or calculate planet
            if (!object.userData.planet) {
                object.userData.planet = this.calculateSOI(object.position);
            }
            
            // CRITICAL FIX: Store planet in a local variable and verify it exists
            const planet = object.userData.planet || object.userData.soi;
            
            // Skip if planet is not defined or invalid
            if (!planet) {
                console.warn(`No planet found for object type '${object.userData.type || 'unknown'}' - skipping height maintenance`);
                return;
            }
            
            const planetCenter = planet.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const distance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Store surface normal for alignment and collision
            object.userData.surfaceNormal = surfaceNormal;
            
            // Get fixed height offset based on object type
            // CRITICAL FIX: Use consistent height offsets that place vehicles correctly
            let heightOffset;
            if (object.userData.type === 'car') {
                heightOffset = 2.2; // Increased from 1.8 to 2.2 for better wheel clearance
            } else if (object.userData.type === 'airplane') {
                heightOffset = 0.8;
            } else {
                heightOffset = object.userData.fixedHeightOffset || 0.1;
            }
            
            // Store the correct value for consistent use
            object.userData.fixedHeightOffset = heightOffset;
            
            const groundLevel = planet.radius + heightOffset;
            
            // IMPROVED: Calculate current height above surface for debugging
            const heightAboveSurface = distance - planet.radius;
            object.userData.heightAboveSurface = heightAboveSurface;

            // CRITICAL FIX: Skip height correction for falling vehicles to match player behavior
            if (object.userData.falling && 
                (object.userData.isVehicle || object.userData.type === 'car' || 
                 object.userData.type === 'airplane' || object.userData.type === 'vehicle')) {
                // For falling vehicles, only update the height info but don't correct position
                return;
            }

            // IMPROVED: Define a reasonable height tolerance value for when to apply corrections
            const heightTolerance = object.userData.type === 'car' ? 0.15 : 0.25; // Tighter tolerance for cars
            
            // Only adjust if significantly different from target height
            if (Math.abs(distance - groundLevel) > heightTolerance) {
                this.correctObjectHeight(object, planetCenter, surfaceNormal, groundLevel);
            }
            // Object is at correct height - potential stabilization
            else if (!object.userData.fullyStabilized && !object.userData.falling && object.userData.landingTime) {
                const timeSinceLanding = Date.now() - object.userData.landingTime;
                
                // If landed for a while and height is stable, mark as fully stabilized
                if (timeSinceLanding > 5000) {
                    object.userData.fullyStabilized = true;
                }
            }
            
            // Apply very gentle gravity damping for stabilized objects
            this.applyStabilizationDamping(object);
            
            // ENHANCED: For cars, always apply stronger alignment to ensure bottom faces surface
            const needsStrongerAlignment = object.userData.type === 'car' || 
                                          (object.userData.isVehicle && !object.userData.falling);
                                          
            // Align object to surface based on its type
            this.alignObjectToPlanetSurface(object, surfaceNormal);
            
            // Update collision bounds after position change
            if (object.collidable) {
                ObjectManager.updateCollidableBounds(object);
            }
            
        } catch (e) {
            console.error(`Error maintaining object surface height (${object.userData.type || 'unknown'}):`, e);
        }
    }

    // Handle vehicle-specific landing behaviors
    static handleVehicleLanding(vehicle, surfaceNormal) {
        // For vehicles, use VehicleManager's alignment if available
        if (typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
            VehicleManager.alignVehicleToPlanetSurface(vehicle, surfaceNormal, 0.9, true);
        }
        
        // Reset wheel orientation for cars
        if (vehicle.userData.type === 'car' && 
            typeof VehicleManager.resetWheelsBaseOrientation === 'function') {
            VehicleManager.resetWheelsBaseOrientation(vehicle);
        }
    }
    
    // Correct object height above surface
    static correctObjectHeight(object, planetCenter, surfaceNormal, groundLevel) {
        try {
            // Calculate new position at correct height
            const newPosition = planetCenter.clone().addScaledVector(
                surfaceNormal,
                groundLevel
            );
            
            // Apply gentler correction based on stabilization state
            const correctionFactor = object.userData.fullyStabilized ? 0.1 : 0.3;
            
            object.position.lerp(newPosition, correctionFactor);
            
            // Update object's matrix
            object.updateMatrix();
            object.updateMatrixWorld(true);
            
            // Objects that needed height adjustment are not fully stabilized
            if (Math.abs(object.position.distanceTo(planetCenter) - groundLevel) > 0.5) {
                object.userData.fullyStabilized = false;
            }
            
            if (object.userData.debug) {
                const distance = object.position.distanceTo(planetCenter);
                const heightOffset = object.userData.fixedHeightOffset || 0.1;
                console.log(`Maintaining object height: ${(distance - groundLevel + heightOffset).toFixed(2)} → ${heightOffset.toFixed(2)}`);
            }
        } catch (err) {
            console.error("Error correcting object height:", err);
        }
    }
    
    // Apply stabilization damping to grounded objects
    static applyStabilizationDamping(object) {
        if (!object.userData || !object.userData.velocity) return;
        
        // Only apply damping if not falling and has been on ground for some time
        if (!object.userData.falling && object.userData.landingTime && 
            object.userData.velocity.lengthSq() > 0.001) {
            
            // Calculate how long object has been on the ground
            const groundedTime = Date.now() - object.userData.landingTime;
            
            // Stronger damping the longer it's been on the ground
            let dampingFactor = 0.7;
            if (groundedTime > 3000) {
                dampingFactor = 0.95; // Very strong damping after 3 seconds
            } else if (groundedTime > 1000) {
                dampingFactor = 0.85; // Strong damping after 1 second
            }
            
            // Apply damping to velocity
            object.userData.velocity.multiplyScalar(1 - dampingFactor);
            
            // Zero out very small velocities to prevent perpetual tiny movements
            if (object.userData.velocity.lengthSq() < 0.001) {
                object.userData.velocity.set(0, 0, 0);
            }
        }
    }
    
    // IMPROVED: Align an object to the planet surface - simplified to use ObjectManager
    static alignObjectToPlanetSurface(object, surfaceNormal) {
        // UPDATED: Use the centralized alignment method in ObjectManager with stronger defaults for vehicles
        const isVehicle = object.userData?.isVehicle || 
                          object.userData?.type === 'car' || 
                          object.userData?.type === 'airplane' ||
                          object.userData?.type === 'vehicle';
                          
        return ObjectManager.alignObjectToSurface(object, surfaceNormal, {
            lerpFactor: isVehicle ? 0.15 : 0.1, // Stronger alignment factor for vehicles
            skipIfFalling: false,              // Always align vehicles for better visuals
            alignmentType: 'physics'
        });
    }

    // Updates player physics, processes all collidable objects
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

        // Initialize velocity if not present
        if (!player.velocity) {
            player.velocity = new Vector3(0, 0, 0);
            console.warn("Player missing velocity property - initialized");
        }

        // Cap velocity to prevent tunneling
        const maxVelocity = 15;
        if (player.velocity.lengthSq() > maxVelocity * maxVelocity) {
            player.velocity.normalize().multiplyScalar(maxVelocity);
        }

        // Apply movement in substeps
        const velocity = player.velocity.clone();
        const speed = velocity.length();
        const numSteps = speed > 5 ? Math.ceil(speed / 5) : 1;
        const subStep = 1.0 / numSteps;
        
        // Ensure player handle is updated
        if (player.handle && !player.position.equals(player.handle.position)) {
            player.handle.position.copy(player.position);
            player.handle.updateMatrix();
            player.handle.updateMatrixWorld(true);
        }
        
        // Track if any collisions happened
        let hadCollision = false;

        // Process movement and collision in steps
        for (let step = 0; step < numSteps && !hadCollision; step++) {
            const stepVelocity = velocity.clone().multiplyScalar(subStep);
            
            // Apply movement
            player.position.add(stepVelocity);
            if (player.handle) {
                player.handle.position.copy(player.position);
            }
            
            // Update sphere of influence
            player.soi = this.calculateSOI(player.position);
            if (!player.soi) continue;
            
            // Check for collisions with objects
            // This is handled by the collision system and stored in player.currentlyColliding
            
            // Apply planet gravity and ground detection
            if (player.soi && player.soi.object) {
                const planetRadius = player.soi.radius;
                const collisionDistance = planetRadius + 0.8; // Distance above planet surface
                const soi = player.soi.object;
                
                const toPlayer = player.position.clone().sub(soi.position);
                const distance = toPlayer.length();
                const surfaceNormal = toPlayer.normalize();
                
                // CRITICAL: Apply gravity if player is not standing on an object
                if (!player.standingOnObject) {
                    // Calculate gravity strength based on distance
                    const playerGravityFactor = 0.85; // Reduced player gravity
                    const gravity = GRAVITY_CONSTANT * playerGravityFactor / 
                                  Math.pow(distance / planetRadius, 2);
                    
                    // Apply gravity to velocity
                    player.velocity.add(surfaceNormal.clone().multiplyScalar(-gravity));
                    
                    // Update surface normal
                    player.surfaceNormal = surfaceNormal.clone();
                }
                
                // Check if player is on planet surface
                const onPlanet = distance <= collisionDistance;
                const downwardSpeed = player.velocity.dot(surfaceNormal);
                const canLiftoff = (!player.falling && downwardSpeed < 0);
                
                if ((onPlanet || canLiftoff) && !player.standingOnObject) {
                    // Position player on surface
                    const surfacePosition = soi.position.clone()
                        .add(surfaceNormal.clone().multiplyScalar(collisionDistance));
                    
                    player.position.copy(surfacePosition);
                    if (player.handle) {
                        player.handle.position.copy(surfacePosition);
                    }
                    
                    // Check if player was falling
                    if (player.falling) {
                        // Handle landing
                        player.falling = false;
                        
                        if (ControlManager.controller?.landing) {
                            ControlManager.controller.landing(surfaceNormal);
                        }
                        
                        // Apply friction
                        if (player.soi.CoF) {
                            player.velocity.multiplyScalar(1 - player.soi.CoF);
                        }
                    } else {
                        // Already on ground - just apply friction
                        if (player.soi.CoF) {
                            player.velocity.multiplyScalar(1 - player.soi.CoF);
                        }
                    }
                } else if (!player.standingOnObject && !player.falling && distance > collisionDistance + 0.5) {
                    // Player is leaving the ground
                    if (ControlManager.controller?.liftoff) {
                        ControlManager.controller.liftoff(surfaceNormal);
                    }
                    player.falling = true;
                }
            }
        }
        
        // Update handle position
        if (player.handle) {
            player.handle.position.copy(player.position);
            
            // Update collision bounds
            if (player.collidable) {
                ObjectManager.updateCollidableBounds(player.handle);
            }
        }
    }

    // Add missing updateObjects method to handle physics for static and dynamic objects
    static updateObjects() {
        try {
            // Process any test cubes or other physics objects in the scene
            for (const collidable of ObjectManager.collidableObjects) {
                if (!collidable || !collidable.active) continue;
                
                // Skip players and vehicles as they're handled separately
                if (collidable.type === 'player' || collidable.type === 'vehicle') continue;
                
                const object = collidable.object;
                if (!object || !object.userData) continue;
                
                // Process test cubes that can be pushed
                if (collidable.type === 'testCube' && object.userData.isLightObject) {
                    this.updateLightTestCube(object, collidable);
                }
                
                // Update other physics objects here if needed
            }
        } catch (err) {
            console.error("Error in Physics.updateObjects:", err);
        }
    }
    
    // Helper method for updateObjects to handle light test cubes that can be pushed
    static updateLightTestCube(object, collidable) {
        try {
            // Initialize velocity if not present
            if (!object.userData.velocity) {
                object.userData.velocity = new Vector3(0, 0, 0);
            }
            
            // Get or calculate planet (sphere of influence)
            if (!object.userData.planet) {
                object.userData.planet = this.calculateSOI(object.position);
            }
            const planet = object.userData.planet;
            if (!planet || !planet.object) return;
            
            // Get surface normal and apply gravity
            const planetCenter = planet.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const distance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Store surface normal for collisions and visualization
            object.userData.surfaceNormal = surfaceNormal;
            
            // Apply gravity - use lighter gravity for test cubes
            // REDUCED: Further reduce gravity for test cubes
            const testCubeGravityFactor = 0.3; // Reduced from 0.4 to 0.3
            const gravity = GRAVITY_CONSTANT * testCubeGravityFactor / Math.pow(distance / planet.radius, 2);
            object.userData.velocity.addScaledVector(surfaceNormal, -gravity);
            
            // Apply velocity to position
            const speed = object.userData.velocity.length();
            if (speed > 0) {
                const steps = Math.max(1, Math.ceil(speed / 0.5));
                const subStep = 1.0 / steps;
                
                for (let i = 0; i < steps; i++) {
                    const stepVelocity = object.userData.velocity.clone().multiplyScalar(subStep);
                    object.position.add(stepVelocity);
                }
            }
            
            // Apply friction and handle ground collision
            const groundLevel = planet.radius + (object.userData.heightOffset || 0.1);
            
            if (distance <= groundLevel + 0.5) {
                // Keep object at correct height
                const newPosition = planetCenter.clone().addScaledVector(surfaceNormal, groundLevel);
                object.position.lerp(newPosition, 0.3);
                
                // Remove vertical velocity component for objects on ground
                const verticalComponent = surfaceNormal.clone().multiplyScalar(
                    object.userData.velocity.dot(surfaceNormal)
                );
                object.userData.velocity.sub(verticalComponent);
                
                // Apply surface friction
                const friction = planet.CoF || 0.2;
                object.userData.velocity.multiplyScalar(1 - friction);
                
                // Zero out very small velocities
                if (object.userData.velocity.lengthSq() < 0.001) {
                    object.userData.velocity.set(0, 0, 0);
                }
                
                // Align object to surface
                const yAxis = new Vector3(0, 1, 0);
                const rotationAxis = new Vector3().crossVectors(yAxis, surfaceNormal).normalize();
                const angle = Math.acos(yAxis.dot(surfaceNormal));
                
                if (rotationAxis.lengthSq() > 0.001) {
                    const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                    object.quaternion.slerp(alignQuat, 0.1);
                }
            }
            
            // Update collision bounds
            if (typeof ObjectManager.updateCollidableBounds === 'function') {
                ObjectManager.updateCollidableBounds(object);
            }
            
        } catch (err) {
            console.error("Error updating light test cube:", err);
        }
    }
    
    // Add missing processCollisions method referenced in update methods
    static processCollisions() {
        try {
            // Process collisions between objects on planet surfaces
            this.processPlanetSurfaceCollisions();
            
            // Process player-specific collisions
            if (PlayersManager.self) {
                this.processPlayerCollisions(PlayersManager.self);
            }
        } catch (err) {
            console.error("Error in processCollisions:", err);
        }
    }
    
    // NEW: Process collisions between objects on planet surfaces
    static processPlanetSurfaceCollisions() {
        try {
            const collidables = ObjectManager.collidableObjects;
            if (!collidables || collidables.length < 2) return;
            
            // Track processed pairs to avoid duplicate checks
            const processedPairs = new Set();
            
            // ENHANCED: Track number of object collisions for debugging
            let collisionCount = 0;
            
            // Check each collidable against others
            for (let i = 0; i < collidables.length; i++) {
                const objA = collidables[i];
                if (!objA || !objA.active || !objA.object) continue;
                
                // Skip static objects for first loop (they don't move)
                if (objA.isStatic) continue;
                
                // Only process objects that are on the ground (not falling)
                if (objA.object.userData?.falling) continue;
                
                for (let j = 0; j < collidables.length; j++) {
                    if (i === j) continue; // Skip self
                    
                    const objB = collidables[j];
                    if (!objB || !objB.active || !objB.object) continue;
                    
                    // Create a unique key for this pair to avoid processing twice
                    const pairKey = `${Math.min(i, j)}-${Math.max(i, j)}`;
                    if (processedPairs.has(pairKey)) continue;
                    processedPairs.add(pairKey);
                    
                    // Skip if either object is falling
                    if (objB.object.userData?.falling) continue;
                    
                    // Check if both objects are on the same planet
                    const planetA = objA.object.userData?.planet || objA.object.userData?.soi;
                    const planetB = objB.object.userData?.planet || objB.object.userData?.soi;
                    if (!planetA || !planetB || planetA !== planetB) continue;
                    
                    // IMPROVED: More reliable detection with fallback options
                    let collisionDetected = false;
                    
                    // First try OBB collision if both objects have valid OBBs
                    // CRITICAL FIX: Use ObjectManager.validateOBB instead of this.validateOBB
                    if (objA.obb && objB.obb && 
                        ObjectManager.validateOBB(objA.obb) && ObjectManager.validateOBB(objB.obb)) {
                
                        // CRITICAL FIX: Direct OBB-OBB test
                        const centerDist = objA.object.position.distanceTo(objB.object.position);
                        const maxSizeA = Math.max(objA.obb.halfSize.x, objA.obb.halfSize.y, objA.obb.halfSize.z);
                        const maxSizeB = Math.max(objB.obb.halfSize.x, objB.obb.halfSize.y, objB.obb.halfSize.z);
                        
                        // If centers are close enough, do detailed check
                        if (centerDist < (maxSizeA + maxSizeB) * 2.0) {
                            // Get closest points between the OBBs
                            // SIMPLIFIED: Use direct sphere collision as fallback
                            if (centerDist < (maxSizeA + maxSizeB) * 1.1) {
                                collisionDetected = true;
                            }
                        }
                    } else {
                        // Fallback to sphere check if OBBs are invalid
                        const radiusA = this.getObjectRadius(objA.object);
                        const radiusB = this.getObjectRadius(objB.object);
                        const distance = objA.object.position.distanceTo(objB.object.position);
                        
                        collisionDetected = distance < (radiusA + radiusB);
                    }
                    
                    // Resolve collision if detected
                    if (collisionDetected) {
                        this.resolveCollision(objA, objB, planetA);
                        collisionCount++;
                    }
                }
            }
            
            // Log collision count if non-zero
            if (collisionCount > 0) {
                console.log(`Processed ${collisionCount} object-object collisions`);
            }
        } catch (err) {
            console.error("Error in processPlanetSurfaceCollisions:", err);
        }
    }
    
    // New helper method - simple and direct OBB-OBB collision test
    static obbIntersectsOBB(obb1, obb2) {
        // CRITICAL FIX: Use ObjectManager.validateOBB instead of this.validateOBB
        if (!ObjectManager.validateOBB(obb1) || !ObjectManager.validateOBB(obb2)) {
            return false;
        }
        
        try {
            // Simple distance check first
            const centerDistance = obb1.center.distanceTo(obb2.center);
            const maxSize1 = Math.max(obb1.halfSize.x, obb1.halfSize.y, obb1.halfSize.z);
            const maxSize2 = Math.max(obb2.halfSize.x, obb2.halfSize.y, obb2.halfSize.z);
            
            // Quick rejection test
            if (centerDistance > (maxSize1 + maxSize2) * 2.0) {
                return false;
            }
            
            // SIMPLIFIED: For closer objects, just use approximate sphere collision
            if (centerDistance < (maxSize1 + maxSize2) * 1.5) {
                return true; // Close enough to consider collision
            }
            
            // If that fails, use more complex test
            // Get closest points
            // CRITICAL FIX: Use ObjectManager.findContactPoint instead of this.findContactPoint
            const closestPointResult = ObjectManager.findContactPoint(obb1, obb2);
            
            if (closestPointResult && closestPointResult.distance < 0.5) {
                return true;
            }
            
            return false;
        } catch (err) {
            console.error("Error in obbIntersectsOBB:", err);
            return false; // Safer default
        }
    }
    
    // IMPROVED: Get object radius for sphere-based collision - more generous
    static getObjectRadius(object) {
        if (!object) return 1.5; // Increased default radius
    
        try {
            // For player, use clearly defined radius
            if (object.userData && object.userData.isPlayer) {
                return object.userData.collisionRadius || 1.2; // Increased player radius
            }
            
            // For vehicles, use type-specific radius with larger values
            if (object.userData && object.userData.isVehicle) {
                if (object.userData.type === 'car') return 3.5; // Increased from 3.0
                if (object.userData.type === 'airplane') return 6.5; // Increased from 6.0
                return 4.5; // Increased from 4.0
            }
            
            // For test cubes, use larger sizes
            if (object.userData && object.userData.type === 'testCube') {
                if (object.userData.collisionRadius) {
                    return object.userData.collisionRadius;
                }
                
                // Calculate from cube dimensions with safety margin
                const width = (object.userData.width || 1) * 1.2;
                const height = (object.userData.height || 1) * 1.2; 
                const depth = (object.userData.depth || 1) * 1.2;
                
                // Use half the largest dimension plus small margin
                return Math.max(width, height, depth) / 2 + 0.2;
            }
            
            // For other objects with OBB, use more generous radius
            if (object.collidable && object.collidable.obb) {
                const obb = object.collidable.obb;
                // Calculate maximum radius from half-size with safety margin
                return Math.max(obb.halfSize.x, obb.halfSize.y, obb.halfSize.z) * 1.2;
            } else if (object.collidable && object.collidable.aabb) {
                const aabb = object.collidable.aabb;
                // Calculate size from AABB with safety margin
                const sizeX = (aabb.max.x - aabb.min.x) * 1.2;
                const sizeY = (aabb.max.y - aabb.min.y) * 1.2;
                const sizeZ = (aabb.max.z - aabb.min.z) * 1.2;
                return Math.max(sizeX, sizeY, sizeZ) / 2;
            }
            
            // Default values based on type with increased sizes
            if (object.userData && object.userData.type) {
                switch (object.userData.type) {
                    case 'player': return 1.2; // Increased from 1.0
                    case 'car': return 3.5; // Increased from 3.0
                    case 'airplane': return 6.5; // Increased from 6.0
                    case 'testCube': return 2.0; // Increased from 1.5
                    default: return 1.5; // Increased from 1.0
                }
            }
            
            return 1.5; // Increased default fallback
        } catch (err) {
            console.error("Error getting object radius:", err);
            return 1.5; // Increased default fallback
        }
    }
    
    // NEW: Resolve collision between two objects on a planet surface
    static resolveCollision(objA, objB, planet) {
        try {
            const objectA = objA.object;
            const objectB = objB.object;
            const planetCenter = planet.object.position;
            
            // Calculate vector between object centers
            const direction = new Vector3().subVectors(objectA.position, objectB.position);
            const distance = direction.length();
            
            // Skip if objects are too far apart (shouldn't happen)
            if (distance > 10) return;
            
            // Get object masses for momentum calculation
            const massA = this.getObjectMass(objectA);
            const massB = this.getObjectMass(objectB);
            
            // Calculate penetration depth
            const radiusA = this.getObjectRadius(objectA);
            const radiusB = this.getObjectRadius(objectB);
            const penetration = radiusA + radiusB - distance;
            
            // Skip if not actually penetrating
            if (penetration <= 0) return;
            
            // Normalize direction and calculate separation amounts
            const totalMass = massA + massB;
            const ratioA = massB / totalMass;
            const ratioB = massA / totalMass;
            
            // IMPORTANT: Handle special case of fixed objects
            if (objectA.userData.isStatic || objA.isStatic) {
                // A is static - only move B
                this.moveObjectOnPlanetSurface(objectB, direction, -penetration, planet);
                return;
            }
            
            if (objectB.userData.isStatic || objB.isStatic) {
                // B is static - only move A
                this.moveObjectOnPlanetSurface(objectA, direction, penetration, planet);
                return;
            }
            
            // Both objects movable - move them apart inversely proportional to mass
            this.moveObjectOnPlanetSurface(objectA, direction, penetration * ratioA, planet);
            this.moveObjectOnPlanetSurface(objectB, direction, -penetration * ratioB, planet);
            
            // Apply impulse velocity changes for physical response
            this.applyCollisionImpulse(objectA, objectB, direction, penetration, massA, massB);
            
        } catch (err) {
            console.error("Error resolving collision:", err);
        }
    }
    
    // NEW: Helper to get object mass for physics
    static getObjectMass(object) {
        if (!object || !object.userData) return 100; // Default mass
        
        // First check for explicit mass property
        if (object.userData.mass) {
            return object.userData.mass;
        }
        
        // If no mass specified, use default based on type
        if (object.userData.type) {
            if (this.DEFAULT_MASSES[object.userData.type]) {
                return this.DEFAULT_MASSES[object.userData.type];
            }
            
            // Specific handling for special types
            if (object.userData.type === 'testCube') {
                if (object.userData.isLightObject) {
                    return this.DEFAULT_MASSES.lightCube;
                }
                if (object.userData.isHeavyObject) {
                    return this.DEFAULT_MASSES.heavyCube;
                }
                return this.DEFAULT_MASSES.testCube;
            }
        }
        
        // Handle player special case
        if (object.userData.isPlayer) {
            return this.DEFAULT_MASSES.player;
        }
        
        // Default value based on size
        return 100;
    }
    
    // NEW: Move an object along the surface of a planet (avoiding flying off)
    static moveObjectOnPlanetSurface(object, direction, amount, planet) {
        if (!object || !planet) return;
        
        try {
            // Get planet info
            const planetCenter = planet.object.position;
            const planetRadius = planet.radius;
            
            // Calculate current surface normal
            const toObject = object.position.clone().sub(planetCenter).normalize();
            
            // Project the separation direction onto the planet surface tangent plane
            const surfaceDirection = new Vector3();
            surfaceDirection.copy(direction).projectOnPlane(toObject).normalize();
            
            // Move object along the surface
            const moveAmount = amount * 0.5; // Reduce movement amount to avoid tunneling
            object.position.addScaledVector(surfaceDirection, moveAmount);
            
            // Maintain correct height above planet surface
            const currentDistance = object.position.distanceTo(planetCenter);
            const heightOffset = object.userData.fixedHeightOffset || 0.1;
            const targetDistance = planetRadius + heightOffset;
            
            // Adjust position to maintain correct height
            const newToObject = object.position.clone().sub(planetCenter);
            const newDistance = newToObject.length();
            const newNormal = newToObject.normalize();
            
            object.position.copy(planetCenter).addScaledVector(
                newNormal, 
                targetDistance
            );
            
            // Update object's matrix after position change
            object.updateMatrix();
            object.updateMatrixWorld(true);
            
            // Update collision bounds
            if (object.collidable) {
                ObjectManager.updateCollidableBounds(object);
            }
        } catch (err) {
            console.error("Error moving object on planet surface:", err);
        }
    }
    
    // NEW: Apply physical impulse response to colliding objects with reduced bounce
    static applyCollisionImpulse(objectA, objectB, direction, penetration, massA, massB) {
        try {
            // Skip if either object doesn't have velocity
            if (!objectA.userData.velocity || !objectB.userData.velocity) return;
            
            // Get current velocities
            const velA = objectA.userData.velocity;
            const velB = objectB.userData.velocity;
            
            // Calculate relative velocity along collision normal
            const relativeVelocity = new Vector3()
                .subVectors(velA, velB)
                .dot(direction);
                
            // Identify object types for specialized handling
            const isVehicleA = objectA.userData?.isVehicle || objectA.userData?.type === 'vehicle' || 
                              objectA.userData?.type === 'car' || objectA.userData?.type === 'airplane';
            const isVehicleB = objectB.userData?.isVehicle || objectB.userData?.type === 'vehicle' || 
                              objectB.userData?.type === 'car' || objectB.userData?.type === 'airplane';
            const isPlayerA = objectA.userData?.isPlayer;
            const isPlayerB = objectB.userData?.isPlayer;
                          
            const isVehicleCollision = isVehicleA && isVehicleB;
            const isVehiclePlayerCollision = (isVehicleA && isPlayerB) || (isVehicleB && isPlayerA);
            
            if (relativeVelocity > 0 && !isVehicleCollision && !isVehiclePlayerCollision) return;
            
            // Log pre-collision velocities for debugging
            console.log(`PRE-COLLISION: Object A speed: ${velA.length().toFixed(2)}, Object B speed: ${velB.length().toFixed(2)}`);
            
            // CRITICAL FIX: Check for stationary vehicles
            const speedA = velA.length();
            const speedB = velB.length();
            const isStationaryA = speedA < 0.1;
            const isStationaryB = speedB < 0.1;
            
            // CRITICAL FIX: For stationary-stationary vehicle collisions, add minimal velocity
            // This ensures the physics system properly handles the collision
            if (isVehicleCollision && isStationaryA && isStationaryB) {
                console.log("SPECIAL CASE: Collision between two stationary vehicles");
                
                // Add a small velocity to the first vehicle to simulate a tiny push
                const minVelocity = 0.25;
                const pushDirection = direction.clone().multiplyScalar(-1);
                velA.addScaledVector(pushDirection, minVelocity);
                
                // Flag both vehicles to ensure they process physics
                // SIMPLIFIED: Just clear isStatic, remove hardFreeze references
                objectA.userData.isStatic = false;
                objectB.userData.isStatic = false;
            }
            
            // CRITICAL FIX: Handle moving vehicle hitting stationary vehicle
            const isMovingHittingStationary = isVehicleCollision && 
                ((isStationaryB && !isStationaryA) || (isStationaryA && !isStationaryB));
                
            if (isMovingHittingStationary) {
                console.log("DETECTED: Moving vehicle hitting stationary vehicle!");
                
                // Ensure the stationary vehicle is not static
                // SIMPLIFIED: Only clear isStatic flag
                if (isStationaryA) {
                    objectA.userData.isStatic = false;
                } else {
                    objectB.userData.isStatic = false;
                }
            }
            
            // ORIGINAL CODE: Use standard physics from here
            // Set restitution based on collision type
            let restitution;
            
            if (isVehicleCollision) {
                // Lower restitution for vehicle-vehicle collisions
                restitution = 0.0; // Reduced to eliminate bounce
            } else if (isVehiclePlayerCollision) {
                // Lower restitution for vehicle-player collisions too
                restitution = 0.02;
            } else {
                // Use the lowest restitution of both objects with a cap
                const restitutionA = objectA.userData.bounceFactor || 0.1;
                const restitutionB = objectB.userData.bounceFactor || 0.1;
                restitution = Math.min(restitutionA, restitutionB);
            }
            
            // Calculate momentum-conserving impulse
            const impulseFactor = -(1 + restitution) * relativeVelocity / 
                                (1/massA + 1/massB);
            
            // Apply impulse based on mass
            const impulse = direction.clone().multiplyScalar(impulseFactor);
            
            // For vehicle collisions, always apply impulse to both objects
            if (isVehicleCollision || isVehiclePlayerCollision) {
                velA.addScaledVector(impulse, 1/massA);
                velB.addScaledVector(impulse, -1/massB);
                
                console.log(`Collision impulse: ${impulseFactor.toFixed(2)}`);
            } else {
                // For other collisions, respect static property
                const isStaticA = objectA.userData?.isStatic || false;
                const isStaticB = objectB.userData?.isStatic || false;
                
                if (!isStaticA) {
                    velA.addScaledVector(impulse, 1/massA);
                }
                if (!isStaticB) {
                    velB.addScaledVector(impulse, -1/massB);
                }
            }
            
            // For vehicle-vehicle collisions, update vehicle speed properties
            if (isVehicleCollision) {
                // Update speed properties for both objects
                if (typeof objectA.userData.speed !== 'undefined') {
                    objectA.userData.speed = velA.length();
                    console.log(`Vehicle A speed after collision: ${objectA.userData.speed.toFixed(2)}`);
                }
                
                if (typeof objectB.userData.speed !== 'undefined') {
                    objectB.userData.speed = velB.length();
                    console.log(`Vehicle B speed after collision: ${objectB.userData.speed.toFixed(2)}`);
                }
                
                // CRITICAL FIX: Flag collided vehicles with impact state for special handling
                if (isMovingHittingStationary) {
                    const stationaryObj = isStationaryA ? objectA : objectB;
                    const movingObj = isStationaryA ? objectB : objectA;
                    
                    // Flag the stationary vehicle as recently impacted
                    stationaryObj.userData.justImpacted = true;
                    stationaryObj.userData.impactTime = Date.now();
                }
            }
        } catch (err) {
            console.error("Error applying collision impulse:", err);
        }
    }
    
    // FIXED: Process player-specific collisions with enhanced debug visualization
    static processPlayerCollisions(player) {
        if (!player || !player.handle || player.inVehicle) return;
        
        try {
            // Always use sphere collision for players - make sure radius is defined
            const playerRadius = player.collisionRadius || 1.2; // Increased radius for better detection
            let collisionFound = false;
            
            // Reset active collisions for this frame
            player.activeCollisions = [];

            // Check against all collidable objects
            const collidables = ObjectManager.collidableObjects;
            if (!collidables || collidables.length === 0) return;
            
            // Debug logging for collision checks
            const collisionDebug = false; // Set to true for verbose collision logs
            if (collisionDebug) {
                console.log(`Checking player collisions against ${collidables.length} objects`);
            }
            
            for (const collidable of collidables) {
                // Skip invalid colliders
                if (!collidable || !collidable.active || !collidable.object) {
                    continue;
                }
                
                // Skip self-collision
                if (collidable.object === player.handle) {
                    continue;
                }
                
                // Skip vehicles that player is in
                if (player.inVehicle && collidable.object === VehicleManager.currentVehicle) {
                    continue;
                }
                
                // Skip explicit collision ignores
                if (player.handle._ignoreCollisionWith === collidable.object ||
                    collidable.object._ignoreCollisionWith === player.handle) {
                    continue;
                }
                
                // Skip planets - they're handled through gravity system
                if (collidable.object.userData?.isPlanet) {
                    continue;
                }
                
                // CRITICAL FIX: Use proper Sphere-OBB collision detection
                // First do a quick sphere-sphere distance check for early rejection
                const objectPos = collidable.object.position;
                const centerDistance = player.position.distanceTo(objectPos);
                
                // Get approximate size of the object for distance check
                const objectRadius = this.getObjectRadius(collidable.object);
                
                // If centers are too far apart, no collision possible (broad phase)
                const maxCheckDistance = playerRadius + objectRadius + 1.0; // Add margin for safety
                if (centerDistance > maxCheckDistance) {
                    continue; // Skip detailed collision check
                }
                
                // IMPROVED: Use ObjectManager's sphere-OBB test for more accurate collision
                let collision = false;
                let collisionResult = null;
                
                if (collisionDebug) {
                    console.log(`Testing player collision with ${collidable.type} at distance ${centerDistance.toFixed(2)}`);
                }
                
                // Use the proper sphere-OBB test from ObjectManager
                if (collidable.obb) {
                    // Make sure OBB is valid before testing
                    if (ObjectManager.validateOBB(collidable.obb)) {
                        // Use enhanced face collision detection for better normal calculation
                        const sphereOBBResult = ObjectManager.testSphereOBBFaceCollision(
                            player.position, 
                            playerRadius, 
                            collidable.obb
                        );
                        
                        if (sphereOBBResult.collides) {
                            collision = true;
                            collisionResult = {
                                collides: true,
                                point: sphereOBBResult.point,
                                normal: sphereOBBResult.normal,
                                penetration: sphereOBBResult.penetration,
                                object: collidable.object
                            };
                            
                            if (collisionDebug) {
                                console.log(`Sphere-OBB collision detected with ${collidable.type}, penetration: ${collisionResult.penetration.toFixed(2)}`);
                            }
                        }
                    } else {
                        // Fallback to simple sphere-sphere test if OBB is invalid
                        if (centerDistance <= playerRadius + objectRadius) {
                            // Calculate collision normal (from object to player)
                            const normal = new Vector3().subVectors(player.position, objectPos).normalize();
                            
                            collision = true;
                            collisionResult = {
                                collides: true,
                                point: objectPos.clone().addScaledVector(normal, objectRadius),
                                normal: normal,
                                penetration: playerRadius + objectRadius - centerDistance,
                                object: collidable.object
                            };
                            
                            if (collisionDebug) {
                                console.log(`Sphere-sphere fallback collision with ${collidable.type}, penetration: ${collisionResult.penetration.toFixed(2)}`);
                            }
                        }
                    }
                } else {
                    // If object has no OBB, use simple sphere-sphere test
                    if (centerDistance <= playerRadius + objectRadius) {
                        // Calculate collision normal (from object to player)
                        const normal = new Vector3().subVectors(player.position, objectPos).normalize();
                        
                        collision = true;
                        collisionResult = {
                            collides: true,
                            point: objectPos.clone().addScaledVector(normal, objectRadius),
                            normal: normal,
                            penetration: playerRadius + objectRadius - centerDistance,
                            object: collidable.object
                        };
                        
                        if (collisionDebug) {
                            console.log(`Simple sphere collision with ${collidable.type}, penetration: ${collisionResult.penetration.toFixed(2)}`);
                        }
                    }
                }
                
                // Handle collision if detected
                if (collision && collisionResult) {
                    // Store collision for visualization
                    player.activeCollisions.push({
                        object: collidable.object,
                        normal: collisionResult.normal.clone(),
                        position: collisionResult.point.clone()
                    });
                    
                    // Apply collision response
                    this.handlePlayerObjectCollision(player, collidable, collisionResult);
                    collisionFound = true;
                }
            }
            
            // Update player's collision state
            player.isColliding = collisionFound;
            
            // Trigger visualization
            if (player.activeCollisions && player.activeCollisions.length > 0) {
                this.visualizeCollisions(player);
            }
        } catch (err) {
            console.error("Error processing player collisions:", err);
        }
    }
    
    // Complete handlePlayerObjectCollision method
    static handlePlayerObjectCollision(player, collidable, collisionResult) {
        if (!player || !collidable || !collisionResult) return false;
        
        try {
            // Mark player as colliding
            player.currentlyColliding = true;
            
            // Check if collision should affect player movement
            const objectType = collidable.type || collidable.object?.userData?.type;
            const isSolidObject = collidable.object?.userData?.isSolid !== false; // Default to true if not specified
            
            // Calculate player velocity component along collision normal
            const velocityAlongNormal = player.velocity.dot(collisionResult.normal);
            const penetration = collisionResult.penetration || 0.1;
            
            // Only apply response if player is moving into the object or penetrating deeply
            if (velocityAlongNormal < 0 || penetration > 0.2) {
                // Resolve penetration by moving player out of collision
                if (penetration > 0) {
                    // Move player out along collision normal
                    const correctionDistance = Math.min(penetration * 1.1, 0.5); // Limit max correction
                    player.position.addScaledVector(collisionResult.normal, correctionDistance);
                    
                    // Also move handle for visualization
                    if (player.handle) {
                        player.handle.position.copy(player.position);
                    }
                    
                    if (player.handle) {
                        // Update collision bounds
                        ObjectManager.updateCollidableBounds(player.handle);
                    }
                    
                    // Debug log
                    console.log(`Applied collision correction: ${correctionDistance.toFixed(2)} units along ${collisionResult.normal.toArray()}`);
                }
                
                // Remove velocity component along collision normal (sliding effect)
                // Only if this is a solid object that should block movement
                if (isSolidObject) {
                    // Calculate velocity along the normal
                    const normalVelocity = collisionResult.normal.clone()
                        .multiplyScalar(velocityAlongNormal);
                    
                    // Remove this component from player velocity
                    player.velocity.sub(normalVelocity);
                    
                    // Apply friction to the remaining velocity (tangential component)
                    const frictionFactor = collidable.object?.userData?.frictionFactor || 0.2;
                    player.velocity.multiplyScalar(1 - frictionFactor);
                    
                    // Debug log
                    console.log(`Collision response: removed normal velocity ${normalVelocity.length().toFixed(2)}`);
                }
                
                // Set player as standing on object if collision is from below
                // This affects gravity application
                const upVector = player.surfaceNormal || new Vector3(0, 1, 0);
                const normalDotUp = collisionResult.normal.dot(upVector);
                if (normalDotUp > 0.7) { // Collision from below
                    player.standingOnObject = true;
                    player.standingOnObjectTime = Date.now();
                    
                    // Track which object player is standing on
                    player._standingOnObjectRef = collidable.object;
                }
            }
            
            // Process special interactions based on object type
            if (objectType === 'vehicle' && !player.inVehicle) {
                // Vehicle collision while not in vehicle - register potential entry
                if (typeof window.VehicleManager?.registerPlayerVehicleProximity === 'function') {
                    window.VehicleManager.registerPlayerVehicleProximity(player, collidable.object);
                }
            } else if (objectType === 'testCube' && collidable.object.userData?.isLightObject) {
                // Push test cubes when colliding with them
                this.handlePlayerTestCubeCollision(player, collidable, collisionResult);
            }
            
            return true;
        } catch (err) {
            console.error("Error handling player-object collision:", err);
        }
    }
    
    // Add method to handle player collision with pushable test cubes
    static handlePlayerTestCubeCollision(player, collidable, collisionResult) {
        if (!player || !collidable || !collisionResult || !collidable.object) return false;
        
        try {
            const cube = collidable.object;
            
            // Only handle light test cubes (pushable ones)
            if (!cube.userData || !cube.userData.isLightObject) return false;
            
            // Initialize velocity if not present
            if (!cube.userData.velocity) {
                cube.userData.velocity = new Vector3(0, 0, 0);
            }
            
            // Calculate impulse strength based on player's speed into the cube
            const playerSpeed = player.velocity.length();
            const approachSpeed = -Math.min(0, player.velocity.dot(collisionResult.normal));
            
            // Higher base impulse for more responsive pushing
            const baseImpulse = 0.3;
            let impulseStrength = baseImpulse;
            
            // Add more impulse if player is actively moving toward the cube
            if (approachSpeed > 0.1) {
                impulseStrength += approachSpeed * 0.5;
            }
            
            // Reduce impulse for very light movement to allow precise positioning
            if (playerSpeed < 0.5) {
                impulseStrength *= 0.5;
            }
            
            // Apply impulse to cube velocity in the direction away from player
            const pushDirection = collisionResult.normal.clone();
            
            // Apply force
            cube.userData.velocity.addScaledVector(pushDirection, impulseStrength);
            
            // Ensure cube is no longer static
            cube.userData.isStatic = false;
            
            // Mark cube as pushed
            cube.userData._lastPushedBy = 'player';
            cube.userData._lastPushedTime = Date.now();
            
            console.log(`Player pushed test cube with impulse ${impulseStrength.toFixed(2)}`);
            
            return true;
        } catch (err) {
            console.error("Error handling player-test cube collision:", err);
            return false;
        }
    }
    
    // Visualize collision data for debugging
    static visualizeCollisions(player) {
        // Skip if engine is not available
        if (!window.Engine || !window.Engine.scene) return;
        
        try {
            // Import THREE to ensure we have access to the library
            const THREE = window.THREE;
            if (!THREE) {
                console.error("THREE.js not available for collision visualization");
                return;
            }
            
            // Clear old visualizations if they exist
            if (this._debugHelpers && this._debugHelpers.length > 0) {
                this._debugHelpers.forEach(helper => {
                    if (helper && helper.parent) window.Engine.scene.remove(helper);
                });
                this._debugHelpers = [];
            } else {
                this._debugHelpers = [];
            }
            
            // Skip if player has no active collisions
            if (!player.activeCollisions || player.activeCollisions.length === 0) {
                return;
            }
            
            console.log(`Visualizing ${player.activeCollisions.length} collisions`);
            
            // Visualize all active collisions
            player.activeCollisions.forEach(collision => {
                if (!collision.position || !collision.normal) return;
                
                // Create arrow for collision normal
                const normalLength = 3.0; // Make it very visible
                
                // Create arrow helper for normal
                const arrowHelper = new THREE.ArrowHelper(
                    collision.normal,
                    collision.position,
                    normalLength,
                    0xff0000, // Bright red
                    0.5,      // Big head length
                    0.2       // Big head width
                );
                
                // Add to scene
                window.Engine.scene.add(arrowHelper);
                this._debugHelpers.push(arrowHelper);
                
                // Create sphere at collision point
                const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 8);
                const sphereMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffff00,
                    transparent: true,
                    opacity: 0.8,
                    depthTest: false
                });
                
                const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
                sphere.position.copy(collision.position);
                
                // Add to scene
                window.Engine.scene.add(sphere);
                this._debugHelpers.push(sphere);
                
                // Log collision details for debugging
                console.log(`Visualized collision at ${collision.position.toArray()} with normal ${collision.normal.toArray()}`);
            });
        } catch (err) {
            console.error("Error visualizing collisions:", err);
        }
    }
    
    // Initialize static properties
    static {
        this._debugHelpers = [];
    }
}