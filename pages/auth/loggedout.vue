<template>
    <div class="content-container">
        <h1 class="title">Successful logout</h1>
        <p>
            You have been logged out, please don't stay this way for long! <br />
            <i>Redirecting you to the home page in a few seconds...</i>
        </p>

        <img src="/cryinglogout.gif" />
    </div>
</template>

<script>
    export default {
        mounted() {
            setTimeout(() => this.$router.push({ path: '/' }), 5000);
        }        
    }
</script>

<style scoped>
    img {        
        margin: auto;
        max-width: 100%;
    }
    p {
        color: rgb(120, 120, 120);
    }
</style>