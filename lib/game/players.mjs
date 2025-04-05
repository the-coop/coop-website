import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3, Quaternion, Box3 } from 'three';
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
        
        // IMPROVED: Register player as a proper collidable object like vehicles
        const playerBox = new Box3().setFromObject(player.handle);
        player.handle.userData = {
            isPlayer: true,
            isDynamic: true,
            player: player, // Reference back to player data
            velocity: player.velocity,
            planet: player.soi
        };
        player.collidable = ObjectManager.registerCollidable(player.handle, playerBox, 'player', false);
        
        this.players.push(player);
        return player;
    };
    
    // Make sure player collider is properly initialized and updated
    static initializePlayerCollider(player) {
        if (!player || !player.handle) return;
        
        // Mark the player handle with userData to help collision system
        if (!player.handle.userData) player.handle.userData = {};
        player.handle.userData.isPlayer = true;
        
        // Create or update a bounding box for the player
        if (!player.collidable) {
            console.log("Creating player collision box");
            player.collidable = ObjectManager.registerPlayerAsCollidable(player);
            
            if (player.collidable) {
                // Make the collider active - players should collide with everything
                player.collidable.active = true;
                
                // Create a more appropriate sized collision shape
                const playerBox = new Box3();
                playerBox.setFromCenterAndSize(
                    new Vector3(0, 0, 0),
                    new Vector3(1.0, 2.0, 1.0) // Player dimensions (width, height, depth)
                );
                player.collidable.aabb = playerBox;
                
                // Initialize OBB from the updated AABB
                player.collidable.obb.fromBox3(playerBox);
                player.collidable.obb.applyMatrix4(player.handle.matrixWorld);
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
            } else {
                this.initializePlayerCollider(player);
            }
        });
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
