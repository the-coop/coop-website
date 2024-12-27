import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
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
        
        // Position player above the planet (planet radius is 100)
        player.position.set(0, 120, 0);
        player.soi = Physics.calculateSOI(player.position);
        
        Engine.scene.add(player);

        this.self = player;
        this.players.push(player);
        
        return player;
    };
    
};
