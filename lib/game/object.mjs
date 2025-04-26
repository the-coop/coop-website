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
    
    // Create an OBB directly from object dimensions and transform
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

            const speed = player.velocity.length();
            if (speed === 0) return null; // No movement, no collision
            
            const effectiveSpeed = Math.min(speed, 20); // Cap speed for collision detection
            
            // CRITICAL FIX: More accurate OBB collision detection for player handle
            try {
                const playerOBB = new OBB();
                // ENHANCED: Use accurate size to reflect actual player collision volume
                const playerBox = new Box3().setFromCenterAndSize(
                    new Vector3(0, 0, 0),
                    new Vector3(1.8, 2.2, 1.8) // Full 3D volume of player
                );
                playerOBB.fromBox3(playerBox);
                
                // Apply player's world matrix to properly orient the OBB
                if (player.handle && player.handle.matrixWorld) {
                    // Check matrixWorld for NaN values
                    const elements = player.handle.matrixWorld.elements;
                    let hasNaN = false;
                    
                    for (let i = 0; i < 16; i++) {
                        if (isNaN(elements[i]) || !isFinite(elements[i])) {
                            hasNaN = true;
                            break;
                        }
                    }
                    
                    if (hasNaN) {
                        console.warn("Player matrix contains NaN values, using fallback");
                        // Use simple translation matrix instead
                        playerOBB.applyMatrix4(new Matrix4().makeTranslation(
                            player.position.x, player.position.y, player.position.z
                        ));
                    } else {
                        // Use complete matrix world from handle for proper orientation
                        playerOBB.applyMatrix4(player.handle.matrixWorld);
                    }
                } else {
                    // Fallback to simple translation matrix if matrixWorld isn't available
                    const playerMatrix = new Matrix4().makeTranslation(
                        player.position.x, player.position.y, player.position.z
                    );
                    playerOBB.applyMatrix4(playerMatrix);
                }

                const potentialCollisions = [];
                
                // ENHANCED: Use continuous collision detection with swept volumes
                const numSteps = Math.max(1, Math.ceil(speed / 3)); // More substeps for higher precision
                const subStepSize = timeStep / numSteps;

                // Store previous player position to calculate swept volume
                const startPos = player.position.clone();
                const endPos = startPos.clone().addScaledVector(player.velocity, timeStep);
                
                // IMPROVED: Use ray casting for continuous collision detection
                const movementRay = new Ray(startPos, player.velocity.clone().normalize());
                const movementDistance = player.velocity.length() * timeStep;
                
                for (let step = 0; step < numSteps; step++) {
                    // Calculate position at this substep
                    const stepPosition = player.position.clone().addScaledVector(
                        player.velocity, 
                        (step * subStepSize) / timeStep
                    );
                    
                    // Calculate next position for swept volume
                    const nextStepPosition = player.position.clone().addScaledVector(
                        player.velocity,
                        ((step + 1) * subStepSize) / timeStep
                    );
                    
                    // Position the player OBB at this step
                    const stepMatrix = new Matrix4().makeTranslation(
                        stepPosition.x, stepPosition.y, stepPosition.z
                    );
                    
                    if (player.handle && player.handle.quaternion) {
                        const rotMatrix = new Matrix4().makeRotationFromQuaternion(player.handle.quaternion);
                        stepMatrix.multiply(rotMatrix);
                    }
                    
                    // Clone and apply matrix to OBB for this step
                    const worldPlayerOBB = playerOBB.clone().applyMatrix4(stepMatrix);
                    
                    // Process all objects (walls and non-walls together)
                    for (let i = 0; i < objects.length; i++) {
                        const item = objects[i];
                        
                        // Skip invalid objects
                        if (!item || !item.object || !item.aabb) continue;
                        
                        // Get object dimensions from userData or AABB
                        let objectSize = this.getObjectDimensions(item);
                        
                        // IMPROVED: Get accurate OBB size rather than just max dimension
                        const objectHalfSize = item.obb ? item.obb.halfSize.clone() : 
                                              new Vector3(objectSize.x/2, objectSize.y/2, objectSize.z/2);
                        
                        // Calculate adjusted threshold based on actual 3D shape
                        // Factor in all dimensions not just the maximum
                        const playerHalfSize = new Vector3(1.8/2, 2.2/2, 1.8/2);
                        
                        // NEW: Use more accurate distance calculation based on actual shapes
                        // Instead of just distance between centers
                        const minDistance = this.getMinimumDistanceBetweenOBBs(worldPlayerOBB, item.obb);
                        
                        // Check if we're close enough to consider collisions
                        const proximityThreshold = 3.0; // More generous threshold for walls
                        if (minDistance > proximityThreshold) continue;
                        
                        // Update collision bounds for more accurate detection
                        this.updateCollidableBounds(item.object);
                        
                        // IMPROVED: Test for intersection using multiple methods
                        let intersects = false;
                        let collisionMethod = "";
                        let closestPoint = null;
                        
                        try {
                            // METHOD 1: Primary OBB-OBB intersection test
                            intersects = worldPlayerOBB.intersectsOBB(item.obb);
                            if (intersects) collisionMethod = "obb-direct";
                            
                            // METHOD 2: If method 1 fails, test for corner penetration
                            if (!intersects) {
                                // Test all 8 corners of player OBB against wall OBB
                                const playerCorners = this.getOBBCorners(worldPlayerOBB);
                                for (const corner of playerCorners) {
                                    if (this.isPointInOBB(corner, item.obb)) {
                                        intersects = true;
                                        collisionMethod = "player-corner-in-wall";
                                        closestPoint = corner.clone();
                                        break;
                                    }
                                }
                                
                                // Test all 8 corners of wall OBB against player OBB
                                if (!intersects) {
                                    const itemCorners = this.getOBBCorners(item.obb);
                                    for (const corner of itemCorners) {
                                        if (this.isPointInOBB(corner, worldPlayerOBB)) {
                                            intersects = true;
                                            collisionMethod = "wall-corner-in-player";
                                            closestPoint = corner.clone();
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // NEW: METHOD 3 - Test for swept volume intersection
                            if (!intersects && step < numSteps - 1) {
                                // Create expanded OBB that encompasses both current and next position
                                const sweptCollision = this.checkSweptVolumeCollision(
                                    worldPlayerOBB, 
                                    stepPosition, 
                                    nextStepPosition,
                                    item.obb
                                );
                                
                                if (sweptCollision.collides) {
                                    intersects = true;
                                    collisionMethod = "swept-volume";
                                    closestPoint = sweptCollision.point;
                                }
                            }
                            
                            // NEW: METHOD 4 - Edge-to-edge testing (crucial for thin objects)
                            if (!intersects) {
                                const edgeCollision = this.checkEdgeCollision(worldPlayerOBB, item.obb);
                                if (edgeCollision.collides) {
                                    intersects = true;
                                    collisionMethod = "edge-to-edge";
                                    closestPoint = edgeCollision.point;
                                }
                            }
                            
                            // NEW: METHOD 5 - SAT algorithm for more accurate collision
                            if (!intersects) {
                                const satResult = this.runSATTest(worldPlayerOBB, item.obb);
                                if (satResult.collides) {
                                    intersects = true;
                                    collisionMethod = "sat-test";
                                    closestPoint = satResult.point;
                                }
                            }
                            
                            // NEW: METHOD 6 - Fast moving object - ray cast against OBB
                            // Critical for detecting collisions with thin objects at high speed
                            if (!intersects && speed > 5) {
                                // Get item OBB as a box3 for ray intersection test
                                const itemBox = this.obbToBox3(item.obb);
                                
                                // Transform ray to object local space for easier intersection test
                                const localRay = movementRay.clone();
                                localRay.origin.sub(item.obb.center);
                                localRay.origin.applyMatrix3(this.getInverseRotationMatrix(item.obb.rotation));
                                localRay.direction.applyMatrix3(this.getInverseRotationMatrix(item.obb.rotation));
                                
                                // Box3 in local space
                                const localBox = new Box3(
                                    new Vector3(-item.obb.halfSize.x, -item.obb.halfSize.y, -item.obb.halfSize.z),
                                    new Vector3(item.obb.halfSize.x, item.obb.halfSize.y, item.obb.halfSize.z)
                                );
                                
                                // Test ray intersection with box
                                const intersection = localRay.intersectBox(localBox, new Vector3());
                                if (intersection) {
                                    // Transform intersection back to world space
                                    intersection.applyMatrix3(item.obb.rotation);
                                    intersection.add(item.obb.center);
                                    
                                    // Check if intersection is within movement distance
                                    const distToIntersection = movementRay.origin.distanceTo(intersection);
                                    if (distToIntersection <= movementDistance) {
                                        intersects = true;
                                        collisionMethod = "ray-cast";
                                        closestPoint = intersection.clone();
                                    }
                                }
                            }

                            // Debug: Log successful collision detection
                            if (intersects && this._debugEnabled) {
                                console.log(`Collision with ${item.type} using method: ${collisionMethod}`);
                            }
                        } catch (err) {
                            console.error(`Error in collision detection for ${item.type}:`, err);
                            continue;
                        }
                        
                        if (intersects) {
                            try {
                                // Determine contact point based on collision method
                                let contactPoint;
                                if (closestPoint) {
                                    contactPoint = closestPoint;
                                } else {
                                    contactPoint = this.findContactPoint(worldPlayerOBB, item.obb, stepPosition);
                                }
                                
                                // Calculate collision time
                                const distToIntersection = stepPosition.distanceTo(contactPoint);
                                const time = (step * subStepSize) + (distToIntersection / (effectiveSpeed || 0.001));

                                // Store collision data
                                if (time <= timeStep) {
                                    potentialCollisions.push({
                                        time,
                                        object: item,
                                        position: contactPoint.clone(),
                                        method: collisionMethod,
                                        isWall: false,
                                        penetration: 1.5  // Stronger response for walls
                                    });
                                }
                            } catch (err) {
                                console.error(`Error processing collision:`, err);
                            }
                        }
                    }
                }
                
                // Sort and select best collision
                if (potentialCollisions.length > 0) {
                    // Sort by time
                    potentialCollisions.sort((a, b) => a.time - b.time);
                    
                    // Take the collision with the smallest time that passes distance validation
                    for (const collision of potentialCollisions) {
                        closestTime = collision.time;
                        closestObject = collision.object;
                        closestPosition = collision.position;
                        
                        // Log collision with wall or vehicle
                        if (typeof window !== 'undefined' && window.gameNotify && 
                            closestObject.type !== player._lastCollidedWith) {
                            window.gameNotify(`Collision with ${closestObject.type}`);
                            player._lastCollidedWith = closestObject.type;
                            setTimeout(() => { player._lastCollidedWith = null; }, 2000);
                        }
                        
                        break; // Take the first valid collision
                    }
                }
                
            } catch (err) {
                console.error("Error in collision detection setup:", err);
                return null;
            }
            
            if (closestPosition === null) return null;
            
            try {
                // Get more accurate collision normal by using OBB face normal
                const collisionNormal = this.getOBBNormalAtPoint(
                    closestPosition, 
                    closestObject.obb,
                    closestObject.object
                ).normalize();
                
                // ENHANCED: More detailed collision logging for any collision type
                if (this._debugEnabled) {
                    // Create a type-specific identifier
                    let objectIdentifier = closestObject.type;
                    
                    // Add vehicle-specific details
                    if (closestObject.type === 'vehicle') {
                        if (closestObject.object.userData) {
                            objectIdentifier = `${closestObject.object.userData.type || 'vehicle'} "${closestObject.object.userData.name || 'unnamed'}"`;
                        }
                    }
                    
                    console.log(`PLAYER COLLISION WITH ${objectIdentifier.toUpperCase()}`);
                    console.log(`Collision details:
                      - Object type: ${closestObject.type}
                      - Object ID: ${closestObject.object.uuid.substring(0, 8)}
                      - Distance: ${player.position.distanceTo(closestObject.object.position).toFixed(2)} units
                      - Impact time: ${closestTime.toFixed(3)}s
                      - Normal: [${collisionNormal.x.toFixed(2)}, ${collisionNormal.y.toFixed(2)}, ${collisionNormal.z.toFixed(2)}]
                      - Player position: [${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}]
                      - Object position: [${closestObject.object.position.x.toFixed(1)}, ${closestObject.object.position.y.toFixed(1)}, ${closestObject.object.position.z.toFixed(1)}]
                    `);
                }
                
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

    // NEW: Check collisions for a specific object with other objects in the scene
    static checkCollisionsWithObject(object, timeStep = 1/60) {
        if (!object || !object.userData) {
            return [];
        }
        
        try {
            const results = [];
            
            // Get velocity from object's userData if available
            const velocity = object.userData.velocity || new Vector3();
            const speed = velocity.length();
            
            // Skip if object is not moving
            if (speed < 0.0001) {
                return results;
            }
            
            // Find collidable for this object
            let objectCollidable = null;
            if (object.collidable) {
                objectCollidable = object.collidable;
            } else if (object.userData.collidable) {
                objectCollidable = object.userData.collidable;
            } else {
                objectCollidable = this.collidableObjects.find(c => c && c.object === object);
            }
            
            if (!objectCollidable) {
                return results;
            }
            
            // Update the object's OBB before checking collisions
            this.updateCollidableBounds(object);
            
            // Collect all potential collision candidates
            // Filter objects that aren't this object and are close enough to possibly collide
            const nearbyObjects = this.collidableObjects.filter(item => {
                // Skip self
                if (item === objectCollidable || !item.object || item.object === object) {
                    return false;
                }
                
                // Skip inactive objects
                if (!item.active) {
                    return false;
                }
                
                // Use distance-based culling for performance
                const distSq = object.position.distanceToSquared(item.object.position);
                const maxCheckDistance = 50 * 50; // Check objects within 50 units
                
                return distSq < maxCheckDistance;
            });
            
            // Check collisions with possible objects
            const steps = Math.max(1, Math.ceil(speed / 5));
            const subStep = timeStep / steps;
            
            // Basic collision detection - can be enhanced for swept volume like player collisions
            for (const item of nearbyObjects) {
                try {
                    // Skip if missing OBB
                    if (!objectCollidable.obb || !item.obb) {
                        continue;
                    }
                    
                    // Update other object's bounds
                    this.updateCollidableBounds(item.object);
                    
                    // Test for OBB-OBB intersection
                    let intersects = objectCollidable.obb.intersectsOBB(item.obb);
                    
                    // Additional checks for walls or nearby objects
                    if (!intersects && (item.type === 'wall' || item.type === 'vehicle')) {
                        // Test corners of object against other OBB
                        const corners = this.getOBBCorners(objectCollidable.obb);
                        for (const corner of corners) {
                            if (this.isPointInOBB(corner, item.obb)) {
                                intersects = true;
                                break;
                            }
                        }
                        
                        // Test corners of other object against this OBB
                        if (!intersects) {
                            const otherCorners = this.getOBBCorners(item.obb);
                            for (const corner of otherCorners) {
                                if (this.isPointInOBB(corner, objectCollidable.obb)) {
                                    intersects = true;
                                    break;
                                }
                            }
                        }
                        
                        // Check edge distances for thin objects
                        if (!intersects) {
                            const edgeResult = this.checkEdgeCollision(objectCollidable.obb, item.obb);
                            intersects = edgeResult.collides;
                        }
                    }
                    
                    // If we have an intersection, calculate collision response
                    if (intersects) {
                        // Calculate collision normal from object centers
                        let normal = new Vector3().subVectors(object.position, item.object.position).normalize();
                        
                        // If normal is invalid, use default up direction
                        if (isNaN(normal.x) || isNaN(normal.y) || isNaN(normal.z)) {
                            normal = new Vector3(0, 1, 0);
                        }
                        
                        // Get contact point
                        const contactPoint = this.findContactPoint(objectCollidable.obb, item.obb, object.position);
                        
                        // Add to results
                        results.push({
                            object: object,
                            other: item.object,
                            normal: normal,
                            position: contactPoint,
                            distance: object.position.distanceTo(item.object.position),
                            penetration: 0.1, // Default penetration depth
                            isWallCollision: item.type === 'wall'
                        });
                    }
                } catch (err) {
                    console.error("Error checking object collision:", err);
                }
            }
            
            return results;
        } catch (err) {
            console.error("Error in checkCollisionsWithObject:", err);
            return [];
        }
    }
    
    // Create a new method to check all collisions for debugging
    static checkAllCollisions(object) {
        if (!object) return [];
        
        try {
            const results = [];
            
            // Find collidable reference for this object
            let objectCollidable = null;
            if (object.collidable) {
                objectCollidable = object.collidable;
            } else if (object.userData && object.userData.collidable) {
                objectCollidable = object.userData.collidable;
            } else {
                objectCollidable = this.collidableObjects.find(c => c && c.object === object);
            }
            
            if (!objectCollidable) {
                return [];
            }
            
            // Update the object's OBB to ensure accuracy
            this.updateCollidableBounds(object);
            
            // Check against all other collidables
            for (const other of this.collidableObjects) {
                // Skip comparing with self
                if (!other || other === objectCollidable || other.object === object) continue;
                
                // Skip inactive collidables
                if (!other.active) continue;
                
                // Skip objects that are too far away (performance optimization)
                const maxDist = 50;
                const distSq = object.position.distanceToSquared(other.object.position);
                if (distSq > maxDist * maxDist) continue;
                
                // Calculate actual distance
                const distance = Math.sqrt(distSq);
                
                // Update other object's bounds as well
                this.updateCollidableBounds(other.object);
                
                // Check for OBB intersection
                try {
                    let intersects = false;
                    
                    // First try OBB-OBB intersection
                    if (objectCollidable.obb && other.obb) {
                        intersects = objectCollidable.obb.intersectsOBB(other.obb);
                    }
                    
                    // If that failed, try additional corner tests for walls
                    if (!intersects) {
                        // Test corners of object against other OBB
                        const corners = this.getOBBCorners(objectCollidable.obb);
                        for (const corner of corners) {
                            if (this.isPointInOBB(corner, other.obb)) {
                                intersects = true;
                                break;
                            }
                        }
                        
                        // Test corners of other object against this OBB
                        if (!intersects) {
                            const otherCorners = this.getOBBCorners(other.obb);
                            for (const corner of otherCorners) {
                                if (this.isPointInOBB(corner, objectCollidable.obb)) {
                                    intersects = true;
                                    break;
                                }
                            }
                        }
                        
                        // Check closest point distance
                        if (!intersects) {
                            const closestPoint = this.findClosestPointOnOBB(
                                object.position, 
                                other.obb, 
                                other.object
                            );
                            const pointDistance = object.position.distanceTo(closestPoint);
                            if (pointDistance < 2.0) {
                                intersects = true;
                            }
                        }
                        
                        // Edge-to-edge check
                        if (!intersects) {
                            const edgeDistance = this.findMinimumEdgeDistance(
                                objectCollidable.obb, 
                                other.obb
                            );
                            if (edgeDistance < 1.8) {
                                intersects = true;
                            }
                        }
                    }
                    
                    // If we found an intersection, add it to results
                    if (intersects) {
                        // Calculate a collision normal
                        let normal;
                        if (other.object && other.object.position && object.position) {
                            normal = new Vector3()
                                .subVectors(object.position, other.object.position)
                                .normalize();
                        } else {
                            normal = new Vector3(0, 1, 0);
                        }
                        
                        // Add to results
                        results.push({
                            object: object,
                            otherCollidable: other,
                            distance: distance,
                            normal: normal,
                            intersectionTime: Date.now() // For debugging recency
                        });
                    }
                } catch (e) {
                    console.error("Error in collision check:", e);
                }
            }
            
            return results;
        } catch (e) {
            console.error("Error in checkAllCollisions:", e);
            return [];
        }
    }

    // Create a new method to find minimum distance between two OBBs' edges
    static findMinimumEdgeDistance(obb1, obb2) {
        try {
            // Get the 12 edges of each OBB (8 corners with 12 connecting edges)
            const edges1 = this.getOBBEdges(obb1);
            const edges2 = this.getOBBEdges(obb2);
            
            let minDistance = Infinity;
            
            // Test each edge pair for minimum distance
            for (let i = 0; i < edges1.length; i++) {
                const edge1 = edges1[i];
                
                for (let j = 0; j < edges2.length; j++) {
                    const edge2 = edges2[j];
                    
                    // Find minimum distance between these two edges
                    const distance = this.lineSegmentDistance(
                        edge1.start, edge1.end, 
                        edge2.start, edge2.end
                    );
                    
                    minDistance = Math.min(minDistance, distance);
                }
            }
            
            return minDistance;
        } catch (err) {
            console.error("Error in findMinimumEdgeDistance:", err);
            return Infinity;
        }
    }

    // Get the 12 edges of an OBB as line segments
    static getOBBEdges(obb) {
        const corners = this.getOBBCorners(obb);
        if (corners.length !== 8) return [];
        
        // Edge indices connecting the 8 corners
        const edgeIndices = [
            [0, 1], [1, 3], [3, 2], [2, 0], // Bottom face
            [4, 5], [5, 7], [7, 6], [6, 4], // Top face
            [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting edges
        ];
        
        return edgeIndices.map(pair => ({
            start: corners[pair[0]],
            end: corners[pair[1]]
        }));
    }

    // Calculate minimum distance between two line segments
    static lineSegmentDistance(p1, p2, p3, p4) {
        try {
            const u = p2.clone().sub(p1);
            const v = p4.clone().sub(p3);
            const w = p1.clone().sub(p3);
            
            const a = u.dot(u);
            const b = u.dot(v);
            const c = v.dot(v);
            const d = u.dot(w);
            const e = v.dot(w);
            
            const D = a * c - b * b;
            let sc, tc;
            
            // Compute the line parameters of the two closest points
            if (D < 1e-8) {
                // Lines are almost parallel
                sc = 0.0;
                tc = (b > c ? d / b : e / c);
            } else {
                sc = (b * e - c * d) / D;
                tc = (a * e - b * d) / D;
            }
            
            // Get the closest points
            sc = Math.max(0, Math.min(1, sc)); // Clamp sc between 0 and 1
            tc = Math.max(0, Math.min(1, tc)); // Clamp tc between 0 and 1
            
            const closest1 = p1.clone().addScaledVector(u, sc);
            const closest2 = p3.clone().addScaledVector(v, tc);
            
            // Return the distance
            return {
                distance: closest1.distanceTo(closest2),
                closestPoints: [closest1, closest2]
            };
        } catch (err) {
            console.error("Error in lineSegmentDistance:", err);
            return { distance: Infinity, closestPoints: [null, null] };
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

            const speed = player.velocity.length();
            if (speed === 0) return null; // No movement, no collision
            
            const effectiveSpeed = Math.min(speed, 20); // Cap speed for collision detection
            
            // CRITICAL FIX: More accurate OBB collision detection for player handle
            try {
                const playerOBB = new OBB();
                // ENHANCED: Use accurate size to reflect actual player collision volume
                const playerBox = new Box3().setFromCenterAndSize(
                    new Vector3(0, 0, 0),
                    new Vector3(1.8, 2.2, 1.8) // Full 3D volume of player
                );
                playerOBB.fromBox3(playerBox);
                
                // Apply player's world matrix to properly orient the OBB
                if (player.handle && player.handle.matrixWorld) {
                    // Check matrixWorld for NaN values
                    const elements = player.handle.matrixWorld.elements;
                    let hasNaN = false;
                    
                    for (let i = 0; i < 16; i++) {
                        if (isNaN(elements[i]) || !isFinite(elements[i])) {
                            hasNaN = true;
                            break;
                        }
                    }
                    
                    if (hasNaN) {
                        console.warn("Player matrix contains NaN values, using fallback");
                        // Use simple translation matrix instead
                        playerOBB.applyMatrix4(new Matrix4().makeTranslation(
                            player.position.x, player.position.y, player.position.z
                        ));
                    } else {
                        // Use complete matrix world from handle for proper orientation
                        playerOBB.applyMatrix4(player.handle.matrixWorld);
                    }
                } else {
                    // Fallback to simple translation matrix if matrixWorld isn't available
                    const playerMatrix = new Matrix4().makeTranslation(
                        player.position.x, player.position.y, player.position.z
                    );
                    playerOBB.applyMatrix4(playerMatrix);
                }

                const potentialCollisions = [];
                
                // ENHANCED: Use continuous collision detection with swept volumes
                const numSteps = Math.max(1, Math.ceil(speed / 3)); // More substeps for higher precision
                const subStepSize = timeStep / numSteps;

                // Store previous player position to calculate swept volume
                const startPos = player.position.clone();
                const endPos = startPos.clone().addScaledVector(player.velocity, timeStep);
                
                // IMPROVED: Use ray casting for continuous collision detection
                const movementRay = new Ray(startPos, player.velocity.clone().normalize());
                const movementDistance = player.velocity.length() * timeStep;
                
                for (let step = 0; step < numSteps; step++) {
                    // Calculate position at this substep
                    const stepPosition = player.position.clone().addScaledVector(
                        player.velocity, 
                        (step * subStepSize) / timeStep
                    );
                    
                    // Calculate next position for swept volume
                    const nextStepPosition = player.position.clone().addScaledVector(
                        player.velocity,
                        ((step + 1) * subStepSize) / timeStep
                    );
                    
                    // Position the player OBB at this step
                    const stepMatrix = new Matrix4().makeTranslation(
                        stepPosition.x, stepPosition.y, stepPosition.z
                    );
                    
                    if (player.handle && player.handle.quaternion) {
                        const rotMatrix = new Matrix4().makeRotationFromQuaternion(player.handle.quaternion);
                        stepMatrix.multiply(rotMatrix);
                    }
                    
                    // Clone and apply matrix to OBB for this step
                    const worldPlayerOBB = playerOBB.clone().applyMatrix4(stepMatrix);
                    
                    // Process all objects (walls and non-walls together)
                    for (let i = 0; i < objects.length; i++) {
                        const item = objects[i];
                        
                        // Skip invalid objects
                        if (!item || !item.object || !item.aabb) continue;
                        
                        // Get object dimensions from userData or AABB
                        let objectSize = this.getObjectDimensions(item);
                        
                        // IMPROVED: Get accurate OBB size rather than just max dimension
                        const objectHalfSize = item.obb ? item.obb.halfSize.clone() : 
                                              new Vector3(objectSize.x/2, objectSize.y/2, objectSize.z/2);
                        
                        // Calculate adjusted threshold based on actual 3D shape
                        // Factor in all dimensions not just the maximum
                        const playerHalfSize = new Vector3(1.8/2, 2.2/2, 1.8/2);
                        
                        // NEW: Use more accurate distance calculation based on actual shapes
                        // Instead of just distance between centers
                        const minDistance = this.getMinimumDistanceBetweenOBBs(worldPlayerOBB, item.obb);
                        
                        // Check if we're close enough to consider collisions
                        const proximityThreshold = 3.0; // More generous threshold for walls
                        if (minDistance > proximityThreshold) continue;
                        
                        // Update collision bounds for more accurate detection
                        this.updateCollidableBounds(item.object);
                        
                        // IMPROVED: Test for intersection using multiple methods
                        let intersects = false;
                        let collisionMethod = "";
                        let closestPoint = null;
                        
                        try {
                            // METHOD 1: Primary OBB-OBB intersection test
                            intersects = worldPlayerOBB.intersectsOBB(item.obb);
                            if (intersects) collisionMethod = "obb-direct";
                            
                            // METHOD 2: If method 1 fails, test for corner penetration
                            if (!intersects) {
                                // Test all 8 corners of player OBB against wall OBB
                                const playerCorners = this.getOBBCorners(worldPlayerOBB);
                                for (const corner of playerCorners) {
                                    if (this.isPointInOBB(corner, item.obb)) {
                                        intersects = true;
                                        collisionMethod = "player-corner-in-wall";
                                        closestPoint = corner.clone();
                                        break;
                                    }
                                }
                                
                                // Test all 8 corners of wall OBB against player OBB
                                if (!intersects) {
                                    const itemCorners = this.getOBBCorners(item.obb);
                                    for (const corner of itemCorners) {
                                        if (this.isPointInOBB(corner, worldPlayerOBB)) {
                                            intersects = true;
                                            collisionMethod = "wall-corner-in-player";
                                            closestPoint = corner.clone();
                                            break;
                                        }
                                    }
                                }
                            }
                            
                            // NEW: METHOD 3 - Test for swept volume intersection
                            if (!intersects && step < numSteps - 1) {
                                // Create expanded OBB that encompasses both current and next position
                                const sweptCollision = this.checkSweptVolumeCollision(
                                    worldPlayerOBB, 
                                    stepPosition, 
                                    nextStepPosition,
                                    item.obb
                                );
                                
                                if (sweptCollision.collides) {
                                    intersects = true;
                                    collisionMethod = "swept-volume";
                                    closestPoint = sweptCollision.point;
                                }
                            }
                            
                            // NEW: METHOD 4 - Edge-to-edge testing (crucial for thin objects)
                            if (!intersects) {
                                const edgeCollision = this.checkEdgeCollision(worldPlayerOBB, item.obb);
                                if (edgeCollision.collides) {
                                    intersects = true;
                                    collisionMethod = "edge-to-edge";
                                    closestPoint = edgeCollision.point;
                                }
                            }
                            
                            // NEW: METHOD 5 - SAT algorithm for more accurate collision
                            if (!intersects) {
                                const satResult = this.runSATTest(worldPlayerOBB, item.obb);
                                if (satResult.collides) {
                                    intersects = true;
                                    collisionMethod = "sat-test";
                                    closestPoint = satResult.point;
                                }
                            }
                            
                            // NEW: METHOD 6 - Fast moving object - ray cast against OBB
                            // Critical for detecting collisions with thin objects at high speed
                            if (!intersects && speed > 5) {
                                // Get item OBB as a box3 for ray intersection test
                                const itemBox = this.obbToBox3(item.obb);
                                
                                // Transform ray to object local space for easier intersection test
                                const localRay = movementRay.clone();
                                localRay.origin.sub(item.obb.center);
                                localRay.origin.applyMatrix3(this.getInverseRotationMatrix(item.obb.rotation));
                                localRay.direction.applyMatrix3(this.getInverseRotationMatrix(item.obb.rotation));
                                
                                // Box3 in local space
                                const localBox = new Box3(
                                    new Vector3(-item.obb.halfSize.x, -item.obb.halfSize.y, -item.obb.halfSize.z),
                                    new Vector3(item.obb.halfSize.x, item.obb.halfSize.y, item.obb.halfSize.z)
                                );
                                
                                // Test ray intersection with box
                                const intersection = localRay.intersectBox(localBox, new Vector3());
                                if (intersection) {
                                    // Transform intersection back to world space
                                    intersection.applyMatrix3(item.obb.rotation);
                                    intersection.add(item.obb.center);
                                    
                                    // Check if intersection is within movement distance
                                    const distToIntersection = movementRay.origin.distanceTo(intersection);
                                    if (distToIntersection <= movementDistance) {
                                        intersects = true;
                                        collisionMethod = "ray-cast";
                                        closestPoint = intersection.clone();
                                    }
                                }
                            }

                            // Debug: Log successful collision detection
                            if (intersects && this._debugEnabled) {
                                console.log(`Collision with ${item.type} using method: ${collisionMethod}`);
                            }
                        } catch (err) {
                            console.error(`Error in collision detection for ${item.type}:`, err);
                            continue;
                        }
                        
                        if (intersects) {
                            try {
                                // Determine contact point based on collision method
                                let contactPoint;
                                if (closestPoint) {
                                    contactPoint = closestPoint;
                                } else {
                                    contactPoint = this.findContactPoint(worldPlayerOBB, item.obb, stepPosition);
                                }
                                
                                // Calculate collision time
                                const distToIntersection = stepPosition.distanceTo(contactPoint);
                                const time = (step * subStepSize) + (distToIntersection / (effectiveSpeed || 0.001));

                                // Store collision data
                                if (time <= timeStep) {
                                    potentialCollisions.push({
                                        time,
                                        object: item,
                                        position: contactPoint.clone(),
                                        method: collisionMethod,
                                        isWall: false,
                                        penetration: 1.5  // Stronger response for walls
                                    });
                                }
                            } catch (err) {
                                console.error(`Error processing collision:`, err);
                            }
                        }
                    }
                }
                
                // Sort and select best collision
                if (potentialCollisions.length > 0) {
                    // Sort by time
                    potentialCollisions.sort((a, b) => a.time - b.time);
                    
                    // Take the collision with the smallest time that passes distance validation
                    for (const collision of potentialCollisions) {
                        closestTime = collision.time;
                        closestObject = collision.object;
                        closestPosition = collision.position;
                        
                        // Log collision with wall or vehicle
                        if (typeof window !== 'undefined' && window.gameNotify && 
                            closestObject.type !== player._lastCollidedWith) {
                            window.gameNotify(`Collision with ${closestObject.type}`);
                            player._lastCollidedWith = closestObject.type;
                            setTimeout(() => { player._lastCollidedWith = null; }, 2000);
                        }
                        
                        break; // Take the first valid collision
                    }
                }
                
            } catch (err) {
                console.error("Error in collision detection setup:", err);
                return null;
            }
            
            if (closestPosition === null) return null;
            
            try {
                // Get more accurate collision normal by using OBB face normal
                const collisionNormal = this.getOBBNormalAtPoint(
                    closestPosition, 
                    closestObject.obb,
                    closestObject.object
                ).normalize();
                
                // ENHANCED: More detailed collision logging for any collision type
                if (this._debugEnabled) {
                    // Create a type-specific identifier
                    let objectIdentifier = closestObject.type;
                    
                    // Add vehicle-specific details
                    if (closestObject.type === 'vehicle') {
                        if (closestObject.object.userData) {
                            objectIdentifier = `${closestObject.object.userData.type || 'vehicle'} "${closestObject.object.userData.name || 'unnamed'}"`;
                        }
                    }
                    
                    console.log(`PLAYER COLLISION WITH ${objectIdentifier.toUpperCase()}`);
                    console.log(`Collision details:
                      - Object type: ${closestObject.type}
                      - Object ID: ${closestObject.object.uuid.substring(0, 8)}
                      - Distance: ${player.position.distanceTo(closestObject.object.position).toFixed(2)} units
                      - Impact time: ${closestTime.toFixed(3)}s
                      - Normal: [${collisionNormal.x.toFixed(2)}, ${collisionNormal.y.toFixed(2)}, ${collisionNormal.z.toFixed(2)}]
                      - Player position: [${player.position.x.toFixed(1)}, ${player.position.y.toFixed(1)}, ${player.position.z.toFixed(1)}]
                      - Object position: [${closestObject.object.position.x.toFixed(1)}, ${closestObject.object.position.y.toFixed(1)}, ${closestObject.object.position.z.toFixed(1)}]
                    `);
                }
                
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

    // NEW: Find the 8 corners of an OBB
    static getOBBCorners(obb) {
        if (!obb || !obb.center || !obb.halfSize || !obb.rotation) {
            console.warn("Invalid OBB provided to getOBBCorners");
            return [];
        }
        
        try {
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
            
            return corners;
        } catch (err) {
            console.error("Error in getOBBCorners:", err);
            return [];
        }
    }

    // NEW: Validate OBB
    static validateOBB(obb, object) {
        if (!obb) return false;
        
        // Check for required properties
        if (!obb.center || !obb.halfSize || !obb.rotation) {
            return false;
        }
        
        // Check for NaN values in center
        if (isNaN(obb.center.x) || isNaN(obb.center.y) || isNaN(obb.center.z)) {
            return false;
        }
        
        // Check for NaN values in halfSize
        if (isNaN(obb.halfSize.x) || isNaN(obb.halfSize.y) || isNaN(obb.halfSize.z)) {
            return false;
        }
        
        // Check if rotation matrix exists and is valid
        if (!obb.rotation || !obb.rotation.elements || obb.rotation.elements.length !== 9) {
            return false;
        }
        
        // Check rotation matrix for NaN values
        for (let i = 0; i < 9; i++) {
            if (isNaN(obb.rotation.elements[i])) {
                return false;
            }
        }
        
        return true;
    }
    
    // NEW: Get minimum distance between OBBs
    static getMinimumDistanceBetweenOBBs(obb1, obb2) {
        if (!obb1 || !obb2) return Infinity;
        
        // If either OBB is invalid, return a large distance
        if (!this.validateOBB(obb1) || !this.validateOBB(obb2)) {
            return Infinity;
        }
        
        // Simple center distance approximation
        return obb1.center.distanceTo(obb2.center);
    }
    
    // NEW: Check if a point is inside an OBB
    static isPointInOBB(point, obb) {
        if (!point || !obb) return false;
        
        try {
            // Find local coordinates by inverting the OBB transformation
            const localPoint = point.clone().sub(obb.center);
            localPoint.applyMatrix3(this.getInverseRotationMatrix(obb.rotation));
            
            // Check if point is inside box in local space
            return (
                Math.abs(localPoint.x) <= obb.halfSize.x &&
                Math.abs(localPoint.y) <= obb.halfSize.y &&
                Math.abs(localPoint.z) <= obb.halfSize.z
            );
        } catch (err) {
            console.error("Error in isPointInOBB:", err);
            return false;
        }
    }
    
    // NEW: Get OBB normal at a point
    static getOBBNormalAtPoint(point, obb, object) {
        if (!point || !obb) return new Vector3(0, 1, 0);
        
        try {
            // Simple approximation - use direction from OBB center to point
            if (!this.isPointInOBB(point, obb)) {
                return new Vector3().subVectors(point, obb.center).normalize();
            }
            
            // If point is inside OBB, find closest face
            const localPoint = point.clone().sub(obb.center);
            localPoint.applyMatrix3(this.getInverseRotationMatrix(obb.rotation));
            
            // Distances to each face (normalized by halfSize)
            const dx = Math.abs(localPoint.x / obb.halfSize.x);
            const dy = Math.abs(localPoint.y / obb.halfSize.y);
            const dz = Math.abs(localPoint.z / obb.halfSize.z);
            
            // Find the closest face and get its normal
            let localNormal;
            if (dx > dy && dx > dz) {
                localNormal = new Vector3(Math.sign(localPoint.x), 0, 0);
            } else if (dy > dx && dy > dz) {
                localNormal = new Vector3(0, Math.sign(localPoint.y), 0);
            } else {
                localNormal = new Vector3(0, 0, Math.sign(localPoint.z));
            }
            
            // Transform normal to world space
            const worldNormal = localNormal.clone().applyMatrix3(obb.rotation).normalize();
            
            return worldNormal;
        } catch (err) {
            console.error("Error in getOBBNormalAtPoint:", err);
            return new Vector3(0, 1, 0);
        }
    }
    
    // NEW: Find closest point on OBB to a given point
    static findClosestPointOnOBB(point, obb, object) {
        if (!point || !obb) return point.clone();
        
        try {
            // Transform point to local space
            const localPoint = point.clone().sub(obb.center);
            localPoint.applyMatrix3(this.getInverseRotationMatrix(obb.rotation));
            
            // Clamp to OBB bounds
            const clampedPoint = new Vector3(
                Math.max(-obb.halfSize.x, Math.min(obb.halfSize.x, localPoint.x)),
                Math.max(-obb.halfSize.y, Math.min(obb.halfSize.y, localPoint.y)),
                Math.max(-obb.halfSize.z, Math.min(obb.halfSize.z, localPoint.z))
            );
            
            // Transform back to world space
            clampedPoint.applyMatrix3(obb.rotation);
            clampedPoint.add(obb.center);
            
            return clampedPoint;
        } catch (err) {
            console.error("Error in findClosestPointOnOBB:", err);
            return point.clone();
        }
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
                console.log("Attempting to fix missing player collidable");
                
                // Find the player by handle
                const player = window.PlayersManager.players.find(p => p && p.handle === object);
                if (player) {
                    console.log("Found player for handle - reinitializing collider");
                    window.PlayersManager.initializePlayerCollider(player, true);
                    return true;
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
                console.warn("Object has invalid matrix - resetting position", object.name || object.uuid);
                object.matrix.identity();
                // Keep position if valid
                if (!isNaN(object.position.x) && !isNaN(object.position.y) && !isNaN(object.position.z)) {
                    object.updateMatrix();
                }
            }
        }
        
        try {
            // Update the AABB of the collidable to match the object's new bounds
            collidable.aabb.setFromObject(object);
            
            // Update the OBB to match the new AABB
            collidable.obb.fromBox3(collidable.aabb);
            collidable.obb.applyMatrix4(object.matrixWorld);
            
            return true;
        } catch (err) {
            console.error("Error updating collidable bounds:", err);
            return false;
        }
    }
    
    // NEW: Validate a collidable object is properly registered
    static validateCollidable(object) {
        if (!object) return false;
        
        const collidable = this.collidableObjects.find(c => c && c.object === object);
        return !!collidable;
    }

    // NEW: Calculate projection of OBB onto an axis for SAT collision test
    static projectOBB(obb, axis) {
        if (!obb || !obb.halfSize || !obb.rotation) {
            console.warn("Cannot project invalid OBB");
            return 0;
        }
        
        try {
            // Get local axes from OBB rotation matrix
            const xAxis = new Vector3(obb.rotation.elements[0], obb.rotation.elements[1], obb.rotation.elements[2]);
            const yAxis = new Vector3(obb.rotation.elements[3], obb.rotation.elements[4], obb.rotation.elements[5]);
            const zAxis = new Vector3(obb.rotation.elements[6], obb.rotation.elements[7], obb.rotation.elements[8]);
            
            // Calculate projection by summing the absolute projections of each local axis
            const projection = 
                Math.abs(obb.halfSize.x * axis.dot(xAxis)) +
                Math.abs(obb.halfSize.y * axis.dot(yAxis)) +
                Math.abs(obb.halfSize.z * axis.dot(zAxis));
                
            return projection;
        } catch (err) {
            console.error("Error projecting OBB:", err);
            return 0;
        }
    }

    // ENHANCED: Improved SAT test that handles wide objects better
    static runSATTest(obb1, obb2) {
        try {
            // If either OBB is invalid, exit early
            if (!obb1 || !obb2 || !obb1.center || !obb2.center || 
                !obb1.halfSize || !obb2.halfSize || 
                !obb1.rotation || !obb2.rotation) {
                return { collides: false };
            }

            // ENHANCED: Calculate aspect ratios to detect wide objects
            const aspect1 = Math.max(obb1.halfSize.x, obb1.halfSize.z) / Math.min(obb1.halfSize.x, obb1.halfSize.z);
            const aspect2 = Math.max(obb2.halfSize.x, obb2.halfSize.z) / Math.min(obb2.halfSize.x, obb2.halfSize.z);
            
            // If we have a wide object (high aspect ratio), use more rigorous testing
            const isWideObject = aspect1 > 5 || aspect2 > 5;
            
            // Get axes to test (face normals from both OBBs)
            const axes = [];
            
            // Add face normal axes from OBB1
            axes.push(new Vector3(obb1.rotation.elements[0], obb1.rotation.elements[1], obb1.rotation.elements[2]));
            axes.push(new Vector3(obb1.rotation.elements[3], obb1.rotation.elements[4], obb1.rotation.elements[5]));
            axes.push(new Vector3(obb1.rotation.elements[6], obb1.rotation.elements[7], obb1.rotation.elements[8]));
            
            // Add face normal axes from OBB2
            axes.push(new Vector3(obb2.rotation.elements[0], obb2.rotation.elements[1], obb2.rotation.elements[2]));
            axes.push(new Vector3(obb2.rotation.elements[3], obb2.rotation.elements[4], obb2.rotation.elements[5]));
            axes.push(new Vector3(obb2.rotation.elements[6], obb2.rotation.elements[7], obb2.rotation.elements[8]));
            
            // ENHANCED: For wide objects, add more edge cross products to increase test accuracy
            const crossProductTests = isWideObject ? 9 : 3; // More tests for wide objects
            
            // Add cross product axes (edge tests)
            for (let i = 0; i < crossProductTests; i++) {
                const axis1 = new Vector3(
                    obb1.rotation.elements[i*3], 
                    obb1.rotation.elements[i*3+1], 
                    obb1.rotation.elements[i*3+2]
                );
                
                for (let j = 0; j < crossProductTests; j++) {
                    const axis2 = new Vector3(
                        obb2.rotation.elements[j*3], 
                        obb2.rotation.elements[j*3+1], 
                        obb2.rotation.elements[j*3+2]
                    );
                    
                    const cross = new Vector3().crossVectors(axis1, axis2);
                    if (cross.lengthSq() > 1e-6) { // Only use if non-zero
                        cross.normalize();
                        axes.push(cross);
                    }
                }
            }
            
            // Test each axis for separation
            let minPenetration = Infinity;
            let minAxis = null;
            
            for (const axis of axes) {
                // Project both OBBs onto the axis
                const projection1 = this.projectOBB(obb1, axis);
                const projection2 = this.projectOBB(obb2, axis);
                
                // Calculate distance between centers along axis
                const centerDist = obb2.center.clone().sub(obb1.center).dot(axis);
                
                // Calculate overlap
                const overlap = projection1 + projection2 - Math.abs(centerDist);
                
                // If no overlap on any axis, objects don't intersect
                if (overlap <= 0) {
                    return { collides: false };
                }
                
                // Keep track of the minimum penetration
                if (overlap < minPenetration) {
                    minPenetration = overlap;
                    minAxis = axis.clone();
                }
            }
            
            // ENHANCEMENT: For wide objects, add final direct plane test
            if (isWideObject) {
                // Check if player is intersecting with the wide flat surface plane
                // by using a more precise plane-vs-OBB intersection test
                const result = this.checkWideObjectPlaneIntersection(obb1, obb2);
                if (result.collides) {
                    return result;
                }
            }
            
            // If we got here, there's no separating axis, so the OBBs intersect
            // Calculate contact point using axis of minimum penetration
            const contactNormal = minAxis.clone();
            if (obb1.center.clone().sub(obb2.center).dot(contactNormal) < 0) {
                contactNormal.negate(); // Ensure normal points from obb2 to obb1
            }
            
            // Find closest point on obb2 to obb1 along contact normal
            const supportPoint = obb2.center.clone().addScaledVector(contactNormal, -this.projectOBB(obb2, contactNormal));
            
            return {
                collides: true,
                point: supportPoint,
                penetration: minPenetration,
                normal: contactNormal
            };
        } catch (err) {
            console.error("Error in SAT test:", err);
            return { collides: false };
        }
    }
    
    // NEW: Special test for wide, flat objects using plane intersection
    static checkWideObjectPlaneIntersection(obb1, obb2) {
        try {
            // Determine which OBB might be a wide flat object
            let wideObb, otherObb;
            
            // Check aspect ratios to identify the wide object
            const aspect1x = obb1.halfSize.x / obb1.halfSize.y;
            const aspect1z = obb1.halfSize.z / obb1.halfSize.y;
            const aspect2x = obb2.halfSize.x / obb2.halfSize.y;
            const aspect2z = obb2.halfSize.z / obb2.halfSize.y;
            
            // Check if either object is wide and flat (much wider than tall)
            const isObb1Wide = (aspect1x > 5 || aspect1z > 5) && obb1.halfSize.y < 1.5;
            const isObb2Wide = (aspect2x > 5 || aspect2z > 5) && obb2.halfSize.y < 1.5;
            
            // If neither is wide and flat, return no collision
            if (!isObb1Wide && !isObb2Wide) {
                return { collides: false };
            }
            
            // Assign wide and other OBB
            if (isObb1Wide) {
                wideObb = obb1;
                otherObb = obb2;
            } else {
                wideObb = obb2;
                otherObb = obb1;
            }
            
            // Get the up-facing normal of the wide object (typically Y-axis)
            const upNormal = new Vector3(
                wideObb.rotation.elements[3],
                wideObb.rotation.elements[4], 
                wideObb.rotation.elements[5]
            ).normalize();
            
            // Create a plane from the wide object's surface
            const planePoint = wideObb.center.clone();
            // Offset from center to top surface based on halfSize
            planePoint.addScaledVector(upNormal, wideObb.halfSize.y);
            
            // Get all corners of the other OBB
            const corners = this.getOBBCorners(otherObb);
            
            // Check if any corner is below the plane (within halfSize.y of the wide object)
            let belowPlanePoints = [];
            let abovePlanePoints = [];
            
            for (const corner of corners) {
                // Vector from plane point to corner
                const toCorner = corner.clone().sub(planePoint);
                
                // Calculate signed distance to plane
                const signedDistance = toCorner.dot(upNormal);
                
                // Store points based on which side of the plane they're on
                if (signedDistance <=0) {
                    belowPlanePoints.push(corner);
                } else if (signedDistance <= wideObb.halfSize.y * 2) {
                    // Also track points that are just above the plane
                    abovePlanePoints.push({
                        point: corner,
                        distance: signedDistance
                    });
                }
            }
            
            // If we have points below the plane, we have a collision
            if (belowPlanePoints.length > 0) {
                // Find the point with the greatest penetration
                let deepestPoint = belowPlanePoints[0];
                let maxPenetration = -Infinity;
                
                for (const point of belowPlanePoints) {
                    const penetration = -point.clone().sub(planePoint).dot(upNormal);
                    if (penetration > maxPenetration) {
                        maxPenetration = penetration;
                        deepestPoint = point;
                    }
                }
                
                return {
                    collides: true,
                    point: deepestPoint.clone(),
                    normal: isObb1Wide ? upNormal.clone() : upNormal.clone().negate(),
                    penetration: maxPenetration,
                    method: "plane-intersection"
                };
            }
            
            // No intersection with the plane
            return { collides: false };
        } catch (err) {
            console.error("Error in wide object plane intersection test:", err);
            return { collides: false };
        }
    }

    // ENHANCED: Better edge collision detection especially for wide objects
    static checkEdgeCollision(obb1, obb2) {
        try {
            // Get edges for both OBB
            const edges1 = this.getOBBEdges(obb1);
            const edges2 = this.getOBBEdges(obb2);
            
            // Early exit if we don't have edges
            if (edges1.length === 0 || edges2.length === 0) {
                return { collides: false };
            }
            
            // ENHANCED: Calculate aspect ratios to detect wide objects
            const aspect1 = Math.max(obb1.halfSize.x, obb1.halfSize.z) / Math.min(obb1.halfSize.y, 1.0);
            const aspect2 = Math.max(obb2.halfSize.x, obb2.halfSize.z) / Math.min(obb2.halfSize.y, 1.0);
            
            // Use smaller threshold for wide objects, larger for regular objects
            const threshold = (aspect1 > 5 || aspect2 > 5) ? 0.2 : 0.35;
            
            // Test all edge pairs with improved logic for wide objects
            let minDistance = Infinity;
            let closestPoint1 = null;
            let closestPoint2 = null;
            let closestEdge1 = null;
            let closestEdge2 = null;
            
            // ENHANCED: First check edges that are likely to be involved in wide object collisions
            const priorityEdges1 = edges1.filter(e => {
                // Get edge direction
                const dir = e.end.clone().sub(e.start).normalize();
                // Check if this is a horizontal edge (Y component close to 0)
                return Math.abs(dir.y) < 0.3;
            });
            
            const priorityEdges2 = edges2.filter(e => {
                const dir = e.end.clone().sub(e.start).normalize();
                return Math.abs(dir.y) < 0.3;
            });
            
            // Check priority edges first if we have wide objects
            if ((aspect1 > 5 || aspect2 > 5) && priorityEdges1.length > 0 && priorityEdges2.length > 0) {
                for (const edge1 of priorityEdges1) {
                    for (const edge2 of priorityEdges2) {
                        // Find closest points between these two edges
                        const result = this.closestPointsBetweenLines(
                            edge1.start, edge1.end, 
                            edge2.start, edge2.end
                        );
                        
                        const distance = result.distance;
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestPoint1 = result.point1;
                            closestPoint2 = result.point2;
                            closestEdge1 = edge1;
                            closestEdge2 = edge2;
                        }
                    }
                }
            }
            
            // If we didn't find close enough edges in the priority check, check all edges
            if (minDistance > threshold) {
                for (const edge1 of edges1) {
                    for (const edge2 of edges2) {
                        // Find closest points between these two edges
                        const result = this.closestPointsBetweenLines(
                            edge1.start, edge1.end, 
                            edge2.start, edge2.end
                        );
                        
                        const distance = result.distance;
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestPoint1 = result.point1;
                            closestPoint2 = result.point2;
                            closestEdge1 = edge1;
                            closestEdge2 = edge2;
                        }
                    }
                }
            }
            
            // ENHANCED: Special handling for very wide, flat objects with vertical edges
            if (minDistance > threshold && (aspect1 > 10 || aspect2 > 10)) {
                // For extremely wide objects, check if vertical edges might be colliding
                const verticalEdges1 = edges1.filter(e => {
                    const dir = e.end.clone().sub(e.start).normalize();
                    return Math.abs(dir.y) > 0.7; // Mostly vertical
                });
                
                const verticalEdges2 = edges2.filter(e => {
                    const dir = e.end.clone().sub(e.start).normalize();
                    return Math.abs(dir.y) > 0.7; // Mostly vertical
                });
                
                // Check vertical edges with a more lenient threshold
                const verticalThreshold = 0.8;
                for (const edge1 of verticalEdges1) {
                    for (const edge2 of verticalEdges2) {
                        const result = this.closestPointsBetweenLines(
                            edge1.start, edge1.end, 
                            edge2.start, edge2.end
                        );
                        
                        if (result.distance < verticalThreshold && result.distance < minDistance) {
                            minDistance = result.distance;
                            closestPoint1 = result.point1;
                            closestPoint2 = result.point2;
                            closestEdge1 = edge1;
                            closestEdge2 = edge2;
                        }
                    }
                }
            }

            // If distance is small enough, we have a collision
            if (minDistance <= threshold) {
                // Calculate collision normal from closest points
                const normal = new Vector3()
                    .subVectors(closestPoint1, closestPoint2)
                    .normalize();
                
                return {
                    collides: true,
                    point: new Vector3().addVectors(closestPoint1, closestPoint2).multiplyScalar(0.5),
                    distance: minDistance,
                                       normal: normal,
                    method: "edge-collision"
                };
            }
            
            return { collides: false };
        } catch (err) {
            console.error("Error in edge collision detection:", err);
            return { collides: false };
        }
    }

    // IMPROVED: Get better OBB dimensions from actual object properties
    static getObjectDimensions(item) {
        let objectSize = new Vector3(2, 2, 2); // Default
        
        try {
            // First try to get precise dimensions from userData for walls and vehicles
            if (item.object.userData) {
                // Check for wall dimensions first
                if (item.object.userData.wallWidth && item.object.userData.wallHeight && item.object.userData.wallDepth) {
                    return new Vector3(
                        item.object.userData.wallWidth,
                        item.object.userData.wallHeight,
                        item.object.userData.wallDepth
                    );
                }
                
                // Check for vehicle dimensions
                if (item.object.userData.width && item.object.userData.height && item.object.userData.depth) {
                    return new Vector3(
                        item.object.userData.width,
                        item.object.userData.height,
                        item.object.userData.depth
                    );
                }
                
                // Check for type-specific dimensions
                if (item.object.userData.type === 'testCube' && item.object.userData.originalSize) {
                    return new Vector3(
                        item.object.userData.originalSize.width,
                        item.object.userData.originalSize.height,
                        item.object.userData.originalSize.depth
                    );
                }
            }
            
            // If we have an OBB with valid halfSize, use that
            if (item.obb && item.obb.halfSize) {
                return new Vector3(
                    item.obb.halfSize.x * 2,
                    item.obb.halfSize.y * 2,
                    item.obb.halfSize.z * 2
                );
            } 
            
            // As a last resort, calculate from AABB
            if (item.aabb) {
                const size = item.aabb.getSize(new Vector3());
                if (!isNaN(size.x) && !isNaN(size.y) && !isNaN(size.z)) {
                    objectSize = size;
                }
            }
        } catch (err) {
            console.warn("Error getting object dimensions:", err);
        }
        
        return objectSize;
    }

    // NEW: Method to find contact point between two OBBs
    static findContactPoint(obb1, obb2) {
        try {
            let minDist = Infinity;
            let contactPoints = null;

            const edges1 = this.getOBBEdges(obb1);
            const edges2 = this.getOBBEdges(obb2);

            for (const e1 of edges1) {
                for (const e2 of edges2) {
                    // lineSegmentDistance should return distance and closest points
                    const result = this.lineSegmentDistance(e1.start, e1.end, e2.start, e2.end);
                    if (result.distance < minDist) {
                        minDist = result.distance;
                        contactPoints = {
                            point1: result.closestPoints[0],
                            point2: result.closestPoints[1],
                            distance: result.distance
                        };
                    }
                }
            }

            return contactPoints;
        } catch (error) {
            console.error("Error in findContactPoint:", error);
            return null;
        }
    }

    static getInverseRotationMatrix(obb) {
        if (!obb || !obb.rotation) {
            console.warn("Missing OBB or OBB.rotation, returning identity matrix");
            return new Matrix3().identity();
        }
        const inverseMat = new Matrix3();
        inverseMat.copy(obb.rotation);
        inverseMat.invert();
        return inverseMat;
    }
}