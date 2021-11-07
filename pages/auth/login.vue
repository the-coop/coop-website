<template>
    <div class="content-container">
        <h1 class="title">🔑 Login</h1>

        <LoginBlock />
    </div>
</template>

<script>
    import LoginBlock from '~/components/users/LoginBlock.vue';

    export default {
        middleware: 'guest',
        components: { LoginBlock }
    }
</script>