import { 
    BoxGeometry, 
    Mesh, 
    MeshBasicMaterial, 
    Vector3,
    Quaternion,
    Matrix4,
    Box3,
    Ray,
    ArrowHelper,
    Box3Helper,
    LineSegments,
    LineBasicMaterial,
    BufferGeometry,
    Float32BufferAttribute,
    Matrix3
} from 'three';
import { OBB } from 'three/addons/math/OBB.js';
import Engine from './engine.mjs';
import SceneManager from './scene.mjs';

// Manages objects placed on planetary surfaces like walls, structures, etc.
export default class ObjectManager {
    // Add a registry to track all collidable objects
    static collidableObjects = [];
    
    // Debug visualization state
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
            
            // Register with collision system
            const collidable = this.registerCollidable(object, collisionBox, type, isStatic);
            
            // Store reference in object's userData
            object.userData.collidable = collidable;
            
            // Store direct reference to OBB for convenience
            object.collidable = collidable;
            object.userData.obb = collidable.obb;
            
            console.log(`Registered ${type} object with collision system`);
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
    
    // Add OBB visualization for debugging
    static updateOBBVisualizer(collidable) {
        if (!this._debugEnabled || !collidable || !collidable.object) return;
        // Apply the object's world transform if available
        try {
            // Remove any existing OBB visualizer
            if (collidable.obbVisualizer) {
                collidable.object.remove(collidable.obbVisualizer);
                collidable.obbVisualizer = null;
            }
            
            if (this._debugSettings.showBoxes) {
                // Create a new visualizer
                const obb = collidable.obb;
                if (!obb) return;
                
                // Generate the 8 corners of the OBB
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
                
                // Create line segments for each edge of the box
                const indices = [
                    0, 1, 1, 3, 3, 2, 2, 0, // Bottom face
                    4, 5, 5, 7, 7, 6, 6, 4, // Top face
                    0, 4, 1, 5, 2, 6, 3, 7  // Connecting edges
                ];  
                const positions = [];
                indices.forEach(idx => {
                    const corner = corners[idx];
                    positions.push(corner.x, corner.y, corner.z);
                });
                const geometry = new BufferGeometry();
                geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
                const material = new LineBasicMaterial({
                    color: 0x00ff00,
                    transparent: true,
                    opacity: 0.8,
                    depthTest: false
                });
                const obbVisualizer = new LineSegments(geometry, material);
                collidable.object.add(obbVisualizer);
                collidable.obbVisualizer = obbVisualizer;
            }
        } catch (e) {
            console.error("Error updating OBB visualizer:", e);
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
                        
                        // Return collision result and edge collision for better reliability
                        return {
                            collisionNormal: satResult.normal.clone(),
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
                        
                        // Calculate a collision normal that's aligned with the planet surface
                        const contactVector = pointB.clone().sub(pointA).normalize();
                        
                        // IMPROVED: For test cubes specifically, use a better sliding behavior
                        const isTestCube = objectOBB.object && 
                                         objectOBB.object.userData && 
                                         objectOBB.object.userData.type === 'testCube';
                        
                        if (isTestCube) {
                            // Get the direction toward the collision object
                            const toObject = objectOBB.center.clone().sub(playerOBB.center).normalize();
                            
                            // Remove any upward component in planetary reference frame
                            const upComponent = toObject.dot(planetNormal) * planetNormal.clone();
                            const horizontalDirection = toObject.clone().sub(upComponent).normalize();
                            
                            if (horizontalDirection.lengthSq() > 0.1) {
                                // Use this as the collision normal to ensure smooth sliding
                                const adjustedNormal = horizontalDirection.clone();
                                
                                // Update pointB to reflect this adjusted normal
                                pointB.copy(pointA).addScaledVector(adjustedNormal, minDist);
                                
                                console.log("Using horizontal direction for test cube collision normal");
                            } else {
                                // Project contact vector onto planet surface plane
                                const surfaceAlignedNormal = contactVector.projectOnPlane(planetNormal).normalize();
                                
                                // Only use surface-aligned normal if it's valid
                                if (surfaceAlignedNormal.lengthSq() > 0.01) {
                                    // Create new contact direction that won't push player up or down
                                    const adjustedContact = surfaceAlignedNormal.clone();
                                    
                                    // Update pointB to reflect this adjusted normal
                                    pointB.copy(pointA).addScaledVector(adjustedContact, minDist);
                                    
                                    console.log("Using surface-aligned normal for collision");
                                }
                            }
                        } else {
                            // For other objects, use standard projection
                            // Project contact vector onto planet surface plane
                            const surfaceAlignedNormal = contactVector.projectOnPlane(planetNormal).normalize();
                            
                            // Only use surface-aligned normal if it's valid
                            if (surfaceAlignedNormal.lengthSq() > 0.01) {
                                // Store the original normal for debugging
                                const originalNormal = contactVector.clone();
                                
                                // Create new contact direction that won't push player up
                                const adjustedContact = surfaceAlignedNormal.clone();
                                
                                // Update pointB to reflect this adjusted normal
                                pointB.copy(pointA).addScaledVector(adjustedContact, minDist);
                                
                                // Log the adjustment if significant
                                if (originalNormal.dot(adjustedContact) < 0.9) {
                                    console.log("Adjusted collision normal to prevent bouncing off surface");
                                }
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
            // Basic SAT separation test
            // This is a simplified version that just checks for intersection
            // A more comprehensive test would calculate penetration depth and contact point
            
            // Get corners
            const corners1 = this.getOBBCorners(obb1);
            const corners2 = this.getOBBCorners(obb2);
            
            if (corners1.length !== 8 || corners2.length !== 8) {
                console.warn("Invalid OBB corners for SAT test");
                return { collides: false };
            }
            
            // Find closest points between OBBs
            const result = this.findContactPoint(obb1, obb2);
            if (!result) return { collides: false };
            
            // If distance is very small, we consider them colliding
            const collisionThreshold = 0.1; // Small epsilon for contact
            if (result.distance < collisionThreshold) {
                // IMPROVED: Calculate a contact normal that works better for sliding
                // Compute normal as vector from A to B, but consider player collisions specially
                let normal;
                const isPlayerCollision = obb1.userData?.isPlayer || obb2.userData?.isPlayer;
                
                if (isPlayerCollision) {
                    const playerOBB = obb1.userData?.isPlayer ? obb1 : obb2;
                    const otherOBB = obb1.userData?.isPlayer ? obb2 : obb1;
                    
                    // Get a vector from player center to other object center
                    const dirToObject = new Vector3().subVectors(
                        otherOBB.center, 
                        playerOBB.center
                    ).normalize();
                    
                    // If player has a reference, use it to ensure we're not pushing upward
                    if (playerOBB.userData?.playerReference && 
                        playerOBB.userData.playerReference.soi &&
                        !playerOBB.userData.playerReference.falling) {
                        
                        const player = playerOBB.userData.playerReference;
                        const planetNormal = player.position.clone()
                            .sub(player.soi.object.position)
                            .normalize();
                        
                        // Remove vertical component to ensure horizontal sliding
                        const upComponent = dirToObject.dot(planetNormal);
                        const horizontalDir = dirToObject.clone()
                            .addScaledVector(planetNormal, -upComponent)
                            .normalize();
                        
                        // If horizontal direction is valid, use it as normal
                        if (horizontalDir.lengthSq() > 0.1) {
                            normal = horizontalDir;
                        } else {
                            // If direction is mostly vertical, use standard calculation
                            normal = new Vector3()
                                .subVectors(result.pointA, result.pointB)
                                .normalize();
                        }
                    } else {
                        // Default to standard normal calculation
                        normal = new Vector3()
                            .subVectors(result.pointA, result.pointB)
                            .normalize();
                    }
                } else {
                    // For non-player collisions, use standard normal calculation
                    normal = new Vector3()
                        .subVectors(result.pointA, result.pointB)
                        .normalize();
                }
                
                // CRITICAL FIX: Store OBB user data to identify player collisions
                if (obb1.userData) normal.userData = obb1.userData;
                if (obb2.userData) normal.userData = { ...normal.userData, ...obb2.userData };
                    
                // Use midpoint as collision point
                const point = new Vector3()
                    .addVectors(result.pointA, result.pointB)
                    .multiplyScalar(0.5);
                    
                return {
                    collides: true,
                    normal: normal,
                    point: point,
                    distance: result.distance
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
        if (!object || !this.collidableObjects) return [];
        
        try {
            // Find the object's collidable
            const objCollidable = this.collidableObjects.find(c => c && c.object === object);
            if (!objCollidable || !objCollidable.obb) return [];
            
            const collisions = [];
            
            // Check against all other collidables
            for (const collidable of this.collidableObjects) {
                if (!collidable || collidable.object === object || !collidable.obb) continue;
                
                // Run simplified SAT test
                const result = this.runSATTest(objCollidable.obb, collidable.obb);
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
        } catch (err) {
            console.error("Error checking all collisions:", err);
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
            
            return true;
        } catch (err) {
            console.error("Error updating collidable bounds:", err);
            return false;
        }
    }
}

// CRITICAL FIX: Ensure functionality is available even before class is fully constructed
if (typeof window !== 'undefined') {
    window.ObjectManager = ObjectManager;
}