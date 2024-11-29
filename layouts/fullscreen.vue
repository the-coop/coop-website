<template>
    <div class="fullscreen">
        <slot></slot>
    </div>
</template>

<style scoped>
.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
}

:global(body) {
    margin: 0;
    padding: 0;
    height: 100dvh;
    width: 100vw;
    overflow: hidden;
}

:global(canvas) {
    display: block;
    width: 100vw !important;
    height: 100dvh !important;
    position: fixed;
    top: 0;
    left: 0;
}
</style>