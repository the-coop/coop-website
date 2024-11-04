import { SphereGeometry, MeshBasicMaterial, Mesh, BoxGeometry, Vector3 } from 'three';

export default class SceneManager {
    static assets = [];

    static reset() {
        this.assets = [];
    };

    static getRandomSphericalPosition() {
        return {
            phi: Math.acos(2 * Math.random() - 1), // Uniform distribution on sphere
            theta: Math.random() * Math.PI * 2,
            size: 1 + Math.random() * 4 // Random size between 1 and 5
        };
    }

    static setup(scene) {
        // Create larger sphere
        const geo = new SphereGeometry(400, 64, 64);  // Increased from 200 to 400
        const mat = new MeshBasicMaterial({ 
            color: 0x44aa44,
            // wireframe: true
        });
        const sphere = new Mesh(geo, mat);
        scene.add(sphere);

        // Generate 50 random cubes
        const cubePositions = Array(50).fill(0).map(() => this.getRandomSphericalPosition());

        // Add cubes using the random positions
        this.assets = cubePositions.map(pos => {
            const cube = new Mesh(
                new BoxGeometry(pos.size, pos.size, pos.size),
                new MeshBasicMaterial({ 
                    wireframe: true,
                    color: 0xffff00
                })
            );
            
            // Position slightly above surface to prevent intersection
            const radius = 400 + pos.size/2;  // Increased from 200 to 400
            cube.position.setFromSphericalCoords(radius, pos.phi, pos.theta);
            scene.add(cube);
            return cube;
        });
    };
};
