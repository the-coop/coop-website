import { SphereGeometry, Mesh, MeshBasicMaterial, Color, BufferAttribute } from 'three';
import Engine from './engine.mjs';

// Manages all celestial bodies and their relationships
// Currently handles planet creation and placement
export default class SceneManager {
    // Array of all planets in the scene
    // Referenced by Physics system for gravity calculations
    static planets = [];


    static reallybasicNoise(x, y, z, scale) {
        return (Math.sin((y * 0.1) * scale) + Math.sin((x * 0.11 + 0.2) * scale) + Math.sin((z * 0.15 + 0.3) * scale)) / scale;
    }

    static buildPlanetMesh(Geometry, planetdata) {
        const positionNumComponents = 3;
        const colorNumComponents = 3;
        const VertexCount = Geometry.attributes.position.array.length / positionNumComponents;
        const colours = new Float32Array(VertexCount * colorNumComponents);

        const Water = new Color(planetdata.watercolor);
        const Land = new Color(planetdata.color);


        for (let i = 0; i < VertexCount; i++) {

            const x = Geometry.attributes.position.array[i * positionNumComponents + 0];
            const y = Geometry.attributes.position.array[i * positionNumComponents + 1];
            const z = Geometry.attributes.position.array[i * positionNumComponents + 2];

            let Magnatude = this.reallybasicNoise(x, y, z, 1) + this.reallybasicNoise(x, y, z, 2) + this.reallybasicNoise(x, y, z, 0.5);
            const Result = Water.clone().lerp(Land, (Magnatude) /2);


            colours[i * colorNumComponents] = Result.r;
            colours[i * colorNumComponents + 1] = Result.g;
            colours[i * colorNumComponents + 2] = Result.b;
        }
        
        Geometry.setAttribute('color', new BufferAttribute(colours, 3));

    }


    static setup() {
        // Planet configuration array
        // Each entry defines:
        // - radius: Size of the planet (affects gravity strength)
        // - color: Visual appearance in wireframe mode
        // - position: [x,y,z] coordinates in world space
        // - CoF coefficent of terrain friction, 0 to 1
        this.planets = [
            { radius: 500, color: 0x800080, watercolor: 0x0000ff, position: [0, -1000, 0], CoF: 0.2 },    // Main planet below
            { radius: 300, color: 0x404040, watercolor: 0x0000ff, position: [1000, 0, 0], CoF: 0.2 }      // Second planet to side
        ].map((planetdata) => {
            const { radius, color, position }  = planetdata;
            // Create planet mesh:
            // - SphereGeometry(radius, widthSegments, heightSegments)
            // - More segments = smoother sphere but higher polygon count
            
            const Geometry = new SphereGeometry(radius, 128, 128);
            this.buildPlanetMesh(Geometry, planetdata);
        
            const planet = new Mesh(
                Geometry,
                new MeshBasicMaterial({ color: 0xFFFFFF, vertexColors: true, wireframe: false })
            );
            
            // Position planet in world space
            // spread operator converts array to individual arguments
            planet.position.set(...position);
            
            // Add to Three.js scene for rendering
            Engine.scene.add(planet);

            planetdata.object = planet;

            return planetdata;
        });
    };
};
