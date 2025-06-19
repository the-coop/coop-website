export default defineNuxtConfig({
  ssr: false, // Disable server-side rendering for client-only app
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
