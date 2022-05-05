<template>
    <div class="content-container">
        <h1 class="title">🔑 Login</h1>

        <LoginBlock :intent="intent" />
    </div>
</template>

<script>
    import LoginBlock from '~/components/users/LoginBlock.vue';
    
    export default {
        middleware: 'guest',
        components: { LoginBlock },
        data() {
            return {
                intent: ''
            };
        },
        mounted() {
            if (this.$route?.query?.intent)
                this.intent = this.$route.query.intent;
        }
    }
</script>