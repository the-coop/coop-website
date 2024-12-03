<template>
  <div class="game-container" :class="{ 'fullscreen': isPlaying }">
    <div v-if="!isPlaying" class="start-screen">
      <h1 @click="startGame">Click to Play</h1>
    </div>
    <div ref="gameContainer" class="game-view" :class="{ active: isPlaying }"></div>
  </div>
</template>

<script>
import GameEngine from '../lib/game/engine.mjs'
import { inject } from 'vue'

export default {
  name: 'GameComponent',
  layout: 'default',
  data() {
    return {
      isPlaying: false,
      animationFrame: null,
      scene: null,
      camera: null,
      renderer: null,
      cube: null,
      layoutControl: null
    }
  },
  mounted() {
    this.layoutControl = inject('fullscreen');
    
    // Add fullscreen change listener
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  },
  methods: {
    handleFullscreenChange() {
      if (!document.fullscreenElement) {
        this.exitGame();
      }
    },
    
    exitGame() {
      // Cancel animation frame first
      if (this.animationFrame) {
        cancelAnimationFrame(this.animationFrame);
        this.animationFrame = null;
      }

      // Clean up renderer
      if (this.renderer) {
        this.renderer.dispose();
        this.renderer.domElement.remove(); // Remove canvas element
        this.renderer = null;
      }

      // Clean up Three.js resources
      if (this.scene) {
        this.scene.clear();
        this.scene = null;
      }
      this.camera = null;
      this.cube = null;

      // Reset game state
      this.isPlaying = false;
      
      // Reset layout state last
      this.layoutControl.setFullscreen(false);
    },
    
    startGame() {
      this.isPlaying = true;
      this.layoutControl.setFullscreen(true);
      this.$nextTick(() => {
        const container = this.$refs.gameContainer
        
        // Enter fullscreen
        if (container.requestFullscreen) {
          container.requestFullscreen()
        }
        
        // Apply pointer lock
        container.requestPointerLock = container.requestPointerLock ||
                                     container.mozRequestPointerLock ||
                                     container.webkitRequestPointerLock
        container.requestPointerLock()
        
        this.initGame()
      })
    },
    
    initGame() {
      const container = this.$refs.gameContainer;
      const { scene, camera, renderer } = GameEngine.createScene(container);
      this.scene = scene;
      this.camera = camera;
      this.renderer = renderer;
      
      this.cube = GameEngine.createCube();
      this.scene.add(this.cube);
      
      this.$refs.gameContainer.appendChild(renderer.domElement);
      
      // Handle window resize
      window.addEventListener('resize', () => {
        GameEngine.handleResize(renderer, camera);
      });
      
      this.animate();
    },
    
    animate() {
      if (this.cube) {
        this.cube.rotation.x += 0.01;
        this.cube.rotation.y += 0.01;
      }
      
      this.renderer.render(this.scene, this.camera);
      this.animationFrame = requestAnimationFrame(this.animate);
    }
  },
  beforeDestroy() {
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    this.exitGame();
  }
}
</script>

<style scoped>
.game-container {
  height: calc(100vh - 200px);
  display: flex;
  justify-content: center;
  align-items: center;
}

.game-container.fullscreen {
  height: 100vh;
  width: 100vw;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  background: #000;
}

.start-screen {
  text-align: center;
}

.start-screen h1 {
  display: inline-block;
  padding: 15px 30px;
  border: 2px solid white;
  cursor: pointer;
}

.game-view {
  display: none;
  width: 100%;
  height: 100%;
}

.game-view.active {
  display: block;
}
</style>
