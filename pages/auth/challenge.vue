<template>
  <h1>Attemping to verify your Discord account in exchange for greater access.</h1>
</template>


<script>
  export default {
    mounted: () => {
      alert('mounted');
      this.authenticate();
    },
    methods: {
      authenticate() {
        // Access the code from query params and authenticate with it.
        console.log('authenticating');
        
      }
    }
  }
</script>