import * as THREE from 'three';
import PlayerManager from './entities/playerManager';
import ControlsManager from './experience/controls/controlsManager';
import Physics from './experience/physics';

export default function engine(instance) {
    // Once the component has been unmounted, this should stop being applied.
    if (instance._isDestroyed) return;

    // Update game clock time.
    WORLD.timeIncrement = WORLD.timeIncrement + WORLD.delta;

    // Apply gravity to all players.
    Object.keys(WORLD.players).map(key => {
        const player = WORLD.players[key];

        let isSelf = PlayerManager.isSelf(player);
    
        // Initialise player position.
        let worldPos = new THREE.Vector3(0, 0, 1);
        player.handle.getWorldPosition(worldPos);
        let playerHeight = player.handle.position.length();

        // Handle SOI gravity capture.
        Physics.captureSOI(player, playerHeight, worldPos, isSelf);

        // Detect and update player grounded attribute.
        let playerSize = 0.4 / 2;
        let surfaceHeight = player.soi.surface;
        let height = playerSize + surfaceHeight;
        player.onGround = playerHeight <= (height + 0.0001);

        // Apply movement from calculations.
        Physics.applyMovement(player, playerHeight, surfaceHeight, isSelf);

        // Apply friction
        Physics.applyFriction(player, playerHeight, height);

        // Apply first person looking to the player rotation.
        player.mesh.quaternion.copy(player.aim);

        // Calculate and set up direction (forward)
        const planetWorldPos = new THREE.Vector3(0, 0, 1);
        player.soi.body.getWorldPosition(planetWorldPos);
        const altDirection = player.handle.localToWorld(new THREE.Vector3(0, 1, 0))
            .sub(worldPos)
            .normalize();
        player.handle.up.set(altDirection.x, altDirection.y, altDirection.z);
    
        // Look at the ground
        player.handle.lookAt(planetWorldPos);
    });

    // Send position update.
    if (WORLD.socket && WORLD?.me?.config?.player_id)
        WORLD.me.player.emitPosition();

    // Rotate the planets.
    WORLD.planets.map(planet => {
        if (planet.velocity) {
            planet.pivot.rotation.y = 2 * Math.PI * planet.velocity * WORLD.timeIncrement;
            planet.body.rotation.y = 2 * Math.PI * planet.spin * WORLD.timeIncrement;
        }
    });

    // Handle camera changes.
    if (WORLD.settings.view.DESIRED_CAMERA_KEY !== WORLD.settings.view.CURRENT_CAMERA_KEY)
        ControlsManager.change(WORLD.settings.view.DESIRED_CAMERA_KEY);

    // Update the camera changes over WORLD.timeIncrement.
    WORLD.controls.update(WORLD.delta);

    // If there is an incomplete tween, process it.
    if (WORLD.tween) WORLD.tween.update();

    // Render the scene.
    WORLD.composer.render();

    // Recurse frames.
    window.requestAnimationFrame(() => engine(instance));
}
