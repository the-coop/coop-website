export default defineNuxtConfig({
  ssr: true,
  nitro: {
    preset: 'static' // Use static preset for Netlify
  },
  vite: {
    server: {
      fs: {
        // Suppress development shared repo errors because it doesn't work with yarn link
        strict: false 
      }
    }
  }
})
