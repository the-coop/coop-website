import { SphereGeometry, MeshStandardMaterial, Mesh, BoxGeometry, Vector3, AxesHelper, GridHelper } from 'three';

export default class SceneManager {
    static assets = [];

    static reset() {
        this.assets = [];
    };

    static getRandomSphericalPosition() {
        return {
            phi: Math.acos(2 * Math.random() - 1), // Uniform distribution on sphere
            theta: Math.random() * Math.PI * 2,
            size: 0.5 + Math.random() * 4.5 // Random size between 0.5 and 5
        };
    }

    static setup(scene) {
        // Add frames of reference
        const axesHelper = new AxesHelper(100); // Length of axes lines
        scene.add(axesHelper);

        // const gridHelper = new GridHelper(800, 80); // Size and divisions
        // gridHelper.rotation.x = Math.PI / 2; // Rotate to lie on the horizontal plane
        // scene.add(gridHelper);

        // Create larger sphere with shadow properties
        const geo = new SphereGeometry(400, 64, 64);  // Increased from 200 to 400
        const mat = new MeshStandardMaterial({ 
            color: 0x44aa44,
            metalness: 0.3,
            roughness: 0.7
            // wireframe: true // Disable wireframe for better shadow effects
        });
        const sphere = new Mesh(geo, mat);
        sphere.castShadow = true;    // Sphere casts shadows
        sphere.receiveShadow = true; // Sphere receives shadows
        scene.add(sphere);

        // Generate 50 random cubes with varied sizes
        const cubePositions = Array(50).fill(0).map(() => this.getRandomSphericalPosition());

        // Add cubes using the random positions
        this.assets = cubePositions.map(pos => {
            const cube = new Mesh(
                new BoxGeometry(pos.size, pos.size, pos.size),
                new MeshStandardMaterial({ 
                    color: 0xffff00,
                    metalness: 0.5,
                    roughness: 0.5
                })
            );
            
            // Enable shadows for cubes
            cube.castShadow = true;
            cube.receiveShadow = true;

            // Position slightly above surface to prevent intersection
            const radius = 400 + pos.size / 2;  // Increased from 200 to 400
            cube.position.setFromSphericalCoords(radius, pos.phi, pos.theta);
            scene.add(cube);
            return cube;
        });
    };
};
