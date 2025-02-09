import { SphereGeometry, Mesh, MeshBasicMaterial } from 'three';
import Engine from './engine.mjs';

export default class SceneManager {
    static planets = [];

    static setup() {
        this.planets = [
            { radius: 100, color: 0x808080, position: [0, 0, 0] },
            { radius: 80, color: 0x404040, position: [300, 0, 0] }
        ].map(({ radius, color, position }) => {
            const planet = new Mesh(
                new SphereGeometry(radius, 32, 32),
                new MeshBasicMaterial({ color, wireframe: true })
            );
            planet.position.set(...position);
            Engine.scene.add(planet);
            return planet;
        });
    };
    
};
