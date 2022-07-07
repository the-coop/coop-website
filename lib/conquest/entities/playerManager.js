import Player from '~/lib/conquest/entities/player';
import { Texture, SpriteMaterial, Sprite } from 'three';

const generateLabel = (text = '???') => {
    const canvas = document.createElement('canvas');
    const size = 256; // CHANGED
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; // CHANGED
    context.textAlign = 'center';
    context.font = '24px Arial';
    context.fillText(text, size / 2, size / 2);

    const amap = new Texture(canvas);
    amap.needsUpdate = true;

    const mat = new SpriteMaterial({
        map: amap,
        transparent: true,
        color: 0xffffff
    });

    const textSprite = new Sprite(mat);
    textSprite.scale.set(10, 10, 1);
    textSprite.position.set(0, 1.75, 0);
    return textSprite;
}

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
        if (WORLD.players[data.player_id]) return;

        const player = new Player(data.player_id, data);

        WORLD.players[data.player_id] = player;

        player.handle.position.set(0, -1, -1);
        
        // Add the mesh to the handle.
        player.handle.add(player.mesh);
        player.soi = WORLD.planets[1];
        player.soi.body.add(player.handle);

        player.handle.add(generateLabel(player.config.username))
        
        console.log('Added player', data, player);

        return player;
    }
}