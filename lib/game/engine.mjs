import { Scene, PerspectiveCamera, WebGLRenderer, PCFSoftShadowMap, DirectionalLight, AmbientLight } from 'three';
import FPS from './controllers/fps.mjs';
import PlayerManager from './players/playerManager.mjs';
import Gravity from './physics/gravity.mjs';
import SceneManager from './scenes/sceneManager.mjs';
import AnimationManager from './animations/animationManager.mjs'; // Ensure AnimationManager is imported

export default class Engine {
    static scene = null;
    static cam = null;
    static rend = null;
    static frame = null;
    static time = 0;

    static cleanup() {
        if (this.rend) this.rend.dispose();
        if (this.frame) cancelAnimationFrame(this.frame);
        
        window.removeEventListener('resize', this.resize);
        FPS.disconnect();
        AnimationManager.reset(); // Reset animations if necessary

        this.scene = null;
        this.cam = null;
        this.rend = null;
        this.frame = null;
        this.time = 0;
        
        SceneManager.reset();
        PlayerManager.reset();
    };

    static resize = () => {
        if (!this.cam || !this.rend) return;
        this.cam.aspect = window.innerWidth / window.innerHeight;
        this.cam.updateProjectionMatrix();
        this.rend.setSize(window.innerWidth, window.innerHeight);
    };

    static setup(canvas) {
        this.cleanup();
        this.scene = new Scene();
        this.cam = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.rend = new WebGLRenderer({ canvas: canvas.value, antialias: true });

        // Enable shadow mapping
        this.rend.shadowMap.enabled = true;
        this.rend.shadowMap.type = PCFSoftShadowMap; // Optional: smoother shadows

        this.rend.setSize(window.innerWidth, window.innerHeight);
        this.rend.setClearColor(0x000000);
        
        SceneManager.setup(this.scene);

        // Add lighting that casts shadows
        const directionalLight = new DirectionalLight(0xffffff, 1);
        directionalLight.position.set(100, 100, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;  // Default is 512
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        this.scene.add(directionalLight);

        // Add ambient light for softer shadows
        const ambientLight = new AmbientLight(0x404040); // Soft white light
        this.scene.add(ambientLight);

        const me = PlayerManager.create(this.scene, this.cam, false); // Create main player

        window.addEventListener('resize', this.resize);
        FPS.setup(me);
        this.loop();
    };

    static loop() {
        const delta = Math.min(0.1, (performance.now() - this.time) / 1000);
        this.time = performance.now();
        
        FPS.update(delta);
        AnimationManager.updateAnimations(delta); // Changed from updateArmSwing
        Gravity.apply(delta);
        FPS.applyGravityAndCheckLanding(); // Added to reset 'jumping' state
        
        this.rend.render(this.scene, this.cam);
        this.frame = requestAnimationFrame(() => this.loop());
    };

};