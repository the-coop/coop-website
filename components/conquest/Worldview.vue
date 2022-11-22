<template>
  <div class="worldview">
    <h1 class="error-text" v-if="!WEBGL_SUPPORT && !silent">Loading error...</h1>

    <div class="intro" v-show="uiBlocked && !silent">
      <Logo class="intro-logo" />
      <h1 class="intro-title">CONQUEST</h1>
    </div>

    <div 
      class="settings-toggle"
      @click="ev => { ev.preventDefault(); this.settingsOpen = !this.settingsOpen}"
      v-if="!silent">
      <Gear />
    </div>

    <div v-if="settingsOpen && !silent" class="settings">
      <h1>SETTINGS MENU</h1>

      <span v-show="$auth.$state.loggedIn" 
        class="primary-action"
        @click="logout">⏏️ Logout</span>

      <span class="primary-action" @click="toggleGUI">
        🐛 GUI
      </span>

      <span class="primary-action" @click="toggleControllers">
        🎮 CONTROLLERS
      </span>

      <span class="primary-action" @click="closeSettings">
        x Close
      </span>
    </div>

    <div class="primary" v-if="!silent && !uiBlocked">
      <button 
        class="primary-action"
        v-show="$auth.$state.loggedIn" 
        @click="spawn" 
        v-if="!silent && !spawned" id="spawn">
        🧬 Spawn
      </button>
      <NuxtLink v-show="!$auth.$state.loggedIn" 
        class="primary-action"
        :to="{ path: '/auth/login', query: { intent: 'game' }}">
        🔑 Login
      </NuxtLink>
    </div>

    <!-- TODO: Implement properly -->
    <div class="info" v-if="died">
      YOU DIED
    </div>

    <div class="info" v-if="!silent && guiOpen">
      Target: {{ selected }}

      <p>
        <button 
          @click="changeCamera"
          id="toggle_controls">SWITCH POV</button>
      </p>

      <!-- Temporary debug GUI. -->
      <div>
        <p v-for="p in players" :key="p.id">
          {{ p.config.username }}
          <span :style="{ minWidth: '300px' }">
            <p>X: {{ p.handle.position.x.toFixed(4) }}</p>
            <p>Y: {{ p.handle.position.y.toFixed(4) }}</p>
            <p>Z: {{ p.handle.position.z.toFixed(4) }}</p>

            G: {{ p.onGround }}
            CV: {{ p.correctionVelocity }}
            CT: {{ p.correctionTime }}
          </span>
        </p>
      </div>
    </div>

    <div class="info" v-if="controllersOpen">
      CONTROLLERS
    </div>

    <canvas id="canvas" />
  </div>
</template>

<style scoped>
  * {
    user-select: none;
  }
  .info {
    position: absolute;
    z-index: 1;
    top: 0;
    right: 0;

    background: rgba(255, 255, 255, 0.77);
    padding: .25em 2.25em;
  }
  .settings-toggle {
    position: absolute;
    z-index: 1;

    top: .35em;
    left: .75em;

    cursor: pointer;
  }
  .settings-toggle svg {
    fill: #747474;
    stroke: rgb(163, 162, 162);
    width: 1.75em;
  }
  .settings-toggle:hover svg {
    fill: #2d2d2d;
    stroke: rgb(144, 144, 144);
  }
  .settings {
    display: flex;
    position: fixed;

    height: 100%;
    width: 100%;

    background: rgba(23, 23, 23, 0.93);
    color: white;

    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 2;
  }
  .primary {
    position: absolute;
    z-index: 1;

    bottom: .35em;
    right: .75em;
  }
  .primary-action {
    font-size: 3em;
    color: rgba(255, 255, 255, 0.77);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: none;
  }
  .primary-action:hover {
    opacity: .65;
  }
  .worldview {
    width: 100vw;
    height: 100vh;

    position: fixed;
    top: 0;
    left: 0;
    z-index: -1;
  }

  .intro {
    position: absolute;
    z-index: 3;

    display: flex;
    flex-direction: column;
    align-items: center;

    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);

    animation: hide .5s;
    animation-delay: 4s;
    animation-fill-mode: both;
  }

  .intro-logo {
    animation: intro 2s;
    animation-fill-mode: both;
  }
  .intro-logo * {
    fill: #fffaee;
  }

  .intro-title {
    margin: 0;
    animation: grow 1.2s;
    animation-delay: 2.25s;
    animation-fill-mode: both;

    color: #fffaee;

    font-size: 7em;
  }

  @keyframes intro {
    0% {
      width: 12em;
      opacity: 0;
    }

    70% {
      width: 3em;
      opacity: 1;
    }

    100% {
      opacity: 0;
    }
  }
  @keyframes grow {
    from {
      font-size: 3em;
      opacity: 0;
    }
    to {
      font-size: 7em;
      opacity: 1;
    }
  }
  @keyframes hide {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
</style>

<script>
  import * as THREE from 'three';

  import ControlsManager from '~/lib/conquest/experience/controlsManager';

  import resizer from '~/lib/conquest/experience/resizing';
  import engine from '~/lib/conquest/engine';
  import buildSolarSystem from '~/lib/conquest/generation/buildSolarSystem';
  import setupNetworking from '~/lib/conquest/network/setupNetworking';

  import UNIVERSE_SPECIFICATION from '~/lib/conquest/generation/universe-specification.json';

  import Gear from '../socials/Gear.vue';

  import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';  
  import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
  import { playIntro } from '~/lib/conquest/experience/controls/trackball/trackballControls';
  
  import Logo from "~/components/Logo.vue";
  import items from 'coop-shared/config/items.mjs';

  const isMobile = () => {
    let check = false;
    (function(a) { if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
  }
  
  const bloom = {
    exposure: 0.5,
    bloomStrength: 1.5,
    bloomThreshold: 0.7,
    bloomRadius: 0.1
  };

  export default {
    name: 'Worldview',
    props: {
      silent: {
        type: Boolean,
        default: false
      },
      tile: {
        type: String,
        default: null
      },
      intro: {
        type: Boolean,
        default: false
      },
      networking: {
        type: Boolean,
        default: false
      }
    },
    components: {
      Logo,
      Gear
    },
    data: () => ({
      // Just for testing and GUI
      players: [],

      WEBGL_SUPPORT: false,

      settingsOpen: false,
      guiOpen: false,
      controllersOpen: false,

      spawned: false,
      died: false,

      selected: null,

      uiBlocked: true
    }),
    
    methods: {
      getPlayers() {
        return Object.values(WORLD.players);
      },
      changeCamera() {
        ControlsManager.toggleCameraTemp();
      },
      logout() {
        this.$auth.logout();
        this.closeSettings();
      },
      toggleGUI() {
        this.guiOpen = !this.guiOpen;
        this.closeSettings();
      },
      toggleControllers() {
        this.closeSettings();
        this.controllersOpen = !this.controllersOpen;
      },
      closeSettings() {
        this.settingsOpen = false;
      },
      spawn() {
        const target = WORLD.planets[0];
        const spawnPos = target.body.position;

        window.WORLD.socket.emit('player_spawned', {
          spawn_location: spawnPos,
          orbit_influence: target.name
        });

        // Update GUI actions related to spawning.
        this.spawned = true;

        // Interaction required*
        window.WORLD.renderer.domElement.requestPointerLock();

        // https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API

        document.addEventListener('pointerlockchange', ev => {
          // console.log(document.pointerLockElement, WORLD.renderer.domElement);
          if (document.pointerLockElement === WORLD.renderer.domElement) {
            console.log('The pointer lock status is now locked');
          } else {
            console.log('The pointer lock status is now unlocked');
          }
        }, false);

        document.addEventListener('pointerlockerror', ev => {
          console.log('Error with pointer lock' + ev);
          console.error(ev);
        }, false);
      }
    },

    async mounted() {
      const DETECTED_INPUT_KEY = isMobile() ? "MOBILE" : "COMPUTER";

      // Reveal UI that camera animation won't break.
      setTimeout(() => this.uiBlocked = false, 5000);

      // TODO: On detection/disconnection should have a popup for switching.



      // Detect console controller.
      window.addEventListener("gamepadconnected", function(e) {
        console.log(
          "Gamepad connected at index %d: %s. %d buttons, %d axes.",
          e.gamepad.index, e.gamepad.id,
          e.gamepad.buttons.length, e.gamepad.axes.length
        );
        WORLD.settings.view.DESIRED_INPUT_KEY = "CONSOLE";
      });
      window.addEventListener("gamepaddisconnected", function(e) {
        console.log("Gamepad disconnected from index %d: %s",
        e.gamepad.index, e.gamepad.id);
        WORLD.settings.view.DESIRED_INPUT_KEY = "COMPUTER";
      });

      // Check if WebGL is supported.
      const canvas = document.getElementById('canvas');
      this.WEBGL_SUPPORT = !!(
        window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );;

      // Used for shared state.
      window.WORLD = {
        canvas,
        component: this,

        renderer: new THREE.WebGLRenderer({ canvas, antialias: true }),
        scene: new THREE.Scene,
        camera: new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200),

        cameraAnimation: null,

        // Deterministic time variable
        timeIncrement: Date.now(),
        deltaTime: 0,

        // Engine needs to know if controls etc disabled.
        silent: this.silent,

        input: null,
        controls: null,

        socket: null,

        // TODO: Refactor into planets??
        SOIDict: {},
        planets: [],
        players: {},

        me: {
          player: null,
          config: null
        },

        settings: {
          view: {
            DESIRED_CAMERA_KEY: "TRACKBALL",
            DESIRED_INPUT_KEY: DETECTED_INPUT_KEY,

            // Setting to null may trigger initialisation of input.
            CURRENT_CAMERA_KEY: null,
            CURRENT_INPUT_KEY: null
          }
        },
      };

      const renderScene = new RenderPass(WORLD.scene, WORLD.camera);

      const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);

      bloomPass.threshold = bloom.bloomThreshold;
      bloomPass.strength = bloom.bloomStrength;
      bloomPass.radius = bloom.bloomRadius;

      // Composer for post-processing.
      WORLD.composer = new EffectComposer(WORLD.renderer);
      WORLD.composer.addPass(renderScene);
      WORLD.composer.addPass(bloomPass);

      // Set background colour
      WORLD.scene.background = new THREE.Color(0x050D22);

      // Generate the world.
      UNIVERSE_SPECIFICATION.map(solarSystemConfig => {
        WORLD.scene.add(buildSolarSystem(solarSystemConfig));
      });

      // Add our main camera to the engine.
      WORLD.scene.add(WORLD.camera);

      // TODO: Refactor out of here and add move to follow (surround) player.
      // Generate the stars.
      const starsCount = 200;
      const starsContainer = new THREE.Group;
      for (let s = 0; s < starsCount; s++) {
        const star = new THREE.Mesh(
          new THREE.CircleGeometry(.1, .1),
          new THREE.MeshBasicMaterial({ color: 0xffffff }) 
        );

        // Calculate random star position.
        star.position.x = Math.random() * 300 - 125;
        star.position.y = Math.random() * 300 - 125;
        star.position.z = Math.random() * 300 - 125;

        // Limit the proximity of stars.
        const distance = star.position.distanceTo(WORLD.planets[0].body.position);
        if (distance > 50) {
          starsContainer.add(star);
          star.lookAt(WORLD.planets[0].body.position);
        }
      }

      // Soft white global light
      const light = new THREE.AmbientLight(0x404040); 
      WORLD.scene.add(light);

      // Add stars to scene.
      WORLD.scene.add(starsContainer);

      // Add screen resizing capability.
      window.addEventListener('resize', resizer);
      resizer();

      // Setup and run the game/level networking (socket based).
      if (this.networking && this.$auth.user)
        setupNetworking(this.$auth.strategy.token.get(), this.$auth.user);

      // Play the intro if specified.
      if (this.intro)
        playIntro();

      // DEV: Update mainly for GUI.
      setInterval(() => this.players = this.getPlayers(), 150);

      // Start the engine, recursively.
      engine(this);

      console.log('Loading image');

      // const objectLoader = new THREE.ObjectLoader;
      // console.log(objectLoader);

      // instantiate a loader const loader = new OBJLoader(); 
      // load a resource loader.load( 
      // resource URL 'models/monster.obj', 
      // called when resource is loaded function ( object ) { scene.add( object ); }, 

      // WORLD.scene.add(object);


      // Force console controls for testing.
      // WORLD.settings.view.DESIRED_INPUT_KEY = "CONSOLE";



      // TODO: Add COOP_POINT item image to test.
      const textureLoader = new THREE.TextureLoader;

      ['AVERAGE_EGG', 'RARE_EGG', 'LEGENDARY_EGG', 'COOP_POINT'].map(async (itemKey, itemIndex) => {
        const texture = await textureLoader.loadAsync(items[itemKey].image);
        console.log(texture);
  
        const geometry = new THREE.PlaneGeometry(3, 3, 3);
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  
        const mesh = new THREE.Mesh(geometry, material);
  
        const offset = 4 * itemIndex;
        mesh.position.set(offset, offset, offset);
  
        WORLD.scene.add(mesh);
      });
    },

    async beforeUnmount() {
      console.log('Testing Worldview beforeUnmount');
    }
  }
</script>
