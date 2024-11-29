import { BoxGeometry, MeshStandardMaterial, Mesh, Vector3, Object3D } from 'three';
import Engine from '../engine.mjs';
import State from '../state.mjs';

export default class PlayerManager {
    static players = new Map();  // Add this line at the top with other static properties

    static isValidPlayer(player) {
        return player && 
               player.mesh && 
               player.camera && 
               player.pivot && 
               player.cameraPivot;
    }

    static reset() {
        const protagonist = State.protagonist;
        if (protagonist?.mesh) {
            protagonist.mesh.parent?.remove(protagonist.mesh);
        }
        State.clearPlayers();
    }

    static async create(scene, camera) {
        if (!scene || !camera) return null;

        try {
            const pivot = new Object3D();
            scene.add(pivot);
            
            const cameraPivot = new Object3D();
            pivot.add(cameraPivot);

            const playerMesh = new Mesh(
                new BoxGeometry(1, 2, 1),
                new MeshStandardMaterial({ 
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            playerMesh.castShadow = true;
            playerMesh.receiveShadow = true;
            pivot.add(playerMesh);
            cameraPivot.add(camera);

            // Set positions
            pivot.position.set(0, 2, 0);
            cameraPivot.position.set(0, 0.85, 0);
            
            const player = {
                mesh: playerMesh,
                pivot,
                cameraPivot,
                camera,
                vel: new Vector3(),
                velocity: new Vector3(),
                surfaceNormal: new Vector3(0, 1, 0),
                onGround: false,
                canJump: true,
                jumping: false,
                falling: false,
                speed: 10,
                jumpForce: 15
            };

            State.setProtagonist(player);
            return player;

        } catch (err) {
            console.error('Player creation failed:', err);
            return null;
        }
    }

    // Add this getter to allow accessing the protagonist as a property
    static get protagonist() {
        return State.protagonist;
    }

    static getProtagonist() {
        return State.protagonist;
    }

    static getPlayer() {
        return State.protagonist;
    }

    static remove(playerId) {
        const player = State.players.get(playerId);
        if (player) {
            if (player.pivot) player.pivot.parent?.remove(player.pivot);
            State.removePlayer(playerId);
        }
    }

    static verifySpawn() {
        const protagonist = State.protagonist;
        if (!protagonist) return false;
        
        const pos = protagonist.pivot.position;
        const isValidPosition = !isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z);
        const isInScene = !!protagonist.pivot.parent;
        
        return isValidPosition && isInScene;
    }

    static cleanup() {
        const protagonist = State.protagonist;
        if (protagonist?.mesh) protagonist.mesh.parent?.remove(protagonist.mesh);
        if (protagonist?.pivot) protagonist.pivot.parent?.remove(protagonist.pivot);
        if (protagonist?.cameraPivot) protagonist.cameraPivot.parent?.remove(protagonist.cameraPivot);
        State.clearPlayers();
    }

    static getAllPlayers() {
        return Array.from(this.players.values());
    }

    static forEach(callback) {
        this.players.forEach(callback);
    }

    // Update other methods to use both local and State storage
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
}