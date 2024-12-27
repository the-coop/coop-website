import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import Engine from './engine.mjs';

export default class PlayersManager {
    static players = [];
    static self;
    
    static spawn() {
        const player = new Mesh(
            new BoxGeometry(),
            new MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        );
        
        Engine.scene.add(player);

        this.self = player;
        this.players.push(player);
        
        return player;
    };
    
};
