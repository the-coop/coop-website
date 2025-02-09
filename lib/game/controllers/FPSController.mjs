import { Quaternion, Vector3 } from 'three';
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
        rotation: new Quaternion(),
        jump: false
    };

    // Camera may need detaching or transitions to other controllers.
    static reset() {
        // Engine.camera.position.set(0, 0.3, 0);
        // Engine.camera.quaternion.set(0, 0, 0, 1);
        // PlayersManager.self.mesh.add(Engine.camera);
    };

    // Modify the player state based on input transforms.
    static update() {
        // Apply any additional rotation from input
        PlayersManager.self.aim.multiply(this.input.rotation);
        
        // Update camera to match player aim
        Engine.camera.quaternion.copy(PlayersManager.self.aim);
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0, 1);
        this.input.jump = false;
    };

    // Intercepts player landing on sphere surface.
    static landing(upVector, surfacePosition) {
        // Align with planet surface when landing
        const surfaceAlignment = new Quaternion();
        const worldUp = new Vector3(0, 1, 0);
        surfaceAlignment.setFromUnitVectors(worldUp, upVector);
        
        // Set player's aim to surface tangent
        PlayersManager.self.aim.copy(surfaceAlignment);
        
        console.log('player landed at', surfacePosition);
    };

};