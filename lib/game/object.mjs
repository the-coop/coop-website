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
    Float32BufferAttribute
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
                        
                        // Check if this is a wall for special handling
                        const isWall = item.type === 'wall';
                        
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
                        const proximityThreshold = isWall ? 5.0 : 3.0; // More generous threshold for walls
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
                                if (isWall) {
                                    console.log(`  Wall dimensions: ${objectSize.x.toFixed(1)}x${objectSize.y.toFixed(1)}x${objectSize.z.toFixed(1)}`);
                                }
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
                                        isWall: isWall,
                                        penetration: isWall ? 3.0 : 1.5  // Stronger response for walls
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
                    // First prioritize walls, then sort by time
                    potentialCollisions.sort((a, b) => {
                        // Wall collisions take precedence regardless of time
                        if (a.isWall && !b.isWall) return -1;
                        if (!a.isWall && b.isWall) return 1;
                        // If both are walls or both are not walls, sort by time
                        return a.time - b.time;
                    });
                    
                    // ADDED: Debug log of potential collisions when debug is enabled
                    if (this._debugEnabled && potentialCollisions.length > 1) {
                        console.log(`DEBUG: Found ${potentialCollisions.length} potential collisions:`);
                        potentialCollisions.forEach((collision, index) => {
                            console.log(`  [${index}] Type: ${collision.object.type}, Time: ${collision.time.toFixed(3)}, Distance: ${collision.distance.toFixed(2)}`);
                        });
                    }
                    
                    // Take the collision with the smallest time that passes distance validation
                    for (const collision of potentialCollisions) {
                        // For walls, we trust the collision detection more
                        if (collision.isWall) {
                            closestTime = collision.time;
                            closestObject = collision.object;
                            closestPosition = collision.position;
                            
                            if (this._debugEnabled) {
                                console.log(`Wall collision selected as primary collision`);
                            }
                            
                            break; // Prioritize wall collision
                        }
                        
                        // For other objects, apply more validation
                        const sizeToDistRatio = collision.objectSize / Math.max(0.1, collision.distance);
                        
                        // If an object is far away but small, it's suspicious
                        if (collision.distance > 20 && sizeToDistRatio < 0.1) {
                            if (this._debugEnabled) {
                                console.warn(
                                    `Skipping suspicious collision with ${collision.object.type} at ` +
                                    `distance ${collision.distance.toFixed(2)} (size ratio: ${sizeToDistRatio.toFixed(2)})`
                                );
                            }
                            continue;
                        }
                        
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
                    
                    // Add wall-specific details
                    if (closestObject.type === 'wall') {
                        if (closestObject.object.userData && closestObject.object.userData.wallData) {
                            const wallData = closestObject.object.userData.wallData;
                            objectIdentifier = `wall at lat=${wallData.latitude?.toFixed(1) || '?'}, lon=${wallData.longitude?.toFixed(1) || '?'}`;
                        }
                    }
                    
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
                
                // For wall collisions, include increased penetration depth info
                // for stronger collision response
                if (closestObject.type === 'wall') {
                    return {
                        collisionNormal,
                        collisionPosition: closestPosition,
                        closestObject,
                        closestTime,
                        isWallCollision: true,
                        penetration: 3.0 // INCREASED from 2.0 to 3.0 for stronger wall response
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
            return closest1.distanceTo(closest2);
        } catch (err) {
            console.error("Error in lineSegmentDistance:", err);
            return Infinity;
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
                        
                        // Check if this is a wall for special handling
                        const isWall = item.type === 'wall';
                        
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
                        const proximityThreshold = isWall ? 5.0 : 3.0; // More generous threshold for walls
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
                                if (isWall) {
                                    console.log(`  Wall dimensions: ${objectSize.x.toFixed(1)}x${objectSize.y.toFixed(1)}x${objectSize.z.toFixed(1)}`);
                                }
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
                                        isWall: isWall,
                                        penetration: isWall ? 3.0 : 1.5  // Stronger response for walls
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
                    // First prioritize walls, then sort by time
                    potentialCollisions.sort((a, b) => {
                        // Wall collisions take precedence regardless of time
                        if (a.isWall && !b.isWall) return -1;
                        if (!a.isWall && b.isWall) return 1;
                        // If both are walls or both are not walls, sort by time
                        return a.time - b.time;
                    });
                    
                    // ADDED: Debug log of potential collisions when debug is enabled
                    if (this._debugEnabled && potentialCollisions.length > 1) {
                        console.log(`DEBUG: Found ${potentialCollisions.length} potential collisions:`);
                        potentialCollisions.forEach((collision, index) => {
                            console.log(`  [${index}] Type: ${collision.object.type}, Time: ${collision.time.toFixed(3)}, Distance: ${collision.distance.toFixed(2)}`);
                        });
                    }
                    
                    // Take the collision with the smallest time that passes distance validation
                    for (const collision of potentialCollisions) {
                        // For walls, we trust the collision detection more
                        if (collision.isWall) {
                            closestTime = collision.time;
                            closestObject = collision.object;
                            closestPosition = collision.position;
                            
                            if (this._debugEnabled) {
                                console.log(`Wall collision selected as primary collision`);
                            }
                            
                            break; // Prioritize wall collision
                        }
                        
                        // For other objects, apply more validation
                        const sizeToDistRatio = collision.objectSize / Math.max(0.1, collision.distance);
                        
                        // If an object is far away but small, it's suspicious
                        if (collision.distance > 20 && sizeToDistRatio < 0.1) {
                            if (this._debugEnabled) {
                                console.warn(
                                    `Skipping suspicious collision with ${collision.object.type} at ` +
                                    `distance ${collision.distance.toFixed(2)} (size ratio: ${sizeToDistRatio.toFixed(2)})`
                                );
                            }
                            continue;
                        }
                        
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
                    
                    // Add wall-specific details
                    if (closestObject.type === 'wall') {
                        if (closestObject.object.userData && closestObject.object.userData.wallData) {
                            const wallData = closestObject.object.userData.wallData;
                            objectIdentifier = `wall at lat=${wallData.latitude?.toFixed(1) || '?'}, lon=${wallData.longitude?.toFixed(1) || '?'}`;
                        }
                    }
                    
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
                
                // For wall collisions, include increased penetration depth info
                // for stronger collision response
                if (closestObject.type === 'wall') {
                    return {
                        collisionNormal,
                        collisionPosition: closestPosition,
                        closestObject,
                        closestTime,
                        isWallCollision: true,
                        penetration: 3.0 // INCREASED from 2.0 to 3.0 for stronger wall response
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

    // NEW: Implement full SAT (Separating Axis Theorem) test for OBBs
    static runSATTest(obb1, obb2) {
        try {
            // If either OBB is invalid, exit early
            if (!obb1 || !obb2 || !obb1.center || !obb2.center || 
                !obb1.halfSize || !obb2.halfSize || 
                !obb1.rotation || !obb2.rotation) {
                return { collides: false };
            }
            
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
            
            // Add cross product axes (edge tests)
            for (let i = 0; i < 3; i++) {
                const axis1 = new Vector3(
                    obb1.rotation.elements[i*3], 
                    obb1.rotation.elements[i*3+1], 
                    obb1.rotation.elements[i*3+2]
                );
                
                for (let j = 0; j < 3; j++) {
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
            
            // If we got here, there's no separating axis, so the OBBs intersect
            // Calculate contact point using axis of minimum penetration
            const contactNormal = minAxis.clone();
            if (obb1.center.clone().sub(obb2.center).dot(contactNormal) < 0) {
                contactNormal.negate(); // Ensure normal points from obb2 to obb1
            }
            
            // Find closest point on obb2 to obb1 along contact normal
            const supportPoint = obb2.center.clone().addScaledVector(contactNormal, -projection2);
            
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
    
    // NEW: Get inverse rotation matrix for a rotation matrix
    static getInverseRotationMatrix(rotationMatrix) {
        // For rotation matrices, transpose = inverse
        const inverse = rotationMatrix.clone();
        inverse.transpose();
        return inverse;
    }

    // NEW: Convert OBB to Box3 for ray casting
    static obbToBox3(obb) {
        if (!obb) return new Box3();
        
        // Create box centered at origin with correct dimensions
        return new Box3(
            new Vector3(-obb.halfSize.x, -obb.halfSize.y, -obb.halfSize.z),
            new Vector3(obb.halfSize.x, obb.halfSize.y, obb.halfSize.z)
        );
    }

    // NEW: Better OBB dimensions helper
    static getObjectDimensions(item) {
        let objectSize = new Vector3(2, 2, 2); // Default
        
        try {
            if (item.object.userData && 
                item.object.userData.wallWidth && 
                item.object.userData.wallHeight && 
                item.object.userData.wallDepth) {
                // Use precise dimensions from userData
                objectSize.set(
                    item.object.userData.wallWidth,
                    item.object.userData.wallHeight,
                    item.object.userData.wallDepth
                );
            } 
            else if (item.obb && item.obb.halfSize) {
                // Get size from OBB halfSize
                objectSize.set(
                    item.obb.halfSize.x * 2,
                    item.obb.halfSize.y * 2,
                    item.obb.halfSize.z * 2
                );
            }
            else if (item.aabb) {
                // Calculate from AABB
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

    // NEW: Check swept volume collision between two positions
    static checkSweptVolumeCollision(obb, startPos, endPos, targetObb) {
        try {
            // Calculate movement vector
            const movement = endPos.clone().sub(startPos);
            const movementLen = movement.length();
            
            // Early exit if no movement
            if (movementLen < 0.0001) {
                return { collides: false };
            }
            
            // Get normalized movement direction
            const movementDir = movement.clone().divideScalar(movementLen);
            
            // Cast ray from start position in movement direction
            const ray = new Ray(startPos, movementDir);
            
            // Test if ray intersects target OBB
            // We'll need to convert OBB to box3 in local space
            const localRay = ray.clone();
            
            // Transform ray to OBB local space
            localRay.origin.sub(targetObb.center);
            localRay.origin.applyMatrix3(this.getInverseRotationMatrix(targetObb.rotation));
            localRay.direction.applyMatrix3(this.getInverseRotationMatrix(targetObb.rotation));
            
            // Create local space box3
            const localBox = new Box3(
                new Vector3(-targetObb.halfSize.x, -targetObb.halfSize.y, -targetObb.halfSize.z),
                new Vector3(targetObb.halfSize.x, targetObb.halfSize.y, targetObb.halfSize.z)
            );
            
            // Test ray intersection with box
            const intersection = localRay.intersectBox(localBox, new Vector3());
            if (intersection) {
                // Transform intersection back to world space
                intersection.applyMatrix3(targetObb.rotation);
                intersection.add(targetObb.center);
                
                // Check if intersection is within movement distance
                const distToIntersection = startPos.distanceTo(intersection);
                
                if (distToIntersection <= movementLen + obb.halfSize.length()) {
                    return { 
                        collides: true, 
                        point: intersection,
                        distance: distToIntersection
                    };
                }
            }
            
            return { collides: false };
        } catch (err) {
            console.error("Error in swept volume collision:", err);
            return { collides: false };
        }
    }

    // NEW: Advanced edge-to-edge collision detection
    static checkEdgeCollision(obb1, obb2) {
        try {
            // Get edges for both OBBs
            const edges1 = this.getOBBEdges(obb1);
            const edges2 = this.getOBBEdges(obb2);
            
            // Early exit if we don't have edges
            if (edges1.length === 0 || edges2.length === 0) {
                return { collides: false };
            }
            
            // Test all edge pairs
            let minDistance = Infinity;
            let closestPoint1 = null;
            let closestPoint2 = null;
            
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
                    }
                }
            }
            
            // Use threshold based on object sizes
            const threshold = 0.3; // Adjust based on testing

            if (minDistance <= threshold) {
                return {
                    collides: true,
                    point: new Vector3().addVectors(closestPoint1, closestPoint2).multiplyScalar(0.5),
                    distance: minDistance
                };
            }
            
            return { collides: false };
        } catch (err) {
            console.error("Error in edge collision detection:", err);
            return { collides: false };
        }
    }

    // NEW: Find closest points between two line segments
    static closestPointsBetweenLines(a1, a2, b1, b2) {
        try {
            // Line directions
            const d1 = a2.clone().sub(a1);
            const d2 = b2.clone().sub(b1);
            
            // Line lengths
            const l1 = d1.length();
            const l2 = d2.length();
            
            // Early out for degenerate lines
            if (l1 < 1e-6 || l2 < 1e-6) {
                const dist = a1.distanceTo(b1);
                return { 
                    distance: dist, 
                    point1: a1.clone(),
                    point2: b1.clone()
                };
            }
            
            // Normalize directions
            const d1n = d1.clone().divideScalar(l1);
            const d2n = d2.clone().divideScalar(l2);
            
            // Vector connecting line origins
            const r = a1.clone().sub(b1);
            
            // Compute dot products
            const a = d1n.dot(d1n); // Always 1 since normalized
            const b = d1n.dot(d2n);
            const c = d2n.dot(d2n); // Always 1 since normalized
            const d = d1n.dot(r);
            const e = d2n.dot(r);
            
            // Compute parameters for closest points
            const denom = a*c - b*b;
            
            // Handle parallel lines
            let s, t;
            if (denom < 1e-8) {
                // Lines are nearly parallel
                s = 0.0;
                t = (b > c ? d / b : e / c);
            } else {
                s = (b*e - c*d) / denom;
                t = (a*e - b*d) / denom;
            }
            
            // Clamp parameters to line segments
            s = Math.max(0, Math.min(1, s));
            t = Math.max(0, Math.min(1, t));
            
            // Find closest points
            const point1 = a1.clone().addScaledVector(d1n, s);
            const point2 = b1.clone().addScaledVector(d2n, t);
            
            // Calculate distance
            const distance = point1.distanceTo(point2);
            
            return {
                distance,
                point1,
                point2
            };
        } catch (err) {
            console.error("Error in closestPointsBetweenLines:", err);
            return { 
                distance: Infinity,
                point1: new Vector3(),
                point2: new Vector3()
            };
        }
    }

    // NEW: Find contact point between two OBBs
    static findContactPoint(obb1, obb2, fallbackPoint) {
        if (!obb1 || !obb2) return fallbackPoint.clone();
        
        try {
            // Get the 8 corners of each OBB
            const corners1 = this.getOBBCorners(obb1);
            const corners2 = this.getOBBCorners(obb2);
            
            let closestDist = Infinity;
            let closestPoint1 = null;
            let closestPoint2 = null;
            
            // Find the closest pair of corners
            for (const c1 of corners1) {
                for (const c2 of corners2) {
                    const dist = c1.distanceToSquared(c2);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestPoint1 = c1;
                        closestPoint2 = c2;
                    }
                }
            }
            
            // Return the midpoint between the closest corners
            if (closestPoint1 && closestPoint2) {
                return new Vector3().addVectors(closestPoint1, closestPoint2).multiplyScalar(0.5);
            }
            
            // If we couldn't find corners (shouldn't happen), use the midpoint between centers
            return new Vector3().addVectors(obb1.center, obb2.center).multiplyScalar(0.5);
        } catch (err) {
            console.error("Error finding contact point:", err);
            return fallbackPoint.clone();
        }
    }

    // Update the OBB corners function to ensure it gets all 8 corners properly
    static getOBBCorners(obb) {
        if (!obb || !obb.center || !obb.halfSize || !obb.rotation) {
            return [];
        }

        try {
            const corners = [];
            const center = obb.center;
            const halfSize = obb.halfSize;
            const rotation = obb.rotation;

            // Get the three local axes of the OBB
            const xAxis = new Vector3(rotation.elements[0], rotation.elements[1], rotation.elements[2]);
            const yAxis = new Vector3(rotation.elements[3], rotation.elements[4], rotation.elements[5]);
            const zAxis = new Vector3(rotation.elements[6], rotation.elements[7], rotation.elements[8]);

            // Calculate all 8 corners of the OBB using the center, halfSize, and axes
            // Each corner is at center +/- xAxis*halfSize.x +/- yAxis*halfSize.y +/- zAxis*halfSize.z
            for (let i = 0; i < 8; i++) {
                const xSign = (i & 1) ? 1 : -1;
                const ySign = (i & 2) ? 1 : -1;
                const zSign = (i & 4) ? 1 : -1;
                
                const corner = new Vector3(center.x, center.y, center.z)
                    .addScaledVector(xAxis, xSign * halfSize.x)
                    .addScaledVector(yAxis, ySign * halfSize.y)
                    .addScaledVector(zAxis, zSign * halfSize.z);
                
                corners.push(corner);
            }
            
            return corners;
        } catch (err) {
            console.error("Error in getOBBCorners:", err);
            return [];
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
}