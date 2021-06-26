import { BoxGeometry, MeshBasicMaterial, Mesh } from 'three';

export default function playerRecognised({ position, id, color }) {
    // Generate geometry and materials for this player object.
    const playerGeometry = new BoxGeometry(2, 2, 2);
    const playerMaterial = new MeshBasicMaterial({ 
        color: 0x00ff00,
        wireframe: true
    });
    const playerMesh = new Mesh(playerGeometry, playerMaterial);

    // Set the position based on what the server returns.
    playerMesh.position.set(position.x, position.y, position.z);

    // Add the player to the relevent scene layer.
    window.GROUND_LEVEL.scene.add(playerMesh);

    // Add for global data access. =p
    window.GROUND_LEVEL.players[id] = {
        mesh: 'player',
        position
    };

    // Debugging only.
    console.log('player recognised data', { position, id, color });
}