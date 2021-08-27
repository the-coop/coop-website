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
        // this.load.setBaseURL('https://www.thecoop.group');
        this.load.setBaseURL('http://localhost:3000');
    
        // this.load.image('background', 'conquest/fight.jpeg');
        this.load.multiatlas('nyx_idle', 'conquest/fight/animations/nyx_idle.json', 'conquest/fight/animations');
        this.load.multiatlas('nyx_walk', 'conquest/fight/animations/nyx_walk.json', 'conquest/fight/animations');
    }

    function create() {
        movementKeys = this.input.keyboard.addKeys({
            up: 'W',
            down: 'A',
            left: 'A',
            right: 'D'
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

        // Set current action for reference during switching of animations
        nyx.action = 'idle';
        nyx.direction = 'right';
    }

    function update() {
        if (movementKeys.right.isDown) {
            if (nyx.action !== 'walk') {
                nyx.anims.play('walk');
                nyx.action = 'walk';
            }
            if (nyx.action === 'walk' && nyx.direction !== 'right') {
                nyx.direction = 'right';
                nyx.setScale(0.5, 0.5);
            }
            nyx.x += 4;
        }

        if (movementKeys.left.isDown) {
            if (nyx.action !== 'walk') {
                nyx.anims.play('walk');
                nyx.action = 'walk';
            }
            if (nyx.action === 'walk' && nyx.direction !== 'left') {
                nyx.direction = 'left';
                nyx.setScale(-0.5, 0.5);
            }
            nyx.x -= 4;
        }


        if (movementKeys.left.isUp && nyx.action === 'walk' && nyx.direction === 'left') {
            nyx.action = 'idle';
            nyx.anims.play('idle');
        }
        if (movementKeys.right.isUp && nyx.action === 'walk' && nyx.direction === 'right') {
            nyx.action = 'idle';
            nyx.anims.play('idle');
        }


        // Jump
        // if (movementKeys.up.isDown) nyx.y -= 4;

        // Crouch
        // if (movementKeys.down.isDown) nyx.y += 4;
    }
    
}