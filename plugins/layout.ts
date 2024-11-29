// Consider removing this file if it's redundant.
// Alternatively, ensure it doesn't conflict with the composable approach.

import { defineNuxtPlugin } from 'nuxt/app'
import { useLayout } from '../composables/useLayout'

export default defineNuxtPlugin(() => {
  const { setLayout } = useLayout()
  
  return {
    provide: {
      layout: {
        set: (name: string) => setLayout(name)
      }
    }
  }
});
