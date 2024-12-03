import * as THREE from 'three';

export default class GameEngine {
    static createScene(container = null) {
        const scene = new THREE.Scene();
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || window.innerHeight;
        
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        
        renderer.setSize(width, height);
        camera.position.z = 5;
        
        return { scene, camera, renderer };
    }

    static createCube() {
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const cube = new THREE.Mesh(geometry, material);
        return cube;
    }

    static handleResize(renderer, camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
