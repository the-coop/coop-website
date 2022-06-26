import Player from '~/lib/conquest/entities/player';

export default class PlayerManager {
    constructor() {

    }

    static isSpawned() {
        // PlayerManager.isSpawned()
            // Spawn the player, unless unspawned.
                // TODO If player logged in spawn/re-center world.
        console.log('Invalid spawn check');
        return true;
    }

    static add(data) {
        // Prevent respawning/duplication.
        if (WORLD.players[data.id]) return;

        const player = new Player(data.id, data);

        WORLD.players[data.id] = player;

        player.handle.position.set(0, -1, -1);
        
        // Add the mesh to the handle.
        player.handle.add(player.mesh);
        player.current_planet = WORLD.planets[1];
        player.current_planet.body.add(player.handle);
        
        console.log('Added player', data, player);

        return player;
    }
}