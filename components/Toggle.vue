<template>
  <div class="toggle">
    <svg viewBox="0 0 351 147" v-on:click="toggle">
      <rect x="2" y="2" width="347" height="147" rx="65" :fill="!toggled ? '#D9D9D9' : '#38CE5B'" stroke="#818181" strokeWidth="4" />
      <rect :x="!toggled ? 21 : 210" y="17" width="121" height="117" rx="58.5" fill="#F8F4F1" />
    </svg>
    {{ label }}
  </div>
</template>

<style scoped>
  .toggle {
    display: flex;
    align-items: center;
    user-select: none;
    cursor: pointer;
  }
  
  svg {
    margin-right: .5em;
  }

  rect {
    transition: x .5s, fill .5s;
  }
</style>

<script>
  export default {
    props: ['label'],
    methods: {
      toggle() {
        this.toggled = !this.toggled;
      }
    },
    data() {
      return {
        toggled: false
      };
    }
};
</script>
