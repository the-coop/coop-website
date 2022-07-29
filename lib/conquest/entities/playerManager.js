import { Texture, SpriteMaterial, Sprite, Vector3 } from 'three';
import Player from '~/lib/conquest/entities/player';
import { PLAYER_SIZE } from '../config';
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

    static remove(id) {
        // Remove the objects from the scene.
        WORLD.players[id]?.handle.remove();
        WORLD.players[id]?.mesh.remove();

        // Remove the remaining reference to the player.
        delete WORLD.players[id];
    }

    static add(data) {
        // Remove so this can be used for respawning and reconnecting, allow overwrite.
        this.remove(data.player_id);

        // Create a new player instance with mesh and data.
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

    static update(elapsed) {
        Object.keys(WORLD.players).map(key => {
            const player = WORLD.players[key];
    
            let isSelf = PlayerManager.isSelf(player);
        
            // Initialise player position.
            let worldPos = new Vector3(0, 0, 1);
            player.handle.getWorldPosition(worldPos);
            let playerHeight = player.handle.position.length();
    
            // Handle SOI gravity capture.
            Physics.captureSOI(player, playerHeight, worldPos, isSelf);

            // Calculate and set up direction (forward)
            const planetWorldPos = new Vector3(0, 0, 1);
            player.soi.body.getWorldPosition(planetWorldPos);
            const altDirection = player.handle.localToWorld(new Vector3(0, 1, 0))
                .sub(worldPos)
                .normalize();
            player.handle.up.set(altDirection.x, altDirection.y, altDirection.z);
        
            // Look at the ground
            player.handle.lookAt(planetWorldPos);
    
            // Detect and update player grounded attribute.
            let playerBoundarySize = PLAYER_SIZE / 2;
            let surfaceHeight = player.soi.surface;
            let height = playerBoundarySize + surfaceHeight;
            const isGrounded = playerHeight <= (height + 0.0001);
            if (isGrounded && !player.onGround) {
                // grounding interception
                // TODO: Point up away from planet floor?
                console.log('intercepted grounding on', player.soi);

                const groundedUp = new Vector3();
                groundedUp.subVectors(player.handle.position, player.soi.body.position).normalize().negate();
                player.handle.up.set(groundedUp.x, groundedUp.y, groundedUp.z);
            }
            player.onGround = isGrounded;

            // Apply movement from calculations.
            const updatedPlayerHeight = Physics.applyPlayerMovement(elapsed,player, playerHeight, surfaceHeight, isSelf);
    
            // Apply friction
            Physics.applyFriction(player, updatedPlayerHeight, height,elapsed);
    
            // Apply first person looking to the player rotation.
            // WORLD.me.player.handle.rotation.applyQuaternion(aim);
            player.mesh.quaternion.copy(player.aim);
        });

        // Send own position update.
        if (WORLD.socket && WORLD?.me?.config?.player_id)
            WORLD.me.player.emitPosition();
    }

}
