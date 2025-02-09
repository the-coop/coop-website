import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3, Quaternion } from 'three';
import Engine from './engine.mjs';
import Physics from './physics.mjs';

export default class PlayersManager {
    static players = [];
    static self;
    
    // Creates a new player with physics simulation setup
    // Camera is attached to mesh for smooth movement
    // Handle provides ground alignment and collision
    static spawn() {
        const player = {
            velocity: new Vector3(),
            position: new Vector3(0, 1000, 0),
            soi: null,
            falling: true,
            aim: new Quaternion(),
            handle: new Mesh(
                new BoxGeometry(1, 1, 1),
                new MeshBasicMaterial({ color: 0xff0000, wireframe: true })
            ),
            mesh: new Mesh(
                new BoxGeometry(0.8, 0.8, 0.8),
                new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
            )
        };
        
        player.handle.add(player.mesh);
        player.mesh.add(Engine.camera);
        Engine.camera.position.set(0, 0.7, 0);
        Engine.camera.matrixAutoUpdate = true;
        
        player.soi = Physics.calculateSOI(player.position);
        player.handle.position.copy(player.position);
        
        Engine.scene.add(player.handle);
        return this.self = this.players[0] = player;
    };
};
