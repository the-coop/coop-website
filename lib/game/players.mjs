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
        
        // Create handle (outer cube) for grounding and gravity
        const handle = new Mesh(
            new BoxGeometry(1, 1, 1),
            new MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        
        // Create player mesh (inner cube) for rotation and camera
        const player = new Mesh(
            new BoxGeometry(0.8, 0.8, 0.8),
            new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        );
        
        // Setup hierarchy
        handle.add(player);
        handle.player = player;  // Store reference to player
        player.handle = handle;  // Store reference to handle
        
        // Setup initial state
        handle.position.set(0, 1000, 0);
        handle.velocity = new Vector3();
        handle.soi = Physics.calculateSOI(handle.position);
        handle.falling = true;
        handle.grounded = false;
        
        // Add to scene and setup camera
        Engine.scene.add(handle);
        Engine.camera.position.set(0, 0, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
        
        this.self = handle;
        this.players.push(handle);
        
        return handle;
    }
}
