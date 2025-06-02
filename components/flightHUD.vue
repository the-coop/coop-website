<template>
  <div v-if="visible" class="flight-hud">
    <div class="flight-instruments">
      <div class="instrument-panel left-panel">
        <div class="instrument">
          <label>ALT</label>
          <span class="value">{{ data.altitude }}m</span>
        </div>
        <div class="instrument">
          <label>IAS</label>
          <span class="value">{{ data.airspeed }}m/s</span>
        </div>
        <div class="instrument">
          <label>VS</label>
          <span class="value" :class="{ positive: data.verticalSpeed > 0, negative: data.verticalSpeed < 0 }">
            {{ data.verticalSpeed > 0 ? '+' : '' }}{{ data.verticalSpeed }}m/s
          </span>
        </div>
      </div>
      
      <div class="attitude-indicator">
        <div class="horizon" :style="{ transform: `rotate(${-data.roll}deg) translateY(${data.pitch * 2}px)` }">
          <div class="sky"></div>
          <div class="ground"></div>
          <div class="horizon-line"></div>
        </div>
        <div class="aircraft-symbol"></div>
        <div class="pitch-ladder">
          <div class="pitch-mark" v-for="pitch in [-20, -10, 0, 10, 20]" :key="pitch" :style="{ top: `${50 - pitch * 2}%` }">
            {{ pitch }}°
          </div>
        </div>
        <!-- Add gravity reference indicator -->
        <div v-if="data.gravityDir" class="gravity-indicator" :style="gravityIndicatorStyle"></div>
      </div>
      
      <div class="instrument-panel right-panel">
        <div class="instrument">
          <label>HDG</label>
          <span class="value">{{ String(data.heading).padStart(3, '0') }}°</span>
        </div>
        <div class="instrument">
          <label>THR</label>
          <span class="value">{{ data.throttle }}%</span>
        </div>
        <div class="instrument" v-if="data.engineRPM">
          <label>RPM</label>
          <span class="value">{{ data.engineRPM }}</span>
        </div>
      </div>
    </div>
    
    <div class="flight-status">
      <span v-if="data.isGrounded" class="status-indicator grounded">GROUNDED</span>
      <span v-if="data.stallWarning" class="status-indicator warning">STALL WARNING</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  data: {
    type: Object,
    default: () => ({
      altitude: 0,
      airspeed: 0,
      verticalSpeed: 0,
      heading: 0,
      pitch: 0,
      roll: 0,
      throttle: 0,
      engineRPM: 0,
      isGrounded: true,
      stallWarning: false,
      gravityDir: { x: 0, y: -1, z: 0 }
    })
  }
});

// Computed style for gravity indicator
const gravityIndicatorStyle = computed(() => {
  if (!props.data.gravityDir) return {};
  
  // Project gravity direction onto the aircraft's local coordinate system
  // This will show which way is "down" relative to the aircraft
  const angle = Math.atan2(props.data.gravityDir.x, props.data.gravityDir.y) * (180 / Math.PI);
  
  return {
    transform: `rotate(${angle}deg)`
  };
});
</script>

<style scoped>
.flight-hud {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: #00ff00;
  font-family: 'Courier New', monospace;
  pointer-events: none;
  user-select: none;
}

.flight-instruments {
  display: flex;
  gap: 20px;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border: 1px solid #00ff00;
  border-radius: 5px;
}

.instrument-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.instrument {
  display: flex;
  align-items: center;
  gap: 10px;
}

.instrument label {
  font-size: 12px;
  color: #00ff00;
  width: 30px;
}

.instrument .value {
  font-size: 16px;
  font-weight: bold;
  color: #00ff00;
  min-width: 60px;
  text-align: right;
}

.value.positive {
  color: #00ff00;
}

.value.negative {
  color: #ff6666;
}

.attitude-indicator {
  width: 150px;
  height: 150px;
  border: 2px solid #00ff00;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  background: #000;
}

.horizon {
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  transition: transform 0.1s ease-out;
}

.sky {
  position: absolute;
  top: 0;
  width: 100%;
  height: 50%;
  background: #1e3c72;
}

.ground {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 50%;
  background: #654321;
}

.horizon-line {
  position: absolute;
  top: 50%;
  width: 100%;
  height: 2px;
  background: #fff;
}

.aircraft-symbol {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 2px;
  background: #ffff00;
}

.aircraft-symbol::before,
.aircraft-symbol::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 2px;
  background: #ffff00;
  top: 0;
}

.aircraft-symbol::before {
  left: -10px;
  transform: rotate(90deg);
}

.aircraft-symbol::after {
  right: -10px;
  transform: rotate(90deg);
}

.pitch-ladder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.pitch-mark {
  position: absolute;
  width: 100%;
  text-align: center;
  font-size: 10px;
  color: #00ff00;
}

.flight-status {
  margin-top: 10px;
  text-align: center;
}

.status-indicator {
  padding: 5px 10px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: bold;
  margin: 0 5px;
}

.status-indicator.grounded {
  background: #333;
  color: #00ff00;
  border: 1px solid #00ff00;
}

.status-indicator.warning {
  background: #ff0000;
  color: #fff;
  animation: blink 0.5s infinite;
}

@keyframes blink {
  50% { opacity: 0.5; }
}

.gravity-indicator {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 10px solid #ff0000;
  opacity: 0.7;
}
</style>
