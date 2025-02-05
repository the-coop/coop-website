import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import Engine from './engine.mjs';
import Physics from './physics.mjs';

export default class PlayersManager {
    static players = [];
    static self;
    
    static spawn() {
        // Clear existing players
        this.players.forEach(p => {
            Engine.camera.parent?.remove(Engine.camera);
            Engine.scene.remove(p);
        });
        this.players = [];
        this.self = null;
        
        // Create handle for surface alignment
        const handle = new Mesh(
            new BoxGeometry(1, 1, 1),
            new MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        
        // Create player mesh for rotation and camera
        const player = new Mesh(
            new BoxGeometry(0.8, 0.8, 0.8),
            new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        );
        
        // Setup hierarchy with player mesh at bottom of handle
        handle.add(player);
        handle.player = player;
        player.handle = handle;
        
        // Position player mesh with feet at handle bottom
        player.position.set(0, -0.1, 0); // Slight offset to ensure feet are at handle bottom
        
        // Add camera to player mesh at eye level (relative to feet)
        Engine.camera.position.set(0, 0.7, 0); // Measure from feet up
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
        
        // Initial setup
        handle.position.set(0, 1000, 0);
        handle.velocity = new Vector3();
        handle.soi = Physics.calculateSOI(handle.position);
        handle.falling = true;
        handle.grounded = false;
        
        Engine.scene.add(handle);
        
        this.self = handle;
        this.players.push(handle);
        
        return handle;
    }
}
