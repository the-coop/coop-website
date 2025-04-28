import { Vector3, Quaternion, Box3, Matrix4, Euler, Object3D } from 'three';
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
                    if (object.userData.velocity && 
                        !object.userData.isStatic && 
                        !object.userData.hardFreeze) {
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
    
    // Generic gravity application for any object
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
            // This is a critical fix for vehicles passing through the surface
            if (object.userData.falling && 
                (object.userData.type === 'vehicle' || 
                 object.userData.type === 'car' || 
                 object.userData.type === 'airplane')) {
                
                // Get appropriate height offset for this vehicle type
                let heightOffset = object.userData.fixedHeightOffset || 0.1;
                if (object.userData.type === 'car') {
                    heightOffset = object.userData.fixedHeightOffset || 2.5;
                } else if (object.userData.type === 'airplane') {
                    heightOffset = object.userData.fixedHeightOffset || 5.0;
                }
                
                const groundLevel = soi.radius + heightOffset;
                
                // CRITICAL FIX: More aggressive landing detection for vehicles
                // This ensures vehicles don't pass through the planet surface
                if (distance <= groundLevel + 5.0) {
                    console.log(`Vehicle landing detected at height ${heightAboveSurface.toFixed(2)}`);
                    
                    // Mark as landed
                    object.userData.falling = false;
                    object.userData.justLanded = true;
                    object.userData.landingTime = Date.now();
                    
                    // Hard freeze to stop movement
                    object.userData.velocity.set(0, 0, 0);
                    object.userData.speed = 0;
                    object.userData.hardFreeze = true;
                    object.userData.hardFreezeEndTime = Date.now() + 1000;
                    
                    // Zero out any angular velocity
                    if (object.userData.angularVelocity) {
                        object.userData.angularVelocity.set(0, 0, 0);
                    }
                    
                    // CRITICAL FIX: Immediately snap to correct height
                    // This prevents passing through the surface
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
        } catch (err) {
            console.error("Error applying gravity to object:", err);
        }
    }
    
    // Generic velocity application for any object
    static applyVelocity(object) {
        if (!object || !object.position || !object.userData || !object.userData.velocity) {
            return;
        }
        
        try {
            // Skip if velocity is zero
            const velocity = object.userData.velocity;
            const speed = velocity.length();
            if (speed <= 0.001) return;
            
            // Apply velocity in steps to prevent tunneling
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
        } catch (err) {
            console.error("Error applying velocity to object:", err);
        }
    }

    // Generalized version to maintain ANY object at proper height above surface
    static maintainObjectSurfaceHeight(object) {
        if (!object || !object.userData) return;
        
        try {
            // Get or calculate planet
            if (!object.userData.planet) {
                object.userData.planet = this.calculateSOI(object.position);
            }
            const planet = object.userData.planet;
            if (!planet) return;
            
            const planetCenter = planet.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const distance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Store surface normal for alignment and collision
            object.userData.surfaceNormal = surfaceNormal;
            
            // Get fixed height offset based on object type
            let heightOffset = object.userData.fixedHeightOffset || 0.1;
            if (object.userData.type === 'car') {
                heightOffset = object.userData.fixedHeightOffset || 2.5;
            } else if (object.userData.type === 'airplane') {
                heightOffset = object.userData.fixedHeightOffset || 5.0;
            } else if (object.userData.type === 'testCube') {
                heightOffset = object.userData.heightOffset || 0.1;
            }
                                
            const groundLevel = planet.radius + heightOffset;
            
            // IMPROVED: Calculate current height above surface for debugging
            const heightAboveSurface = distance - planet.radius;
            object.userData.heightAboveSurface = heightAboveSurface;
            
            // IMPROVED: Use smaller height tolerance for cars for smoother driving
            let heightTolerance = 0.1; // Base height tolerance
            
            // Increase tolerance for fully stabilized objects
            if (object.userData.fullyStabilized) {
                if (object.userData.type === 'car') {
                    heightTolerance = 0.05; // FIXED: Smaller tolerance for cars
                } else {
                    heightTolerance = 0.5; // Regular tolerance for other objects
                }
            }
            // Increase tolerance based on time since landing
            else if (object.userData.landingTime) {
                const timeSinceLanding = Date.now() - object.userData.landingTime;
                if (timeSinceLanding > 5000) {
                    // Gradually increase tolerance up to 0.3 units after 5 seconds
                    heightTolerance = Math.min(0.3, 0.1 + (timeSinceLanding / 5000) * 0.2);
                }
            }
            
            // CRITICAL FIX: Never align falling vehicles to planet surface
            // This allows them to tumble naturally under gravity
            if (object.userData.falling) {
                // Apply gravity and velocity but skip all surface maintenance and alignment
                this.applyGravity(object);
                
                if (object.userData.velocity) {
                    this.applyVelocity(object);
                }
                
                // ADDED: Log the falling vehicle's position relative to planet surface
                if (object.userData.type === 'car' || object.userData.type === 'airplane') {
                    // Only log once every 60 frames to avoid spam
                    if (!object.userData._lastLogTime || Date.now() - object.userData._lastLogTime > 1000) {
                        console.log(`Vehicle ${object.name || 'unnamed'} falling: ${heightAboveSurface.toFixed(2)} units above surface`);
                        object.userData._lastLogTime = Date.now();
                    }
                }
                
                return;
            }
            
            // CRITICAL FIX: Enhanced landing detection for vehicles
            if ((object.userData.type === 'car' || object.userData.type === 'airplane') &&
                object.userData.justLanded) {
                console.log(`Vehicle ${object.name} just landed, applying special handling`);
                
                // Create a hard freeze period immediately after landing
                object.userData.velocity.set(0, 0, 0);
                object.userData.speed = 0;
                object.userData.hardFreeze = true;
                object.userData.hardFreezeEndTime = Date.now() + 1000;
                
                // CRITICAL FIX: Force snap to correct height to prevent falling through
                const correctedPosition = planetCenter.clone().addScaledVector(
                    surfaceNormal, 
                    groundLevel
                );
                
                object.position.copy(correctedPosition);
                object.updateMatrix();
                object.updateMatrixWorld(true);
                
                // Apply strong alignment to surface
                if (typeof window.VehicleManager?.alignVehicleToPlanetSurface === 'function') {
                    window.VehicleManager.alignVehicleToPlanetSurface(
                        object, surfaceNormal, 0.9, true
                    );
                }
                
                // Clear justLanded flag
                object.userData.justLanded = false;
                
                return;
            }

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
    
    // Process hard freeze state (used during landing)
    static processHardFreezeState(object, planetCenter, surfaceNormal, groundLevel) {
        const now = Date.now();
        if (now < object.userData.hardFreezeEndTime) {
            // During hard freeze, force object to exact height and zero velocity
            const newPosition = planetCenter.clone().addScaledVector(surfaceNormal, groundLevel);
            object.position.copy(newPosition);
            object.userData.velocity.set(0, 0, 0);
            object.userData.speed = 0;
            
            // Zero any angular velocity
            if (object.userData.angularVelocity) {
                object.userData.angularVelocity.set(0, 0, 0);
            }
            
            // For vehicles, use special alignment during hard freeze
            if (object.userData.type === 'vehicle' && 
                typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                // Use the initial landing normal for consistent alignment
                const alignNormal = object.userData.initialLandingNormal || surfaceNormal;
                VehicleManager.alignVehicleToPlanetSurface(object, alignNormal, 0.95, true);
            }
            
            // Stabilize rotation by zeroing quaternion velocity
            if (object.userData.lastQuaternion) {
                object.userData.lastQuaternion.copy(object.quaternion);
            }
        } else {
            // Hard freeze period has ended
            object.userData.hardFreeze = false;
            
            // Enter enhanced stabilization phase for smooth transition
            object.userData.enhancedStabilization = true;
            object.userData.enhancedStabilizationEndTime = now + 2000;
            
            // Keep the normal from hard freeze for consistent alignment
            object.userData.stabilizationNormal = 
                object.userData.initialLandingNormal || surfaceNormal.clone();
        }
    }
    
    // Process enhanced stabilization (post-hard-freeze)
    static processEnhancedStabilization(object, surfaceNormal) {
        const now = Date.now();
        if (now < object.userData.enhancedStabilizationEndTime) {
            // During enhanced stabilization, add extra angular damping
            if (object.userData.angularVelocity) {
                // Apply extremely aggressive damping to angular velocity
                object.userData.angularVelocity.multiplyScalar(0.7);
                
                // If angular velocity is very small, just zero it completely
                if (object.userData.angularVelocity.lengthSq() < 0.0001) {
                    object.userData.angularVelocity.set(0, 0, 0);
                }
            }
            
            // For vehicles, apply specific alignment during stabilization
            if (object.userData.type === 'vehicle' && 
                typeof VehicleManager.alignVehicleToPlanetSurface === 'function') {
                // Use saved normal for consistent alignment during stabilization
                const alignNormal = object.userData.stabilizationNormal || surfaceNormal;
                const timeFactor = (object.userData.enhancedStabilizationEndTime - now) / 2000;
                // Gradually reduce alignment strength over time (from 0.8 to 0.2)
                const alignFactor = 0.2 + (timeFactor * 0.6); 
                VehicleManager.alignVehicleToPlanetSurface(object, alignNormal, alignFactor, false);
            }
        } else {
            // Enhanced stabilization complete
            object.userData.enhancedStabilization = false;
            
            // Mark as fully stabilized for gentler physics
            object.userData.fullyStabilized = true;
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
    
    // Align an object to the planet surface
    static alignObjectToPlanetSurface(object, surfaceNormal) {
        if (!object || !surfaceNormal) return;
        
        // For vehicles, use VehicleManager's specialized alignment
        if (object.userData.type === 'vehicle' || object.userData.type === 'car' || object.userData.type === 'airplane') {
            // FIXED: Use stronger alignment for player-controlled cars for smoother driving
            if (object === VehicleManager.currentVehicle && object.userData.type === 'car') {
                // Use stronger alignment factor for active cars
                const alignmentFactor = object.userData.isActivelyControlled ? 0.2 : 0.1;
                VehicleManager.alignVehicleToPlanetSurface(object, surfaceNormal, alignmentFactor);
                return;
            }
            
            // Use much smaller alignment factor for fully stabilized vehicles
            const alignmentFactor = object.userData.fullyStabilized ? 0.005 : 0.2;
            VehicleManager.alignVehicleToPlanetSurface(object, surfaceNormal, alignmentFactor);
            return;
        }
        
        // For other objects, apply simple alignment
        try {
            // Create alignment quaternion
            const defaultUp = new Vector3(0, 1, 0);
            const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal).normalize();
            
            if (rotationAxis.lengthSq() > 0.001) {
                const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
                const alignQuat = new Quaternion().setFromAxisAngle(rotationAxis, angle);
                
                // Determine alignment factor based on object state
                let alignFactor = 0.1; // Default gentle alignment
                
                if (object.userData.fullyStabilized) {
                    alignFactor = 0.01; // Very gentle for stable objects
                } else if (object.userData.falling) {
                    alignFactor = 0.05; // Lighter alignment when falling
                } else if (object.userData.justLanded) {
                    alignFactor = 0.5; // Stronger alignment right after landing
                }
                
                // Apply alignment
                object.quaternion.slerp(alignQuat, alignFactor);
            }
        } catch (err) {
            console.error("Error aligning object to surface:", err);
        }
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
            
            // Check each collidable against others
            for (let i = 0; i < collidables.length; i++) {
                const objA = collidables[i];
                if (!objA || !objA.active || !objA.object || objA.isStatic) continue;
                
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
                    
                    // Use simplified sphere-based collision for faster detection
                    if (this.objectsOverlapping(objA, objB)) {
                        this.resolveCollision(objA, objB, planetA);
                    }
                }
            }
        } catch (err) {
            console.error("Error in processPlanetSurfaceCollisions:", err);
        }
    }
    
    // NEW: Check if two objects are overlapping using OBB or sphere approximation
    static objectsOverlapping(objA, objB) {
        try {
            // Using OBB intersection test first (most accurate)
            if (objA.obb && objB.obb && 
                typeof ObjectManager.runSATTest === 'function') {
                const result = ObjectManager.runSATTest(objA.obb, objB.obb);
                return result && result.collides;
            }
            
            // Fallback to sphere-based intersection (faster)
            const objectA = objA.object;
            const objectB = objB.object;
            
            // Get sphere radii - use object size or bounding box
            const radiusA = this.getObjectRadius(objectA);
            const radiusB = this.getObjectRadius(objectB);
            
            // Check distance between centers
            const distance = objectA.position.distanceTo(objectB.position);
            return distance < (radiusA + radiusB);
        } catch (err) {
            console.error("Error checking object overlap:", err);
            return false;
        }
    }
    
    // Helper to get object radius for sphere-based collision
    static getObjectRadius(object) {
        if (!object) return 1.0; // Default fallback radius
        
        try {
            // For player, use fixed radius
            if (object.userData && object.userData.isPlayer) {
                return 1.0; // Player sphere radius
            }
            
            // For vehicles, use type-specific radius
            if (object.userData && object.userData.isVehicle) {
                if (object.userData.type === 'car') return 3.0;
                if (object.userData.type === 'airplane') return 6.0;
                return 4.0; // Default vehicle radius
            }
            
            // For test cubes, use user-specified size or calculate from dimensions
            if (object.userData && object.userData.type === 'testCube') {
                if (object.userData.collisionRadius) {
                    return object.userData.collisionRadius;
                }
                
                // Calculate from cube dimensions
                const width = object.userData.width || 1;
                const height = object.userData.height || 1;
                const depth = object.userData.depth || 1;
                
                // Use half the largest dimension
                return Math.max(width, height, depth) / 2;
            }
            
            // For other objects, calculate from their OBB or bounding box
            if (object.collidable && object.collidable.obb) {
                const obb = object.collidable.obb;
                // Calculate maximum radius from half-size
                return Math.max(obb.halfSize.x, obb.halfSize.y, obb.halfSize.z);
            } else if (object.collidable && object.collidable.aabb) {
                const aabb = object.collidable.aabb;
                // Calculate size from AABB
                const sizeX = aabb.max.x - aabb.min.x;
                const sizeY = aabb.max.y - aabb.min.y;
                const sizeZ = aabb.max.z - aabb.min.z;
                return Math.max(sizeX, sizeY, sizeZ) / 2;
            }
            
            // Default fallback based on object type
            if (object.userData && object.userData.type) {
                switch (object.userData.type) {
                    case 'player': return 1.0;
                    case 'car': return 3.0;
                    case 'airplane': return 6.0;
                    case 'testCube': return 1.5;
                    default: return 1.0;
                }
            }
            
            return 1.0; // Default fallback
        } catch (err) {
            console.error("Error getting object radius:", err);
            return 1.0; // Default fallback
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
    
    // NEW: Apply physical impulse response to colliding objects
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
                
            // If objects are already separating, skip impulse
            if (relativeVelocity > 0) return;
            
            // Calculate coefficient of restitution (bounciness)
            // Use the lowest restitution of both objects
            const restitutionA = objectA.userData.bounceFactor || 0.1;
            const restitutionB = objectB.userData.bounceFactor || 0.1;
            const restitution = Math.min(restitutionA, restitutionB);
            
            // Calculate impulse scalar
            const impulseFactor = -(1 + restitution) * relativeVelocity / 
                                  (1/massA + 1/massB);
            
            // Apply impulse based on mass
            const impulse = direction.clone().multiplyScalar(impulseFactor);
            velA.addScaledVector(impulse, 1/massA);
            velB.addScaledVector(impulse, -1/massB);
            
            // Apply friction to reduce lateral movement after collision
            const friction = 0.5;
            const tangent = new Vector3()
                .copy(direction)
                .cross(new Vector3().crossVectors(direction, relativeVelocity))
                .normalize();
            
            if (!isNaN(tangent.x)) { // Make sure tangent is valid
                // Calculate tangential impulse
                const tangentImpulse = tangent.clone().multiplyScalar(-friction * impulseFactor);
                velA.addScaledVector(tangentImpulse, 1/massA);
                velB.addScaledVector(tangentImpulse, -1/massB);
            }
            
            // Dampen velocity after collision for stability
            velA.multiplyScalar(0.95);
            velB.multiplyScalar(0.95);
            
            // Update speed property if it exists
            if (typeof objectA.userData.speed !== 'undefined') {
                objectA.userData.speed = velA.length();
            }
            
            if (typeof objectB.userData.speed !== 'undefined') {
                objectB.userData.speed = velB.length();
            }
            
        } catch (err) {
            console.error("Error applying collision impulse:", err);
        }
    }
    
    // NEW: Process player-specific collisions
    static processPlayerCollisions(player) {
        if (!player || !player.handle || player.inVehicle) return;
        
        try {
            // Get player collision shape
            const useSphericalCollision = true; // Set to true for sphere-based collision

            // Check against all collidable objects
            const collidables = ObjectManager.collidableObjects;
            if (!collidables) return;
            
            for (const collidable of collidables) {
                // Skip invalid colliders
                if (!collidable || !collidable.active || !collidable.object) continue;
                
                // Skip self-collision
                if (collidable.object === player.handle) continue;
                
                // Skip vehicles that player is in
                if (player.inVehicle && collidable.object === VehicleManager.currentVehicle) {
                    continue;
                }
                
                // Check intersection using sphere or OBB
                let collision = false;
                
                if (useSphericalCollision) {
                    // Sphere-based collision (simpler and faster, using player radius)
                    const playerRadius = 1.0;
                    const objectRadius = this.getObjectRadius(collidable.object);
                    const distance = player.position.distanceTo(collidable.object.position);
                    
                    collision = distance < (playerRadius + objectRadius);
                } else {
                    // OBB-based collision (more accurate but more complex)
                    const playerOBB = PlayersManager.getPlayerWorldOBB(player);
                    if (playerOBB && collidable.obb) {
                        const result = ObjectManager.runSATTest(playerOBB, collidable.obb);
                        collision = result && result.collides;
                    }
                }
                
                // Handle collision if detected
                if (collision) {
                    this.handlePlayerObjectCollision(player, collidable);
                }
            }
        } catch (err) {
            console.error("Error processing player collisions:", err);
        }
    }
    
    // NEW: Handle collision between player and object
    static handlePlayerObjectCollision(player, collidable) {
        if (!player || !collidable || !collidable.object) return;
        
        try {
            const object = collidable.object;
            
            // Skip if either is falling
            if (player.falling || object.userData?.falling) return;
            
            // Calculate direction from object to player
            const direction = new Vector3().subVectors(
                player.position,
                object.position
            ).normalize();
            
            // Get player and object mass
            const playerMass = this.DEFAULT_MASSES.player;
            const objectMass = this.getObjectMass(object);
            
            // Get planet reference
            const playerPlanet = player.soi;
            const objectPlanet = object.userData?.planet || object.userData?.soi;
            
            // Skip if on different planets
            if (!playerPlanet || !objectPlanet || playerPlanet !== objectPlanet) {
                return;
            }
            
            // Calculate movement amounts based on relative masses
            const totalMass = playerMass + objectMass;
            const playerRatio = objectMass / totalMass;
            const objectRatio = playerMass / totalMass;
            
            // Calculate penetration depth
            const playerRadius = 1.0;
            const objectRadius = this.getObjectRadius(object);
            const distance = player.position.distanceTo(object.position);
            const penetration = (playerRadius + objectRadius) - distance;
            
            if (penetration <= 0) return; // No actual penetration
            
            // Reduce penetration correction to avoid tunneling through objects
            const correctionFactor = 0.5;
            const effectivePenetration = penetration * correctionFactor;
            
            // Special case for static/heavy objects - only move player
            if (collidable.isStatic || object.userData?.isStatic || 
                object.userData?.isHeavyObject) {
                // Just move the player away from the object
                this.movePlayerOnPlanetSurface(player, direction, effectivePenetration, playerPlanet);
                return;
            }
            
            // Both player and object movable - move them apart proportional to mass
            this.movePlayerOnPlanetSurface(player, direction, effectivePenetration * playerRatio, playerPlanet);
            this.moveObjectOnPlanetSurface(object, direction.clone().negate(), effectivePenetration * objectRatio, objectPlanet);
            
            // Apply collision impulse for physical response
            if (object.userData.velocity) {
                this.applyPlayerObjectImpulse(player, object, direction, penetration, playerMass, objectMass);
            }
            
        } catch (err) {
            console.error("Error handling player-object collision:", err);
        }
    }
    
    // NEW: Move a player along planet surface
    static movePlayerOnPlanetSurface(player, direction, amount, planet) {
        if (!player || !planet) return;
        
        try {
            const planetCenter = planet.object.position;
            const planetRadius = planet.radius;
            
            // Calculate current surface normal
            const toPlayer = player.position.clone().sub(planetCenter).normalize();
            
            // Project the separation direction onto the planet surface tangent plane
            const surfaceDirection = new Vector3();
            surfaceDirection.copy(direction).projectOnPlane(toPlayer).normalize();
            
            // Move player along the surface
            const moveAmount = Math.min(amount, 0.5); // Limit max movement per frame
            player.position.addScaledVector(surfaceDirection, moveAmount);
            
            // Maintain correct height above planet
            const collisionDistance = planetRadius + 0.8; // Player height above planet surface
            const newToPlayer = player.position.clone().sub(planetCenter);
            const newDistance = newToPlayer.length();
            const newNormal = newToPlayer.normalize();
            
            // Keep player at right height
            player.position.copy(planetCenter).addScaledVector(
                newNormal,
                collisionDistance
            );
            
            // Update player handle and collider
            if (player.handle) {
                player.handle.position.copy(player.position);
                player.handle.updateMatrix();
                player.handle.updateMatrixWorld(true);
                
                // Update collision bounds
                if (player.collidable) {
                    ObjectManager.forceUpdateCollidableBounds(player.handle);
                }
            }
        } catch (err) {
            console.error("Error moving player on planet surface:", err);
        }
    }
    
    // NEW: Apply collision impulse between player and object
    static applyPlayerObjectImpulse(player, object, direction, penetration, playerMass, objectMass) {
        try {
            if (!player.velocity || !object.userData.velocity) return;
            
            // Get velocities
            const playerVel = player.velocity;
            const objectVel = object.userData.velocity;
            
            // Calculate relative velocity
            const relativeVel = new Vector3()
                .subVectors(playerVel, objectVel)
                .dot(direction);
                
            // If already separating, skip
            if (relativeVel > 0) return;
            
            // Calculate coefficient of restitution (bounciness)
            const restitution = 0.1; // Very low - objects mostly stop after collision
            
            // Calculate impulse scalar
            const impulseFactor = -(1 + restitution) * relativeVel /
                                 (1/playerMass + 1/objectMass);
            
            // Apply impulse based on mass
            const impulse = direction.clone().multiplyScalar(impulseFactor);
            playerVel.addScaledVector(impulse, 1/playerMass);
            objectVel.addScaledVector(impulse, -1/objectMass);
            
            // Apply extra damping for stability
            playerVel.multiplyScalar(0.85);
            objectVel.multiplyScalar(0.85);
            
            // Update object speed if needed
            if (typeof object.userData.speed !== 'undefined') {
                object.userData.speed = objectVel.length();
            }
        } catch (err) {
            console.error("Error applying player-object impulse:", err);
        }
    }
    
    // NEW: Check if a vehicle is on planet surface without using collision system
    static isVehicleOnPlanetSurface(vehicle) {
        if (!vehicle || !vehicle.userData || !vehicle.userData.planet) return false;
        
        const planet = vehicle.userData.planet;
        if (!planet || !planet.object || !planet.radius) return false;
        
        const planetCenter = planet.object.position;
        const distanceToPlanet = vehicle.position.distanceTo(planetCenter);
        const heightOffset = vehicle.userData.fixedHeightOffset || 
                            (vehicle.userData.type === 'car' ? 3.0 : 5.5);
        
        // Vehicle is on surface if distance to planet is approximately radius + height offset
        return Math.abs(distanceToPlanet - (planet.radius + heightOffset)) < 0.5;
    }
}