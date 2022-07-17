import ComputerInput from "./inputs/computer";
import Physics from "./physics";
import { PLAYER_SPEED, THRUST_AMOUNT } from '../config';
import { Vector3 } from 'three';

export default class InputManager {
    static keyToggleHandler = (state, inputHandler) => ({ which }) => {
        if (which in inputHandler.keyCodeMap) {
            const key = inputHandler.keyCodeMap[which];
            inputHandler.inputs[key] = state;
        }
        return false;
    } 

    static applyPlayerInput(elapsed, player, playerHeight, surfaceHeight) {
        let { x, y, z } = InputManager.calculatePlayerThrust(player, playerHeight, surfaceHeight);

        // Transform global gravitational accelaration to local coordinates.
        const normalMatrix = Physics.getMeshGlobalPos(player.handle);
        const acceleration = new Vector3(x, y, z);
        acceleration.applyMatrix3(normalMatrix);

        // Move the player
        player.handle.position.addScaledVector(acceleration, 0.5 * elapsed * elapsed);
        player.handle.position.addScaledVector(player.velocity, elapsed);
        player.velocity.addScaledVector(acceleration, elapsed);
    }

    static calculatePlayerThrust(player, playerHeight, surfaceHeight) {
        // Convert computer specific input to general directions.
        let x = PLAYER_SPEED * ((+ComputerInput.inputs.a) - (+ComputerInput.inputs.d));
        let y = PLAYER_SPEED * ((+ComputerInput.inputs.w) - (+ComputerInput.inputs.s));
        let z = Physics.calcPlayerGravity(player, playerHeight, surfaceHeight);

        const thrustDirection = player.handle.position.clone().normalize();

        if (player.onGround) {
            if (ComputerInput.inputs.space)
                z = -THRUST_AMOUNT;

            if (ComputerInput.inputs.e)
                player.velocity.addScaledVector(thrustDirection, -1);

        } else {
            if (ComputerInput.inputs.space)
                player.velocity.addScaledVector(thrustDirection, 1);

            if (ComputerInput.inputs.e)
                z = THRUST_AMOUNT;
        }

        z = z + player.surfaceNormalThrust;
        player.surfaceNormalThrust = 0;

        return { x, y, z };
    }
}