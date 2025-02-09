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
        
        // player.aim.multiply(this.input.rotation);
        // Engine.camera.quaternion.copy(player.aim);
        
        // Reset input state
        // this.input.movement.set(0, 0, 0);
        // this.input.rotation.set(0, 0, 0, 1);
        // this.input.jump = false;
    };

    static landing() {
        // Called by Physics system when player transitions from falling to landed state
        // Ideal place to:
        // - Align camera with planet's horizon
        // - Play landing sound effects
        // - Create impact particles
        // - Apply screen shake or other effects
        // - Reset any air-control related states
        console.log('player landed');
    };

};