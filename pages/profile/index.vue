<template>
  <div>
    <h1 v-if="me">{{me.username}}</h1>
  </div>
</template>

<script>
  import Auth from '~/lib/auth/auth';

  export default {
    async mounted() {
      const me = await Auth._me();
      if (typeof me.id !== 'undefined' && me.id) this.me = me;
    },
    data() {
      return {
        me: null
      }
    }
  }
</script>