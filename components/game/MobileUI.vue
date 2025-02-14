<template>
  <div class="ui">
    <div class="outer movement" ref="movementOuter">
      <div class="inner"
           @touchstart.prevent="e => startDrag('movement', e)"
           @touchmove.prevent="e => drag('movement', e)"
           @touchend.prevent="e => endDrag('movement', e)"
           @touchcancel.prevent="e => endDrag('movement', e)"
           :style="movementTransform">
      </div>
    </div>
    <div class="outer aim" ref="aimOuter">
      <div class="inner"
           @touchstart.prevent="e => startDrag('aim', e)"
           @touchmove.prevent="e => drag('aim', e)"
           @touchend.prevent="e => endDrag('aim', e)"
           @touchcancel.prevent="e => endDrag('aim', e)"
           :style="aimTransform">
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import Mobile from '../../lib/game/controllers/inputs/mobile.mjs';

const movementOuter = ref(null);
const aimOuter = ref(null);
const movementPos = ref({ x: 0, y: 0 });
const aimPos = ref({ x: 0, y: 0 });
const touches = ref({ movement: null, aim: null });

function startDrag(control, event) {
  // Store the touch identifier for this control
  touches.value[control] = event.touches[0].identifier;
}

function findTouch(event, controlId) {
  return Array.from(event.touches).find(
    touch => touch.identifier === touches.value[controlId]
  );
}

function drag(control, event) {
  const touch = findTouch(event, control);
  if (!touch) return;

  const outer = control === 'movement' ? movementOuter.value : aimOuter.value;
  const rect = outer.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let x = touch.clientX - centerX;
  let y = touch.clientY - centerY;

  const radius = rect.width / 2;
  const distance = Math.sqrt(x * x + y * y);

  if (distance > radius) {
    const angle = Math.atan2(y, x);
    const visualX = Math.cos(angle) * radius;
    const visualY = Math.sin(angle) * radius;
    const normalizedX = x / distance;
    const normalizedY = y / distance;
    
    if (control === 'movement') {
      movementPos.value = { x: visualX, y: visualY };
      Mobile.movement = { x: normalizedX, y: -normalizedY };
    } else {
      aimPos.value = { x: visualX, y: visualY };
      Mobile.aim = { x: normalizedX, y: normalizedY };
    }
  } else {
    const normalizedX = x / radius;
    const normalizedY = y / radius;
    
    if (control === 'movement') {
      movementPos.value = { x, y };
      Mobile.movement = { x: normalizedX, y: -normalizedY };
    } else {
      aimPos.value = { x, y };
      Mobile.aim = { x: normalizedX, y: normalizedY };
    }
  }
}

function endDrag(control, event) {
  // Only end if it's the right touch
  if (event.touches.length === 0 || 
      !Array.from(event.changedTouches).find(
        touch => touch.identifier === touches.value[control]
      )) {
    return;
  }

  touches.value[control] = null;
  if (control === 'movement') {
    movementPos.value = { x: 0, y: 0 };
    Mobile.movement = { x: 0, y: 0 };
  } else {
    aimPos.value = { x: 0, y: 0 };
    Mobile.aim = { x: 0, y: 0 };
  }
}

onMounted(() => {
  console.log('mobile ui mounted');
});

onBeforeUnmount(() => {
  Mobile.cleanup();
});

const movementTransform = computed(() => ({
  transform: `translate(calc(${movementPos.value.x}px - 50%), calc(${movementPos.value.y}px - 50%))`,
  transition: 'transform 0.15s ease-out'
}));

const aimTransform = computed(() => ({
  transform: `translate(calc(${aimPos.value.x}px - 50%), calc(${aimPos.value.y}px - 50%))`,
  transition: 'transform 0.15s ease-out'
}));
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
}

.inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2.5em;
  height: 2.5em;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  touch-action: none;
  user-select: none;
  will-change: transform;
  cursor: grab;
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
