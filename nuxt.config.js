export default defineNuxtConfig({
  ssr: false,
  app: {
    head: {
      title: 'FPS with Spherical Gravity',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },
  runtimeConfig: {
    public: {
      wsUrl: process.env.WS_URL || 'ws://localhost:8080/ws'
    }
  },
  nitro: {
    devProxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  }
})