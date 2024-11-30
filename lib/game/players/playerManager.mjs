import { BoxGeometry, MeshStandardMaterial, Mesh, Vector3, Object3D } from 'three';
import State from '../state.mjs';

export default class PlayerManager {
    static players = new Map();
    static protagonist = null;

    static isValidPlayer(player) {
        return player && 
               player.mesh && 
               player.camera && 
               player.pivot && 
               player.cameraPivot;
    }

    static reset() {
        const protagonist = State.protagonist; // Use getter
        if (protagonist?.mesh) {
            protagonist.mesh.parent?.remove(protagonist.mesh);
        }
        State.clearPlayers();
    }

    static async create(scene, camera) {
        // Add validation with detailed error messages
        if (!scene) {
            throw new Error('Cannot create player: scene is required');
        }
        if (!camera) {
            throw new Error('Cannot create player: camera is required');
        }

        // Validate scene is a Three.js Scene
        if (!scene.isScene) {
            throw new Error('Invalid scene object provided');
        }

        try {
            const player = await this._createPlayerMesh(scene);
            player.camera = camera;
            State.setProtagonist(player);
            this.players.set('protagonist', player);
            return true;
        } catch (err) {
            console.error('Failed to create player:', err);
            throw err;
        }
    }

    static getProtagonist() {
        return State.protagonist; // Use getter
    }

    static remove(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            if (player.mesh) {
                player.mesh.parent?.remove(player.mesh);
            }
            this.players.delete(playerId);
            State.removePlayer(playerId);
        }
    }

    static verifySpawn() {
        const protagonist = State.protagonist; // Use getter
        if (!protagonist) return false;
        
        const pos = protagonist.pivot.position;
        const isValidPosition = !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z);
        const isInScene = !!protagonist.pivot.parent;
        
        return isValidPosition && isInScene;
    }

    static cleanup() {
        const protagonist = State.protagonist; // Use getter
        if (protagonist?.mesh)
            protagonist.mesh.parent?.remove(protagonist.mesh);
        if (protagonist?.pivot)
            scene.remove(protagonist.pivot);
        if (protagonist?.cameraPivot)
            scene.remove(protagonist.cameraPivot);
        State.clearPlayers();
    }

    static getAllPlayers() {
        return Array.from(this.players.values());
    }

    static forEach(callback) {
        this.players.forEach(callback);
    }

    static addPlayer(id, player) {
        this.players.set(id, player);
        State.addPlayer(id, player);
    }

    static removePlayer(id) {
        this.players.delete(id);
        State.removePlayer(id);
    }

    static clearPlayers() {
        this.players.clear();
        State.clearPlayers();
    }

    static async _createPlayerMesh(scene) {
        // Create player geometry and material
        const geometry = new BoxGeometry(1, 2, 1); // Width, Height, Depth
        const material = new MeshStandardMaterial({ color: 0x00ff00 }); // Green color

        // Create the mesh
        const mesh = new Mesh(geometry, material);

        // Create a pivot object
        const pivot = new Object3D();
        pivot.add(mesh);

        // Position the player at the starting point
        pivot.position.set(0, 1, 0); // Adjust Y position to half the height

        // Add the pivot to the scene
        scene.add(pivot);

        // Return the player object with necessary properties
        return {
            mesh: mesh,
            pivot: pivot,
            camera: null,
            cameraPivot: new Object3D(),
            vel: new Vector3(),
            jumping: false,
            falling: false,
            // ...other player properties...
        };
    }
}