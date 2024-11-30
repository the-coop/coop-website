import State from '../state.mjs';
// import { Player } from './player.mjs'; // Remove this import

export default class PlayerManager {
    static players = [];

    static async setup(scene) {
        // Initialize player manager with the scene
        try {
            // Player setup logic removed
            console.log('PlayerManager: Setup complete without Player.');
            return true;
        } catch (err) {
            console.error('PlayerManager: Setup failed:', err);
            return false;
        }
    }

    static async create(scene, camera) {
        // Player creation logic removed
        console.warn('PlayerManager: create method called but Player is not used.');
        return null;
    }

    static getProtagonist() {
        return null; // No protagonist
    }

    static async setupForGame(scene) {
        return this.setup(scene); // Delegate to setup method
    }

    static reset() {
        // Cleanup logic without Player
        this.players = [];
        State.setProtagonist(null);
        console.log('PlayerManager: Players have been reset.');
    }
}