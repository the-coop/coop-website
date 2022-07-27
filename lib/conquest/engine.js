import PlayerManager from './entities/playerManager';
import ControlsManager from './experience/controlsManager';
import InputManager from './experience/inputManager';
import Physics from './experience/physics';

let enginePreviousTime;

export default function engine(instance) {
    // Once the component has been unmounted, this should stop being applied.
    if (instance._isDestroyed) return;

    // Current game/frame time.
    const engineCurrentTime = Date.now() / 1000;

    // Initialise start time.
    if (!enginePreviousTime)
      enginePreviousTime = engineCurrentTime;

    // Calculate elapsed game time.
    const elapsed = engineCurrentTime - enginePreviousTime;
  
    // Track the latest frame.
    enginePreviousTime = engineCurrentTime;

    // Update game clock time.
    WORLD.timeIncrement = WORLD.timeIncrement + elapsed;

    // Update physics (planetary rotation etc).
    Physics.update(elapsed);

    // Apply player movement.
    PlayerManager.update(elapsed);

    // Player.aim 
    // apply to the handle?

    // Prevent controls and input during camera animations.
    if (!WORLD.cameraAnimation) {
      // Update the controls.
      ControlsManager.update(elapsed)
  
      // Update input state.
      InputManager.update(elapsed);
      
    } else {
      WORLD.cameraAnimation.update();
    }

    // Render the scene.
    WORLD.composer.render(elapsed);

    // Recurse frames.
    window.requestAnimationFrame(() => engine(instance));
}
