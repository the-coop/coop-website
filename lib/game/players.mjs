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
    
    // ENHANCED: Better player collider setup with OBB support
    static initializePlayerCollider(player, forceRecreation = false) {
        if (!player || !player.handle) return;
        
        // Mark the player handle with userData to help collision system
        if (!player.handle.userData) player.handle.userData = {};
        player.handle.userData.isPlayer = true;
        
        // Create or update a bounding box for the player
        if (forceRecreation || !player.collidable) {
            console.log("Creating/updating player collision box with OBB support");
            
            // Remove existing collider if forcing recreation
            if (player.collidable && forceRecreation) {
                ObjectManager.unregisterCollidable(player.handle);
                player.collidable = null;
            }
            
            // Create a properly sized collision box for the player
            const playerBox = new Box3();
            playerBox.setFromCenterAndSize(
                new Vector3(0, 0, 0),
                new Vector3(1.0, 2.0, 1.0) // Player dimensions (width, height, depth)
            );
            
            // Register with collision system
            player.collidable = ObjectManager.registerCollidable(
                player.handle, playerBox, 'player', false
            );
            
            if (player.collidable) {
                // Make the collider active - players should collide with everything
                player.collidable.active = true;
                
                // Initialize OBB from the AABB but considering player's orientation
                player.collidable.obb.fromBox3(playerBox);
                player.collidable.obb.applyMatrix4(player.handle.matrixWorld);
                
                // Add direct OBB reference for convenience
                player.obb = player.collidable.obb;
            }
        }
        
        // Ensure the player's collider is up to date
        ObjectManager.updateCollidableBounds(player.handle);
        
        // Mark collider as active now that we've properly initialized it
        if (player.collidable) {
            player.collidable.active = true;
        }
        
        return player.collidable;
    }
    
    // Update collision info for all players
    static updatePlayerColliders() {
        this.players.forEach(player => {
            if (player.handle && player.handle.userData) {
                player.handle.userData.isPlayer = true; // Ensure this flag is set
            }
            
            if (player.collidable) {
                ObjectManager.updateCollidableBounds(player.handle);
                
                // ENHANCED: Store a reference to the updated OBB for convenience
                if (player.collidable.obb) {
                    player.obb = player.collidable.obb;
                }
            } else {
                this.initializePlayerCollider(player);
            }
        });
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
