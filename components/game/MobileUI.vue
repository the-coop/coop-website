<template>
  <div class="ui">
    <div class="outer movement" ref="movementOuter">
      <div class="inner"
           @touchstart.prevent="e => startDrag('movement', e)"
           @touchmove.prevent="e => drag('movement', e)"
           @touchend.prevent="e => endDrag('movement')"
           @mousedown.prevent="e => startDrag('movement', e)"
           @mousemove.prevent="e => drag('movement', e)"
           @mouseup.prevent="e => endDrag('movement')"
           :style="movementStyle">
      </div>
    </div>
    <div class="outer aim" ref="aimOuter">
      <div class="inner"
           @touchstart.prevent="e => startDrag('aim', e)"
           @touchmove.prevent="e => drag('aim', e)"
           @touchend.prevent="e => endDrag('aim')"
           @mousedown.prevent="e => startDrag('aim', e)"
           @mousemove.prevent="e => drag('aim', e)"
           @mouseup.prevent="e => endDrag('aim')"
           :style="aimStyle">
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
const isDragging = ref({ movement: false, aim: false });
const isMouseDown = ref(false);

function getEventCoords(event) {
  if (event.touches) {
    return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
  }
  return { clientX: event.clientX, clientY: event.clientY };
}

function startDrag(control, event) {
  if (event.type === 'mousedown') {
    isMouseDown.value = true;
    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('mouseup', mouseUpHandler);
  }
  isDragging.value[control] = true;
}

function drag(control, event) {
  // Only check if we're dragging, ignore mouse position
  if (!isDragging.value[control]) return;

  const coords = getEventCoords(event);
  const outer = control === 'movement' ? movementOuter.value : aimOuter.value;
  const rect = outer.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  // Calculate position relative to center
  let x = coords.clientX - centerX;
  let y = coords.clientY - centerY;

  // Constrain visual position to circle but keep input normalized
  const radius = rect.width / 2;
  const distance = Math.sqrt(x * x + y * y);
  if (distance > radius) {
    const angle = Math.atan2(y, x);
    // Visual position is constrained
    const visualX = Math.cos(angle) * radius;
    const visualY = Math.sin(angle) * radius;
    
    // Input uses actual position normalized
    const normalizedX = x / distance; // This gives -1 to 1 range
    const normalizedY = y / distance;
    
    if (control === 'movement') {
      movementPos.value = { x: visualX, y: visualY };
      Mobile.movement = { x: normalizedX, y: -normalizedY };
    } else {
      aimPos.value = { x: visualX, y: visualY };
      Mobile.aim = { x: normalizedX, y: normalizedY };
    }
  } else {
    // Within bounds, use regular normalized position
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

function endDrag(control) {
  isDragging.value[control] = false;
  if (control === 'movement') {
    movementPos.value = { x: 0, y: 0 };
    Mobile.movement = { x: 0, y: 0 };
  } else {
    aimPos.value = { x: 0, y: 0 };
    Mobile.aim = { x: 0, y: 0 };
  }
}

function mouseMoveHandler(event) {
  if (isDragging.value.movement) {
    drag('movement', event);
  } else if (isDragging.value.aim) {
    drag('aim', event);
  }
}

function mouseUpHandler() {
  if (isDragging.value.movement) {
    endDrag('movement');
  } else if (isDragging.value.aim) {
    endDrag('aim');
  }
  isMouseDown.value = false;
  window.removeEventListener('mousemove', mouseMoveHandler);
  window.removeEventListener('mouseup', mouseUpHandler);
}

onMounted(() => {
  if (Mobile.detect()) {
    Mobile.setup();
  }
});

onBeforeUnmount(() => {
  if (Mobile.detect()) {
    Mobile.cleanup();
  }
  window.removeEventListener('mousemove', mouseMoveHandler);
  window.removeEventListener('mouseup', mouseUpHandler);
});

const movementStyle = computed(() => ({
  transform: `translate(calc(${movementPos.value.x}px - 50%), calc(${movementPos.value.y}px - 50%))`,
  transition: 'transform 0.15s ease-out'
}));

const aimStyle = computed(() => ({
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
