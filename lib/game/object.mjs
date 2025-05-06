import { Vector3, Box3, Matrix4, Matrix3, Quaternion, Raycaster, Euler } from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import Engine from './engine.mjs';
import PlayersManager from './players.mjs';

// ObjectManager handles all game object registrations and collision detection
export default class ObjectManager {
    // Array to store all collidable objects
    static collidableObjects = [];
    
    // Debug visualization flag
    static _debugEnabled = false;
    static _debugHelpers = [];
    static _debugSettings = {
        showBoxes: false,
        showNormals: false,
        boxOpacity: 0.3,
        normalLength: 2
    };

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
            return existing;
        }

        // Create collision metadata
        const collidable = {
            object: object,
            aabb: collisionBox.clone(),
            obb: new OBB(), // Add OBB for orientation-aware collision
            type: type || 'generic',
            active: true, // Can be used to temporarily disable collisions
            isStatic: isStatic // Whether this object is affected by gravity/physics
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
    
    // NEW: Find closest point on OBB to a given point
    static findClosestPointOnOBB(point, obb) {
        if (!point || !obb) return point ? point.clone() : new Vector3();
        if (!this.validateOBB(obb)) {
            console.warn("Invalid OBB in findClosestPointOnOBB");
            return point.clone();
        }
        try {
            // Transform point to local space
            const localPoint = point.clone().sub(obb.center);
            const inverseRotation = this.getInverseRotationMatrix(obb);
            localPoint.applyMatrix3(inverseRotation);
            
            // Clamp to OBB bounds
            const clampedPoint = new Vector3(
                Math.max(-obb.halfSize.x, Math.min(obb.halfSize.x, localPoint.x)),
                Math.max(-obb.halfSize.y, Math.min(obb.halfSize.y, localPoint.y)),
                Math.max(-obb.halfSize.z, Math.min(obb.halfSize.z, localPoint.z))
            );
            // Transform point to local space
            // Transform back to world space.
            clampedPoint.applyMatrix3(obb.rotation);
            clampedPoint.add(obb.center);
            
            return clampedPoint;
        } catch (err) {
            console.error("Error finding closest point on OBB:", err);
            return point.clone();
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
    
    // NEW: Run SAT Test between two OBBs
    static runSATTest(obb1, obb2) {
        if (!this.validateOBB(obb1) || !this.validateOBB(obb2)) {
            console.warn("Cannot perform SAT test with invalid OBBs");
            return { collides: false };
        }
        
        try {
            // Initialize result variable
            const result = { 
                distance: Infinity,
                pointA: null,
                pointB: null
            };
            
            // IMPROVED: Add early intersection test with enlarged boundaries for tunneling prevention
            // First check simple AABB-style test with expanded boundaries before complex math
            const center1 = obb1.center;
            const center2 = obb2.center;
            const maxSize1 = Math.max(obb1.halfSize.x, obb1.halfSize.y, obb1.halfSize.z) * 1.2; // 20% margin
            const maxSize2 = Math.max(obb2.halfSize.x, obb2.halfSize.y, obb2.halfSize.z) * 1.2; // 20% margin
            
            const centerDistance = center1.distanceTo(center2);
            const combinedSizes = maxSize1 + maxSize2;
            
            // If centers are too far apart, no chance of collision (early exit optimization)
            if (centerDistance > combinedSizes * 1.5) {
                return { collides: false };
            }
            
            // If centers are very close, high likelihood of collision (early detection)
            const isVeryClose = centerDistance < combinedSizes * 0.5;
            
            // Find closest points between OBBs
            const contactPoint = this.findContactPoint(obb1, obb2);
            if (!contactPoint) {
                return { collides: false };
            }
            
            // Update result with contact point data
            result.distance = contactPoint.distance;
            result.pointA = contactPoint.pointA;
            result.pointB = contactPoint.pointB;
            
            // IMPROVED: Lower collision threshold for more authoritative blocking
            // If distance is very small OR centers are very close, we consider them colliding
            const collisionThreshold = isVeryClose ? 0.2 : 0.1; // More lenient threshold when very close
            if (result.distance < collisionThreshold) {
                let normal;
                const isPlayerCollision = obb1.userData?.isPlayer || obb2.userData?.isPlayer;
                
                if (isPlayerCollision) {
                    const playerOBB = obb1.userData?.isPlayer ? obb1 : obb2;
                    const otherOBB = obb1.userData?.isPlayer ? obb2 : obb1;
                    
                    // Get player reference if available
                    const player = playerOBB.userData?.playerReference;
                    
                    // Get planet normal for surface alignment
                    let planetNormal = null;
                    if (player && player.soi && player.soi.object) {
                        planetNormal = player.position.clone()
                            .sub(player.soi.object.position)
                            .normalize();
                        
                        // Store this as the definitive planet normal
                        player._planetSurfaceNormal = planetNormal.clone();
                    }
                    
                    // Calculate standard point-based normal
                    const standardNormal = new Vector3().subVectors(result.pointA, result.pointB).normalize();
                    
                    // IMPROVED CORE FIX: For test cubes, ALWAYS use surface-aligned normal
                    const isTestCubeCollision = otherOBB.object?.userData?.type === 'testCube';
                    
                    if (isTestCubeCollision && planetNormal) {
                        // Project the normal onto the planet surface for lateral movement
                        const projectedNormal = standardNormal.clone()
                            .projectOnPlane(planetNormal)
                            .normalize();
                            
                        // Check if projection gave us a valid normal
                        if (projectedNormal.lengthSq() > 0.1) {
                            // Use pure surface-projected normal
                            normal = projectedNormal;
                            console.log("Using pure surface-projected normal for test cube collision");
                            
                            // Attach data to normal to indicate this is a test cube collision
                            normal.isTestCubeCollision = true;
                            normal.surfaceNormal = planetNormal.clone();
                        } else {
                            // If projection failed, use center-to-center but still mark as test cube
                            const centerToCenter = new Vector3().subVectors(
                                otherOBB.center,
                                playerOBB.center
                            ).projectOnPlane(planetNormal).normalize();
                            
                            normal = centerToCenter.lengthSq() > 0.1 ? 
                                centerToCenter : standardNormal;
                                
                            normal.isTestCubeCollision = true;
                            normal.surfaceNormal = planetNormal.clone();
                        }
                    }
                    // For other collisions, use standard handling
                    else if (player && !player.falling && planetNormal) {
                        // Player is on planet surface - ensure collision normal is surface-aligned
                        const projectedNormal = standardNormal.clone()
                            .projectOnPlane(planetNormal)
                            .normalize();
                            
                        if (projectedNormal.lengthSq() > 0.3) {
                            const dotWithUp = standardNormal.dot(planetNormal);
                            const isLateralCollision = Math.abs(dotWithUp) < 0.5;
                            
                            if (isLateralCollision) {
                                normal = projectedNormal;
                            } else {
                                normal = projectedNormal.clone()
                                    .multiplyScalar(0.85)
                                    .add(standardNormal.multiplyScalar(0.15));
                                normal.normalize();
                            }
                        } else {
                            normal = standardNormal;
                        }
                    } else {
                        // IMPROVED: For edge collisions, use a blend of center-to-center and point normal
                        // This helps prevent getting "stuck" on edges
                        const centerToCenter = new Vector3().subVectors(
                            playerOBB.center,
                            otherOBB.center
                        ).normalize();
                        
                        // Check if this looks like an edge collision (normal significantly different from center-to-center)
                        const dotProduct = centerToCenter.dot(standardNormal);
                        const isEdgeCollision = dotProduct < 0.7; // Normals differ by more than ~45 degrees
                        
                        if (isEdgeCollision) {
                            // Blend the two normals for better edge handling
                            normal = standardNormal.clone().multiplyScalar(0.6)
                                .add(centerToCenter.multiplyScalar(0.4))
                                .normalize();
                            
                            console.log("Using blended normal for edge collision");
                        } else {
                            normal = standardNormal;
                        }
                    }
                } else {
                    // For non-player collisions, use standard normal calculation
                    normal = new Vector3()
                        .subVectors(result.pointA, result.pointB)
                        .normalize();
                }
                
                // Use midpoint as collision point
                const point = new Vector3()
                    .addVectors(result.pointA, result.pointB)
                    .multiplyScalar(0.5);
                    
                return {
                    collides: true,
                    normal: normal,
                    point: point,
                    distance: result.distance,
                    isTestCubeCollision: normal.isTestCubeCollision // Pass through flag
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
    
    // Check collision between two objects using OBB
    static checkCollision(object1, object2) {
        // Skip collision check if either object is a planet
        if ((object1.userData && object1.userData.isPlanet) || 
            (object2.userData && object2.userData.isPlanet)) {
            return false;
        }
        
        // ENHANCED: More comprehensive player-vehicle collision filtering
        if (object1.userData && object2.userData) {
            // Check if either object is in entry grace period
            const obj1InGracePeriod = object1.userData._entryGracePeriod && 
                                      object1.userData._entryGraceEndTime && 
                                      Date.now() < object1.userData._entryGraceEndTime;
                                      
            const obj2InGracePeriod = object2.userData._entryGracePeriod && 
                                      object2.userData._entryGraceEndTime && 
                                      Date.now() < object2.userData._entryGraceEndTime;
            
            // If either object is in grace period and is occupied by a player
            if ((obj1InGracePeriod && object1.userData.isOccupied) ||
                (obj2InGracePeriod && object2.userData.isOccupied)) {
                
                // Find which is the vehicle
                const vehicle = object1.userData.isVehicle ? object1 : 
                               (object2.userData.isVehicle ? object2 : null);
                               
                // Find which is the player
                const playerHandle = object1.userData.isPlayer ? object1 : 
                                    (object2.userData.isPlayer ? object2 : null);
                
                if (vehicle && playerHandle) {
                    // Check if this player is the vehicle's current driver
                    if (vehicle.userData.occupiedBy === playerHandle || 
                        vehicle.userData.currentDriver?.handle === playerHandle) {
                        console.log('Blocking collision between vehicle and its driver during grace period');
                        return false;
                    }
                }
            }
            
            // ENHANCED: First check direct player-in-vehicle state
            const player = PlayersManager?.self;
            if (player && player.inVehicle && VehicleManager?.currentVehicle) {
                // If player is in a vehicle, explicitly block collision between them
                if ((object1 === player.handle && object2 === VehicleManager.currentVehicle) ||
                    (object2 === player.handle && object1 === VehicleManager.currentVehicle)) {
                    console.log("Explicitly blocking player-vehicle collision while in vehicle");
                    return false;
                }
            }
            
            // IMPROVED: More extensive check for player-vehicle relationship
            const isPlayerVehicleCollision = 
                (object1.userData.isPlayer && object2.userData.isVehicle && 
                 (object2.userData.isOccupied || object2.userData._entryGracePeriod) && 
                 ((object2.userData.player && object2.userData.player.handle === object1) || 
                  (object2.userData.occupiedBy === object1) ||
                  (object2.userData.currentDriver?.handle === object1) ||
                  (object2._ignoreCollisionWith === object1))) ||
                (object2.userData.isPlayer && object1.userData.isVehicle && 
                 (object1.userData.isOccupied || object1.userData._entryGracePeriod) && 
                 ((object1.userData.player && object1.userData.player.handle === object2) || 
                  (object1.userData.occupiedBy === object2) ||
                  (object1.userData.currentDriver?.handle === object2) ||
                  (object1._ignoreCollisionWith === object2)));
            
            if (isPlayerVehicleCollision) {
                // Skip collision detection for occupied vehicles and their drivers
                console.log("Player-vehicle collision excluded by relationship check");
                return false;
            }
            
            // ENHANCED: Check direct ignore flags in both directions
            if ((object1._ignoreCollisionWith === object2) || (object2._ignoreCollisionWith === object1)) {
                console.log("Collision excluded by ignoreCollisionWith flags");
                return false;
            }
            
            // NEW: Check current vehicle explicitly
            if (typeof VehicleManager !== 'undefined' && VehicleManager.currentVehicle) {
                if (object1.userData.isPlayer && object2 === VehicleManager.currentVehicle) {
                    return false;
                }
                if (object2.userData.isPlayer && object1 === VehicleManager.currentVehicle) {
                    return false;
                }
            }
        }
        
        // Skip if global collision filter function exists and returns false
        if (window.shouldCheckCollisionWith) {
            if (!window.shouldCheckCollisionWith(object1) || !window.shouldCheckCollisionWith(object2)) {
                return false;
            }
        }
        
        // Get the OBBs for both objects
        const obb1 = object1.userData && object1.userData.obb;
        const obb2 = object2.userData && object2.userData.obb;
        
        // NEW: Validate OBBs before proceeding
        if (!this.validateOBB(obb1, object1) || !this.validateOBB(obb2, object2)) {
            console.warn("Invalid OBBs for collision check", object1, object2);
            return false;
        }
        
        // Calculate the distance between the two OBBs
        const distance = this.getMinimumDistanceBetweenOBBs(obb1, obb2);
        
        // If the distance is negative, they are colliding
        return distance < 0;
    }
    
    // Check collisions for a specific object
    static checkObjectCollisions(object) {
        if (!object || !this.collidableObjects) return [];
        
        const collisions = [];
        
        // Loop through all collidable objects
        for (const collidable of this.collidableObjects) {
            if (!collidable || collidable.object === object || !collidable.obb) continue;
            
            // Skip collision check if either object is a planet
            if ((object.userData && object.userData.isPlanet) || 
                (collidable.object.userData && collidable.object.userData.isPlanet)) {
                continue;
            }
            
            // CRITICAL FIX: Skip collision check between player and their occupied vehicle
            if (object.userData && collidable.object.userData) {
                // Check if player is occupying this vehicle
                const playerOccupyingVehicle = 
                    (object.userData.isPlayer && collidable.object.userData.isVehicle && 
                     collidable.object.userData.isOccupied && 
                     collidable.object.userData.player && 
                     collidable.object.userData.player.handle === object) ||
                    (collidable.object.userData.isPlayer && object.userData.isVehicle && 
                     object.userData.isOccupied && 
                     object.userData.player && 
                     object.userData.player.handle === collidable.object);
                
                if (playerOccupyingVehicle) {
                    continue; // Skip this collision pair
                }
            }
            
            // Run simplified SAT test
            const result = this.runSATTest(object.userData.obb, collidable.obb);
            if (result && result.collides) {
                collisions.push({
                    object: collidable.object,
                    normal: result.normal,
                    position: result.point,
                    distance: result.distance,
                    type: collidable.type
                });
            }
        }
        
        return collisions;
    }
    
    // NEW: Centralized surface alignment method for all objects (players, vehicles, etc.)
    static alignObjectToSurface(object, surfaceNormal, options = {}) {
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
    }
}

// CRITICAL FIX: Ensure functionality is available even before class is fully constructed
if (typeof window !== 'undefined') {
    window.ObjectManager = ObjectManager;
}