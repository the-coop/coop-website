import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import FPS from './controllers/fps.mjs';
import PlayerManager from './players/playerManager.mjs';
import Gravity from './physics/gravity.mjs';
import SceneManager from './scenes/sceneManager.mjs';

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
        
        this.rend.setSize(window.innerWidth, window.innerHeight);
        this.rend.setClearColor(0x000000);
        
        SceneManager.setup(this.scene);
        
        const me = PlayerManager.create(this.scene, this.cam);
        
        window.addEventListener('resize', this.resize);
        FPS.setup(me);
        this.loop();
    };

    static loop() {
        const delta = Math.min(0.1, (performance.now() - this.time) / 1000);
        this.time = performance.now();
        
        FPS.update(delta);
        Gravity.apply(delta);
        
        this.rend.render(this.scene, this.cam);
        this.frame = requestAnimationFrame(() => this.loop());
    };

};