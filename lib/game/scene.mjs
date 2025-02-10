import { SphereGeometry, Mesh, MeshBasicMaterial } from 'three';
import Engine from './engine.mjs';

// Manages all celestial bodies and their relationships
// Currently handles planet creation and placement
export default class SceneManager {
    // Array of all planets in the scene
    // Referenced by Physics system for gravity calculations
    static planets = [];

    static setup() {
        // Planet configuration array
        // Each entry defines:
        // - radius: Size of the planet (affects gravity strength)
        // - color: Visual appearance in wireframe mode
        // - position: [x,y,z] coordinates in world space
        this.planets = [
            { radius: 500, color: 0x808080, position: [0, -1000, 0] },    // Main planet below
            { radius: 300, color: 0x404040, position: [1000, 0, 0] }      // Second planet to side
        ].map(({ radius, color, position }) => {
            // Create planet mesh:
            // - SphereGeometry(radius, widthSegments, heightSegments)
            // - More segments = smoother sphere but higher polygon count
            const planet = new Mesh(
                new SphereGeometry(radius, 32, 32),
                new MeshBasicMaterial({ color, wireframe: true })
            );
            
            // Position planet in world space
            // spread operator converts array to individual arguments
            planet.position.set(...position);
            
            // Add to Three.js scene for rendering
            Engine.scene.add(planet);
            
            return planet;
        });
    };
};
