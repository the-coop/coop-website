import PlayerManager from './entities/playerManager';
import ControlsManager from './experience/controls/controlsManager';
import Physics from './experience/physics';

let start, previousTimeStamp;

export default function engine(instance) {
    // Once the component has been unmounted, this should stop being applied.
    if (instance._isDestroyed) return;
    const timestamp = new Date().getTime() / 1000;
    if (start === undefined) {
      start = timestamp;
    }
    const elapsed = timestamp - start;
    
    // Update game clock time.
    WORLD.timeIncrement = WORLD.timeIncrement + elapsed;

    // Update physics (planetary rotation etc).
    // Physics.update(elapsed);

    // Apply player movement.
    PlayerManager.update(elapsed);

    // Update the controls.
    ControlsManager.update(elapsed)

    // Render the scene.
    WORLD.composer.render(elapsed);

    // Recurse frames.
    window.requestAnimationFrame(() => engine(instance));
}
