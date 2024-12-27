<template>
  <div class="start">
    <!-- {{ Engine.gamepad }} -->
    <!-- <span style="color: white">{{ Engine.mobile }}</span> -->
    <div v-if="incompatible" class="safari-warning">
      ⚠️ This game doesn't work properly in OS X Safari due to browser limitations.<br>
      Please use Chrome, Firefox, or Edge instead, mobile Safari works(?).
    </div>
    <transition name="fade">
      <button v-if="!incompatible && ready" class="cta" @click="start">
        {{ label }}
      </button>
    </transition>
  </div>
</template>

<script setup>
  import { ref, onMounted, computed } from 'vue';
  import Engine from '../../lib/game/engine.mjs';
  import StartMenuController from '../../lib/game/controllers/StartMenuController.mjs';

  const props = defineProps(['start', 'gamepad']);

  const incompatible = ref(false);
  const ready = ref(false);

  // Action text is device/input specific to acknowlede it's detected.
  const label = computed(() => {
    if (Engine.state.gamepad) return 'Press any button';
    if (Engine.state.mobile) return 'Tap to play';
    return 'Click to start';
  });

  onMounted(() => {
    // Detect incompatible devices before proceeding.
    const ua = navigator.userAgent;
    incompatible.value = ua.includes('Macintosh') && ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Mobile');

    // Start menu controller needs UI mutation hook.
    StartMenuController.start = props.start;

    // Show button after a brief delay to ensure state is ready
    setTimeout(() => ready.value = true, 100);
  });
</script>

<style scoped>
  .start {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0,0,0,0.8);
  }

  .cta {
    font-size: 2em;
    padding: 1em 2em;
    background: none;
    color: white;
    border: .1em solid white;
    cursor: pointer;
  }

  .safari-warning {
    padding: 1em;
    font-size: 1.5em;
    color: #ff6b6b;
    background: rgba(0,0,0,0.9);
    border: .1em solid #ff6b6b;
    border-radius: .5em;
    text-align: center;
    font-weight: 600;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.3s ease;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
