export default defineNuxtConfig({
  ssr: false,
  app: {
    head: {
      title: 'FPS with Spherical Gravity',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  }
})