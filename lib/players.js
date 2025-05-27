import * as THREE from 'three';

export class Player {
  constructor(id, name, color = 0xff9900) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.isGrounded = false;
    this.velocity = new THREE.Vector3();
  }

  updateFromController(controller) {
    this.position.copy(controller.getPosition());
    this.rotation.copy(controller.mesh.quaternion);
    this.isGrounded = controller.isGrounded;
  }
}

export class PlayersManager {
  constructor() {
    this.players = new Map();
    this.localPlayerId = null;
  }

  addPlayer(id, name, color) {
    const player = new Player(id, name, color);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  getPlayer(id) {
    return this.players.get(id);
  }

  getAllPlayers() {
    return Array.from(this.players.values());
  }
}
