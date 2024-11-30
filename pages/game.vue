<template>
  <NuxtLayout :name="layout" :title="on ? '' : 'The Coop Game'">
    <div ref="el" @click="run">
      <div v-if="!on" class="start">CLICK</div>
      <GameSettings v-if="showSettings" @close="showSettings = false"/>
    </div>
  </NuxtLayout>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Game from '../lib/game/engine.mjs'
import PC from '../lib/game/ux/input/pc.mjs'
import GameSettings from '../components/GameSettings.vue'

const el = ref(), on = ref(false)
const showSettings = ref(false)

const layout = computed(() => on.value ? 'fullscreen' : 'default')

definePageMeta({
  ssr: false,
  layout: false
})

let keyHandler = null

const end = () => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(console.error)
  }
  if (document.pointerLockElement) {
    document.exitPointerLock()
  }
  Game.end()
  PC.end()
  on.value = false
  showSettings.value = false
}

const run = async () => {
  if(on.value) return
  try {
    await el.value.requestFullscreen()
    await document.documentElement.requestPointerLock()
    Game.setup(el.value)
    PC.setup()
    on.value = true
  } catch (e) {
    console.error(e)
    end()
  }
}

onMounted(() => {
  keyHandler = e => {
    if (e.detail === 'Escape' && on.value) showSettings.value = !showSettings.value
  }
  window.addEventListener('key', keyHandler)
  
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && on.value) {
      end()
    }
  })

  document.addEventListener('pointerlockerror', () => {
    if (on.value) end()
  })

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && on.value && !showSettings.value) {
      end()
    }
  })
})

onUnmounted(() => {
  end()
  if (keyHandler) {
    window.removeEventListener('key', keyHandler)
  }
})
</script>

<style scoped>
.start {
  display: grid;
  place-items: center;
  min-height: 50vh;
  cursor: pointer;
}
</style>