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
    Box3Helper
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
        
        // FIXED: Set reference to collidable in object's userData for quick lookup
        if (object.userData) {
            object.userData.collidable = collidable;
        }
        
        this.collidableObjects.push(collidable);
        return collidable;
    }
    
    // Unregister a collidable object when it's no longer needed
    static unregisterCollidable(object) {
        const index = this.collidableObjects.findIndex(c => c.object === object);
        if (index >= 0) {
            this.collidableObjects.splice(index, 1);
            return true;
        }
        return false;
    }
    
    // Get all collidable objects of a specific type
    static getCollidables(type) {
        return this.collidableObjects.filter(c => c.type === type);
    }
    
    // Add player handle to collidable objects system - BUT don't make it a regular physics object
    static registerPlayerAsCollidable(player) {
        if (!player || !player.handle) return null;
        
        // Create bounding box for player handle
        const playerBox = new Box3();
        playerBox.setFromObject(player.handle);
        
        // Register player as a dynamic collidable object (not static)
        const collidable = this.registerCollidable(player.handle, playerBox, 'player', false);
        collidable.active = false; // Mark as inactive for regular collision system
        
        // Store the collidable reference on the player for easy access
        player.collidable = collidable;
        
        return collidable;
    }
    
    // Update a collidable object's bounding box (needed when objects move)
    static updateCollidableBounds(object) {
        try {
            const collidable = this.collidableObjects.find(c => c.object === object);
            if (!collidable) return false;
            
            if (collidable.aabb) {
                // FIX: Use the physics handle if available for more accurate bounds
                if (object.userData && object.userData.physicsHandle) {
                    collidable.aabb.setFromObject(object.userData.physicsHandle);
                } else {
                    collidable.aabb.setFromObject(object);
                }
                
                // FIX: Update OBB from AABB and object's world matrix
                collidable.obb.fromBox3(collidable.aabb);
                collidable.obb.applyMatrix4(object.matrixWorld);
                
                // FIX: If this object has a boxHelper, update it too
                if (object.userData && object.userData.boxHelper) {
                    object.userData.boxHelper.box.copy(collidable.aabb);
                }
                
                return true;
            }
            
            return false;
        } catch (e) {
            console.error("Error updating collidable bounds:", e);
            return false;
        }
    }

    // Create a single wall on a planet at the specified latitude and longitude
    static createWall(planet, objectData) {
        const planetRadius = planet.radius;
        const wallHeight = planetRadius * 0.05; // 5% of planet radius
        const wallWidth = planetRadius * 0.2;   // 20% of planet radius
        const wallDepth = planetRadius * 0.2;  // 1% of planet radius

        // Create the wall geometry
        const geometry = new BoxGeometry(wallWidth, wallHeight, wallDepth);
        const material = new MeshBasicMaterial({ 
            color: 0x8844aa, 
            wireframe: true 
        });
        
        const wall = new Mesh(geometry, material);
        
        // Position the wall on the planet surface
        this.positionObjectOnPlanet(
            wall,
            planet,
            objectData.latitude,
            objectData.longitude,
            0   // Offset so the bottom of the wall rests on surface
        );
        
        // Add the wall to the scene and our objects array
        Engine.scene.add(wall);
        objectData.object = wall

        // Set special userdata to identify this as a wall
        wall.userData.isWall = true;
        wall.userData.wallData = objectData;

        //create local matrix
        //create AABB
        const aabb = new Box3();
        const v1 = new Vector3(0, 0, 0);
        const size = new Vector3(wallWidth, wallHeight, wallDepth);
        aabb.setFromCenterAndSize(v1, size);
        objectData.aabb = aabb;

        // Register wall as a STATIC collidable object
        objectData.collidable = this.registerCollidable(wall, aabb, 'wall', true);
        
        // IMPROVED: Update the OBB immediately after registration to ensure correct orientation
        this.updateCollidableBounds(wall);
        
        return wall;
    }

    // Position an object on a planet's surface at given latitude/longitude
    static positionObjectOnPlanet(object, planet, latitude, longitude, heightOffset = 0) {
        // CRITICAL FIX: Better validation of planet properties
        if (!planet || !planet.radius) {
            console.error('Invalid planet for positioning object:', planet);
            return;
        }

        if (!planet.object || !planet.object.position) {
            console.error('Invalid planet object for positioning:', planet);
            return;
        }

        // Use SceneManager's implementation for consistency
        if (typeof SceneManager.positionObjectOnPlanet === 'function') {
            return SceneManager.positionObjectOnPlanet(object, planet, latitude, longitude, heightOffset);
        }

        // Fallback implementation if SceneManager method is not available
        const planetRadius = planet.radius;
        const planetCenter = planet.object.position;

        // Convert lat/long to radians
        const latRad = latitude * (Math.PI / 180);
        const longRad = longitude * (Math.PI / 180);

        // Calculate position on sphere
        const x = planetRadius * Math.cos(latRad) * Math.cos(longRad);
        const y = planetRadius * Math.sin(latRad);
        const z = planetRadius * Math.cos(latRad) * Math.sin(longRad);

        // Position relative to planet center
        const position = new Vector3(x, y, z);

        // Create orientation matrix to align with planet surface
        const surfaceNormal = position.clone().normalize();
        const objectUp = new Vector3(0, 1, 0); // Default up direction

        // Create quaternion to rotate from default orientation to surface orientation
        const alignmentQuaternion = new Quaternion();

        // Find rotation axis and angle between default up and surface normal
        const rotationAxis = new Vector3().crossVectors(objectUp, surfaceNormal).normalize();
        const angle = Math.acos(objectUp.dot(surfaceNormal));

        // Set quaternion from axis and angle
        if (rotationAxis.length() > 0.001) { // Avoid zero-length rotation axis
            alignmentQuaternion.setFromAxisAngle(rotationAxis, angle);
        }

        // Apply rotation to align with surface
        object.quaternion.copy(alignmentQuaternion);

        // Add height offset along the normal direction
        const offsetPosition = position.clone().add(
            surfaceNormal.clone().multiplyScalar(heightOffset)
        );

        // Position the object (relative to planet position)
        object.position.copy(planetCenter).add(offsetPosition);
    }

    // Improved normal calculation that accounts for object orientation
    static getNormalFromBoundingBox(position, boundingBox, object) {
        // Get the center of the bounding box
        const center = new Vector3();
        boundingBox.getCenter(center);
        
        // Convert position to object's local space
        const localPos = position.clone();
        if (object) {
            const inverseMatrix = new Matrix4().copy(object.matrixWorld).invert();
            localPos.applyMatrix4(inverseMatrix);
        }
        
        // Get the size of the bounding box
        const size = new Vector3();
        boundingBox.getSize(size);
        
        // Calculate the direction from center to hit position
        const direction = new Vector3().subVectors(localPos, center);
        
        // Compute normalized distances to each face
        const normalizedDist = new Vector3(
            Math.abs(direction.x) / (size.x * 0.5),
            Math.abs(direction.y) / (size.y * 0.5),
            Math.abs(direction.z) / (size.z * 0.5)
        );
        
        // The normal is perpendicular to the face that was hit
        // The face with normalized distance closest to 1 is the hit face
        const normal = new Vector3();
        
        if (normalizedDist.x > normalizedDist.y && normalizedDist.x > normalizedDist.z) {
            // X face was hit
            normal.set(Math.sign(direction.x), 0, 0);
        } else if (normalizedDist.y > normalizedDist.x && normalizedDist.y > normalizedDist.z) {
            // Y face was hit
            normal.set(0, Math.sign(direction.y), 0);
        } else {
            // Z face was hit
            normal.set(0, 0, Math.sign(direction.z));
        }
        
        // Transform normal to world space if we have an object
        if (object) {
            // We only need to apply rotation, not translation
            normal.applyQuaternion(object.quaternion);
        }
        
        return normal;
    }

    // Enhanced collision detection using OBB for better orientation support
    static checkCollisions(player, objects, timeStep) {
        if (!objects || objects.length === 0) return null;
        
        let closestTime = timeStep;
        let closestObject = null;
        let closestPosition = null;

        const speed = player.velocity.length();
        if (speed === 0) return null; // No movement, no collision
        
        // CRITICAL FIX: If speed is extremely high, cap the effective speed for collision checks
        const effectiveSpeed = Math.min(speed, 20); // Cap speed for collision detection
        
        // CRITICAL FIX: For high speeds, use sub-stepping to check multiple points
        const numSteps = Math.max(1, Math.ceil(speed / 5)); // More steps for higher speeds
        const subStepSize = timeStep / numSteps;
        const subStepVelocity = player.velocity.clone().multiplyScalar(subStepSize / timeStep);
        const startPosition = player.position.clone();
        
        const collision = new Vector3();
        
        // Create a temporary OBB for the player
        const playerOBB = new OBB();
        const playerBox = new Box3().setFromCenterAndSize(
            new Vector3(0, 0, 0),
            new Vector3(1.2, 1.2, 1.2) // Player collision size
        );
        playerOBB.fromBox3(playerBox);
        
        // CRITICAL FIX: Check collision at multiple points along path for fast-moving objects
        for (let step = 0; step < numSteps; step++) {
            // Calculate position at this substep
            const stepPosition = startPosition.clone().addScaledVector(player.velocity, (step * subStepSize) / timeStep);
            
            // Position the player OBB at this step
            const playerMatrix = new Matrix4().makeTranslation(
                stepPosition.x, stepPosition.y, stepPosition.z
            );
            const worldPlayerOBB = playerOBB.clone().applyMatrix4(playerMatrix);
            
            objects.forEach((item) => {
                if (!item.object || !item.aabb) return; // Skip invalid objects
                
                // CRITICAL FIX: Skip collision check if player is in this vehicle
                if (item.type === 'vehicle' && player.inVehicle && 
                    item.object === VehicleManager.currentVehicle) {
                    return;
                }
                
                // Use OBB for oriented collision detection
                // First ensure the object's OBB is up to date
                if (!item.obb) {
                    item.obb = new OBB();
                    item.obb.fromBox3(item.aabb);
                    item.obb.applyMatrix4(item.object.matrixWorld);
                } else {
                    // Make sure OBB is updated with latest matrix
                    item.obb.copy(new OBB().fromBox3(item.aabb).applyMatrix4(item.object.matrixWorld));
                }
                
                // Check for OBB intersection
                if (worldPlayerOBB.intersectsOBB(item.obb)) {
                    // CRITICAL FIX: Replace closestPointToPoint with custom implementation
                    // since three.js OBB doesn't have this method
                    const contactPoint = this.findClosestPointOnOBB(stepPosition, item.obb, item.object);
                    
                    // Calculate time to intersection based on distance
                    const distToIntersection = stepPosition.distanceTo(contactPoint);
                    const time = (step * subStepSize) + (distToIntersection / (effectiveSpeed || 0.001));
                    
                    if (time <= timeStep && time < closestTime) {
                        closestTime = time;
                        closestObject = item;
                        closestPosition = contactPoint.clone();
                    }
                }
            });
            
            // If we found a collision, no need to check further substeps
            if (closestObject) break;
        }
        
        if (closestPosition === null || isNaN(closestPosition.x)) return null;
        
        // Get normal and transform it correctly to world space
        // For more accurate normal, use the closest object face
        const collisionNormal = this.getNormalFromBoundingBox(
            closestPosition, 
            closestObject.aabb,
            closestObject.object
        ).normalize();
        
        // NEW: Add special handling for vehicle collisions
        if (closestObject.type === 'vehicle') {
            return this.handlePlayerVehicleCollision(player, {
                collisionNormal,
                collisionPosition: closestPosition,
                closestObject,
                closestTime
            });
        }
        
        return { collisionNormal, collisionPosition: closestPosition, closestObject, closestTime };
    }
    
    // ADDED: Custom implementation to find the closest point on an OBB to a point
    static findClosestPointOnOBB(point, obb, object) {
        // If the object and matrix are available, transform the point to object local space
        const localPoint = point.clone();
        
        if (object && object.matrixWorld) {
            // Create inverse matrix to transform from world to local space
            const inverseMatrix = new Matrix4().copy(object.matrixWorld).invert();
            localPoint.applyMatrix4(inverseMatrix);
        }
        
        // Get the center and half extents of the box
        const center = new Vector3();
        if (obb.center) {
            center.copy(obb.center);
        }
        
        // Get the half extents (size/2) of the box
        const halfSize = new Vector3();
        if (obb.halfSize) {
            halfSize.copy(obb.halfSize);
        } else if (object && object.geometry) {
            // Fallback: try to get size from geometry
            const box = new Box3().setFromObject(object);
            box.getSize(halfSize).multiplyScalar(0.5);
        } else {
            // Default size if we can't determine it
            halfSize.set(1, 1, 1);
        }
        
        // Clamp the point to be inside the box bounds
        const clampedPoint = new Vector3(
            Math.max(-halfSize.x, Math.min(halfSize.x, localPoint.x - center.x)),
            Math.max(-halfSize.y, Math.min(halfSize.y, localPoint.y - center.y)),
            Math.max(-halfSize.z, Math.min(halfSize.z, localPoint.z - center.z))
        );
        
        // Transform back to world space
        if (object && object.matrixWorld) {
            clampedPoint.add(center); // Add center offset back
            clampedPoint.applyMatrix4(object.matrixWorld);
            return clampedPoint;
        }
        
        // If we can't transform back, just return the clamped point
        return clampedPoint.add(center);
    }

    // NEW: Special handling for player-vehicle collisions
    static handlePlayerVehicleCollision(player, collision) {
        // Get the vehicle object
        const vehicle = collision.closestObject.object;
        
        // Calculate a modified collision response
        const collisionNormal = collision.collisionNormal.clone();
        
        // Create a sliding response along the surface instead of a bounce
        // This prevents the player from being flung far away
        return {
            collisionNormal: collisionNormal,
            collisionPosition: collision.collisionPosition,
            closestObject: collision.closestObject,
            closestTime: collision.closestTime,
            
            // Add a flag to indicate this is a vehicle collision for special handling
            isVehicleCollision: true
        };
    }

    // IMPROVED: Unified collision check for any collidable object against all others
    static checkCollisionsForObject(object, timeStep) {
        if (!object) return null;
        
        // Get the collidable entry for this object
        const collidable = this.collidableObjects.find(c => c.object === object);
        if (!collidable || !collidable.active) return null;
        
        // Get velocity either from object.userData or directly
        let velocity;
        if (object.userData && object.userData.velocity) {
            velocity = object.userData.velocity;
        } else if (object.velocity) {
            velocity = object.velocity;
        } else {
            return null; // No velocity, no collision check needed
        }
        
        const speed = velocity.length();
        if (speed === 0) return null; // No movement, no collision
        
        // Skip remaining logic implementation, we'll just check for player in vehicle
        const otherCollidables = this.collidableObjects.filter(c => {
            // Skip self
            if (c.object === object) return false;
            
            // Skip inactive
            if (!c.active) return false;
            
            // CRITICAL FIX: Skip current vehicle if this is a player in vehicle
            if (object.userData && object.userData.isPlayer && object.userData.inVehicle && 
                c.type === 'vehicle' && c.object === VehicleManager.currentVehicle) {
                return false;
            }
            
            // CRITICAL FIX: Skip player if this is their current vehicle
            if (c.type === 'player' && c.object.userData && c.object.userData.isPlayer && 
                c.object.userData.inVehicle && object === VehicleManager.currentVehicle) {
                return false;
            }
            
            return true;
        });
        
        // Rest of collision detection would follow...
        return null; // Placeholder return
    }

    // Check collisions for an object with objects of a specific type only 
    static checkCollisionsWithType(object, types) {
        const results = [];
        
        if (!object) return results;
        
        // Create temporary OBB for the object
        const objectOBB = new OBB();
        const objectBox = new Box3().setFromObject(object);
        objectOBB.fromBox3(objectBox);
        objectOBB.applyMatrix4(object.matrixWorld);
        
        // Check against all other collidable objects filtered by type
        for (const other of this.collidableObjects) {
            // Skip if not active or not the requested type
            if (!other.active || !types.includes(other.type)) continue;
            
            // Skip self-collision
            if (other.object === object) continue;
            
            // FIXED: Only skip collision between player and their CURRENT vehicle
            // Allow collisions with other vehicles the player isn't in
            const isPlayerInCurrentVehicle = object.userData && 
                                           object.userData.isPlayer && 
                                           object.userData.inVehicle &&
                                           other.type === 'vehicle' && 
                                           VehicleManager.currentVehicle === other.object;
            
            // Check if this is the player's current vehicle trying to collide with the player
            const isVehicleCollidingWithItsPlayer = other.type === 'player' && 
                                                  other.object.userData && 
                                                  other.object.userData.isPlayer &&
                                                  other.object.userData.inVehicle && 
                                                  object === VehicleManager.currentVehicle;
            
            // Skip only if it's the player colliding with their current vehicle
            if (isPlayerInCurrentVehicle || isVehicleCollidingWithItsPlayer) {
                continue; // Skip collision
            }
            
            // Make sure OBB is properly updated for the latest object position
            this.updateCollidableBounds(other.object);
            
            // Check for intersection using OBB for better orientation support
            if (objectOBB.intersectsOBB(other.obb)) {
                results.push({
                    object: object,
                    other: other.object,
                    otherCollidable: other
                });
            }
        }
        
        return results;
    }

    // Check collisions for an object against all other collidable objects
    static checkAllCollisions(object, types = null) {
        const results = [];
        
        if (!object) return results;
        
        // Create temporary OBB for the object
        const objectOBB = new OBB();
        const objectBox = new Box3().setFromObject(object);
        objectOBB.fromBox3(objectBox);
        objectOBB.applyMatrix4(object.matrixWorld);
        
        // Check against all other collidable objects
        for (const other of this.collidableObjects) {
            // Skip if not active
            if (!other.active) continue;
            
            // Skip self-collision
            if (other.object === object) continue;
            
            // Skip if type filtering is applied and type doesn't match
            if (types && !types.includes(other.type)) continue;
            
            // FIXED: Only skip collision between player and their CURRENT vehicle
            // Allow collisions with other vehicles the player isn't in
            const isPlayerInCurrentVehicle = object.userData && 
                                           object.userData.isPlayer && 
                                           object.userData.inVehicle &&
                                           other.type === 'vehicle' && 
                                           VehicleManager.currentVehicle === other.object;
            
            // Check if this is the player's current vehicle trying to collide with the player
            const isVehicleCollidingWithItsPlayer = other.type === 'player' && 
                                                  other.object.userData && 
                                                  other.object.userData.isPlayer &&
                                                  other.object.userData.inVehicle && 
                                                  object === VehicleManager.currentVehicle;
            
            // Skip only if it's the player colliding with their current vehicle
            if (isPlayerInCurrentVehicle || isVehicleCollidingWithItsPlayer) {
                continue;
            }
            
            // Make sure OBB is properly updated for the latest object position
            this.updateCollidableBounds(other.object);
            
            // Check for intersection using OBB for better orientation support
            if (objectOBB.intersectsOBB(other.obb)) {
                results.push({
                    object: object,
                    other: other.object,
                    otherCollidable: other
                });
            }
        }
        
        return results;
    }

    // Create a collision box for any object (walls, vehicles, etc.)
    static createCollisionBox(object, width, height, depth) {
        const aabb = new Box3();
        const center = new Vector3(0, 0, 0);
        const size = new Vector3(width, height, depth);
        aabb.setFromCenterAndSize(center, size);
        return aabb;
    }

    // Enhanced debug visualization with more options
    static debugVisualize(enable = true, options = {}) {
        // Default options
        const config = {
            showNormals: true,
            showBoxes: true,
            normalLength: 2,
            boxOpacity: 0.3,
            boxColor: 0xff0000,
            normalColor: 0xff0000,
            ...options
        };

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
        
        // Add debug visualization for all collidable objects
        this.collidableObjects.forEach((collidable) => {
            if (!collidable.active || !collidable.object) return;
            
            const object = collidable.object;
            
            // Log object's type and properties for debugging
            console.log(`Object ${object.name || 'unnamed'}: type=${collidable.type}, static=${collidable.isStatic}`);
            
            if (config.showBoxes) {
                // Visualize the OBB with a box helper
                const boxHelper = new Box3Helper(collidable.aabb, config.boxColor);
                boxHelper.visible = true;
                boxHelper.material.transparent = true;
                boxHelper.material.opacity = config.boxOpacity;
                object.add(boxHelper);
                this._debugHelpers.push(boxHelper);
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
                window.gameNotify(`Debug: ${wallObjects.length} wall objects visible. Using OBB collision.`);
            }
        }
    }
}
