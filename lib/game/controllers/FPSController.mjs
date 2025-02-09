import { Quaternion, Vector3 } from 'three';
import PlayersManager from '../players.mjs';
import Engine from '../engine.mjs';

export default class FPSController {
    static input = {
        movement: new Vector3(),
        rotation: new Quaternion(),
        jump: false
    };

    static reset() {
        // Engine.camera.position.set(0, 0.3, 0);
        // Engine.camera.quaternion.set(0, 0, 0, 1);
        // PlayersManager.self.mesh.add(Engine.camera);
    };

    static update() {
        const player = PlayersManager.self;
        
        // Apply any additional rotation from input
        player.aim.multiply(this.input.rotation);
        
        // Update camera to match player aim
        Engine.camera.quaternion.copy(player.aim);
        
        // Reset input state
        this.input.movement.set(0, 0, 0);
        this.input.rotation.set(0, 0, 0, 1);
        this.input.jump = false;
    };

    static landing(upVector, surfacePosition) {
        const player = PlayersManager.self;
        
        // Align with planet surface when landing
        const surfaceAlignment = new Quaternion();
        const worldUp = new Vector3(0, 1, 0);
        surfaceAlignment.setFromUnitVectors(worldUp, upVector);
        
        // Set player's aim to surface tangent
        player.aim.copy(surfaceAlignment);
        
        console.log('player landed at', surfacePosition);
    };

};