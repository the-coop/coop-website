import PlayerManager from './entities/playerManager';
import ControlsManager from './experience/controls/controlsManager';
import Physics from './experience/physics';

export default function engine(instance) {
    // Once the component has been unmounted, this should stop being applied.
    if (instance._isDestroyed) return;

    // Update game clock time.
    WORLD.timeIncrement = WORLD.timeIncrement + WORLD.delta;

    // Update physics (planetary rotation etc).
    // Physics.update();

    // Apply player movement.
    PlayerManager.update();

    // Update the controls.
    ControlsManager.update()

    // Render the scene.
    WORLD.composer.render();

    // Recurse frames.
    window.requestAnimationFrame(() => engine(instance));
}
