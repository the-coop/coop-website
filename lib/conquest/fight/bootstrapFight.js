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
        this.load.setBaseURL('https://thecoop.group');
        // this.load.setBaseURL('http://localhost:3000');
    
        this.load.image('sky', 'conquest/fight.jpeg');
    }
    
    function create() {
        this.add.image(400, 300, 'sky');
    }
}