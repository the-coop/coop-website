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
        
        // Create player cube
        const player = new Mesh(
            new BoxGeometry(1, 1, 1),  // Explicit dimensions
            new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        );
        
        // Setup initial state
        player.position.set(0, 1000, 0); // Planet radius (100) + 900 units above
        player.velocity = new Vector3();
        player.soi = Physics.calculateSOI(player.position);
        player.falling = true;
        
        // Add to scene
        Engine.scene.add(player);
        
        // Center camera in player cube
        Engine.camera.position.set(0, 0, 0);
        Engine.camera.rotation.set(0, 0, 0);
        player.add(Engine.camera);
        
        this.self = player;
        this.players.push(player);
        
        return player;
    }
}
