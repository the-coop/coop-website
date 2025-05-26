export const PLAYER_CONFIG = {
  HEIGHT: 1.8,
  RADIUS: 0.4,
  WALK_SPEED: 8,
  RUN_SPEED: 16,
  JUMP_FORCE: 8,
  SPAWN_HEIGHT: 35
};

export const NETWORK_CONFIG = {
  INPUT_RATE: 60, // Hz
  RECONCILIATION_THRESHOLD: 0.1,
  PENDING_INPUT_TIMEOUT: 2000 // ms
};

export function parsePlayerState(data) {
  return {
    position: data.position || [0, 0, 0],
    velocity: data.velocity || [0, 0, 0],
    rotation: data.rotation || [0, 0, 0, 1],
    worldOrigin: data.worldOrigin || [0, 0, 0],
    inputSequence: data.inputSequence || 0,
    isGrounded: data.isGrounded || false
  };
}

export function formatPlayerState(position, velocity, rotation, worldOrigin, inputSequence, isGrounded) {
  return {
    position: position,
    velocity: velocity,
    rotation: rotation,
    worldOrigin: worldOrigin,
    inputSequence: inputSequence,
    isGrounded: isGrounded
  };
}
