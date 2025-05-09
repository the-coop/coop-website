import { Vector3, Box3, Matrix4, Matrix3, Quaternion, Raycaster, Euler } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import Engine from './engine.mjs';
import PlayersManager from './players.mjs';

// ObjectManager handles all game object registrations and collision detection
export default class ObjectManager {
    // Array to store all collidable objects
    static collidableObjects = [];
    
    // ENHANCE: Make debug settings available and more visible
    static _debugSettings = {
        showBoxes: true,       // Always show boxes
        showNormals: true,     // Always show normals
        boxOpacity: 0.6,       // More visible 
        normalLength: 5.0      // Much longer for visibility
    };

    // Enable debug visualization by default
    static _debugEnabled = true;

    // Add a new unified object registration method for all entity types
    static registerGameObject(object, type, dimensions = null, isStatic = false) {
        if (!object) {
            console.error("Cannot register null object");
            return null;
        }
        
        try {
            // Initialize userData if needed
            if (!object.userData) object.userData = {};
            
            // Add common properties for all game objects
            object.userData.type = type;
            object.userData.isRegistered = true;
            object.userData.isSolid = true;
            object.userData.isDynamic = !isStatic;
            
            // ENHANCED: Add specific flags for vehicles to ensure they're recognized in collisions
            if (type === 'vehicle') {
                object.userData.isVehicle = true;
                object.userData.collisionEnabled = true;
            }
            
            // Create collision box based on provided dimensions or object geometry
            let collisionBox;
            if (dimensions) {
                // Use specified dimensions
                const halfWidth = dimensions.width / 2 || 1;
                const halfHeight = dimensions.height / 2 || 1;
                const halfDepth = dimensions.depth / 2 || 1;
                
                collisionBox = new Box3();
                collisionBox.min.set(-halfWidth, -halfHeight, -halfDepth);
                collisionBox.max.set(halfWidth, halfHeight, halfDepth);
            } else {
                // Auto-generate from object geometry
                collisionBox = new Box3().setFromObject(object);
                
                // If box is too small/invalid, create a default box
                if (collisionBox.isEmpty()) {
                    collisionBox.min.set(-1, -1, -1);
                    collisionBox.max.set(1, 1, 1);
                }
            }
            
            // IMPROVED: For vehicles, ensure we actually use the provided dimensions
            // and create a slightly larger collision box to ensure better collision detection
            if (type === 'vehicle') {
                const safetyMargin = 0.1; // Add 10% margin to collision box
                
                // Validate that dimensions exist before proceeding
                const width = dimensions?.width || object.userData.width || 3;
                const height = dimensions?.height || object.userData.height || 1.5;
                const depth = dimensions?.depth || object.userData.depth || 5;
                
                // Expand the collision box for better detection
                const halfWidth = (width * (1 + safetyMargin)) / 2;
                const halfHeight = (height * (1 + safetyMargin)) / 2; 
                const halfDepth = (depth * (1 + safetyMargin)) / 2;
                
                collisionBox = new Box3();
                collisionBox.min.set(-halfWidth, -halfHeight, -halfDepth);
                collisionBox.max.set(halfWidth, halfHeight, halfDepth);
                
                console.log(`Created enhanced vehicle collision box: ${width}x${height}x${depth} with safety margin`);
            }
            
            // Register with collision system
            const collidable = this.registerCollidable(object, collisionBox, type, isStatic);
            
            // Store reference in object's userData
            object.userData.collidable = collidable;
            
            // Store direct reference to OBB for convenience
            object.collidable = collidable;
            object.userData.obb = collidable.obb;
            
            // IMPROVED: For vehicles, add additional references to ensure they're found in collisions
            if (type === 'vehicle') {
                // Add reference from OBB to vehicle for reverse lookups
                if (collidable.obb) {
                    collidable.obb.userData = {
                        isVehicle: true,
                        vehicleReference: object,
                        vehicleType: object.userData.type || 'generic-vehicle'
                    };
                }
                
                // Force a collision bounds update to ensure it's properly positioned
                this.updateCollidableBounds(object);
                
                console.log(`Registered ${object.userData.type || 'unknown'} vehicle with enhanced collision data`);
            } else {
                console.log(`Registered ${type} object with collision system`);
            }
            
            return collidable;
        } catch (err) {
            console.error(`Error registering ${type} object:`, err);
            return null;
        }
    }

    // Register a new collidable object with the system
    static registerCollidable(object, collisionBox, type, isStatic = false) {
        if (!object || !collisionBox) return null;

        // Check if object is already registered
        const existingIndex = this.collidableObjects.findIndex(c => c.object === object);
        if (existingIndex >= 0) {
            // Update existing collidable
            const existing = this.collidableObjects[existingIndex];
            existing.aabb = collisionBox.clone();
            existing.obb.fromBox3(existing.aabb);
            existing.obb.applyMatrix4(object.matrixWorld);
            existing.type = type;
            existing.isStatic = isStatic;
            
            // ADDED: Mark if this is a player (for sphere collision)
            existing.useSphereCollision = type === 'player' && 
                                        object.userData && 
                                        object.userData.useSphericalCollision;
            
            return existing;
        }

        // Create collision metadata
        const collidable = {
            object: object,
            aabb: collisionBox.clone(),
            obb: new OBB(), // Add OBB for orientation-aware collision
            type: type || 'generic',
            active: true, // Can be used to temporarily disable collisions
            isStatic: isStatic, // Whether this object is affected by gravity/physics
            // ADDED: Mark if this is a player (for sphere collision)
            useSphereCollision: type === 'player' && 
                             object.userData && 
                             object.userData.useSphericalCollision
        };
        
        // Initialize the OBB from the AABB
        collidable.obb.fromBox3(collisionBox);
        if (object.matrixWorld) {
            collidable.obb.applyMatrix4(object.matrixWorld);
        }
        
        // Set reference to collidable in object's userData for quick lookup
        if (object.userData) {
            object.userData.collidable = collidable;
        }
        
        // ADDED: If using sphere collision, store the radius
        if (collidable.useSphereCollision && object.userData && 
            object.userData.collisionRadius) {
            collidable.sphereRadius = object.userData.collisionRadius;
        }
        
        this.collidableObjects.push(collidable);
        return collidable;
    }
    
    // Enhanced unregister method to clean up all collision-related properties
    static unregisterGameObject(object) {
        if (!object) return false;
        
        try {
            // Remove from collision system
            this.unregisterCollidable(object);
            
            // Clean up references
            if (object.userData) {
                object.userData.collidable = null;
                object.userData.obb = null;
                object.userData.isRegistered = false;
            }
            
            if (object.collidable) {
                object.collidable = null;
            }
            
            return true;
        } catch (err) {
            console.error("Error unregistering game object:", err);
            return false;
        }
    }
    
    // Remove a collidable object from the system
    static unregisterCollidable(object) {
        if (!object) return false;
        
        const index = this.collidableObjects.findIndex(c => c.object === object);
        if (index >= 0) {
            this.collidableObjects.splice(index, 1);
            return true;
        }
        return false;
    }
    
    // Create an OBB directly from object dimensions and transform registered in the collision system
    static createOBB(object, width, height, depth) {
        // Create a box centered at origin with specified dimensions
        const aabb = new Box3();
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfDepth = depth / 2;
        
        aabb.min.set(-halfWidth, -halfHeight, -halfDepth);
        aabb.max.set(halfWidth, halfHeight, halfDepth);
        
        // Create an OBB from this box
        const obb = new OBB();
        obb.fromBox3(aabb);
        // Apply the object's world transform if available
        if (object && object.matrixWorld) {
            obb.applyMatrix4(object.matrixWorld);
        }
        return obb;
    }   
    
    // Using OBB for accurate collision detection on planetary surfaces
    static checkCollisions(player, objects, timeStep) {
        if (!objects || objects.length === 0) return null;
        if (!player) return null;
        if (!player.velocity) return null;
        
        try {
            let closestTime = timeStep;
            let closestObject = null;
            let closestPosition = null;
            let closestNormal = null;
            
            // CRITICAL FIX: Track which objects we've already processed in this call
            const processedObjectIds = new Set();
        
            const speed = player.velocity.length();
            if (speed === 0) return null;
            const effectiveSpeed = Math.min(speed, 20);
            
            // CRITICAL FIX: More accurate OBB collision detection for player handle
            try {
                // Get player OBB
                if (!player.handle || !player.collidable || !player.collidable.obb) return null;
                if (!this.validateOBB(player.collidable.obb, player.handle)) {
                    this.updateCollidableBounds(player.handle);
                    if (!this.validateOBB(player.collidable.obb, player.handle)) {
                        return null;
                    }
                }

                // Get planet surface normal for ground plane calculation
                const planetNormal = player.soi ? 
                    player.position.clone().sub(player.soi.object.position).normalize() : 
                    new THREE.Vector3(0, 1, 0);

                // Process each object for collision
                for (const obj of objects) {
                    // Skip invalid objects
                    if (!obj || !obj.object || !obj.obb) continue;
                    
                    // Skip objects identical to player
                    if (obj.object === player.handle) continue;
                    
                    // CRITICAL FIX: Skip objects we've already processed in this call
                    if (processedObjectIds.has(obj.object.uuid)) {
                        continue;
                    }
                    processedObjectIds.add(obj.object.uuid);
                    
                    // IMPROVED: Check ALL ways a player might be related to a vehicle
                    const skipReasons = [];
                    
                    // 1. Check if player is in this vehicle
                    if (obj.object.userData && obj.object.userData.isVehicle && 
                        obj.object.userData.isOccupied && 
                        obj.object.userData.player && 
                        obj.object.userData.player.handle === player.handle) {
                        skipReasons.push("player is occupying this vehicle");
                        continue;
                    }
                    
                    // 2. Check explicit ignore flags in both directions
                    if (player.handle._ignoreCollisionWith === obj.object ||
                        obj.object._ignoreCollisionWith === player.handle) {
                        skipReasons.push("explicit ignore flag set");
                        continue;
                    }
                    
                    // 3. Check if object is the current vehicle from VehicleManager
                    if (typeof VehicleManager !== 'undefined' && 
                        VehicleManager.currentVehicle === obj.object &&
                        player.inVehicle) {
                        skipReasons.push("object is current vehicle in VehicleManager");
                        continue;
                    }
                    
                    // 4. Special case for player in vehicle - check through player's properties
                    if (player.inVehicle && player.currentVehicle === obj.object) {
                        skipReasons.push("player's currentVehicle property match");
                        continue;
                    }
                    
                    // If any skip reasons were found, log them and skip this object
                    if (skipReasons.length > 0) {
                        console.log(`Skipping collision check with ${obj.type} due to: ${skipReasons.join(', ')}`);
                        continue;
                    }
                    
                    // CRITICAL FIX: Validate object OBB before collision checks
                    if (!this.validateOBB(obj.obb, obj.object)) {
                        this.updateCollidableBounds(obj.object);
                        if (!this.validateOBB(obj.obb, obj.object)) {
                            continue;
                        }
                    }
                    
                    // ENHANCED: Use both SAT test and edge collision for better reliability
                    // First check SAT for basic intersection
                    const satResult = this.runSATTest(player.collidable.obb, obj.obb);
                    
                    // ADDED: For vehicles, use higher collision threshold to prevent false positives
                    let collisionThreshold = 0.1;
                    if (obj.object.userData && obj.object.userData.isVehicle) {
                        collisionThreshold = 0.15; // More lenient for vehicles
                        
                        // Even more lenient for player-driven vehicles
                        if (obj.object === VehicleManager.currentVehicle) {
                            collisionThreshold = 0.2;
                        }
                    }
                        
                    if (satResult && satResult.collides && satResult.distance < collisionThreshold) {
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
                            if (normalDotPlanet > 0.2) { 
                                // Project the normal onto the surface plane
                                const surfaceAlignedNormal = collisionNormal
                                    .projectOnPlane(planetNormal)
                                    .normalize();
                                
                                if (surfaceAlignedNormal.lengthSq() > 0.01) {
                                    collisionNormal = surfaceAlignedNormal;
                                }
                            }
                        }
                        
                        // Return collision result
                        return {
                            collisionNormal: collisionNormal,
                            collisionPosition: collisionPosition,
                            closestObject: obj,
                            closestTime: 0,
                            isWallCollision: obj.type === 'wall',
                            isTestCubeCollision: obj.type === 'testCube',
                            objectId: obj.object.uuid
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
            
            return {
                collisionNormal: closestNormal || new THREE.Vector3(0, 1, 0),
                collisionPosition: closestPosition,
                closestObject,
                closestTime,
                isWallCollision: closestObject.type === 'wall',
                isTestCubeCollision: closestObject.type === 'testCube',
                objectId: closestObject.object.uuid
            };
        } catch (err) {
            console.error("Error in collision result creation:", err);
            return null;
        }
    }

    // NEW: Improved findContactPoint to better handle edge collisions
    static findContactPoint(obb1, obb2) {
        try {
            if (!this.validateOBB(obb1) || !this.validateOBB(obb2)) {
                console.warn("Cannot find contact points with invalid OBBs");
                return null;
            }
            
            // Get closest points on each OBB
            const corners1 = this.getOBBCorners(obb1);
            const corners2 = this.getOBBCorners(obb2);
            if (corners1.length !== 8 || corners2.length !== 8) {
                console.warn("Could not get OBB corners for contact point calculation");
                return null;
            }
            
            // Find closest corner pair
            let minDist = Infinity;
            let pointA = null;
            let pointB = null;
            
            // Check each corner of obb1 against obb2
            for (const corner of corners1) {
                const closestOnB = this.findClosestPointOnOBB(corner, obb2);
                const dist = corner.distanceTo(closestOnB);
                
                if (dist < minDist) {
                    minDist = dist;
                    pointA = corner.clone();
                    pointB = closestOnB.clone();
                }
            }
            // Check each corner of obb2 against obb1
            for (const corner of corners2) {
                const closestOnA = this.findClosestPointOnOBB(corner, obb1);
                const dist = corner.distanceTo(closestOnA);
                if (dist < minDist) {
                    minDist = dist;
                    pointA = closestOnA.clone();
                    pointB = corner.clone();
                }
            }
            // If we didn't find any valid points, use centers
            if (!pointA || !pointB) {
                pointA = obb1.center.clone();
                pointB = obb2.center.clone();
            }
            
            // CRITICAL FIX: Special case for player colliding with objects on planet surface
            // This prevents the "bounce up" effect and getting stuck when pressing against objects
            const isPlayerCollision = obb1.userData?.isPlayer || obb2.userData?.isPlayer;
            
            if (isPlayerCollision) {
                const playerOBB = obb1.userData?.isPlayer ? obb1 : obb2;
                const objectOBB = obb1.userData?.isPlayer ? obb2 : obb1;
                
                // If this is a player collision and we have the player reference
                if (playerOBB.userData?.playerReference && playerOBB.userData.playerReference.soi) {
                    const player = playerOBB.userData.playerReference;
                    
                    // Only apply correction when player is on a planet and not falling
                    if (player.soi && !player.falling) {
                        const planetNormal = player.position.clone()
                            .sub(player.soi.object.position)
                            .normalize();
                        
                        // IMPROVED: Better handling of collision normals to prevent surface clipping
                        // Calculate the height relation between player and object relative to planet center
                        const playerDist = player.position.distanceTo(player.soi.object.position);
                        const objectDist = objectOBB.center.distanceTo(player.soi.object.position);
                        const heightDiff = objectDist - playerDist;
                        
                        // Get vector from player to object
                        const toObject = objectOBB.center.clone().sub(player.position).normalize();
                        
                        // NEW: Improved sliding normal calculation for smoother surface movement
                        // Calculate the optimal sliding direction based on angle between surface normal
                        // and direction to object
                        const upComponent = toObject.dot(planetNormal);
                        
                        // Always get a horizontal component that's tangent to the planet surface
                        // This is the optimal direction for sliding along the surface
                        const horizontalDir = toObject.clone().projectOnPlane(planetNormal).normalize();
                        
                        if (heightDiff > 0.5) {
                            // Object is higher than player - use climbing logic
                            if (upComponent > 0.7) { // Very steep - straight up
                                // For very steep slopes, block horizontal movement completely
                                if (horizontalDir.lengthSq() > 0.01) {
                                    // Use pure horizontal blocking for very steep obstacles
                                    pointB.copy(pointA).addScaledVector(horizontalDir, minDist);
                                }
                            } else {
                                // For more moderate slopes, allow some climbing with adjusted normal
                                // Blend horizontal and vertical components for smoother climbing
                                const climbNormal = horizontalDir.clone();
                                if (climbNormal.lengthSq() > 0.01) {
                                    pointB.copy(pointA).addScaledVector(climbNormal, minDist);
                                }
                            }
                        } else {
                            // Object is at same level or below player - use pure surface sliding
                            // IMPROVED: More consistent surface-aligned movement
                            // Always use horizontal direction for lateral movement to ensure
                            // player slides smoothly along surfaces without bobbing up/down
                            if (horizontalDir.lengthSq() > 0.01) {
                                pointB.copy(pointA).addScaledVector(horizontalDir, minDist);
                            }
                        }
                    }
                }
            }
            
            return {
                pointA,
                pointB,
                distance: minDist
            };
        } catch (error) {
            console.error("Error in findContactPoint:", error);
            return null;
        }
    }
    
    // ENHANCED: Find closest point on OBB to a given point
    static findClosestPointOnOBB(point, obb) {
        if (!point || !obb) return null;
        if (!this.validateOBB(obb)) {
            console.warn("Invalid OBB in findClosestPointOnOBB");
            return null;
        }
        
        try {
            // Log point and OBB details for debugging
            console.log(`Finding closest point to ${point.toArray()} on OBB at ${obb.center.toArray()}`);
            
            // Transform point to local space
            const localPoint = point.clone().sub(obb.center);
            
            // Create inverse rotation matrix
            const inverseRotation = new Matrix3().copy(obb.rotation).transpose();
            
            // Apply inverse rotation to get point in OBB's local axis-aligned space
            localPoint.applyMatrix3(inverseRotation);
            
            // Log local point for debugging
            console.log(`Local point in OBB space: ${localPoint.toArray()}`);
            
            // Clamp to OBB bounds
            const clampedPoint = new Vector3(
                Math.max(-obb.halfSize.x, Math.min(obb.halfSize.x, localPoint.x)),
                Math.max(-obb.halfSize.y, Math.min(obb.halfSize.y, localPoint.y)),
                Math.max(-obb.halfSize.z, Math.min(obb.halfSize.z, localPoint.z))
            );
            
            // Transform back to world space
            const worldPoint = clampedPoint.clone();
            worldPoint.applyMatrix3(obb.rotation);
            worldPoint.add(obb.center);
            
            // Log result for debugging
            console.log(`Closest point on OBB: ${worldPoint.toArray()}`);
            
            return worldPoint;
        } catch (err) {
            console.error("Error finding closest point on OBB:", err);
            return null;
        }
    }

    // NEW: Validate matrix has valid values
    static validateMatrix(matrix) {
        if (!matrix || !matrix.elements || matrix.elements.length !== 16) {
            return false;
        }
        // Check for NaN or infinite values
        for (let i = 0; i < 16; i++) {
            if (isNaN(matrix.elements[i]) || !isFinite(matrix.elements[i])) {
                return false;
            }
        }
        return true;
    }

    // NEW: Improved getInverseRotationMatrix with better validation and error handling
    static getInverseRotationMatrix(obb) {
        // Do extra validation before attempting matrix operations
        if (!obb) {
            console.warn("getInverseRotationMatrix called with null OBB - returning identity");
            return new Matrix3().identity();
        }
        if (!obb.rotation) {
            console.warn("OBB missing rotation matrix - returning identity");
            return new Matrix3().identity();
        }
        // Check if rotation matrix has valid elements
        if (!obb.rotation.elements || obb.rotation.elements.length !== 9) {
            console.warn("OBB rotation has invalid elements - returning identity");
            return new Matrix3().identity();
        }
        
        // Check for NaN values which would cause inversion problems
        for (let i = 0; i < 9; i++) {
            if (isNaN(obb.rotation.elements[i]) || !isFinite(obb.rotation.elements[i])) {
                console.warn("OBB rotation contains NaN or infinite values - returning identity");
                return new Matrix3().identity();
            }
        }
        
        // Now we can safely invert
        const inverseMat = new Matrix3().copy(obb.rotation);
        inverseMat.invert();
        // Validate the result to ensure we don't return a bad matrix
        for (let i = 0; i < 9; i++) {
            if (isNaN(inverseMat.elements[i]) || !isFinite(inverseMat.elements[i])) {
                console.warn("Matrix inversion produced invalid results - returning identity");
                return new Matrix3().identity();
            }
        }
        return inverseMat;
    }

    // NEW: Get minimum distance between two OBBs
    static getMinimumDistanceBetweenOBBs(obb1, obb2) {
        try {
            const contactPoint = this.findContactPoint(obb1, obb2);
            if (!contactPoint) return Infinity;
            
            return contactPoint.distance;
        } catch (err) {
            console.error("Error getting minimum distance:", err);
            return Infinity;
        }
    }
    
    // NEW: Validate if OBB has all required properties and valid values
    static validateOBB(obb, object) {
        if (!obb) {
            return false;
        }
        
        // Check center is valid
        if (!obb.center || 
            isNaN(obb.center.x) || !isFinite(obb.center.x) ||
            isNaN(obb.center.y) || !isFinite(obb.center.y) ||
            isNaN(obb.center.z) || !isFinite(obb.center.z)) {
            console.warn("OBB has invalid center", object ? object.name || object.id : "unknown");
            return false;
        }
        
        // Check half size is valid
        if (!obb.halfSize || 
            isNaN(obb.halfSize.x) || !isFinite(obb.halfSize.x) ||
            isNaN(obb.halfSize.y) || !isFinite(obb.halfSize.y) ||
            isNaN(obb.halfSize.z) || !isFinite(obb.halfSize.z)) {
            console.warn("OBB has invalid halfSize", object ? object.name || object.id : "unknown");
            return false;
        }
        
        // Check rotation is valid
        if (!obb.rotation || !obb.rotation.elements || obb.rotation.elements.length !== 9) {
            console.warn("OBB has missing or invalid rotation matrix", object ? object.name || object.id : "unknown");
            return false;
        }
        
        // Check for NaN or infinite values in rotation matrix
        for (let i = 0; i < 9; i++) {
            if (isNaN(obb.rotation.elements[i]) || !isFinite(obb.rotation.elements[i])) {
                console.warn("OBB rotation contains NaN or infinite values", object ? object.name || object.id : "unknown");
                return false;
            }
        }
        
        return true;
    }
    
    // NEW: Helper method to get OBB corners
    static getOBBCorners(obb) {
        if (!this.validateOBB(obb)) {
            console.warn("Cannot get corners of invalid OBB");
            return [];
        }
        
        try {
            const corners = [];
            const center = obb.center;
            const halfSize = obb.halfSize;
            const rotation = obb.rotation;
            
            // Calculate all 8 corners
            for (let i = 0; i < 8; i++) {
                const x = ((i & 1) ? 1 : -1) * halfSize.x;
                const y = ((i & 2) ? 1 : -1) * halfSize.y;
                const z = ((i & 4) ? 1 : -1) * halfSize.z;
                
                const point = new Vector3(x, y, z);
                point.applyMatrix3(rotation).add(center);
                corners.push(point);
            }
            
            return corners;
        } catch (err) {
            console.error("Error getting OBB corners:", err);
            return [];
        }
    }
    
    // CRITICAL FIX: Run SAT Test between two OBBs with improved collision detection
    static runSATTest(obb1, obb2) {
        if (!this.validateOBB(obb1) || !this.validateOBB(obb2)) {
            console.warn("Cannot perform SAT test with invalid OBBs");
            return { collides: false };
        }
        
        try {
            // Get object types for debugging
            const objA = obb1.userData?.vehicleReference || obb1.userData?.playerReference || "unknown";
            const objB = obb2.userData?.vehicleReference || obb2.userData?.playerReference || "unknown";
            const typeA = objA?.userData?.type || obb1.userData?.type || "unknown";
            const typeB = objB?.userData?.type || obb2.userData?.type || "unknown";
            
            console.log(`Running SAT test between ${typeA} and ${typeB}`);
            
            // SIMPLIFIED: Use generous sphere overlap as a first pass
            const center1 = obb1.center;
            const center2 = obb2.center;
            const maxSize1 = Math.max(obb1.halfSize.x, obb1.halfSize.y, obb1.halfSize.z);
            const maxSize2 = Math.max(obb2.halfSize.x, obb2.halfSize.y, obb2.halfSize.z);
            
            const centerDistance = center1.distanceTo(center2);
            const combinedSizes = (maxSize1 + maxSize2) * 1.3; // 30% more generous
            
            // Fast rejection - if way too far apart
            if (centerDistance > combinedSizes * 2.0) {
                return { collides: false };
            }
            
            // Fast acceptance - if clearly overlapping
            const isVeryClose = centerDistance < combinedSizes * 0.6;
            if (isVeryClose) {
                console.log(`Guaranteed collision - objects are very close: ${centerDistance.toFixed(2)} < ${(combinedSizes * 0.6).toFixed(2)}`);
                
                // Calculate approximate normal and point for collision response
                const normal = new Vector3().subVectors(center2, center1).normalize();
                const point = new Vector3().addVectors(center1, center2).multiplyScalar(0.5);
                
                return {
                    collides: true,
                    normal: normal,
                    point: point,
                    distance: centerDistance,
                    isVehicleCollision: typeA.includes('vehicle') && typeB.includes('vehicle'),
                    objectA: objA,
                    objectB: objB
                };
            }
            
            // For intermediate distances, do proper contact point check
            const contactPoint = this.findContactPoint(obb1, obb2);
            if (!contactPoint || !contactPoint.pointA || !contactPoint.pointB) {
                console.log("No valid contact points found in SAT test");
                return { collides: false };
            }
            
            // Use contact point data
            const distance = contactPoint.distance;
            const pointA = contactPoint.pointA;
            const pointB = contactPoint.pointB;
            
            console.log(`Contact point distance: ${distance.toFixed(4)}`);
            
            // INCREASED: Much more generous collision thresholds
            const isVehicle = typeA.includes('vehicle') || typeB.includes('vehicle');
            const collisionThreshold = isVehicle ? 0.8 : 0.5;
            
            if (distance < collisionThreshold) {
                console.log(`COLLISION DETECTED with threshold ${collisionThreshold.toFixed(2)}`);
                
                // Calculate normal and collision point
                const normal = new Vector3().subVectors(pointA, pointB).normalize();
                const point = new Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
                
                // For vehicles, use center-to-center normal instead
                if (isVehicle) {
                    normal.copy(new Vector3().subVectors(center2, center1).normalize());
                }
                
                return {
                    collides: true,
                    normal: normal,
                    point: point,
                    distance: distance,
                    isVehicleCollision: isVehicle,
                    objectA: objA,
                    objectB: objB
                };
            }
            
            return { collides: false };
        } catch (err) {
            console.error("Error in SAT test:", err);
            return { collides: false };
        }
    }
    
    // Add missing checkAllCollisions method referenced in DebugBox.vue
    static checkAllCollisions(object) {
        if (!object || !this.collidableObjects) {
            return [];
        }
        
        try {
            const collisions = [];
            
            for (const collidable of this.collidableObjects) {
                // Skip self or invalid collidables
                if (!collidable || !collidable.active || collidable.object === object) {
                    continue;
                }
                
                // ADDED: Skip collisions between player and their vehicle
                if (typeof window.shouldCheckCollisionWith === 'function') {
                    if (!window.shouldCheckCollisionWith(collidable.object)) {
                        continue;
                    }
                }
                
                // Skip collisions if player is in a vehicle
                if (window.PlayersManager && window.PlayersManager.self && 
                    window.PlayersManager.self.inVehicle && window.VehicleManager && 
                    window.VehicleManager.currentVehicle) {
                    // Skip if this is collision between player and their vehicle
                    if ((object === window.PlayersManager.self.handle && 
                         collidable.object === window.VehicleManager.currentVehicle) ||
                        (collidable.object === window.PlayersManager.self.handle && 
                         object === window.VehicleManager.currentVehicle)) {
                        continue;
                    }
                }
                
                // Check for collision
                if (this.checkCollision(object, collidable.object)) {
                    collisions.push(collidable.object);
                }
            }
            
            return collisions;
        } catch (err) {
            console.error("Error in checkAllCollisions:", err);
            return [];
        }
    }
    
    // Add alias method for compatibility
    static checkCollisionsWithObject(object) {
        return this.checkAllCollisions(object);
    }
    
    // Update a collidable object's bounding box (needed when objects move)
    static updateCollidableBounds(object) {
        if (!object) {
            console.warn("updateCollidableBounds called with null object");
            return false;
        }
        
        // NEW: Skip redundant updates to prevent visual jitter
        if (object.userData && object.userData._lastBoundsUpdateTime) {
            const now = Date.now();
            // Only allow updates every 16ms (60fps) unless forced
            if (now - object.userData._lastBoundsUpdateTime < 16 && !object.userData._forceUpdate) {
                return true; // Pretend update succeeded to avoid error logs
            }
        }
        
        // NEW: Enhanced validation before updating
        if (!object.userData) {
            console.warn("Object missing userData in updateCollidableBounds");
            object.userData = {};
        }
        
        // NEW: Check if object is being handled specially as player handle
        const isPlayerHandle = object.userData && object.userData.isPlayer;
        
        // First, search for the object in our collidable registry
        const collidable = this.collidableObjects.find(c => c && c.object === object);
        if (!collidable) {
            // Object not registered with collision system
            console.warn(`Object not found in collidable registry: ${object.name || object.uuid} (type: ${object.userData?.type || 'unknown'})`);
            
            // NEW: Special handling for player handles - attempt reregistration
            if (isPlayerHandle && typeof window.PlayersManager !== 'undefined') {
                console.log("Attempting to reregister player handle for collision detection");
                const player = window.PlayersManager.players.find(p => p && p.handle === object);
                if (player) {
                    window.PlayersManager.initializePlayerCollider(player, true);
                    // Try again after reregistration
                    return this.updateCollidableBounds(object);
                }
            }
            
            return false;
        }
        
        // NEW: Validate matrix has valid values
        if (object.matrixWorld) {
            let hasInvalid = false;
            for (let i = 0; i < 16; i++) {
                if (isNaN(object.matrixWorld.elements[i]) || !isFinite(object.matrixWorld.elements[i])) {
                    hasInvalid = true;
                    break;
                }
            }
            
            if (hasInvalid) {
                console.warn("Object has invalid matrixWorld - skipping OBB update");
                return false;
            }
        }
        
        try {
            // Make sure object's world matrix is up to date
            object.updateMatrixWorld(true);
            
            // Update the AABB of the collidable to match the object's new bounds
            collidable.aabb.setFromObject(object);
            
            // CRITICAL FIX: Define minBoxSize outside of if/else blocks so it's available in both
            const minBoxSize = 0.1;
            
            // CRITICAL FIX: Never use empty AABBs
            if (collidable.aabb.isEmpty()) {
                // If AABB is empty, create a minimum-size box at object position
                // FIXED: Increase minimum box size to prevent clipping
                const minBoxSize = 0.2; // Increased from 0.1 to 0.2 for better collision detection
                
                collidable.aabb.min.set(
                    object.position.x - minBoxSize,
                    object.position.y - minBoxSize,
                    object.position.z - minBoxSize
                );
                collidable.aabb.max.set(
                    object.position.x + minBoxSize,
                    object.position.y + minBoxSize,
                    object.position.z + minBoxSize
                );
                console.warn("Created minimum-size AABB for empty collision box");
            }
            
            // Update the OBB to match the new AABB
            if (!collidable.obb) {
                collidable.obb = new OBB();
            }
            
            collidable.obb.fromBox3(collidable.aabb);
            
            // CRITICAL FIX: Only apply matrix if it's valid
            if (object.matrixWorld && this.validateMatrix(object.matrixWorld)) {
                collidable.obb.applyMatrix4(object.matrixWorld);
                
                // CRITICAL FIX: Validate OBB after transformation
                if (!this.validateOBB(collidable.obb, object)) {
                    console.warn("OBB validation failed after matrix application - resetting");
                    collidable.obb.center.copy(object.position);
                    collidable.obb.rotation.identity();
                    
                    // Calculate suitable half-size based on object userData or a default
                    const defaultSize = 1;
                    collidable.obb.halfSize.set(
                        object.userData.width ? object.userData.width/2 : defaultSize,
                        object.userData.height ? object.userData.height/2 : defaultSize,
                        object.userData.depth ? object.userData.depth/2 : defaultSize
                    );
                }
            } else {
                // If matrix is invalid, just set center to object position
                collidable.obb.center.copy(object.position);
            }
            
            // NEW: Track last update time to prevent redundant updates in the same frame
            if (object.userData) {
                object.userData._lastBoundsUpdateTime = Date.now();
                object.userData._forceUpdate = false;
            }
            
            return true;
        } catch (err) {
            console.error("Error updating collidable bounds:", err);
            return false;
        }
    }
    
    // NEW: Add method to force bounds update
    static forceUpdateCollidableBounds(object) {
        if (!object || !object.userData) return false;
        
        // Mark for immediate update regardless of timing
        object.userData._forceUpdate = true;
        return this.updateCollidableBounds(object);
    }
    
    // ENHANCED: Test collision between a sphere and an OBB with better accuracy
    static testSphereOBBCollision(sphereCenter, sphereRadius, obb) {
        if (!sphereCenter || !obb || !this.validateOBB(obb)) {
            return false;
        }
        
        try {
            // Find the closest point on the OBB to the sphere center
            const closestPoint = this.findClosestPointOnOBB(sphereCenter, obb);
            
            // FIXED: Validate return point
            if (!closestPoint) return false;
            
            // If closest point is within sphere radius, collision detected
            const distance = sphereCenter.distanceTo(closestPoint);
            
            // Add small epsilon to prevent collision tunneling
            const collisionEpsilon = 0.01;
            return distance <= (sphereRadius + collisionEpsilon);
        } catch (err) {
            console.error("Error in sphere-OBB collision test:", err);
            return false;
        }
    }

    // ENHANCED: Test collision between a sphere and specific face of an OBB with more accurate normal calculation
    static testSphereOBBFaceCollision(sphereCenter, sphereRadius, obb) {
        if (!sphereCenter || !obb || !this.validateOBB(obb)) {
            return { collides: false };
        }
        
        try {
            // Find the closest point on the OBB to the sphere center
            const closestPoint = this.findClosestPointOnOBB(sphereCenter, obb);
            if (!closestPoint) return { collides: false };
            
            const distance = sphereCenter.distanceTo(closestPoint);
            
            // If collision detected, determine which face
            if (distance <= sphereRadius) {
                // Calculate the vector from closest point to sphere center (normal points away from OBB)
                let normal = new Vector3().subVectors(sphereCenter, closestPoint).normalize();
                
                // If normal vector is too small, try to find the face normal
                if (normal.lengthSq() < 0.001) {
                    // Transform sphere center to OBB local space
                    const localCenter = sphereCenter.clone().sub(obb.center);
                    localCenter.applyMatrix3(new Matrix3().copy(obb.rotation).transpose());
                    
                    // Determine which face is closest by finding the closest point on the box
                    const localClosest = new Vector3(
                        Math.max(-obb.halfSize.x, Math.min(obb.halfSize.x, localCenter.x)),
                        Math.max(-obb.halfSize.y, Math.min(obb.halfSize.y, localCenter.y)),
                        Math.max(-obb.halfSize.z, Math.min(obb.halfSize.z, localCenter.z))
                    );
                    
                    // Find which axis had the least clamping (closest to the face)
                    let faceNormal = new Vector3(0, 0, 0);
                    let minDistance = Number.MAX_VALUE;
                    
                    // Check each axis
                    const axes = [
                        { axis: new Vector3(1, 0, 0), side: Math.sign(localCenter.x), dist: Math.abs(obb.halfSize.x - Math.abs(localCenter.x)) },
                        { axis: new Vector3(0, 1, 0), side: Math.sign(localCenter.y), dist: Math.abs(obb.halfSize.y - Math.abs(localCenter.y)) },
                        { axis: new Vector3(0, 0, 1), side: Math.sign(localCenter.z), dist: Math.abs(obb.halfSize.z - Math.abs(localCenter.z)) }
                    ];
                    
                    // Find the closest face
                    for (const axisData of axes) {
                        if (axisData.dist < minDistance) {
                            minDistance = axisData.dist;
                            faceNormal.copy(axisData.axis).multiplyScalar(axisData.side);
                        }
                    }
                    
                    // Transform normal back to world space
                    faceNormal.applyMatrix3(obb.rotation);
                    normal = faceNormal;
                }
                
                return {
                    collides: true,
                    distance: distance,
                    penetration: sphereRadius - distance,
                    point: closestPoint.clone(),
                    normal: normal
                };
            }
            
            return { collides: false };
        } catch (err) {
            console.error("Error in sphere-OBB face collision test:", err);
            return { collides: false };
        }
    }
    
    // ENHANCED: Check collision between two objects, using appropriate collision shape based on object type
    static checkCollision(object1, object2) {
        // Skip collision check if either object is a planet
        if ((object1.userData && object1.userData.isPlanet) || 
            (object2.userData && object2.userData.isPlanet)) {
            return false;
        }
        
        // Get the collidables for both objects
        const collidable1 = this.collidableObjects.find(c => c && c.object === object1);
        const collidable2 = this.collidableObjects.find(c => c && c.object === object2);
        
        if (!collidable1 || !collidable2) {
            return false;
        }
        
        // FIXED: Strictly identify player objects by userData.isPlayer for sphere collision
        // All other objects use OBB-OBB collision
        const isPlayer1 = object1.userData?.isPlayer || false;
        const isPlayer2 = object2.userData?.isPlayer || false;
        
        // Case 1: Both are players (sphere vs sphere)
        if (isPlayer1 && isPlayer2) {
            const radius1 = object1.userData.collisionRadius || 1.2;
            const radius2 = object2.userData.collisionRadius || 1.2;
            const distance = object1.position.distanceTo(object2.position);
            return distance < (radius1 + radius2);
        }
        // Case 2: First is player, second is other object (sphere vs OBB)
        else if (isPlayer1 && !isPlayer2) {
            // IMPROVED: Use more accurate sphere-OBB test
            if (collidable2.obb && this.validateOBB(collidable2.obb)) {
                return this.testSphereOBBCollision(
                    object1.position,
                    object1.userData.collisionRadius || 1.2,
                    collidable2.obb
                );
            } else {
                // Fallback to sphere-sphere if OBB is invalid
                const radius1 = object1.userData.collisionRadius || 1.2;
                const radius2 = this.getObjectRadius(object2);
                const distance = object1.position.distanceTo(object2.position);
                return distance < (radius1 + radius2);
            }
        }
        // Case 3: Second is player, first is other object (OBB vs sphere)
        else if (!isPlayer1 && isPlayer2) {
            // IMPROVED: Use more accurate sphere-OBB test
            if (collidable1.obb && this.validateOBB(collidable1.obb)) {
                return this.testSphereOBBCollision(
                    object2.position,
                    object2.userData.collisionRadius || 1.2,
                    collidable1.obb
                );
            } else {
                // Fallback to sphere-sphere if OBB is invalid
                const radius1 = this.getObjectRadius(object1);
                const radius2 = object2.userData.collisionRadius || 1.2;
                const distance = object1.position.distanceTo(object2.position);
                return distance < (radius1 + radius2);
            }
        }
        // Case 4: Neither are players - use OBB-OBB collision for all other objects
        else {
            // Run SAT test for OBB vs OBB collision
            if (collidable1.obb && collidable2.obb && 
                this.validateOBB(collidable1.obb) && this.validateOBB(collidable2.obb)) {
                const result = this.runSATTest(collidable1.obb, collidable2.obb);
                return result && result.collides;
            } else {
                // Fallback to sphere-sphere if either OBB is invalid
                const radius1 = this.getObjectRadius(object1);
                const radius2 = this.getObjectRadius(object2);
                const distance = object1.position.distanceTo(object2.position);
                return distance < (radius1 + radius2);
            }
        }
    }

    // IMPROVED: Get object radius for sphere-based collision - more accurate based on object dimensions
    static getObjectRadius(object) {
        if (!object) return 1.5;
        
        try {
            // For player, use clearly defined radius
            if (object.userData && object.userData.isPlayer) {
                return object.userData.collisionRadius || 1.2;
            }
            
            // For vehicles, use type-specific radius with larger values
            if (object.userData && object.userData.isVehicle) {
                if (object.userData.type === 'car') return 3.5;
                if (object.userData.type === 'airplane') return 6.5;
                return 4.5;
            }
            
            // For test cubes, calculate from dimensions
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
            
            // For other objects with OBB, use its dimensions
            if (object.collidable && object.collidable.obb && this.validateOBB(object.collidable.obb)) {
                const obb = object.collidable.obb;
                // Use maximum half-size plus small margin
                return Math.max(obb.halfSize.x, obb.halfSize.y, obb.halfSize.z) * 1.2;
            } else if (object.collidable && object.collidable.aabb) {
                const aabb = object.collidable.aabb;
                // Calculate size from AABB with safety margin
                const sizeX = (aabb.max.x - aabb.min.x) * 1.2;
                const sizeY = (aabb.max.y - aabb.min.y) * 1.2;
                const sizeZ = (aabb.max.z - aabb.min.z) * 1.2;
                return Math.max(sizeX, sizeY, sizeZ) / 2;
            }
            
            // Default values based on type
            if (object.userData && object.userData.type) {
                switch(object.userData.type) {
                    case 'player': return 1.2;
                    case 'car': return 3.5;
                    case 'airplane': return 6.5;
                    case 'testCube': return 2.0;
                    default: return 1.5;
                }
            }
            
            return 1.5; // Default fallback
        } catch (err) {
            console.error("Error getting object radius:", err);
            return 1.5;
        }
    }
}

// CRITICAL FIX: Ensure functionality is available even before class is fully constructed
if (typeof window !== 'undefined') {
    window.ObjectManager = ObjectManager;
    
    // ADDED: Set enhanced debug settings by default
    ObjectManager._debugSettings = {
        showBoxes: true,
        showNormals: true,
        boxOpacity: 0.4,
        normalLength: 3.0  // Increased from default to make normals more visible
    };
}

// NEW: Centralized surface alignment method for all objects (players, vehicles, etc.)
ObjectManager.alignObjectToSurface = function(object, surfaceNormal, options = {}) {
    if (!object || !surfaceNormal) {
        console.warn("Cannot align object: missing object or surface normal");
        return false;
    }
    
    try {
        // Default options
        const defaults = {
            lerpFactor: 0.1,                // How quickly to align (higher = faster)
            forceFullAlignment: false,       // Whether to immediately snap to alignment
            maintainForwardDirection: false, // Whether to preserve forward direction during alignment
            useLocalUp: true,                // Whether to use object's up vector or world up
            skipIfFalling: true,             // Skip alignment for falling objects
            alignmentType: 'default'         // For tracking alignment source ('vehicle', 'player', 'physics', etc.)
        };
        
        // Merge provided options with defaults
        const settings = {...defaults, ...options};
        
        // Get object state
        const isFalling = object.userData?.falling ?? false;
        const isVehicle = object.userData?.isVehicle ?? false;
        const isPlayer = object.userData?.isPlayer ?? false;
        const isActivelyControlled = object.userData?.isActivelyControlled ?? false;
        
        // IMPROVED: For cars, skip the falling check to maintain alignment during jumps
        const carNeedsAlignment = isVehicle && (object.userData?.type === 'car');
        
        // Skip alignment for falling objects unless forced or is a car
        if (settings.skipIfFalling && isFalling && !settings.forceFullAlignment && !carNeedsAlignment) {
            return false;
        }
        
        // Track when alignment was performed and by what system
        if (!object.userData) object.userData = {};
        object.userData._lastAlignmentTime = Date.now();
        object.userData._lastAlignmentType = settings.alignmentType;
        
        // Store surface normal for future reference
        object.userData.surfaceNormal = surfaceNormal.clone();
        
        // CRITICAL: Explicitly set the object's up vector to surface normal
        // This ensures proper alignment like the player handle uses
        if (settings.useLocalUp) {
            object.up = surfaceNormal.clone();
        }
        
        // Create alignment quaternion that orients object to surface
        const defaultUp = new Vector3(0, 1, 0);
        const alignmentQuaternion = new Quaternion();
        
        // Find axis perpendicular to both default up and surface normal
        const rotationAxis = new Vector3().crossVectors(defaultUp, surfaceNormal);
        
        // Handle cases where vectors are parallel or nearly parallel
        if (rotationAxis.lengthSq() < 0.001) {
            // Either exactly aligned or exactly opposite
            if (defaultUp.dot(surfaceNormal) < 0) {
                // Upside down - use X axis for rotation
                alignmentQuaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI);
            }
            // Else identity quaternion (already aligned)
        } else {
            // Normalize rotation axis
            rotationAxis.normalize();
            
            // Calculate angle between default up and surface normal
            const angle = Math.acos(Math.min(1, Math.max(-1, defaultUp.dot(surfaceNormal))));
            
            // Set quaternion from axis and angle
            alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
        }
        
        // ADVANCED: If maintaining forward direction, preserve it during alignment
        if (settings.maintainForwardDirection && object.quaternion) {
            // Get current forward direction in world space
            const currentForward = new Vector3(0, 0, -1).applyQuaternion(object.quaternion);
            
            // Project this onto the tangent plane of the surface
            const projectedForward = currentForward.clone().projectOnPlane(surfaceNormal).normalize();
            
            // Only if projection is valid
            if (projectedForward.lengthSq() > 0.001) {
                // Find right vector by taking cross product of up and forward
                const rightVector = new Vector3().crossVectors(surfaceNormal, projectedForward).normalize();
                
                // Recalculate forward to ensure orthogonality
                const correctedForward = new Vector3().crossVectors(rightVector, surfaceNormal).normalize();
                
                // Create rotation matrix from these orthogonal vectors
                const m = new Matrix4();
                m.makeBasis(rightVector, surfaceNormal, correctedForward);
                
                // Convert to rotation matrix to quaternion
                const directionPreservingQuaternion = new Quaternion().setFromRotationMatrix(m);
                
                // Use this alignment instead
                alignmentQuaternion.copy(directionPreservingQuaternion);
            }
        }
        
        // Track previous quaternion for reference
        if (!object.userData.lastAlignmentQuaternion) {
            object.userData.lastAlignmentQuaternion = new Quaternion();
            object.userData.lastAlignmentQuaternion.copy(object.quaternion);
        }
        
        // Determine appropriate lerp factor based on object state and settings
        let finalLerpFactor = settings.lerpFactor;
        
        // IMPROVED: For cars, use stronger alignment to prevent floating/tilting
        if (isVehicle && object.userData?.type === 'car') {
            finalLerpFactor = Math.max(0.15, finalLerpFactor);
        }
        
        if (settings.forceFullAlignment) {
            // Use stronger factor for immediate alignment
            finalLerpFactor = 0.8;
        }
        else if (object.userData?.hardFreeze || object.userData?.justLanded) {
            // Stronger for stabilization after landing
            finalLerpFactor = Math.min(0.5, settings.lerpFactor * 3);
        }
        else if (object.userData?.fullyStabilized) {
            // Very gentle for stabilized objects
            finalLerpFactor = Math.min(0.01, settings.lerpFactor * 0.2);
        }
        else if (isVehicle && isActivelyControlled) {
            // Special handling for actively controlled vehicles (more responsive)
            if (object.userData?.speed && Math.abs(object.userData?.speed) > 1.0) {
                finalLerpFactor = Math.min(Math.max(settings.lerpFactor, 0.08), 0.15);
            } else {
                finalLerpFactor = Math.min(settings.lerpFactor, 0.03);
            }
        }
        
        // Apply the rotation with appropriate lerp factor
        object.quaternion.slerp(alignmentQuaternion, finalLerpFactor);
        
        // Store last alignment quaternion for reference
        object.userData.lastAlignmentQuaternion.copy(object.quaternion);
        
        // Dampen angular velocity if present to reduce spinning
        if (object.userData?.angularVelocity) {
            const dampFactor = isActivelyControlled ? 0.7 : 0.9;
            object.userData.angularVelocity.multiplyScalar(1 - dampFactor);
            
            // Kill very small angular velocities
            if (object.userData.angularVelocity.lengthSq() < 0.0001) {
                object.userData.angularVelocity.set(0, 0, 0);
            }
        }
        
        // Update matrices
        if (object.updateMatrix) {
            object.updateMatrix();
        }
        if (object.updateMatrixWorld) {
            object.updateMatrixWorld(true);
        }
        
        return true;
    } catch (err) {
        console.error("Error in alignObjectToSurface:", err);
        return false;
    }
};