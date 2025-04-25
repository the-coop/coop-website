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
                surfaceNormal = toObject.normalize();
                
                // Store surface normal in object userData for later use
                object.userData.surfaceNormal = surfaceNormal;
            }
            
            if (collidable.aabb) {
                // Use the physics handle if available for more accurate bounds
                if (object.userData && object.userData.physicsHandle) {
                    try {
                        collidable.aabb.setFromObject(object.userData.physicsHandle);
                    } catch (err) {
                        console.warn("Error setting AABB from physics handle:", err);
                        // Fallback to main object
                        collidable.aabb.setFromObject(object);
                    }
                } else {
                    collidable.aabb.setFromObject(object);
                }
                
                // Update OBB based on current object state
                if (!collidable.obb) {
                    collidable.obb = new OBB();
                }
                
                try {
                    collidable.obb.fromBox3(collidable.aabb);
                    
                    // Safety check for matrix world
                    if (!object.matrixWorld) {
                        console.warn("Object missing matrixWorld in updateCollidableBounds");
                    } else {
                        // IMPROVED: When on planet, ensure OBB aligns with planet surface normal
                        if (surfaceNormal) {
                            // Create a matrix that aligns the OBB with the planet surface
                            const alignmentMatrix = new Matrix4();
                            
                            // Get object's world position
                            const objPos = new Vector3();
                            object.getWorldPosition(objPos);
                            
                            // Get object's world rotation that should already be aligned to planet
                            const objQuat = object.quaternion.clone();
                            
                            // Create matrix with correct position and rotation
                            alignmentMatrix.compose(
                                objPos,
                                objQuat,
                                object.scale.clone()
                            );
                            
                            // Apply this properly aligned matrix to the OBB
                            collidable.obb.applyMatrix4(alignmentMatrix);
                        } else {
                            // Regular matrix application for non-planet objects
                            collidable.obb.applyMatrix4(object.matrixWorld);
                        }
                    }
                } catch (err) {
                    console.error("Error updating OBB from AABB:", err);
                    // If OBB update fails, create a simple box at object position
                    const center = new Vector3();
                    collidable.aabb.getCenter(center);
                    const size = new Vector3();
                    collidable.aabb.getSize(size);
                    
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
                // IMPROVED: Properly sized collision box for better wall collisions
                const playerBox = new Box3().setFromCenterAndSize(
                    new Vector3(0, 0, 0),
                    new Vector3(1.2, 1.8, 1.2) // Larger collision shape for better wall detection
                );
                playerOBB.fromBox3(playerBox);
                
                // Apply player's world matrix to properly orient the OBB
                if (player.handle && player.handle.matrixWorld) {
                    // Use complete matrix world from handle for proper orientation
                    playerOBB.applyMatrix4(player.handle.matrixWorld);
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
                        
                        // Use larger distance threshold for walls
                        const distToObject = player.position.distanceTo(item.object.position);
                        const objectSize = item.aabb.getSize(new Vector3()).length() * 0.5;
                        const playerSize = 1.2; // Slightly larger player collision size
                        
                        // More generous buffer for walls
                        const buffer = isWall ? 3.0 : 2.0; 
                        const distanceThreshold = objectSize + playerSize + buffer;
                        
                        if (distToObject > distanceThreshold) {
                            // Object is too far to collide
                            continue;
                        }
                        
                        // CRITICAL FIX: Update wall bounds every check for more accurate collision
                        if (isWall) {
                            this.updateCollidableBounds(item.object);
                        }
                        
                        // SAFE INTERSECTION TEST: with detailed debugging
                        let intersects = false;
                        try {
                            const worldPlayerOBB = playerOBB.clone();
                            worldPlayerOBB.applyMatrix4(new Matrix4().makeTranslation(
                                player.position.x, player.position.y, player.position.z
                            ));
                            
                            // Debug before checking intersection
                            if (isWall) {
                                console.log(`Testing wall collision: distance=${distToObject.toFixed(2)}, threshold=${distanceThreshold.toFixed(2)}`);
                            }
                            
                            intersects = worldPlayerOBB.intersectsOBB(item.obb);
                            
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
                                        objectSize: objectSize
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
                if (potentialCollisions.length > 0) {
                    potentialCollisions.sort((a, b) => a.time - b.time);
                    
                    // Take the collision with the smallest time that passes distance validation
                    for (const collision of potentialCollisions) {
                        // Skip collisions with objects that are suspiciously far relative to their size
                        // If object is far away compared to its size, it's likely a false collision
                        const sizeToDistRatio = collision.objectSize / Math.max(0.1, collision.distance);
                        
                        // If an object is far away but small, it's suspicious
                        if (collision.distance > 20 && sizeToDistRatio < 0.1) {
                            console.warn(
                                `Skipping suspicious collision with ${collision.object.type} at ` +
                                `distance ${collision.distance.toFixed(2)} (size ratio: ${sizeToDistRatio.toFixed(2)})`
                            );
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

    // More accurate OBB collision normal calculation
    static getOBBNormalAtPoint(position, obb, object) {
        if (!obb) return new Vector3(0, 1, 0); // Default normal
        if (!obb.center || !obb.halfSize || !obb.rotation) {
            console.warn("Invalid OBB structure in getOBBNormalAtPoint", obb);
            return new Vector3(0, 1, 0); // Default normal
        }
        
        try {
            // Transform position to OBB local space
            const localPos = position.clone().sub(obb.center);
            localPos.applyMatrix3(obb.rotation.clone().transpose());
            
            // Calculate normalized distances to each face
            const normalizedDist = new Vector3(
                Math.abs(localPos.x) / (obb.halfSize.x || 0.001),
                Math.abs(localPos.y) / (obb.halfSize.y || 0.001),
                Math.abs(localPos.z) / (obb.halfSize.z || 0.001)
            );
            
            // The normal is perpendicular to the face that was hit
            // The face with normalized distance closest to 1 is the hit face
            const normal = new Vector3();
            
            if (normalizedDist.x > normalizedDist.y && normalizedDist.x > normalizedDist.z) {
                // X face was hit
                normal.set(Math.sign(localPos.x), 0, 0);
            } else if (normalizedDist.y > normalizedDist.x && normalizedDist.y > normalizedDist.z) {
                // Y face was hit
                normal.set(0, Math.sign(localPos.y), 0);
            } else {
                // Z face was hit
                normal.set(0, 0, Math.sign(localPos.z));
            }
            
            // Transform normal back to world space
            normal.applyMatrix3(obb.rotation);
            
            return normal;
        } catch (err) {
            console.error("Error in getOBBNormalAtPoint:", err);
            return new Vector3(0, 1, 0); // Default normal on error
        }
    }

    // Improved collision detection between objects using OBBs for spherical environment
    static checkAllCollisions(object, types = null) {
        const results = [];
        
        if (!object) return results;
        
        // Get or create the object's OBB
        let objectOBB;
        const collidable = this.collidableObjects.find(c => c.object === object);
        
        if (collidable && collidable.obb) {
            // Update the OBB to the latest state
            this.updateCollidableBounds(object);
            objectOBB = collidable.obb;
        } else {
            // Create a temporary OBB if the object isn't registered
            const objectBox = new Box3().setFromObject(object);
            objectOBB = new OBB();
            objectOBB.fromBox3(objectBox);
            objectOBB.applyMatrix4(object.matrixWorld);
        }
        
        // Check against all other collidable objects
        for (const other of this.collidableObjects) {
            // Skip if not active
            if (!other.active) continue;
            
            // Skip self-collision
            if (other.object === object) continue;
            
            // Skip if type filtering is applied and type doesn't match
            if (types && !types.includes(other.type)) continue;
            
            // ENHANCED: Specifically check for player in vehicle special cases
            // Skip collision between player and their current vehicle
            const isPlayerInCurrentVehicle = object.userData && 
                                           object.userData.isPlayer && 
                                           object.userData.inVehicle &&
                                           other.type === 'vehicle' && 
                                           (typeof window !== 'undefined' && 
                                           window.VehicleManager && 
                                           window.VehicleManager.currentVehicle === other.object);
            
            // Check if this is the player's current vehicle trying to collide with the player
            const isVehicleCollidingWithItsPlayer = other.type === 'player' && 
                                                  other.object.userData && 
                                                  other.object.userData.isPlayer &&
                                                  other.object.userData.inVehicle && 
                                                  object === (typeof window !== 'undefined' && 
                                                             window.VehicleManager && 
                                                             window.VehicleManager.currentVehicle);
            
            // Skip only if it's the player colliding with their current vehicle
            if (isPlayerInCurrentVehicle || isVehicleCollidingWithItsPlayer) {
                continue;
            }
            
            // ADDED: Distance check for optimization
            const maxDist = 20; // Max distance to check for collisions
            const distSq = object.position.distanceToSquared(other.object.position);
            if (distSq > maxDist * maxDist) continue;
            
            // Make sure OBB is properly updated for the latest object position
            this.updateCollidableBounds(other.object);
            
            // Check for intersection using OBB for better orientation support
            try {
                if (objectOBB.intersectsOBB(other.obb)) {
                    // Calculate collision normal
                    const normal = this.getContactNormalBetweenOBBs(objectOBB, other.obb);
                    
                    results.push({
                        object: object,
                        other: other.object,
                        otherCollidable: other,
                        normal: normal
                    });
                }
            } catch (err) {
                console.error(`OBB intersection error between ${object.userData?.type || 'unknown'} and ${other.type}:`, err);
            }
        }
        
        return results;
    }
    
    // Calculate contact normal between two OBBs
    static getContactNormalBetweenOBBs(obb1, obb2) {
        // Simple approximation: vector from center of obb1 to center of obb2
        const normal = new Vector3().subVectors(obb2.center, obb1.center).normalize();
        return normal;
    }

    // Debug visualization with OBB support - IMPROVED error handling
    static debugVisualize(enable = true, options = {}) {
        // Default options
        const config = {
            showNormals: true,
            showBoxes: true,
            showOBBs: true, // New option for OBB visualization
            normalLength: 2,
            boxOpacity: 0.6, // INCREASED from 0.3 for better visibility
            boxColor: 0xff0000,
            obbColor: 0x00ff00, 
            normalColor: 0xff0000,
            ...options
        };

        try {
            this._debugEnabled = enable;
            this._debugSettings = config;
            
            // Remove existing debug visualizers
            if (this._debugHelpers) {
                this._debugHelpers.forEach(helper => {
                    if (helper && helper.parent) {
                        helper.parent.remove(helper);
                    }
                });
                this._debugHelpers = [];
            }
            
            if (!enable) return;
            
            if (!this._debugHelpers) {
                this._debugHelpers = [];
            }
            
            // IMPROVED: Make wall materials wireframe for better visibility
            this.collidableObjects.forEach(collidable => {
                if (collidable && collidable.object && collidable.type === 'wall' && 
                    collidable.object.material && !collidable.object.material.wireframe) {
                        
                    // Store original state so we can restore later
                    collidable._originalMaterial = {
                        wireframe: collidable.object.material.wireframe,
                        color: collidable.object.material.color.clone()
                    };
                    
                    // Switch to wireframe with bright color
                    collidable.object.material.wireframe = true;
                    collidable.object.material.color.set(0xff00ff); // Bright magenta
                }
            });
            
            // Add debug visualization for all collidable objects
            this.collidableObjects.forEach((collidable) => {
                if (!collidable.active || !collidable.object) return;
                
                const object = collidable.object;
                
                // Log object's type and properties for debugging
                console.log(`Object ${object.name || 'unnamed'}: type=${collidable.type}, static=${collidable.isStatic}`);
                
                if (config.showBoxes) {
                    // Visualize the AABB with a box helper
                    const boxHelper = new Box3Helper(collidable.aabb, config.boxColor);
                    boxHelper.visible = true;
                    boxHelper.material.transparent = true;
                    boxHelper.material.opacity = config.boxOpacity;
                    boxHelper.material.depthTest = false; // Make sure it shows through walls
                    object.add(boxHelper);
                    this._debugHelpers.push(boxHelper);
                }
                
                if (config.showOBBs) {
                    // Update or create OBB visualizer
                    this.updateOBBVisualizer(collidable);
                    if (collidable.obbVisualizer) {
                        this._debugHelpers.push(collidable.obbVisualizer);
                    }
                }
                
                if (config.showNormals) {
                    // Draw normal arrows from the center of each face
                    const center = new Vector3();
                    collidable.aabb.getCenter(center);
                    const size = new Vector3();
                    collidable.aabb.getSize(size);
                    
                    // Get the object's world matrix
                    const worldMatrix = collidable.object.matrixWorld;
                    
                    // Create arrows for each face normal
                    const faceNormals = [
                        new Vector3( 1,  0,  0), // +X
                        new Vector3(-1,  0,  0), // -X
                        new Vector3( 0,  1,  0), // +Y
                        new Vector3( 0, -1,  0), // -Y
                        new Vector3( 0,  0,  1), // +Z
                        new Vector3( 0,  0, -1)  // -Z
                    ];
                    
                    faceNormals.forEach(normal => {
                        // Position of face center
                        const facePos = center.clone().add(
                            normal.clone().multiply(size.clone().multiplyScalar(0.5))
                        );
                        
                        // Transform to world space
                        const worldPos = facePos.clone().applyMatrix4(worldMatrix);
                        const worldNormal = normal.clone().transformDirection(worldMatrix).normalize();
                        
                        // Create arrow helper
                        const arrowHelper = new ArrowHelper(
                            worldNormal,
                            worldPos,
                            config.normalLength, // Length of arrow
                            config.normalColor // Color
                        );
                        
                        // Add to scene
                        Engine.scene.add(arrowHelper);
                        this._debugHelpers.push(arrowHelper);
                    });
                }
            });
            
            // If it's a wall object, add more debug info
            const wallObjects = this.collidableObjects.filter(c => c.type === 'wall');
            if (wallObjects.length > 0) {
                console.log(`Found ${wallObjects.length} wall objects`);
                
                // Display a notification about walls
                if (typeof window !== 'undefined' && window.gameNotify) {
                    window.gameNotify(`Debug: ${wallObjects.length} wall objects visible with improved collision.`);
                }
            }
        } catch (e) {
            console.error("Critical error in debugVisualize:", e);
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
            
            const planetRadius = planet.radius;
            const wallHeight = planetRadius * 0.05; // 5% of planet radius
            const wallWidth = planetRadius * 0.2;   // 20% of planet radius
            const wallDepth = planetRadius * 0.025; // 2.5% of planet radius
            
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
                // ADDED: Store surfaceNormal for proper alignment
                surfaceNormal: null // Will be calculated after positioning
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
            
            // ADDED: Calculate and store surface normal for the wall
            const planetCenter = planet.object.position;
            const toWall = wall.position.clone().sub(planetCenter);
            wall.userData.surfaceNormal = toWall.normalize();
            
            // Add the wall to the scene
            if (Engine.scene) {
                Engine.scene.add(wall);
            } else {
                console.error("Cannot add wall to scene: Engine.scene is undefined");
                return null;
            }
            
            // Create a Box3 for the wall's AABB
            const aabb = new Box3();
            aabb.setFromObject(wall);
            objectData.aabb = aabb;
            
            // Register the wall as a STATIC collidable object
            const collidable = this.registerCollidable(wall, aabb, 'wall', true);
            objectData.collidable = collidable;
            
            // Update the OBB for the wall to ensure proper collision detection on the spherical surface
            this.updateCollidableBounds(wall);
            
            console.log(`Wall created on ${planet.name} at lat=${objectData.latitude}, lon=${objectData.longitude}`);
            return wall;
        } catch (error) {
            console.error(`Error creating wall on ${planet.name}:`, error);
            return null;
        }
    }

    // Find closest point on OBB with improved error handling
    static findClosestPointOnOBB(point, obb, object) {
        if (!obb || !obb.center) {
            console.warn("Invalid OBB in findClosestPointOnOBB");
            return point.clone();
        }
        
        try {
            // Transform point to OBB local space
            const localPoint = point.clone().sub(obb.center);
            
            // Safety check for rotation matrix
            if (!obb.rotation) {
                console.warn("OBB missing rotation matrix");
                return point.clone();
            }
            
            try {
                localPoint.applyMatrix3(obb.rotation.clone().transpose());
            } catch (err) {
                console.error("Error applying rotation transpose:", err);
                return point.clone();
            }
            
            // Safety check for halfSize
            if (!obb.halfSize) {
                console.warn("OBB missing halfSize");
                return point.clone();
            }
            
            // Clamp point to OBB bounds
            const clampedPoint = new Vector3(
                Math.max(-(obb.halfSize.x || 0), Math.min(obb.halfSize.x || 0, localPoint.x)),
                Math.max(-(obb.halfSize.y || 0), Math.min(obb.halfSize.y || 0, localPoint.y)),
                Math.max(-(obb.halfSize.z || 0), Math.min(obb.halfSize.z || 0, localPoint.z))
            );
            
            // Transform back to world space
            try {
                clampedPoint.applyMatrix3(obb.rotation);
            } catch (err) {
                console.error("Error applying rotation to clamped point:", err);
                return point.clone();
            }
            
            clampedPoint.add(obb.center);
            
            return clampedPoint;
        } catch (err) {
            console.error("Error in findClosestPointOnOBB:", err);
            return point.clone(); // Return original point if anything fails
        }
    }

    // Position an object on a planet's surface at given latitude/longitude
    static positionObjectOnPlanet(object, planet, latitude, longitude, heightOffset = 0) {
        // Convert lat/long to radians
        const latRad = latitude * (Math.PI / 180);
        const longRad = longitude * (Math.PI / 180);

        // Calculate position on sphere
        const planetRadius = planet.radius;
        const x = planetRadius * Math.cos(latRad) * Math.cos(longRad);
        const y = planetRadius * Math.sin(latRad);
        const z = planetRadius * Math.cos(latRad) * Math.sin(longRad);

        // Position relative to planet center
        const position = new Vector3(x, y, z);

        // Create orientation matrix to align with planet surface
        // This makes the object's "up" direction point away from planet center
        const surfaceNormal = position.clone().normalize();
        const objectUp = new Vector3(0, 1, 0); // Default up direction

        // Create quaternion to rotate from default orientation to surface orientation
        const alignmentQuaternion = new Quaternion();

        // Find rotation axis and angle between default up and surface normal
        const rotationAxis = new Vector3().crossVectors(objectUp, surfaceNormal).normalize();
        const angle = Math.acos(Math.min(1, Math.max(-1, objectUp.dot(surfaceNormal))));

        // Set quaternion from axis and angle
        if (rotationAxis.lengthSq() > 0.0001) { // Avoid zero-length rotation axis
            alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
        }

        // Apply rotation to align with surface
        object.quaternion.copy(alignmentQuaternion);

        // Add height offset along the normal direction
        const offsetPosition = position.clone().add(
            surfaceNormal.clone().multiplyScalar(heightOffset)
        );

        // Position the object (relative to planet position)
        object.position.copy(planet.object.position).add(offsetPosition);
        
        // Ensure matrix is updated after position change
        object.updateMatrix();
        object.updateMatrixWorld(true);
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
}
