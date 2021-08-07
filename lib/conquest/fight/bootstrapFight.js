import Phaser from 'phaser';
import FightManager from './fightManager';

export default function bootstrapFight() {
    const canvasWrapper = document.querySelector('.fightgame');

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

        scene: {
            preload: preload,
            create: create
        }
    };

    FightManager.game = new Phaser.Game(config);
    
    function preload() {
        this.load.setBaseURL('https://www.thecoop.group');
        // this.load.setBaseURL('http://localhost:3000');
    
        // this.load.image('background', 'conquest/fight.jpeg');
        this.load.multiatlas('nyx-idle', 'conquest/fight/animations/nyx-idle.json', 'conquest/fight/animations');
    }

    let nyx = null;
    function create() {
        // this.add.image(0, 0, 'background');
        nyx = this.add.sprite(400, 400, 'nyx-idle');
        nyx.setScale(0.5, 0.5);

        const frameNames = this.anims.generateFrameNames('nyx-idle', {
            start: 1, end: 10, zeroPad: 0,
            prefix: 'idle_', suffix: '.png'
        });

        this.anims.create({ key: 'idle', frames: frameNames, frameRate: 9, repeat: -1 });
        nyx.anims.play('idle');
    }
    
}