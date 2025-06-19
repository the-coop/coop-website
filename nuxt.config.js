export default defineNuxtConfig({
  nitro: {
    preset: 'static',
    output: {
      publicDir: 'dist'
    }
  },
  vite: {
    server: {
      fs: {
        strict: false // Disable strict file serving restrictions
      }
    }
  }
})
