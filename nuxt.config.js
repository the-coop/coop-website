export default defineNuxtConfig({
  ssr: true,
  target: 'static',
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
      wsUrl: process.env.NODE_ENV === 'production' 
        ? 'wss://thecoop.herokuapp.com/ws'
        : (process.env.WS_URL || 'ws://localhost:8080/ws')
    }
  },
  nitro: {
    preset: 'netlify-edge',
    devProxy: {
      '/api/ws': {
        target: 'ws://localhost:8080/ws',
        ws: true,
        changeOrigin: true
      }
    },
    publicAssets: [
      {
        baseURL: '/campaign',
        dir: './campaign'
      }
    ]
  },
  vite: {
    define: {
      global: 'globalThis'
    }
  }
})