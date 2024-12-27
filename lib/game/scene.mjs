import { SphereGeometry, Mesh, MeshBasicMaterial } from 'three';
import Engine from './engine.mjs';

export default class SceneManager {
    static planets = [];

    static setup() {
        // Create first sphere for the world
        const world1 = new Mesh(
            new SphereGeometry(100, 32, 32),
            new MeshBasicMaterial({ color: 0x808080, wireframe: true })
        );
        
        // Create second sphere offset
        const world2 = new Mesh(
            new SphereGeometry(80, 32, 32),
            new MeshBasicMaterial({ color: 0x404040, wireframe: true })
        );
        world2.position.set(300, 0, 0);
        
        this.planets.push(world1, world2);
        Engine.scene.add(world1);
        Engine.scene.add(world2);
    };

};
