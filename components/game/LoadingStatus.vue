<template>
  <Transition name="fade">
    <div v-if="isVisible" class="loading-status">
      <div class="loading-stage" :class="{ 'ready': isReady }">{{ currentStage }}</div>
      <div class="loading-bar">
        <div class="loading-bar-progress" :class="{ 'ready': isReady }"></div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, watch, ref, onMounted, onBeforeUnmount } from 'vue'
import State from '../../lib/game/state.mjs'

const props = defineProps({
  show: Boolean,
})

const isVisible = ref(false)
const isReady = ref(false)
const hideTimeout = ref(null)

const startHideTimer = () => {
  if (hideTimeout.value) clearTimeout(hideTimeout.value)
  
  // When stage is "Game ready!", show green animation
  if (State.currentStage === 'Game ready!') {
    isReady.value = true
    // Wait for color transition before hiding
    hideTimeout.value = setTimeout(() => {
      isVisible.value = false
    }, 2000) // Give time for green animation
  } else {
    hideTimeout.value = setTimeout(() => {
      isVisible.value = false
    }, 3000)
  }
}

onMounted(() => {
  State.addLog('Beginning game setup...', 'LoadingStatus.vue')
  isVisible.value = true
  startHideTimer()
})

watch(() => State.currentStage, (newStage, oldStage) => {
  if (hideTimeout.value) clearTimeout(hideTimeout.value)

  if (newStage) {
    isVisible.value = true
    isReady.value = newStage === 'Game ready!'
  }
  
  startHideTimer()
}, { immediate: true })

const currentStage = computed(() => State.currentStage || 'Beginning game setup...')

onBeforeUnmount(() => {
  if (hideTimeout.value) clearTimeout(hideTimeout.value)
})
</script>

<style scoped>
.loading-status {
  position: fixed;
  bottom: 4rem;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 300px;
  text-align: center;
  z-index: 1001;
  pointer-events: none;
}

.loading-stage {
  color: #ffcc00;
  font-size: 0.9em;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 10px rgba(255, 204, 0, 0.5);
  transition: color 0.5s ease;
}

.loading-stage.ready {
  color: #4CAF50;
  text-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.loading-bar {
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 1px;
  overflow: hidden;
}

.loading-bar-progress {
  height: 100%;
  background: #ffcc00;
  width: 30%;
  border-radius: 1px;
  animation: progress 1s ease-in-out infinite;
  box-shadow: 0 0 10px rgba(255, 204, 0, 0.5);
  transition: background-color 0.5s ease, box-shadow 0.5s ease;
}

.loading-bar-progress.ready {
  background: #4CAF50;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
</style>
