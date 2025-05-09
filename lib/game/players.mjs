import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3, Quaternion, Box3 } from 'three';
import { OBB } from 'three/addons/math/OBB.js'; // Add OBB import
import Engine from './engine.mjs';
import Physics from './physics.mjs';
import ControlManager from './control.mjs';
import FPSController from './controllers/FPSController.mjs';
import ObjectManager from './object.mjs';

export default class PlayersManager {
    static players = [];
    static self;
    
    // Creates a new player with physics simulation setup
    // Camera is attached to mesh for smooth movement
    // Handle provides ground alignment and collision
    static spawn(self = true, customPosition = null) {
        const player = {
            // Current velocity vector - used by physics system
            // Persists between frames for continuous motion and acceleration
            velocity: new Vector3(),

            // Current world position - updated by physics and controls
            // This is the source of truth for player location
            position: customPosition || new Vector3(5100, 2000, 0),  // INCREASED to 2000 units high for dramatic entry

            // Current Sphere of Influence - which planet affects this player
            // Updated each physics frame based on proximity
            soi: null,

            // Falling state - determines if gravity should be applied
            // Also triggers landing events when transitioning to false
            falling: true,  // CRITICAL FIX: Start in falling state

            // NEW: Track when player is standing on objects instead of planet surface
            standingOnObject: false,

            surfaceNormal: null,

            // Player's current orientation relative to planet surface
            // Used for camera alignment and movement direction
            aim: new Quaternion(),

            // Physics collision mesh - slightly larger than visual mesh
            // Used for ground detection and planet surface alignment
            handle: new Mesh(
                new BoxGeometry(2, 2, 2),  // Bigger handle
                new MeshBasicMaterial({ color: 0xff0000, wireframe: true })
            ),

            // Visual representation - actual player model
            // Child of handle for automatic position/rotation updates
            mesh: new Mesh(
                new BoxGeometry(1.5, 1.5, 1.5),  // Bigger mesh
                new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
            ),

            // Type identifier for collision system
            type: 'player'
        };
        
        // Add physics handle to scene for collision detection
        Engine.scene.add(player.handle);
        // Attach visual mesh to handle for automated transforms
        player.handle.add(player.mesh);
        // Initialize position in world
        player.handle.position.copy(player.position);
        
        // Calculate initial planetary influence
        player.soi = Physics.calculateSOI(player.position);
        
        // Setup player controls if this is the local player
        // Only the local player gets input control and camera
        if (self) {
            this.self = player;
            ControlManager.change(FPSController);
            
            // ENHANCED: Notify player they're spawning above the planet with gravity
            if (typeof window !== 'undefined' && window.gameNotify) {
                window.gameNotify("You're spawning high above the planet - enjoy the dramatic descent!");
            }
        }
        
        // ENHANCED: Register player with proper OBB collision setup
        this.initializePlayerCollider(player, true); // true = force recreation
        
        this.players.push(player);
        return player;
    };
    
    /**
     * Sets the player's collision shape to either a box or sphere
     * @param {Object} player - The player object to update
     * @param {boolean} useSphere - Whether to use a sphere (true) or box (false)
     */
    static setPlayerCollisionShape(player, useSphere = true) {
        if (!player || !player.handle) {
            console.warn("Can't update collision shape for invalid player");
            return false;
        }
        
        try {
            // Store the preferred shape
            if (!player.handle.userData) player.handle.userData = {};
            player.handle.userData.useSphericalCollision = useSphere;
            
            // Update dimensions based on shape
            let dimensions;
            
            if (useSphere) {
                // Use identical dimensions for a sphere
                const radius = 1.0;
                dimensions = {
                    width: radius * 2,
                    height: radius * 2,
                    depth: radius * 2
                };
                
                // Store sphere radius explicitly
                player.handle.userData.collisionRadius = radius;
                player.collisionRadius = radius;
            } else {
                // Use box dimensions for OBB
                dimensions = {
                    width: 1.4,
                    height: 2.8,
                    depth: 1.4
                };
                
                // Remove sphere radius if present
                if (player.handle.userData.collisionRadius) {
                    delete player.handle.userData.collisionRadius;
                }
                if (player.collisionRadius) {
                    delete player.collisionRadius;
                }
            }
            
            // Force recreation of the collider with new dimensions
            this.initializePlayerCollider(player, true, dimensions);
            console.log(`Player collision shape set to ${useSphere ? 'sphere' : 'box'}`);
            
            return true;
        } catch (err) {
            console.error("Error setting player collision shape:", err);
            return false;
        }
    }

    /**
     * Initializes a player's collision detection using OBB (Oriented Bounding Box).
     * OBB provides more accurate collision detection than AABB, especially for rotated objects,
     * and is the preferred method for ALL collision detection in the game.
     * 
     * @param {Object} player - The player object to initialize collider for
     * @param {boolean} forceRecreation - Whether to recreate the collider even if one exists
     * @param {Object} dimensions - Optional custom dimensions to use
     * @returns {Object|null} The created/updated collidable or null on failure
     */
    static initializePlayerCollider(player, forceRecreation = false, dimensions = null) {
        if (!player || !player.handle) {
            console.warn("Can't initialize collider for invalid player");
            return null;
        }
        
        try {
            // Explicitly mark player handle as a collision object
            if (!player.handle.userData) player.handle.userData = {};
            player.handle.userData.isPlayer = true;
            player.handle.userData.type = 'player';
            player.handle.userData.isSolid = true;
            
            // CRITICAL FIX: Always use sphere collision for players and set a clear radius
            player.handle.userData.useSphericalCollision = true;
            
            // Explicitly set collision radius on the player object
            const playerRadius = 1.2; // INCREASED from 1.0 for more reliable collision
            player.handle.userData.collisionRadius = playerRadius;
            player.collisionRadius = playerRadius;
            
            // ADDED: Ensure players have mass set correctly
            player.handle.userData.mass = Physics.DEFAULT_MASSES.player;
            player.mass = Physics.DEFAULT_MASSES.player;
            
            // Ensure handle position matches player position before registration
            if (player.position && player.handle) {
                player.handle.position.copy(player.position);
            }
            
            // Force matrix update to ensure proper OBB creation
            player.handle.updateMatrix();
            player.handle.updateMatrixWorld(true);
            
            if (forceRecreation || !player.collidable) {
                // Remove existing collider if forcing recreation
                if (player.collidable && forceRecreation) {
                    ObjectManager.unregisterGameObject(player.handle);
                    player.collidable = null;
                }
                
                // Set up sphere-based dimensions
                const sphereDimensions = {
                    width: playerRadius * 2,
                    height: playerRadius * 2,
                    depth: playerRadius * 2
                };
                
                // Register with the collision system
                player.collidable = ObjectManager.registerGameObject(
                    player.handle, 
                    'player', 
                    sphereDimensions, 
                    false // Not static
                );
                
                // Mark explicitly as sphere collider
                if (player.collidable) {
                    player.collidable.useSphereCollision = true;
                    player.collidable.sphereRadius = playerRadius;
                    
                    // Store reference to player in collider for reverse lookup
                    player.collidable.playerReference = player;
                    
                    // Store reference to OBB in player
                    player.obb = player.collidable.obb;
                    player.handle.userData.collidable = player.collidable;
                    
                    // Store reference to player in OBB for reverse lookup
                    if (player.collidable.obb) {
                        player.collidable.obb.userData = {
                            isPlayer: true,
                            playerReference: player
                        };
                    }
                    
                    console.log(`Player collider created as sphere with radius ${playerRadius.toFixed(2)}`);
                    return player.collidable;
                }
            } else {
                // Update existing collider
                ObjectManager.updateCollidableBounds(player.handle);
            }
            
            return player.collidable;
        } catch (err) {
            console.error("Error initializing player collider:", err);
            return null;
        }
    }
    
    // NEW: Helper method to validate matrix 
    static validateMatrix(matrix) {
        if (!matrix) return false;
        
        // Check for NaN or infinite values
        for (let i = 0; i < 16; i++) {
            if (isNaN(matrix.elements[i]) || !isFinite(matrix.elements[i])) {
                return false;
            }
        }
        return true;
    }
    
    // NEW: Track ground distance for better collision handling
    static updatePlayerGroundDistance() {
        try {
            this.players.forEach(player => {
                if (!player || !player.soi || !player.soi.object || !player.soi.radius) return;
                
                // Calculate distance to planet surface
                const planetCenter = player.soi.object.position;
                const distToCenter = player.position.distanceTo(planetCenter);
                const distToSurface = distToCenter - player.soi.radius;
                
                // Store this value for reference in physics and controllers
                player._lastGroundDistance = distToSurface;
                
                // Debug log if player is in an ambiguous near-ground state
                if (distToSurface < 1.0 && player.falling && !player._debuggedGroundState) {
                    console.log(`Player near ground (${distToSurface.toFixed(2)}u) but falling=true`);
                    player._debuggedGroundState = true;
                    
                    // Reset debug flag after a delay
                    setTimeout(() => {
                        if (player) player._debuggedGroundState = false;
                    }, 1000);
                }
            });
        } catch (err) {
            console.error("Error updating player ground distance:", err);
        }
    }
    
    /**
     * Updates collision information for all players, ensuring accurate OBB data.
     * OBB collision is used universally for all collision detection, not just on planets.
     */
    static updatePlayerColliders() {
        try {
            // NEW: Update ground distance tracking first
            this.updatePlayerGroundDistance();
            
            this.players.forEach(player => {
                if (!player) return;
                
                // NEW: Skip redundant updates that cause visual jitter
                if (player._lastColliderUpdate && Date.now() - player._lastColliderUpdate < 16) {
                    return; // Skip update if last one was less than 16ms ago (60fps)
                }
                
                // ENHANCED: Update handle position from player position with validation
                if (player.handle && player.position) {
                    // If positions have become significantly different, log a warning
                    const posDiff = player.handle.position.distanceTo(player.position);
                    if (posDiff > 0.1) {
                        console.log(`Player position sync: Updating handle position (diff=${posDiff.toFixed(2)})`);
                    }
                    
                    // Ensure handle follows player position exactly
                    player.handle.position.copy(player.position);
                }
                
                if (player.handle && player.handle.userData) {
                    player.handle.userData.isPlayer = true; // Ensure this flag is set
                    player.handle.userData.type = 'player'; // Ensure type is always set
                    player.handle.userData.isSolid = true;  // Ensure physics treats it as solid
                    // NEW: Add explicit reference to player object on handle
                    player.handle.userData.playerReference = player;
                }
                
                // NEW: Force handle to be a direct child of scene
                if (player.handle && player.handle.parent !== Engine.scene) {
                    console.warn("Player handle has incorrect parent - fixing");
                    const worldPos = player.handle.getWorldPosition(new Vector3());
                    if (player.handle.parent) {
                        player.handle.parent.remove(player.handle);
                    }
                    Engine.scene.add(player.handle);
                    player.handle.position.copy(worldPos);
                }
                
                if (player.collidable) {
                    try {
                        // Force matrix update before updating bounds
                        if (player.handle) {
                            player.handle.updateMatrix();
                            player.handle.updateMatrixWorld(true);
                            
                            // NEW: Validate matrix has valid values
                            if (!this.validateMatrix(player.handle.matrixWorld)) {
                                console.error("Player handle has invalid matrix - resetting");
                                player.handle.matrix.identity();
                                player.handle.position.copy(player.position);
                                player.handle.updateMatrix();
                                player.handle.updateMatrixWorld(true);
                            }
                        }
                        
                        // Now update collision bounds with safety check - FORCE UPDATE
                        let success = false;
                        if (typeof ObjectManager.forceUpdateCollidableBounds === 'function') {
                            // Use the new force update method to ensure bounds are updated
                            success = ObjectManager.forceUpdateCollidableBounds(player.handle);
                        } else if (typeof ObjectManager.updateCollidableBounds === 'function') {
                            success = ObjectManager.updateCollidableBounds(player.handle);
                        } else if (typeof window.Physics?._fallbackUpdateCollidableBounds === 'function') {
                            // Use fallback method from Physics if ObjectManager's method is not available
                            success = window.Physics._fallbackUpdateCollidableBounds(player.handle);
                        }
                        
                        if (!success) {
                            console.warn("Player handle collision update failed - re-registering");
                            this.initializePlayerCollider(player, true); // Force recreation
                        }
                        
                        // Track last update time
                        player._lastColliderUpdate = Date.now();
                        
                        // ENHANCED: Store a reference to the updated OBB for convenience
                        if (player.collidable && player.collidable.obb) {
                            player.obb = player.collidable.obb;
                        }
                    } catch (err) {
                        console.error("Error updating player bounds:", err);
                    }
                } else {
                    try {
                        console.log("Player has no collidable - initializing");
                        this.initializePlayerCollider(player);
                    } catch (err) {
                        console.error("Error initializing player collider:", err);
                    }
                }
                
                // NEW: Validate collidable is properly registered with ObjectManager
                if (!this.validatePlayerCollidable(player)) {
                    console.warn("Player collidable validation failed - attempting fix");
                    this.initializePlayerCollider(player, true);
                }
            });
        } catch (err) {
            console.error("Critical error updating player colliders:", err);
        }
    }
    
    // NEW: Validate player collidable is registered with ObjectManager
    static validatePlayerCollidable(player) {
        if (!player || !player.handle || !player.collidable) return false;
        
        // Check if the collidable is in ObjectManager's registry
        const found = ObjectManager.collidableObjects.some(c => 
            c && c.object === player.handle && c === player.collidable);
            
        return found;
    }
    
    // NEW: Get player's OBB in world space for collision checks
    static getPlayerWorldOBB(player) {
        if (!player || !player.handle) return null;
        
        // Ensure player has a collider
        if (!player.collidable) {
            this.initializePlayerCollider(player);
        }
        
        if (!player.collidable || !player.collidable.obb) return null;
        
        // Update the OBB to the latest transform
        ObjectManager.updateCollidableBounds(player.handle);
        
        return player.collidable.obb;
    }
    
    // Helper method to hide/show player handle (mesh + handle)
    static setPlayerVisibility(player, visible) {
        if (!player) return;
        
        // Set visibility for handle
        if (player.handle) {
            player.handle.visible = visible;
            
            // If hiding the player, also make sure we're not processing collisions
            if (player.collidable) {
                player.collidable.active = visible;
            }
        }
        
        // Set visibility for mesh
        if (player.mesh) {
            player.mesh.visible = visible;
        }
        
        console.log(`Player visibility set to ${visible}`);
    }
};
