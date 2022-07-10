import { Texture, SpriteMaterial, Sprite, Vector3 } from 'three';
import Player from '~/lib/conquest/entities/player';
import Physics from '../experience/physics';



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
    static isSpawned() {
        // PlayerManager.isSpawned()
            // Spawn the player, unless unspawned.
                // TODO If player logged in spawn/re-center world.
        console.log('Invalid spawn check');
        return true;
    }

    static isSelf(player) {
        return player.config.player_id === WORLD?.me?.config?.player_id;
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

    static update() {
        Object.keys(WORLD.players).map(key => {
            const player = WORLD.players[key];
    
            let isSelf = PlayerManager.isSelf(player);
        
            // Initialise player position.
            let worldPos = new Vector3(0, 0, 1);
            player.handle.getWorldPosition(worldPos);
            let playerHeight = player.handle.position.length();
    
            // Handle SOI gravity capture.
            Physics.captureSOI(player, playerHeight, worldPos, isSelf);
    
            // Detect and update player grounded attribute.
            let playerSize = 0.4 / 2;
            let surfaceHeight = player.soi.surface;
            let height = playerSize + surfaceHeight;
            player.onGround = playerHeight <= (height + 0.0001);

            // Apply movement from calculations.
            const updatedPlayerHeight = Physics.applyMovement(player, playerHeight, surfaceHeight, isSelf);
    
            // Apply friction
            Physics.applyFriction(player, updatedPlayerHeight, height);
    
            // Apply first person looking to the player rotation.
            player.mesh.quaternion.copy(player.aim);
    
            // Calculate and set up direction (forward)
            const planetWorldPos = new Vector3(0, 0, 1);
            player.soi.body.getWorldPosition(planetWorldPos);
            const altDirection = player.handle.localToWorld(new Vector3(0, 1, 0))
                .sub(worldPos)
                .normalize();
            player.handle.up.set(altDirection.x, altDirection.y, altDirection.z);
        
            // Look at the ground
            player.handle.lookAt(planetWorldPos);
        });

        // Send own position update.
        if (WORLD.socket && WORLD?.me?.config?.player_id)
            WORLD.me.player.emitPosition();
    }

}