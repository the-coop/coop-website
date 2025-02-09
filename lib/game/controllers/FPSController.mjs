import { Quaternion, Vector3, Matrix4 } from 'three';
// Handles first-person camera controls
// Uses quaternions for rotation to avoid gimbal lock
// Maintains separate pitch/yaw tracking for smooth camera movement
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    // Input state is reset each frame after processing
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false
    };

    // Pitch is clamped to avoid camera flipping
    // yRotation is private to enforce rotation order
    static pitch = 0;
    static #yRotation = 0;  // Add this class field to track rotation

    // Temporary quaternions for rotation calculations
    static #tempQuat = new Quaternion();
    static #xAxis = new Vector3(1, 0, 0);
    static #yAxis = new Vector3(0, 1, 0);

    static reset() {
        const player = PlayersManager.self;
        Engine.camera.position.set(0, 0.3, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1);
        player.mesh.add(Engine.camera);
        this.pitch = 0;
        this.#yRotation = 0;
    };

    static update() {
        const player = PlayersManager.self;
        
        if (this.input.rotation.x || this.input.rotation.y) {
            // Update pitch and yaw tracking
            this.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.pitch - this.input.rotation.x));
            this.#yRotation += this.input.rotation.y;
            
            // Apply rotations directly with quaternions
            this.#tempQuat.setFromAxisAngle(this.#xAxis, this.pitch);
            player.aim.setFromAxisAngle(this.#yAxis, this.#yRotation).multiply(this.#tempQuat);
            Engine.camera.quaternion.copy(player.aim);
        }
        
        // Reset input state
        Object.values(this.input).forEach(v => v instanceof Vector3 && v.set(0, 0, 0));
        this.input.jump = false;
    };

    static onLanding(player) {
        // Align camera with planet's horizon by resetting pitch but keeping yaw
        this.pitch = 0;
        player.aim.setFromAxisAngle(this.#yAxis, this.#yRotation);
        Engine.camera.quaternion.copy(player.aim);
    };

};