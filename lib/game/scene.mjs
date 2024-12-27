import { SphereGeometry, Mesh, MeshBasicMaterial } from 'three';
import Engine from './engine.mjs';

export default class SceneManager {

    static setup() {
        // Create large sphere for the world
        const worldGeometry = new SphereGeometry(100, 32, 32);
        const worldMaterial = new MeshBasicMaterial({ 
            color: 0x808080, 
            wireframe: true 
        });
        const world = new Mesh(worldGeometry, worldMaterial);
        
        Engine.scene.add(world);
    };

};
