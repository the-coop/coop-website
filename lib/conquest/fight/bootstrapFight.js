import Phaser from 'phaser';
import FightManager from './fightManager';

export default function bootstrapFight() {
    const canvasWrapper = document.querySelector('.fightgame');

    let movementKeys = {};
    let nyx = null;
    
    const config = {
        type: Phaser.AUTO,

        parent: canvasWrapper,
        width: canvasWrapper.offsetWidth,
        height: canvasWrapper.offsetHeight,

        // May be useful later: https://github.com/jriecken/sat-js
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 200 }
            }
        },

        backgroundColor: '#4488aa',

        scene: {
            preload,
            create,
            update
        }
    };

    FightManager.game = new Phaser.Game(config);
    
    function preload() {
        this.load.setBaseURL('https://www.thecoop.group');
        // this.load.setBaseURL('http://localhost:3000');
    
        // this.load.image('background', 'conquest/fight.jpeg');
        this.load.multiatlas('nyx_idle', 'conquest/fight/animations/nyx_idle.json', 'conquest/fight/animations');
        this.load.multiatlas('nyx_walk', 'conquest/fight/animations/nyx_walk.json', 'conquest/fight/animations');
    }

    function create() {
        movementKeys = this.input.keyboard.addKeys({
            up: 'up',
            down: 'down',
            left: 'left',
            right: 'right'
        });

        // this.add.image(0, 0, 'background');
        nyx = this.add.sprite(400, 400, 'nyx_idle');
        nyx.setScale(0.5, 0.5);

        const idleFrames = this.anims.generateFrameNames('nyx_idle', {
            start: 1, end: 10, zeroPad: 0,
            prefix: 'idle_', suffix: '.png'
        });
        this.anims.create({ key: 'idle', frames: idleFrames, frameRate: 9, repeat: -1 });

        const walkFrames = this.anims.generateFrameNames('nyx_walk', {
            start: 1, end: 10, zeroPad: 0,
            prefix: 'walk_', suffix: '.png'
        });
        this.anims.create({ key: 'walk', frames: walkFrames, frameRate: 9, repeat: -1 });

        // Trigger the initial animation state.
        nyx.anims.play('idle');
    }

    function update() {
        if (movementKeys.left.isDown) {
            nyx.anims.play('walk');
            nyx.x -= 4;
            // TODO: Should check scale isn't already that before setting.
            nyx.setScale(-0.5, 0.5);
        }
        if (movementKeys.right.isDown) {
            nyx.anims.play('walk');
            nyx.x += 4;
            // TODO: Should check scale isn't already that before setting.
            nyx.setScale(0.5, 0.5);
        }
        if (movementKeys.up.isDown) nyx.y -= 4;
        if (movementKeys.down.isDown) nyx.y += 4;        
    }
    
}