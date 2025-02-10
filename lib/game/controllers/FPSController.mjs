import { Quaternion, Vector3, Euler, Matrix4 } from 'three';
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

    // Track player's view angles for ground movement
    static eulerAngles = new Euler(0, 0, 0, 'YXZ');  // YXZ order matches natural view rotation

    // Camera may need detaching or transitions to other controllers.
    static reset() {
        // Initial camera attachment
        Engine.camera.position.set(0, 0.5, 0);
        Engine.camera.quaternion.set(0, 0, 0, 1);
        PlayersManager.self.mesh.add(Engine.camera);  // [1] Initial attachment to mesh
    };

    static falling() {
        // Handle rotates in space, camera follows because it's attached to mesh
        const rotX = new Quaternion().setFromAxisAngle(
            new Vector3(0, 1, 0),
            this.input.rotation.x
        );
        const rotY = new Quaternion().setFromAxisAngle(
            new Vector3(1, 0, 0),
            this.input.rotation.y
        );
        
        PlayersManager.self.handle.quaternion.multiply(rotX).multiply(rotY);
        PlayersManager.self.aim.copy(PlayersManager.self.handle.quaternion);
        // [2] No camera quaternion update needed - follows mesh automatically
    }

    static grounded() {
        // Handle rotates left/right, dragging camera with it
        if (this.input.rotation.x !== 0) {
            const yawRotation = new Quaternion().setFromAxisAngle(
                new Vector3(0, 1, 0),
                this.input.rotation.x
            );
            PlayersManager.self.handle.quaternion.multiply(yawRotation);
        }

        // Only update camera pitch (up/down)
        this.eulerAngles.x = Math.max(
            0.1,
            Math.min(Math.PI * 0.8, this.eulerAngles.x - this.input.rotation.y)
        );
        
        // Apply pitch-only rotation to camera
        Engine.camera.quaternion.setFromEuler(new Euler(this.eulerAngles.x, 0, 0));
    }

    // Handles all rotation using quaternions:
    // - In space: Full 6DOF rotation following view direction
    // - On ground: Rotation relative to planet's surface normal
    static update() {
        // Choose aiming mode based on falling state
        PlayersManager.self.falling ? 
            this.falling() : 
            this.grounded();
        
        // Reset input for next frame
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0);
        this.input.jump = false;
    };

    // Aligns player with planet surface on landing
    // This creates a smooth transition from space to surface movement
    static landing(upVector) {

        // Reset pitch but keep current yaw for smooth transition
        const currentYaw = this.eulerAngles.y;
        this.eulerAngles.set(0, currentYaw, 0);
        
        // [4] Camera alignment during landing
        this.eulerAngles.set(0, 0, 0);
        const surfaceAlignment = new Quaternion();
        surfaceAlignment.setFromUnitVectors(new Vector3(0, 1, 0), upVector);
        PlayersManager.self.handle.quaternion.copy(surfaceAlignment);
        Engine.camera.quaternion.copy(surfaceAlignment);  // Reset camera alignment
    };

};