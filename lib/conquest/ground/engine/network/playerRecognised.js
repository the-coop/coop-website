import GroundPlayerManager from '../entity/groundPlayerManager';

export default function playerRecognised({ id, position, color }) {
const player = GroundPlayerManager.spawn(id, position, color);

    console.log(player);
    
    // Debugging only.
    console.log('player recognised data', { id, position, color });
}