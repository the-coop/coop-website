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
    
    // ENHANCED: Better player collider registration with proper physics
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
            
            // CRITICAL FIX: Set collision flags that ensure we collide with walls
            player.handle.userData.collidesWithWalls = true;
            player.handle.userData.collidesWithVehicles = true;
            
            // ADDED: Ensure player handle has proper collision orientation on spherical surface
            if (player.surfaceNormal && player.handle.up) {
                player.handle.up.copy(player.surfaceNormal);
            }
            
            // Create optimized collision box for player
            if (forceRecreation || !player.collidable) {
                console.log("Creating/updating player collision box with OBB support");
                
                // Remove existing collider if forcing recreation
                if (player.collidable && forceRecreation) {
                    if (typeof ObjectManager.unregisterCollidable === 'function') {
                        ObjectManager.unregisterCollidable(player.handle);
                    } else {
                        // Find and remove from collidable objects array
                        const index = ObjectManager.collidableObjects.findIndex(c => c && c.object === player.handle);
                        if (index >= 0) {
                            ObjectManager.collidableObjects.splice(index, 1);
                        }
                    }
                    player.collidable = null;
                }
                
                // CRITICAL FIX: Create a larger collision box that will better interact with walls
                const playerBox = new Box3().setFromCenterAndSize(
                    new Vector3(0, 0, 0),
                    new Vector3(1.2, 1.8, 1.2) // Taller and slightly wider for better wall collision
                );
                
                // Register with collision system - player handles are NOT static
                player.collidable = ObjectManager.registerCollidable(
                    player.handle, playerBox, 'player', false
                );
                
                if (player.collidable) {
                    // CRITICAL FIX: Explicitly enable wall collision
                    player.collidable.active = true;
                    player.collidable.collidesWithWalls = true;
                    
                    // Initialize OBB from the AABB but considering player's orientation
                    player.collidable.obb = player.collidable.obb || new OBB();
                    player.collidable.obb.fromBox3(playerBox);
                    
                    // CRITICAL FIX: Ensure matrix is properly updated
                    player.handle.updateMatrix();
                    player.handle.updateMatrixWorld(true);
                    
                    if (player.handle.matrixWorld) {
                        player.collidable.obb.applyMatrix4(player.handle.matrixWorld);
                    } else {
                        console.warn("Player handle missing matrixWorld");
                    }
                    
                    // Add direct OBB reference for convenience
                    player.obb = player.collidable.obb;
                    
                    // ADDED: Store reference to collidable in handle's userData
                    player.handle.userData.collidable = player.collidable;
                    
                    console.log("Player collider created successfully");
                    return player.collidable;
                } else {
                    console.error("Failed to register player collider");
                    return null;
                }
            }
            
            // Ensure the player's collider is up to date
            try {
                ObjectManager.updateCollidableBounds(player.handle);
            } catch (err) {
                console.error("Error updating player bounds:", err);
            }
            
            // Mark collider as active now that we've properly initialized it
            if (player.collidable) {
                player.collidable.active = true;
                return player.collidable;
            }
            
            return null;
        } catch (err) {
            console.error("Critical error initializing player collider:", err);
            return null;
        }
    }
    
    // Update collision info for all players
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
