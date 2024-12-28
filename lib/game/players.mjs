import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import Engine from './engine.mjs';
import Physics from './physics.mjs';

export default class PlayersManager {
    static players = [];
    static self;
    
    static spawn() {
        const player = new Mesh(
            new BoxGeometry(),
            new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        );
        
        // Start much higher above planet surface
        player.position.set(0, 1000, 0); // Planet radius (100) + 900 units above
        player.velocity = new Vector3();
        player.soi = Physics.calculateSOI(player.position);
        player.falling = true;
        
        // Add to scene before attaching camera
        Engine.scene.add(player);
        this.self = player;
        this.players.push(player);
        
        // Ensure camera is properly attached
        Engine.camera.position.set(0, 1.8, 0);
        player.add(Engine.camera);
        
        return player;
    };
    
};
