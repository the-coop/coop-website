<template>
  <div class="suggestions" v-if="suggestions.length">
    <p class="suggestions-title">Autocomplete</p>

    <div class="suggestions-items">
      <div 
        class="suggestion"
        v-for="suggestion in suggestions.slice(0, 3)"
        v-on:click="onSelect"
        :data-code="suggestion"
        v-bind:key="suggestion">

        <ItemIcon :code="suggestion" :label="suggestion" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @use "../../assets/style/_colour.scss" as colour;

  .suggestions {
    position: absolute;
    bottom: 2.85em;
    background: colour.$dark;
    width: 100%;
    padding: 1em 0;
    box-sizing: border-box;
  }
  .suggestions-title {
    color: silver;
    margin: 0;
    margin-bottom: 1.125em;
  }
  .suggestions-items {
    /* display: flex; */
    /* flex-wrap: wrap; */
  }

  .suggestion {
    border-bottom: .125em solid silver;
  }
  .suggestion:last-child {
    border: none;
  }

  .suggestion:hover {
    /* color: red; */
    opacity: .8;
    cursor: pointer;
  }
</style>

<script>
  import ItemIcon from '../conquest/ItemIcon.vue';

  export default {
    props: ['suggestions', 'onSelect'],
    components: {
      ItemIcon
    }
  };
</script>
