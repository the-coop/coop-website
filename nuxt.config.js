export default defineNuxtConfig({
  vite: {
    server: {
      fs: {
        // Suppress development shared repo errors because it doesn't work with yarn link
        strict: false 
      }
    }
  }
})
