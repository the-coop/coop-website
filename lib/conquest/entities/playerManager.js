import Player from '~/lib/conquest/entities/player';

export default class PlayerManager {
    constructor() {

    }

    static isSpawned() {
        console.log('Invalid spawn check');
        return true;
    }

    static add(data) {
        console.log('Trying to add player');
        console.log(data);

        // PlayerManager.isSpawned()
            // Spawn the player, unless unspawned.
                // TODO If player logged in spawn/re-center world.

        const player = new Player();

        WORLD.players[data.id] = player;
        WORLD.me.player = player;

        player.handle.position.set(0, -1, -1);

        // Add the mesh to the handle.
        player.handle.add(player.mesh);
        player.current_planet = WORLD.planets[1];
        player.current_planet.body.add(player.handle);
    }
}