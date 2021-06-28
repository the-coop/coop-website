export default function playerMoved(move) {
    const { me, players } = window.GROUND_LEVEL;

    console.log('player moving', move);

    // Maybe don't even need to distinguish me versus others.
    players[move.id].direction.set(
        move.direction.x,
        move.direction.y,
        move.direction.z,
    );
}