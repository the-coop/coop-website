import { Quaternion, Vector3, Euler } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    // Input adapter that standardizes different input methods (keyboard/mouse, gamepad)
    // into a shared format that the FPS controller can process:
    // - movement: unified directional input (WASD/Stick)
    // - rotation: unified view changes (Mouse/Stick)
    // - jump: unified action button (Space/Button)
    static input = {
        movement: new Vector3(),
        rotation: new Vector3(),
        jump: false
    };

    // Keep track of current euler angles when on ground
    static eulerAngles = new Euler(0, 0, 0, 'YXZ');

    // Camera may need detaching or transitions to other controllers.
    static reset() {
        // Position camera slightly above center
        Engine.camera.position.set(0, 0.5, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1);
        // Attach camera to visual mesh instead of handle
        PlayersManager.self.mesh.add(Engine.camera);
    };

    // Handles all rotation using quaternions:
    // - In space: Full 6DOF rotation following view direction
    // - On ground: Rotation relative to planet's surface normal
    static update() {
        if (PlayersManager.self.falling) {
            // Space/falling mode: Full quaternion rotation
            const rotX = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), this.input.rotation.x);
            const rotY = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), this.input.rotation.y);
            PlayersManager.self.aim.multiply(rotX).multiply(rotY);
        } else {
            // Ground mode: Euler angles for restricted rotation
            this.eulerAngles.y += this.input.rotation.x; // Yaw (left/right)
            this.eulerAngles.x += this.input.rotation.y; // Pitch (up/down)
            
            // Clamp pitch to prevent over-rotation
            this.eulerAngles.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.eulerAngles.x));
            
            // Convert euler to quaternion
            PlayersManager.self.aim.setFromEuler(this.eulerAngles);
        }

        // Update camera to match player aim
        Engine.camera.quaternion.copy(PlayersManager.self.aim);
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
    };

    // Aligns player with planet surface on landing
    // This creates a smooth transition from space to surface movement
    static landing(upVector, surfacePosition) {
        // Reset euler angles for ground movement
        this.eulerAngles.set(0, 0, 0);
        
        // Align with planet surface
        const surfaceAlignment = new Quaternion();
        surfaceAlignment.setFromUnitVectors(new Vector3(0, 1, 0), upVector);
        PlayersManager.self.aim.copy(surfaceAlignment);
        
        console.log('player landed at', surfacePosition);
    };

};