import { BoxGeometry, MeshStandardMaterial, Mesh, Vector3, Object3D, SphereGeometry } from 'three';
import State from '../state.mjs';

export default class PlayerManager {
    static protagonist = null;
    static players = new Map();

    static isValidPlayer(player) {
        return player && 
               player.mesh && 
               player.camera && 
               player.pivot && 
               player.cameraPivot;
    }

    static reset() {
        if (this.protagonist) {
            // Clean up protagonist components
            if (this.protagonist.mesh && this.protagonist.mesh.parent) {
                this.protagonist.mesh.parent.remove(this.protagonist.mesh);
            }
            // Clean up other components...
            this.protagonist = null;
        }
        this.players.clear();
    }

    static async create(scene, camera) {
        if (this.protagonist) {
            console.warn('Protagonist already exists');
            return this.protagonist;
        }

        if (State.canStartGame()) { // Now only checks isEngineInitialised and !isGameStarted
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
                // Create base player object
                const player = {
                    mesh: null,
                    pivot: null,
                    cameraPivot: null,
                    camera: camera,
                    vel: new Vector3(),
                    jumping: false,
                    falling: false,
                    surfaceNormal: new Vector3(0, 1, 0),
                    firstPersonLeftHand: null,
                    firstPersonRightHand: null,
                };

                // Initialize mesh and pivots
                await this.initializePlayerComponents(player, scene);

                // Store as protagonist
                this.protagonist = player;
                this.players.set('protagonist', player);

                console.log('Player created successfully:', player);
                return player;

            } catch (err) {
                console.error('Failed to create player:', err);
                return null;
            }
        } else {
            console.warn('Cannot start game. Conditions not met.');
            return null;
        }
    }

    static getProtagonist() {
        if (!this.protagonist) {
            console.warn('Protagonist requested but not found');
            return null;
        }
        return this.protagonist;
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

    // Add helper method for component initialization
    static async initializePlayerComponents(player, scene) {
        // Create mesh
        const geometry = new SphereGeometry(0.25, 32, 32);
        const material = new MeshStandardMaterial({ color: 0xffff00 });
        player.mesh = new Mesh(geometry, material);
        player.mesh.castShadow = true;
        player.mesh.receiveShadow = true;

        // Create pivots
        player.pivot = new Object3D();
        player.cameraPivot = new Object3D();

        // Set up hierarchy
        scene.add(player.pivot);
        player.pivot.add(player.mesh);
        player.mesh.add(player.cameraPivot);
        
        // Add camera if it exists
        if (player.camera) {
            player.cameraPivot.add(player.camera);
        }

        // Initialize position
        player.pivot.position.set(0, 401, 0); // Start slightly above sphere surface
        player.cameraPivot.position.y = 0.85; // Eye height
        
        return player;
    }
}