import { defineNuxtPlugin } from 'nuxt/app'
import { useLayout } from '../composables/useLayout'

export default defineNuxtPlugin(() => {
  const { setLayout } = useLayout();
  
  return {
    provide: {
      layout: {
        set: (name: string) => setLayout(name)
      }
    }
  }
});
