import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3, Quaternion } from 'three';
import Engine from './engine.mjs';
import Physics from './physics.mjs';
import ControlManager from './control.mjs';
import FPSController from './controllers/FPSController.mjs';
import SceneManager from './scene.mjs';

export default class PlayersManager {
    static players = [];
    static self;
    
    // Creates a new player with physics simulation setup
    // Camera is attached to mesh for smooth movement
    // Handle provides ground alignment and collision
    static spawn(self = true, falling = true) {
        const firstPlanet = SceneManager.planets[0];
        const planetRadius = firstPlanet.geometry.parameters.radius;
        const spawnHeight = planetRadius + 400; // Spawn 400 units above planet surface
        
        // Spawn position needs to be relative to planet position
        // Moving along positive Z axis (away from initial camera position)
        const spawnPosition = firstPlanet.position.clone().add(new Vector3(0, 0, spawnHeight));
        
        const player = {
            // Current velocity vector - used by physics system
            // Persists between frames for continuous motion and acceleration
            velocity: new Vector3(),

            // Current world position - updated by physics and controls
            // This is the source of truth for player location
            position: spawnPosition, // Spawn above the first planet

            // Current Sphere of Influence - which planet affects this player
            // Set initial SOI to first planet
            soi: firstPlanet,

            // Falling state - determines if gravity should be applied
            // Also triggers landing events when transitioning to false
            falling: falling,

            // Player's current orientation relative to planet surface
            // Used for camera alignment and movement direction
            aim: new Quaternion(),

            // Physics collision mesh - slightly larger than visual mesh
            // Used for ground detection and planet surface alignment
            handle: new Mesh(
                new BoxGeometry(1, 1, 1),
                new MeshBasicMaterial({ color: 0xff0000, wireframe: true })
            ),

            // Visual representation - actual player model
            // Child of handle for automatic position/rotation updates
            mesh: new Mesh(
                new BoxGeometry(0.8, 0.8, 0.8),
                new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
            )
        };
        
        // Add physics handle to scene for collision detection
        Engine.scene.add(player.handle);
        // Attach visual mesh to handle for automated transforms
        player.handle.add(player.mesh);
        // Initialize position and align with planet surface
        player.handle.position.copy(player.position);
        
        // Don't set initial alignment, let physics handle it when falling
        
        // Setup player controls if this is the local player
        // Only the local player gets input control and camera
        if (self) {
            this.self = player;
            ControlManager.change(FPSController);
            FPSController.reset(); // Add this line to attach camera
        }
        
        this.players.push(player);
        return player;
    };
};
