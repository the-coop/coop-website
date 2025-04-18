<template>
  <div class="game" @click="engage">
    <Start v-if="!started" :start="engage" />
    <canvas class="canvas" ref="canvas"></canvas>
    <MobileUI v-if="started" />
    <DebugBox v-if="started && showDebug" />
    
    <!-- Add notification component -->
    <div v-if="notification.show" class="notification">
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup>
  import { ref, onMounted, onBeforeUnmount } from 'vue';
  import { Vector3 } from 'three'; // Import Vector3 from three.js
  import Engine from '../lib/game/engine.mjs';
  import Start from '../components/game/Start.vue';
  import MobileUI from '../components/game/MobileUI.vue';
  import DebugBox from '../components/game/DebugBox.vue';
  import PlayersManager from '../lib/game/players.mjs';
  import Mobile from '../lib/game/controllers/inputs/mobile.mjs';
  import ControlManager from '../lib/game/control.mjs';
  import FPSController from '../lib/game/controllers/FPSController.mjs';
  import VehicleManager from '../lib/game/vehicles.mjs';
  import ObjectManager from '../lib/game/object.mjs'; // Fixed import path

  // Use the full sized game layout for simplicity/separation.
  definePageMeta({ layout: 'gaming' });

  const started = ref(false);
  const canvas = ref(null);
  const isMobile = ref(false);
  const showDebug = ref(false);
  
  // Add notification state
  const notification = ref({
    show: false,
    message: '',
    timeout: null
  });

  // Function to show notifications
  function showNotification(message, duration = 3000) {
    // Clear any existing timeout
    if (notification.value.timeout) {
      clearTimeout(notification.value.timeout);
    }
    
    // Show new notification
    notification.value.message = message;
    notification.value.show = true;
    
    // Auto-hide after duration
    notification.value.timeout = setTimeout(() => {
      notification.value.show = false;
    }, duration);
  }

  // Check for mobile device
  function detectMobile() {
    // return 'ontouchstart' in window && window.innerWidth <= 768;
    return window.innerWidth <= 768;
  };

  // Toggle debug display with backtick key
  function handleKeyDown(event) {
    if (event.key === '`' || event.key === 'Backquote') {
      showDebug.value = !showDebug.value;
      
      // When turning on debug view, show collision visualization
      if (showDebug.value && ObjectManager.debugVisualize) {
        ObjectManager.debugVisualize(true, {
          showBoxes: true,
          showNormals: true,
          boxOpacity: 0.3,
          normalLength: 2
        });
        showNotification("Debug mode activated - collision boxes visible");
      } else if (ObjectManager.debugVisualize) {
        ObjectManager.debugVisualize(false);
      }
    }
    
    // Add C key to show collision info
    if (event.key === 'c' || event.key === 'C') {
      if (PlayersManager.self && PlayersManager.self.handle) {
        // Check collisions with all object types
        const collisions = ObjectManager.checkAllCollisions(PlayersManager.self.handle);
        
        if (collisions.length > 0) {
          const types = collisions.map(c => c.otherCollidable.type).join(', ');
          showNotification(`Colliding with: ${types} (${collisions.length} objects)`);
          console.log("Current collisions:", collisions);
        } else {
          showNotification("No collisions detected");
        }
      }
    }
  }

  // Handle game initialization and device-specific setup
  async function engage(ev) {
    // Handle initial game start
    if (!started.value) {
      try {
        console.log("Starting game, checking for vehicles...");
        
        isMobile.value = detectMobile();
        if (isMobile.value) {
          Mobile.setup();
        }

        // Start the game first
        Engine.resize();
        
        // Spawn player near second planet where there should be vehicles
        PlayersManager.spawn(true, new Vector3(5000, 120, 0));
        
        // Switch to FPS controller after spawn
        ControlManager.change(FPSController);
        
        // Display vehicle info and controls help
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const vehicleCount = VehicleManager.vehicles.length;
            const carCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'car').length;
            const airplaneCount = VehicleManager.vehicles.filter(v => v && v.userData.type === 'airplane').length;
            
            console.log(`Game world contains ${vehicleCount} vehicles: ${carCount} cars and ${airplaneCount} airplanes`);
            showNotification(`Game started with ${carCount} cars and ${airplaneCount} airplanes`);
            
            // Tell player about controls
            setTimeout(() => {
              showNotification('Press O to toggle between first and third person views (when on foot)');
              setTimeout(() => {
                showNotification('Press E to enter/exit vehicles');
                setTimeout(() => {
                  showNotification('Press ~ to toggle debug view');
                  // Enable collision debug visualization
                  if (ObjectManager.debugVisualize) {
                    ObjectManager.debugVisualize(true);
                  }
                }, 3000);
              }, 3000);
            }, 3000);
          }, 1000);
        }
        
        started.value = true;

        // CRITICAL FIX: Use try/catch for each permission request separately
        try {
          // Only request fullscreen if we're not already in fullscreen
          if (document.documentElement && !document.fullscreenElement) {
            // Need to wait for user interaction before requesting permissions
            console.log("Requesting fullscreen...");
            await document.documentElement.requestFullscreen().catch(e => {
              console.warn("Fullscreen request was rejected:", e.message);
            });
          }
        } catch (e) {
          console.error('Failed to get full screen:', e);
          // Continue even if fullscreen fails
        }
        
        // CRITICAL FIX: Then handle pointer lock for desktop as a separate request
        if (!isMobile.value) {
          try {
            // Short delay before pointer lock request
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (document.body && !document.pointerLockElement) {
              console.log("Requesting pointer lock...");
              await document.body.requestPointerLock().catch(e => {
                console.warn("Pointer lock request was rejected:", e.message);
              });
            }
          } catch (e) {
            console.error('Failed to get pointer lock:', e);
            // Continue even if pointer lock fails
          }
        }
      } catch (error) {
        console.error('Error starting game:', error);
      }
    }

    // Handle reapplying lock/fullscreen for desktop - separate each request
    if (started.value && !isMobile.value) {
      try {
        // First try fullscreen if needed
        if (!document.fullscreenElement && document.documentElement) {
          await document.documentElement.requestFullscreen().catch(e => {
            console.warn("Fullscreen re-request was rejected:", e.message);
          });
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // Then try pointer lock if needed
        if (!document.pointerLockElement && document.body) {
          await document.body.requestPointerLock().catch(e => {
            console.warn("Pointer lock re-request was rejected:", e.message);
          });
        }
      } catch (e) {
        console.error('Failed to enter fullscreen/pointer lock:', e);
        // Just log the error but continue
      }
    }
  };

  // Setup game engine when page ready.
  onMounted(() => {   
    // Setup game engine.
    Engine.setup(canvas);
    
    // Add keyboard listener for debug toggle
    window.addEventListener('keydown', handleKeyDown);
    
    // Expose notification function to the global scope for other modules to use
    if (typeof window !== 'undefined') {
      window.gameNotify = showNotification;
    }
  });

  // Cleanup engine, fullscreen, inputs and pointer lock.
  onBeforeUnmount(() => {
    // Remove pointer lock if it was applied.
    if (!isMobile.value)
      document.exitPointerLock();

    // Remove keyboard listener
    window.removeEventListener('keydown', handleKeyDown);

    // Cleanup the entire engine.
    Engine.cleanup();
    
    // Remove notification function from global scope
    if (typeof window !== 'undefined') {
      window.gameNotify = undefined;
    }
    
    // Clear any pending notification timeout
    if (notification.value.timeout) {
      clearTimeout(notification.value.timeout);
    }
  });
</script>

<style scoped>
  .game {
    height: 100%;
    width: 100%;
  }

  .canvas {
    display: block;
    height: 100%;
    width: 100%;
  }
  
  .notification {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.5);
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
  }
</style>