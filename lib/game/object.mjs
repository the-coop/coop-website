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
        const collidable = this.collidableObjects.find(c => c.object === object);
        if (!collidable) return false;
        
        if (collidable.aabb) {
            // Use the physics handle if available for more accurate bounds
            if (object.userData && object.userData.physicsHandle) {
                collidable.aabb.setFromObject(object.userData.physicsHandle);
            } else {
                collidable.aabb.setFromObject(object);
            }
            
            // Update OBB based on current object state
            collidable.obb.fromBox3(collidable.aabb);
            collidable.obb.applyMatrix4(object.matrixWorld);
            
            // If this object has a boxHelper, update it too
            if (object.userData && object.userData.boxHelper) {
                object.userData.boxHelper.box.copy(collidable.aabb);
            }
            
            // Update OBB visualization if enabled
            this.updateOBBVisualizer(collidable);
            
            return true;
        }
        
        return false;
    }

    // Using OBB for accurate collision detection on planetary surfaces
    static checkCollisions(player, objects, timeStep) {
        if (!objects || objects.length === 0) return null;
        
        let closestTime = timeStep;
        let closestObject = null;
        let closestPosition = null;

        const speed = player.velocity.length();
        if (speed === 0) return null; // No movement, no collision
        
        const effectiveSpeed = Math.min(speed, 20); // Cap speed for collision detection
        
        // Create a temporary OBB for the player that accounts for planetary orientation
        const playerOBB = new OBB();
        const playerBox = new Box3().setFromCenterAndSize(
            new Vector3(0, 0, 0),
            new Vector3(1.2, 1.2, 1.2) // Player collision size
        );
        playerOBB.fromBox3(playerBox);
        
        // Apply player's world matrix to orient the OBB correctly on the planet
        const playerMatrix = new Matrix4().makeTranslation(
            player.position.x, player.position.y, player.position.z
        );
        
        // Apply planet-aligned orientation to handle spherical environment
        if (player.handle && player.handle.quaternion) {
            const rotMatrix = new Matrix4().makeRotationFromQuaternion(player.handle.quaternion);
            playerMatrix.multiply(rotMatrix);
        }
        
        playerOBB.applyMatrix4(playerMatrix);
        
        // Check collision at multiple points along path for fast-moving objects
        const numSteps = Math.max(1, Math.ceil(speed / 5)); // More steps for higher speeds
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
            
            objects.forEach((item) => {
                if (!item.object || !item.aabb) return; // Skip invalid objects
                
                // Skip collision check if player is in this vehicle
                if (item.type === 'vehicle' && player.inVehicle && 
                    item.object === VehicleManager.currentVehicle) {
                    return;
                }
                
                // Always update the object's OBB for accurate planet-oriented collision
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
                    // Find accurate intersection point
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
        
        if (closestPosition === null) return null;
        
        // Get more accurate collision normal by using OBB face normal
        const collisionNormal = this.getOBBNormalAtPoint(
            closestPosition, 
            closestObject.obb,
            closestObject.object
        ).normalize();
        
        // Add special handling for vehicle collisions
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
    
    // More accurate OBB collision normal calculation
    static getOBBNormalAtPoint(position, obb, object) {
        if (!obb) return new Vector3(0, 1, 0); // Default normal
        
        // Transform position to OBB local space
        const localPos = position.clone().sub(obb.center);
        localPos.applyMatrix3(obb.rotation.clone().transpose());
        
        // Calculate normalized distances to each face
        const normalizedDist = new Vector3(
            Math.abs(localPos.x) / obb.halfSize.x,
            Math.abs(localPos.y) / obb.halfSize.y,
            Math.abs(localPos.z) / obb.halfSize.z
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
            
            // Skip collision between player and their current vehicle
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
                // Calculate collision normal
                const normal = this.getContactNormalBetweenOBBs(objectOBB, other.obb);
                
                results.push({
                    object: object,
                    other: other.object,
                    otherCollidable: other,
                    normal: normal
                });
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

    // Debug visualization with OBB support
    static debugVisualize(enable = true, options = {}) {
        // Default options
        const config = {
            showNormals: true,
            showBoxes: true,
            showOBBs: true, // New option for OBB visualization
            normalLength: 2,
            boxOpacity: 0.3,
            boxColor: 0xff0000,
            obbColor: 0x00ff00, 
            normalColor: 0xff0000,
            ...options
        };

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
                window.gameNotify(`Debug: ${wallObjects.length} wall objects visible. Using OBB collision.`);
            }
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
                wallData: objectData
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

    // Find closest point on OBB 
    static findClosestPointOnOBB(point, obb, object) {
        if (!obb || !obb.center) {
            return point.clone();
        }
        
        // Transform point to OBB local space
        const localPoint = point.clone().sub(obb.center);
        localPoint.applyMatrix3(obb.rotation.clone().transpose());
        
        // Clamp point to OBB bounds
        const clampedPoint = new Vector3(
            Math.max(-obb.halfSize.x, Math.min(obb.halfSize.x, localPoint.x)),
            Math.max(-obb.halfSize.y, Math.min(obb.halfSize.y, localPoint.y)),
            Math.max(-obb.halfSize.z, Math.min(obb.halfSize.z, localPoint.z))
        );
        
        // Transform back to world space
        clampedPoint.applyMatrix3(obb.rotation);
        clampedPoint.add(obb.center);
        
        return clampedPoint;
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
}
