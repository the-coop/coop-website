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
            position: customPosition || new Vector3(5100, 0, 0),  // Use custom position or default

            // Current Sphere of Influence - which planet affects this player
            // Updated each physics frame based on proximity
            soi: null,

            // Falling state - determines if gravity should be applied
            // Also triggers landing events when transitioning to false
            falling: true,

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
        }
        
        // ENHANCED: Register player with proper OBB collision setup
        this.initializePlayerCollider(player, true); // true = force recreation
        
        this.players.push(player);
        return player;
    };
    
    // ENHANCED: Improved documentation for player collider to emphasize OBB usage
    /**
     * Initializes a player's collision detection using OBB (Oriented Bounding Box).
     * OBB provides more accurate collision detection than AABB, especially for rotated objects,
     * and is the preferred method for ALL collision detection in the game.
     * 
     * @param {Object} player - The player object to initialize collider for
     * @param {boolean} forceRecreation - Whether to recreate the collider even if one exists
     * @returns {Object|null} The created/updated collidable or null on failure
     */
    static initializePlayerCollider(player, forceRecreation = false) {
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
            player.handle.userData.mass = 100; // Add mass for collision physics
            
            // UNIFIED: Use the standardized object registration system
            if (forceRecreation || !player.collidable) {
                // Remove existing collider if forcing recreation
                if (player.collidable && forceRecreation) {
                    ObjectManager.unregisterGameObject(player.handle);
                    player.collidable = null;
                }
                
                // Register with standardized dimensions
                const playerDimensions = {
                    width: 1.4,  // Increased from 1.2 to 1.4 for better edge detection
                    height: 1.8, // Kept the same height
                    depth: 1.4   // Increased from 1.2 to 1.4 for better edge detection
                };
                
                // Use the unified registration method
                player.collidable = ObjectManager.registerGameObject(
                    player.handle, 
                    'player', 
                    playerDimensions, 
                    false // Not static
                );
                
                if (player.collidable) {
                    // Store reference to collidable in player
                    player.obb = player.collidable.obb;
                    player.handle.userData.collidable = player.collidable;
                    
                    console.log("Player collider created successfully");
                    return player.collidable;
                }
            } else {
                // Just update existing collider
                ObjectManager.updateCollidableBounds(player.handle);
            }
            
            return player.collidable;
        } catch (err) {
            console.error("Error initializing player collider:", err);
            return null;
        }
    }
    
    // ENHANCED: Better documentation for updatePlayerColliders
    /**
     * Updates collision information for all players, ensuring accurate OBB data.
     * OBB collision is used universally for all collision detection, not just on planets.
     */
    static updatePlayerColliders() {
        try {
            this.players.forEach(player => {
                if (!player) return;
                
                // ENHANCED: Update handle position from player position
                if (player.handle && player.position) {
                    // Ensure handle follows player position exactly
                    player.handle.position.copy(player.position);
                }
                
                if (player.handle && player.handle.userData) {
                    player.handle.userData.isPlayer = true; // Ensure this flag is set
                    player.handle.userData.type = 'player'; // Ensure type is always set
                    player.handle.userData.isSolid = true;  // Ensure physics treats it as solid
                }
                
                if (player.collidable) {
                    try {
                        // Force matrix update before updating bounds
                        if (player.handle) {
                            player.handle.updateMatrix();
                            player.handle.updateMatrixWorld(true);
                        }
                        
                        // Now update collision bounds
                        ObjectManager.updateCollidableBounds(player.handle);
                        
                        // ENHANCED: Store a reference to the updated OBB for convenience
                        if (player.collidable.obb) {
                            player.obb = player.collidable.obb;
                        }
                    } catch (err) {
                        console.error("Error updating player bounds:", err);
                    }
                } else {
                    try {
                        this.initializePlayerCollider(player);
                    } catch (err) {
                        console.error("Error initializing player collider:", err);
                    }
                }
            });
        } catch (err) {
            console.error("Critical error updating player colliders:", err);
        }
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
