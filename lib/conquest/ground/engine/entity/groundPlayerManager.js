import { BoxGeometry, MeshBasicMaterial, Mesh, Vector3, TextGeometry, Texture, SpriteMaterial, Sprite } from 'three';


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

export default class GroundPlayerManager {

    static spawn(config) {
        const { position } = config;

        // Generate geometry and materials for this player object.
        const playerGeometry = new BoxGeometry(2, 2, 2);
        const playerMaterial = new MeshBasicMaterial({ 
            color: 0x00ff00,
            wireframe: true
        });
        const playerMesh = new Mesh(playerGeometry, playerMaterial);

        // TODO: Player should spawn with their coop user name.

        // Add label to mesh.
        playerMesh.add(generateLabel(config.username));

        // Set the position based on what the server returns.
        playerMesh.position.set(position.x, position.y, position.z);

        // Add the player to the relevent scene layer.
        window.GROUND_LEVEL.scene.add(playerMesh);

        // Add for global data access. =p
        window.GROUND_LEVEL.players[config.id] = {
            // Add a reference to player ID
            id: config.id,
            username: config.username,

            // Add mesh ID here.
            mesh_id: playerMesh.uuid,

            // Add mesh for easier testing, may be less performant for now.
            mesh: playerMesh,
            
            position,

            direction: new Vector3(0, 0, 0),
            rotation: new Vector3(0, 0, 0)
        };

        // Center the geometry to itself?
        // https://stackoverflow.com/questions/28848863/threejs-how-to-rotate-around-objects-own-center-instead-of-world-center
        playerMesh.geometry.center();

        return window.GROUND_LEVEL.players[config.id];
    }

    static move(move) {
        window.GROUND_LEVEL.socket
            .emit('player_moved', move);
    }
}