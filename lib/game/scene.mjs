import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import Engine from './engine.mjs';

export default class SceneManager {
    // Temp
    static cube;

    // Setup game and act as the entry point for game library.
    static setup() {
        this.cube = this.createCube();
        Engine.scene.add(this.cube);
    };

    static createCube() {
        const geometry = new BoxGeometry();
        const material = new MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        this.cube = new Mesh(geometry, material);
        return this.cube;
    };

};
