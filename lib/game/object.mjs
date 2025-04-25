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

    // Helper function to validate coordinates and vectors for NaN values
    static validateVector(vector, defaultValue = new Vector3(0, 1, 0)) {
        if (!vector) return defaultValue.clone();
        
        // Check if any component is NaN or infinite
        if (isNaN(vector.x) || isNaN(vector.y) || isNaN(vector.z) ||
            !isFinite(vector.x) || !isFinite(vector.y) || !isFinite(vector.z)) {
            console.warn("Invalid vector detected:", vector);
            return defaultValue.clone();
        }
        
        return vector;
    }
    
    // Safely update a box's bounds without causing NaN values
    static safeUpdateBounds(geometry, object) {
        if (!geometry) return null;
        
        try {
            // Create a fresh Box3
            const box = new Box3();
            
            // Check if the geometry has valid positions before computing bounds
            if (geometry.attributes && geometry.attributes.position) {
                const positions = geometry.attributes.position.array;
                
                // Check for NaN values in position array
                let hasNaN = false;
                for (let i = 0; i < positions.length; i++) {
                    if (isNaN(positions[i]) || !isFinite(positions[i])) {
                        hasNaN = true;
                        break;
                    }
                }
                
                if (hasNaN) {
                    console.warn("Geometry contains NaN position values, using fallback bounds");
                    // Create a default small box around the object's position
                    if (object && object.position) {
                        const pos = object.position;
                        box.min.set(pos.x - 1, pos.y - 1, pos.z - 1);
                        box.max.set(pos.x + 1, pos.y + 1, pos.z + 1);
                    } else {
                        box.min.set(-1, -1, -1);
                        box.max.set(1, 1, 1);
                    }
                    return box;
                }
            }
            
            // Try to compute bounds normally
            try {
                box.setFromObject(object);
                
                // Validate the resulting box for NaN values
                if (isNaN(box.min.x) || isNaN(box.max.x) || 
                    isNaN(box.min.y) || isNaN(box.max.y) ||
                    isNaN(box.min.z) || isNaN(box.max.z)) {
                    
                    console.warn("Box computation resulted in NaN values, using fallback");
                    if (object && object.position) {
                        const pos = object.position;
                        box.min.set(pos.x - 1, pos.y - 1, pos.z - 1);
                        box.max.set(pos.x + 1, pos.y + 1, pos.z + 1);
                    } else {
                        box.min.set(-1, -1, -1);
                        box.max.set(1, 1, 1);
                    }
                }
                
                return box;
            } catch (err) {
                console.error("Error computing bounding box:", err);
                // Return a default box
                if (object && object.position) {
                    const pos = object.position;
                    box.min.set(pos.x - 1, pos.y - 1, pos.z - 1);
                    box.max.set(pos.x + 1, pos.y + 1, pos.z + 1);
                } else {
                    box.min.set(-1, -1, -1);
                    box.max.set(1, 1, 1);
                }
                return box;
            }
        } catch (err) {
            console.error("Critical error in safeUpdateBounds:", err);
            const box = new Box3();
            box.min.set(-1, -1, -1);
            box.max.set(1, 1, 1);
            return box;
        }
    }

    // Update a collidable object's bounding box (needed when objects move)
    static updateCollidableBounds(object) {
        if (!object) {
            console.warn("updateCollidableBounds called with null object");
            return false;
        }
        
        const collidable = this.collidableObjects.find(c => c && c.object === object);
        if (!collidable) {
            return false;
        }
        
        try {
            // ADDED: Calculate surface normal for the object based on its planet
            let surfaceNormal = null;
            if (object.userData && object.userData.planet) {
                const planetCenter = object.userData.planet.object.position;
                const toObject = object.position.clone().sub(planetCenter);
                surfaceNormal = this.validateVector(toObject.normalize());
                
                // Store surface normal in object userData for later use
                object.userData.surfaceNormal = surfaceNormal;
            }
            
            if (collidable.aabb) {
                // IMPROVED: Use safer bounds computation to avoid NaN values
                let updatedBox;
                
                // Use the physics handle if available for more accurate bounds
                if (object.userData && object.userData.physicsHandle) {
                    try {
                        updatedBox = this.safeUpdateBounds(object.userData.physicsHandle.geometry, 
                                                          object.userData.physicsHandle);
                    } catch (err) {
                        console.warn("Error setting AABB from physics handle:", err);
                        // Fallback to main object
                        updatedBox = this.safeUpdateBounds(object.geometry, object);
                    }
                } else {
                    updatedBox = this.safeUpdateBounds(object.geometry, object);
                }
                
                // Update the collidable's AABB if we got a valid box
                if (updatedBox) {
                    collidable.aabb = updatedBox;
                }
                
                // Update OBB based on current object state
                if (!collidable.obb) {
                    collidable.obb = new OBB();
                }
                
                try {
                    // IMPROVED: Safely create OBB from AABB with NaN value checks
                    try {
                        collidable.obb.fromBox3(collidable.aabb);
                    } catch (err) {
                        console.warn("Error creating OBB from AABB, using direct dimensions");
                        
                        // Get size from AABB, with NaN checks
                        const center = new Vector3();
                        const size = new Vector3();
                        
                        collidable.aabb.getCenter(center);
                        collidable.aabb.getSize(size);
                        
                        // Validate center and size for NaN values
                        if (isNaN(center.x) || isNaN(center.y) || isNaN(center.z)) {
                            center.copy(object.position || new Vector3());
                        }
                        
                        if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z) ||
                            size.x === 0 || size.y === 0 || size.z === 0) {
                            size.set(2, 2, 2); // Default size
                        }
                        
                        // Set OBB properties directly
                        collidable.obb.center.copy(center);
                        collidable.obb.halfSize.copy(size).multiplyScalar(0.5);
                        
                        // Use identity rotation if we can't get the object's
                        if (object.quaternion) {
                            const rotMatrix = new Matrix4().makeRotationFromQuaternion(object.quaternion);
                            collidable.obb.rotation.setFromMatrix4(rotMatrix);
                        }
                    }
                    
                    // Safety check for matrix world
                    if (!object.matrixWorld) {
                        console.warn("Object missing matrixWorld in updateCollidableBounds");
                        
                        // Create a fallback matrix using object's position and rotation
                        const fallbackMatrix = new Matrix4().compose(
                            object.position || new Vector3(),
                            object.quaternion || new Quaternion(),
                            object.scale || new Vector3(1, 1, 1)
                        );
                        
                        collidable.obb.applyMatrix4(fallbackMatrix);
                    } else {
                        // Check matrixWorld for NaN values
                        const elements = object.matrixWorld.elements;
                        let hasNaN = false;
                        
                        for (let i = 0; i < 16; i++) {
                            if (isNaN(elements[i]) || !isFinite(elements[i])) {
                                hasNaN = true;
                                break;
                            }
                        }
                        
                        if (hasNaN) {
                            console.warn("Object matrixWorld contains NaN values, using fallback");
                            
                            // Create a fallback matrix using object's position and rotation
                            const fallbackMatrix = new Matrix4().compose(
                                object.position || new Vector3(),
                                object.quaternion || new Quaternion(),
                                object.scale || new Vector3(1, 1, 1)
                            );
                            
                            collidable.obb.applyMatrix4(fallbackMatrix);
                        } else {
                            // IMPROVED: When on planet, ensure OBB aligns with planet surface normal
                            if (surfaceNormal) {
                                // Create a matrix that aligns the OBB with the planet surface
                                const alignmentMatrix = new Matrix4();
                                
                                // Get object's world position
                                const objPos = new Vector3();
                                object.getWorldPosition(objPos);
                                
                                // Validate position for NaN values
                                if (isNaN(objPos.x) || isNaN(objPos.y) || isNaN(objPos.z)) {
                                    objPos.copy(object.position || new Vector3());
                                }
                                
                                // Get object's world rotation that should already be aligned to planet
                                const objQuat = object.quaternion ? object.quaternion.clone() : new Quaternion();
                                
                                // Create matrix with correct position and rotation
                                alignmentMatrix.compose(
                                    objPos,
                                    objQuat,
                                    object.scale ? object.scale.clone() : new Vector3(1, 1, 1)
                                );
                                
                                // Apply this properly aligned matrix to the OBB
                                collidable.obb.applyMatrix4(alignmentMatrix);
                            } else {
                                // Regular matrix application for non-planet objects
                                collidable.obb.applyMatrix4(object.matrixWorld);
                            }
                        }
                    }
                    
                    // Final validation for OBB components
                    this.validateOBB(collidable.obb, object);
                } catch (err) {
                    console.error("Error updating OBB from AABB:", err);
                    // If OBB update fails, create a simple box at object position
                    const center = new Vector3();
                    collidable.aabb.getCenter(center);
                    const size = new Vector3();
                    collidable.aabb.getSize(size);
                    
                    // Validate center and size for NaN values
                    if (isNaN(center.x) || isNaN(center.y) || isNaN(center.z)) {
                        center.copy(object.position || new Vector3());
                    }
                    
                    if (isNaN(size.x) || isNaN(size.y) || isNaN(size.z) ||
                        size.x === 0 || size.y === 0 || size.z === 0) {
                        size.set(2, 2, 2); // Default size
                    }
                    
                    collidable.obb.center.copy(center);
                    collidable.obb.halfSize.copy(size).multiplyScalar(0.5);
                }
                
                // If this object has a boxHelper, update it too
                if (object.userData && object.userData.boxHelper) {
                    object.userData.boxHelper.box.copy(collidable.aabb);
                }
                
                // Update OBB visualization if enabled
                this.updateOBBVisualizer(collidable);
                
                return true;
            }
        } catch (err) {
            console.error("Critical error in updateCollidableBounds:", err);
        }
        
        return false;
    }
    
    // Validate an OBB to ensure it has no NaN values
    static validateOBB(obb, object) {
        if (!obb) return false;
        
        try {
            // Check center for NaN values
            if (!obb.center || isNaN(obb.center.x) || isNaN(obb.center.y) || isNaN(obb.center.z)) {
                console.warn("OBB has invalid center, using fallback");
                obb.center = object && object.position ? object.position.clone() : new Vector3();
            }
            
            // Check halfSize for NaN values
            if (!obb.halfSize || isNaN(obb.halfSize.x) || isNaN(obb.halfSize.y) || isNaN(obb.halfSize.z) ||
                obb.halfSize.x === 0 || obb.halfSize.y === 0 || obb.halfSize.z === 0) {
                console.warn("OBB has invalid halfSize, using fallback");
                obb.halfSize = new Vector3(1, 1, 1);
            }
            
            // Check rotation matrix for NaN values
            if (!obb.rotation) {
                console.warn("OBB missing rotation, using identity");
                obb.rotation = new Matrix3().identity();
                return false;
            }
            
            // Check rotation matrix elements
            const elements = obb.rotation.elements;
            let hasNaN = false;
            
            for (let i = 0; i < 9; i++) {
                if (isNaN(elements[i]) || !isFinite(elements[i])) {
                    hasNaN = true;
                    break;
                }
            }
            
            if (hasNaN) {
                console.warn("OBB has invalid rotation matrix, using identity");
                obb.rotation.identity();
                return false;
            }
            
            return true;
        } catch (err) {
            console.error("Error validating OBB:", err);
            return false;
        }
    }

    // Improved findClosestPointOnOBB with robust NaN handling
    static findClosestPointOnOBB(point, obb, object) {
        if (!point) {
            console.warn("findClosestPointOnOBB called with null point");
            return new Vector3();
        }
        
        if (!obb || !obb.center) {
            console.warn("Invalid OBB in findClosestPointOnOBB");
            return point.clone();
        }
        
        try {
            // Validate the input point for NaN values
            if (isNaN(point.x) || isNaN(point.y) || isNaN(point.z)) {
                console.warn("Input point contains NaN values, using fallback");
                return object ? object.position.clone() : new Vector3();
            }
            
            // Validate OBB components
            if (!this.validateOBB(obb, object)) {
                console.warn("OBB validation failed, returning original point");
                return point.clone();
            }
            
            // Transform point to OBB local space
            const localPoint = point.clone().sub(obb.center);
            
            // Safety check for rotation matrix
            if (!obb.rotation) {
                console.warn("OBB missing rotation matrix");
                return point.clone();
            }
            
            try {
                // Convert world-space point to OBB local space
                localPoint.applyMatrix3(obb.rotation.clone().transpose());
                
                // Validate the transformed point
                if (isNaN(localPoint.x) || isNaN(localPoint.y) || isNaN(localPoint.z)) {
                    console.warn("Point transformation resulted in NaN values, using fallback");
                    return object ? object.position.clone() : point.clone();
                }
            } catch (err) {
                console.error("Error applying rotation transpose:", err);
                return point.clone();
            }
            
            // Safety check for halfSize
            if (!obb.halfSize) {
                console.warn("OBB missing halfSize");
                return point.clone();
            }
            
            // Get halfSize with safety checks
            const halfSizeX = isNaN(obb.halfSize.x) ? 1 : obb.halfSize.x || 1;
            const halfSizeY = isNaN(obb.halfSize.y) ? 1 : obb.halfSize.y || 1;
            const halfSizeZ = isNaN(obb.halfSize.z) ? 1 : obb.halfSize.z || 1;
            
            // Clamp point to OBB bounds with safety checks for NaN
            const clampedPoint = new Vector3(
                Math.max(-halfSizeX, Math.min(halfSizeX, localPoint.x)),
                Math.max(-halfSizeY, Math.min(halfSizeY, localPoint.y)),
                Math.max(-halfSizeZ, Math.min(halfSizeZ, localPoint.z))
            );
            
            // Validate clamped point
            if (isNaN(clampedPoint.x) || isNaN(clampedPoint.y) || isNaN(clampedPoint.z)) {
                console.warn("Clamping resulted in NaN values, using fallback");
                return point.clone();
            }
            
            // Transform back to world space
            try {
                clampedPoint.applyMatrix3(obb.rotation);
                
                // Validate result
                if (isNaN(clampedPoint.x) || isNaN(clampedPoint.y) || isNaN(clampedPoint.z)) {
                    console.warn("Return to world space resulted in NaN, using fallback");
                    return point.clone();
                }
            } catch (err) {
                console.error("Error applying rotation to clamped point:", err);
                return point.clone();
            }
            
            // Add OBB center with validation
            const result = clampedPoint.add(obb.center);
            
            // Final validation
            if (isNaN(result.x) || isNaN(result.y) || isNaN(result.z)) {
                console.warn("Final result contains NaN values, using fallback");
                return point.clone();
            }
            
            // DEBUG: Add distance information
            if (this._debugEnabled) {
                const dist = point.distanceTo(result);
                if (!isNaN(dist) && dist < 5) {
                    console.log(`Distance to closest point on OBB: ${dist.toFixed(2)}`);
                }
            }
            
            return result;
        } catch (err) {
            console.error("Critical error in findClosestPointOnOBB:", err);
            return point.clone(); // Return original point if anything fails
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
                // IMPROVED: Further increase collision box size for better wall detection
                const playerBox = new Box3().setFromCenterAndSize(
                    new Vector3(0, 0, 0),
                    new Vector3(1.5, 2.0, 1.5) // Larger collision shape for more reliable wall detection
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

                // CRITICAL FIX: Debug visualization of player's collision box
                if (this._debugEnabled && player.handle) {
                    // Show the OBB bounds for debugging
                    const boxHelper = new Box3Helper(playerBox, 0xff0000);
                    boxHelper.visible = true;
                    boxHelper.position.copy(player.position);
                    if (this._debugHelpers) {
                        this._debugHelpers.push(boxHelper);
                        Engine.scene.add(boxHelper);
                    }
                }
                
                // ENHANCED: Add visualization for wall collision detection
                if (this._debugEnabled) {
                    // Count walls for debug info
                    const wallCount = objects.filter(o => o.type === 'wall').length;
                    if (wallCount > 0) {
                        console.log(`Checking collisions with ${wallCount} walls`);
                    }
                }
                
                const potentialCollisions = [];
                
                // Check collision with multi-step interpolation for better accuracy
                const numSteps = Math.max(1, Math.ceil(speed / 5)); 
                const subStepSize = timeStep / numSteps;
                
                for (let step = 0; step < numSteps; step++) {
                    // Calculate position at this substep
                    const stepPosition = player.position.clone().addScaledVector(
                        player.velocity, 
                        (step * subStepSize) / timeStep
                    );
                    
                    // Position the player OBB at this step
                    const stepMatrix = new Matrix4().makeTranslation(
                        stepPosition.x, stepPosition.y, stepPosition.z
                    );
                    
                    if (player.handle && player.handle.quaternion) {
                        const rotMatrix = new Matrix4().makeRotationFromQuaternion(player.handle.quaternion);
                        stepMatrix.multiply(rotMatrix);
                    }
                    
                    const worldPlayerOBB = playerOBB.clone().applyMatrix4(stepMatrix);
                    
                    // CRITICAL FIX: More aggressive wall collision detection
                    for (let i = 0; i < objects.length; i++) {
                        const item = objects[i];
                        
                        // Skip invalid objects
                        if (!item || !item.object || !item.aabb) {
                            continue;
                        }
                        
                        // IMPROVED: Special handling for wall collision - higher priority
                        const isWall = item.type === 'wall';
                        
                        // FIXED: Calculate the actual size of the object's OBB with NaN safety checks
                        let objectSize = new Vector3(2, 2, 2); // Default fallback size
                        try {
                            const tempSize = item.aabb.getSize(new Vector3());
                            
                            // Validate size for NaN values
                            if (!isNaN(tempSize.x) && !isNaN(tempSize.y) && !isNaN(tempSize.z) &&
                                isFinite(tempSize.x) && isFinite(tempSize.y) && isFinite(tempSize.z)) {
                                objectSize = tempSize;
                            } else {
                                console.warn(`Object ${item.type} has invalid size, using default`);
                            }
                        } catch (err) {
                            console.warn("Error getting object size:", err);
                        }
                        
                        const objectMaxDimension = Math.max(objectSize.x, objectSize.y, objectSize.z) || 2;
                        const playerSize = 1.8; // Enlarged player collision size for more reliable detection
                        
                        // Calculate threshold with safety checks
                        const buffer = isWall ? Math.max(3, objectMaxDimension) : 2.0;
                        const distanceThreshold = objectMaxDimension + playerSize + buffer;
                        
                        // Get distance to object center with NaN safety check
                        let distToObject;
                        try {
                            distToObject = player.position.distanceTo(item.object.position);
                            if (isNaN(distToObject)) {
                                console.warn("Distance calculation resulted in NaN, using fallback");
                                distToObject = 100; // Large value to effectively skip this object
                            }
                        } catch (err) {
                            console.warn("Error in distance calculation:", err);
                            distToObject = 100; // Skip this object
                        }
                        
                        // Debug wall collision distances when debug mode is enabled
                        if (isWall && this._debugEnabled) {
                            console.log(`Wall debug: distance=${distToObject.toFixed(2)}, threshold=${distanceThreshold.toFixed(2)}, dimensions=${objectSize.x.toFixed(1)}x${objectSize.y.toFixed(1)}x${objectSize.z.toFixed(1)}`);
                        }
                        
                        // ADDED: Always log wall distances for improved debugging
                        if (isWall) {
                            console.log(`Wall distance: ${distToObject.toFixed(2)}, threshold: ${distanceThreshold.toFixed(2)}`);
                        }
                        
                        // Skip objects that are clearly too far away
                        // For walls, use an increased threshold based on wall dimensions
                        if (distToObject > distanceThreshold * (isWall ? 3.0 : 1.0)) {
                            continue;
                        }
                        
                        // CRITICAL FIX: Update wall bounds every check for more accurate collision
                        if (isWall) {
                            this.updateCollidableBounds(item.object);
                            
                            // Validate OBB after update
                            this.validateOBB(item.obb, item.object);
                            
                            // ADDED: Log wall OBB details
                            console.log(`Wall OBB center: ${item.obb.center.x.toFixed(2)}, ${item.obb.center.y.toFixed(2)}, ${item.obb.center.z.toFixed(2)}`);
                            console.log(`Wall OBB halfSize: ${item.obb.halfSize.x.toFixed(2)}, ${item.obb.halfSize.y.toFixed(2)}, ${item.obb.halfSize.z.toFixed(2)}`);
                        }

                        // ENHANCED: Multiple intersection tests for more reliable detection
                        let intersects = false;
                        try {
                            // FIXED: Use the stepPosition-based OBB for more accurate collision
                            const worldPlayerOBB = playerOBB.clone();
                            worldPlayerOBB.applyMatrix4(stepMatrix);
                            
                            // 1. Try main OBB-OBB intersection check first
                            intersects = worldPlayerOBB.intersectsOBB(item.obb);
                            
                            // 2. Check if at least one corner of the player OBB is inside the wall OBB
                            if (!intersects && isWall) {
                                // This is a more lenient test for walls
                                const corners = this.getOBBCorners(worldPlayerOBB);
                                for (const corner of corners) {
                                    if (this.isPointInOBB(corner, item.obb)) {
                                        intersects = true;
                                        console.log("Detected wall collision via corner test");
                                        break;
                                    }
                                }
                            }
                            
                            // 3. Check if player's center is very close to wall
                            if (!intersects && isWall) {
                                // Find the closest point on the wall OBB to the player position
                                const closestPoint = this.findClosestPointOnOBB(stepPosition, item.obb, item.object);
                                const distToClosestPoint = stepPosition.distanceTo(closestPoint);
                                
                                // Enhanced: Use much more aggressive distance check for walls to prevent tunneling
                                // If we're very close to the wall (within 1.8 units), consider it a collision
                                if (distToClosestPoint < 2.0) {
                                    intersects = true;
                                    console.log(`Wall collision detected via close distance check: ${distToClosestPoint.toFixed(2)} units`);
                                }
                            }
                            
                            // Debug after checking intersection
                            if (isWall && intersects) {
                                console.log(`WALL INTERSECTION DETECTED!`);
                            }
                        } catch (err) {
                            console.error(`OBB intersection error with ${item.type}:`, err);
                            continue;
                        }
                        
                        if (intersects) {
                            try {
                                // Find accurate intersection point
                                const contactPoint = this.findClosestPointOnOBB(stepPosition, item.obb, item.object);
                                
                                // Calculate time to intersection based on distance
                                const distToIntersection = stepPosition.distanceTo(contactPoint);
                                const time = (step * subStepSize) + (distToIntersection / (effectiveSpeed || 0.001));
                                
                                // Store all potential collisions to sort by distance and time
                                if (time <= timeStep) {
                                    potentialCollisions.push({
                                        time,
                                        object: item,
                                        position: contactPoint.clone(),
                                        distance: distToObject,
                                        objectSize: objectMaxDimension,
                                        isWall: isWall, // Flag to prioritize wall collisions
                                        penetration: isWall ? 2.0 : 1.0 // Stronger penetration response for walls
                                    });
                                }
                            } catch (err) {
                                console.error(`Error processing collision contact point:`, err);
                                continue;
                            }
                        }
                    }
                }
                
                // Sort potential collisions by time to find the closest one
                // MODIFIED: Prioritize wall collisions over other types
                if (potentialCollisions.length > 0) {
                    // First prioritize walls, then sort by time
                    potentialCollisions.sort((a, b) => {
                        // Wall collisions take precedence regardless of time
                        if (a.isWall && !b.isWall) return -1;
                        if (!a.isWall && b.isWall) return 1;
                        // If both are walls or both are not walls, sort by time
                        return a.time - b.time;
                    });
                    
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
                
                // ADDED: Log collision details for debugging
                if (closestObject.type === 'wall') {
                    console.log(`Wall collision details:
                        - Collision normal: ${collisionNormal.x.toFixed(2)}, ${collisionNormal.y.toFixed(2)}, ${collisionNormal.z.toFixed(2)}
                        - Collision position: ${closestPosition.x.toFixed(2)}, ${closestPosition.y.toFixed(2)}, ${closestPosition.z.toFixed(2)}
                        - Player position: ${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)}
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
                
                // For wall collisions, include penetration depth info
                if (closestObject.type === 'wall') {
                    return {
                        collisionNormal,
                        collisionPosition: closestPosition,
                        closestObject,
                        closestTime,
                        isWallCollision: true,
                        penetration: 2.0 // Stronger penetration for walls
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

    // ADDED: New helper method to get all 8 corners of an OBB
    static getOBBCorners(obb) {
        if (!obb || !obb.center || !obb.halfSize || !obb.rotation) {
            return [];
        }
        
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
    }

    // ADDED: Helper method to check if a point is inside an OBB
    static isPointInOBB(point, obb) {
        if (!point || !obb || !obb.center || !obb.halfSize || !obb.rotation) {
            return false;
        }
        
        try {
            // Convert point to OBB local space
            const localPoint = point.clone().sub(obb.center);
            localPoint.applyMatrix3(obb.rotation.clone().transpose());
            
            // Check if point is inside the box bounds
            return (
                Math.abs(localPoint.x) <= (obb.halfSize.x + 0.1) && // Adding small epsilon
                Math.abs(localPoint.y) <= (obb.halfSize.y + 0.1) &&
                Math.abs(localPoint.z) <= (obb.halfSize.z + 0.1)
            );
        } catch (err) {
            console.error("Error in isPointInOBB:", err);
            return false;
        }
    }

    // Create a wall on a planet at the specified latitude and longitude
    static createWall(planet, objectData) {
        if (!planet || !planet.radius || !planet.object) {
            console.error("Cannot create wall: invalid planet data");
            return null;
        }
        
        if (!objectData || typeof objectData.latitude !== 'number' || typeof objectData.longitude !== 'number') {
            console.error("Cannot create wall: missing position data - requires numeric latitude and longitude");
            return null;
        }
        
        try {
            console.log(`Creating wall on ${planet.name} at lat=${objectData.latitude}, lon=${objectData.longitude}`);
            
            // Get scale factor from objectData or use default of 1.0
            const scaleFactor = objectData.scale || 1.0;
            
            const planetRadius = planet.radius;
            const wallHeight = planetRadius * 0.05 * scaleFactor;  // Scale wall height
            const wallWidth = planetRadius * 0.2 * scaleFactor;    // Scale wall width
            const wallDepth = planetRadius * 0.025 * scaleFactor;  // Scale wall depth
            
            console.log(`Wall dimensions: ${wallWidth.toFixed(1)} x ${wallHeight.toFixed(1)} x ${wallDepth.toFixed(1)}`);
            
            // Create the wall geometry and material
            const geometry = new BoxGeometry(wallWidth, wallHeight, wallDepth);
            const material = new MeshBasicMaterial({ 
                color: 0x8844aa, 
                wireframe: false
            });
            
            // Create the mesh
            const wall = new Mesh(geometry, material);
            
            // Add metadata to the wall object
            wall.userData = {
                isWall: true,
                type: 'wall',
                planet: planet,
                wallData: objectData,
                // Store wall dimensions for collision detection
                wallWidth: wallWidth,
                wallHeight: wallHeight,
                wallDepth: wallDepth,
                // Store information for later geometry recreation if needed
                originalSize: { width: wallWidth, height: wallHeight, depth: wallDepth }
            };
            
            // Position the wall on the planet surface at the specified lat/long
            if (typeof SceneManager.positionObjectOnPlanet === 'function') {
                SceneManager.positionObjectOnPlanet(
                    wall,
                    planet,
                    objectData.latitude,
                    objectData.longitude,
                    wallHeight / 2 // Position so bottom of wall is on surface
                );
            } else {
                // Fallback positioning if SceneManager method is not available
                this.positionObjectOnPlanet(
                    wall,
                    planet,
                    objectData.latitude,
                    objectData.longitude,
                    wallHeight / 2
                );
            }
            
            // Ensure matrix is updated before computing bounds
            wall.updateMatrix();
            wall.updateMatrixWorld(true);
            
            // Add the wall to the scene
            if (Engine.scene) {
                Engine.scene.add(wall);
            } else {
                console.error("Cannot add wall to scene: Engine.scene is undefined");
                return null;
            }
            
            // Create collision box specifically for the wall with proper dimensions
            const dimensions = {
                width: wallWidth,
                height: wallHeight,
                depth: wallDepth
            };
            
            // Register the wall as a STATIC collidable object
            const collidable = this.registerGameObject(wall, 'wall', dimensions, true);
            
            // Store references for convenience
            objectData.collidable = collidable;
            wall.collidable = collidable;
            
            // Update the OBB for the wall to ensure proper collision detection
            this.updateCollidableBounds(wall);
            
            // Calculate and store surface normal for the wall
            const planetCenter = planet.object.position;
            const toWall = wall.position.clone().sub(planetCenter);
            wall.userData.surfaceNormal = toWall.normalize();
            
            console.log(`Wall created successfully on ${planet.name} at lat=${objectData.latitude}, lon=${objectData.longitude}`);
            
            return wall;
        } catch (error) {
            console.error(`Error creating wall on ${planet.name}:`, error);
            return null;
        }
    }

    // Make sure to clean up debug visualization
    static cleanupDebug() {
        // Restore original wall materials
        this.collidableObjects.forEach(collidable => {
            if (collidable && collidable._originalMaterial && collidable.object && collidable.object.material) {
                collidable.object.material.wireframe = collidable._originalMaterial.wireframe;
                collidable.object.material.color.copy(collidable._originalMaterial.color);
                delete collidable._originalMaterial;
            }
        });
        
        // Remove debug helpers
        if (this._debugHelpers) {
            this._debugHelpers.forEach(helper => {
                if (helper && helper.parent) {
                    helper.parent.remove(helper);
                }
            });
            this._debugHelpers = [];
        }
        
        this._debugEnabled = false;
    }

    // ADDED: New utility function to ensure object is positioned properly on planet
    static ensureObjectOnPlanetRadius(object, planetOverride = null) {
        if (!object || !object.userData) return false;
        
        try {
            // Get planet from object or from override
            const planet = planetOverride || object.userData.planet;
            if (!planet || !planet.object || !planet.radius) return false;
            
            const planetCenter = planet.object.position;
            const toObject = object.position.clone().sub(planetCenter);
            const currentDistance = toObject.length();
            const surfaceNormal = toObject.normalize();
            
            // Get appropriate height offset
            let heightOffset = 0;
            if (object.userData.type === 'car') {
                heightOffset = object.userData.fixedHeightOffset || 3.5; // Updated to match visual offset
            } else if (object.userData.type === 'wall') {
                // Walls should have their base exactly on the surface
                heightOffset = (object.userData.wallHeight || 0) / 2;
            } else {
                // Default small offset to prevent z-fighting
                heightOffset = 0.1;
            }
            
            // Calculate target height
            const targetHeight = planet.radius + heightOffset;
            
            // If object isn't at correct height, fix it
            if (Math.abs(currentDistance - targetHeight) > 0.01) {
                object.position.copy(planetCenter).addScaledVector(surfaceNormal, targetHeight);
                object.userData.surfaceNormal = surfaceNormal;
                
                // Also ensure object is properly oriented to planet
                if (object.up) {
                    object.up.copy(surfaceNormal);
                }
                
                return true; // Position was corrected
            }
            
            return false; // No correction needed
        } catch (err) {
            console.error("Error in ensureObjectOnPlanetRadius:", err);
            return false;
        }
    }
}
