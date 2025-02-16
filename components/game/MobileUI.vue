<template>
  <div class="ui">
    <div class="outer movement" ref="movementOuter"
         @touchstart.prevent="handleTouchStart"
         @touchmove.prevent="handleTouchMove"
         @touchend.prevent="handleTouchEnd"
         @touchcancel.prevent="handleTouchEnd">
      <div class="inner" :style="{ transform: `translate(${movementPos.x}px, ${movementPos.y}px)` }"></div>
    </div>
    <div class="outer aim" ref="aimOuter"
         @touchstart.prevent="handleTouchStart"
         @touchmove.prevent="handleTouchMove"
         @touchend.prevent="handleTouchEnd"
         @touchcancel.prevent="handleTouchEnd">
      <div class="inner" :style="{ transform: `translate(${aimPos.x}px, ${aimPos.y}px)` }"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import Mobile from '../../lib/game/controllers/inputs/mobile.mjs';

const movementOuter = ref(null);
const aimOuter = ref(null);
const movementPos = ref({ x: 0, y: 0 });
const aimPos = ref({ x: 0, y: 0 });
const movementTouch = ref(null);
const aimTouch = ref(null);

// Remove getTransform function since we're handling transforms directly in template

function getControlFromElement(element) {
  if (element.classList.contains('movement') || element.closest('.movement')) {
    return 'movement';
  }
  if (element.classList.contains('aim') || element.closest('.aim')) {
    return 'aim';
  }
  return null;
}

function handleTouchStart(event) {
  Array.from(event.changedTouches).forEach(touch => {
    const control = getControlFromElement(event.target);
    if (!control) return;

    if (control === 'movement' && !movementTouch.value) {
      movementTouch.value = touch.identifier;
      updateTouch(touch, 'movement');
    } else if (control === 'aim' && !aimTouch.value) {
      aimTouch.value = touch.identifier;
      updateTouch(touch, 'aim');
    }
  });
}

function handleTouchMove(event) {
  Array.from(event.changedTouches).forEach(touch => {
    if (touch.identifier === movementTouch.value) {
      updateTouch(touch, 'movement');
    } else if (touch.identifier === aimTouch.value) {
      updateTouch(touch, 'aim');
    }
  });
}

function handleTouchEnd(event) {
  Array.from(event.changedTouches).forEach(touch => {
    if (touch.identifier === movementTouch.value) {
      movementTouch.value = null;
      movementPos.value = { x: 0, y: 0 };
      Mobile.movement = { x: 0, y: 0 };
    } else if (touch.identifier === aimTouch.value) {
      aimTouch.value = null;
      aimPos.value = { x: 0, y: 0 };
      Mobile.aim = { x: 0, y: 0 };
    }
  });
}

function updateTouch(touch, control) {
  const outer = control === 'movement' ? movementOuter.value : aimOuter.value;
  const rect = outer.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Calculate position relative to center of outer circle
  const x = touch.clientX - centerX;
  const y = touch.clientY - centerY;

  const radius = rect.width / 2;
  const distance = Math.sqrt(x * x + y * y);

  if (distance > radius) {
    const angle = Math.atan2(y, x);
    const visualX = Math.cos(angle) * radius;
    const visualY = Math.sin(angle) * radius;
    const normalizedX = Math.cos(angle);
    const normalizedY = Math.sin(angle);
    
    if (control === 'movement') {
      movementPos.value = { x: visualX, y: visualY };
      Mobile.movement = { x: normalizedX, y: normalizedY };
    } else {
      aimPos.value = { x: visualX, y: visualY };
      Mobile.aim = { x: -normalizedX, y: -normalizedY };
    }
  } else {
    if (control === 'movement') {
      movementPos.value = { x, y };
      Mobile.movement = { x: x / radius, y: y / radius };
    } else {
      aimPos.value = { x, y };
      Mobile.aim = { x: -x / radius, y: -y / radius };
    }
  }
}

onMounted(() => {
  console.log('mobile ui mounted');
});

onBeforeUnmount(() => {
  Mobile.cleanup();
});
</script>

<style scoped>
.ui {
  position: fixed;
  bottom: 1.25em;
  left: 0;
  right: 0;
  height: 7.5em;
  display: none;
}

.outer {
  position: absolute;
  bottom: 1.25em;
  width: 6.25em;
  height: 6.25em;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  border: 0.125em solid rgba(255, 255, 255, 0.3);
  touch-action: none;  /* Add this line */
  user-select: none;   /* Add this line */
}

.inner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2.5em;
  height: 2.5em;
  margin-left: -1.25em;  /* Half of width */
  margin-top: -1.25em;   /* Half of height */
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  touch-action: none;
  user-select: none;
  will-change: transform;
}

.inner:active {
  cursor: grabbing;
}

.movement {
  left: 1.875em;
}

.aim {
  right: 1.875em;
}

@media (max-width: 768px) {
  .ui {
    display: block;
  }
}
</style>
