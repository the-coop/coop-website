<template>
  <div class="start">
    <button @click="start">Start Game</button>
  </div>
</template>

<script>
export default {
    props: ['start']
}
</script>

<style scoped>
.start {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0,0,0,0.8);
}

button {
    font-size: 2em;
    padding: 1em 2em;
    background: none;
    color: white;
    border: 1px solid white;
    cursor: pointer;
}
</style>
