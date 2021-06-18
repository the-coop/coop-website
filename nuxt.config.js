const metaName = 'The Coop';
const metaDesc = 'The Coop is a discord server community that focuses on business, design, and programming. In our free and democratic system, you make the decisions!';
const metaImage = 'https://thecoop.group/favicon.svg';
const metaPreviewImage = 'https://thecoop.group/link-preview.png';

export default {
  // Target: https://go.nuxtjs.dev/config-target
  target: 'static',

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: metaName,
    htmlAttrs: {
      lang: 'en'
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: metaDesc },


      { hid: 'google-name', itemprop: 'name', content: metaName },
      { hid: 'google-description', itemprop: 'description', content: metaDesc },
      { hid: 'google-image', itemprop: 'image', content: metaImage },

      { hid: 'facebook-url', property: 'og:url', content: 'https://thecoop.group' },
      { hid: 'facebook-type', property: 'og:type', content: 'website' },
      { hid: 'facebook-title', property: 'og:title', content: metaName },
      { hid: 'facebook-desc', property: 'og:description', content: metaDesc },
      { hid: 'facebook-image', property: 'og:image', content: metaPreviewImage },

      { hid: 'twitter-card', name: 'twitter:card', content: 'summary_large_image' },
      { hid: 'twitter-title', name: 'twitter:title', content: metaName },
      { hid: 'twitter-desc', name: 'twitter:description', content: metaDesc },
      { hid: 'twitter-image', name: 'twitter:image', content: metaPreviewImage }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.svg' },
      { rel: 'image/svg+xml', type: 'image/x-icon', href: '/favicon.svg' },
      { rel: 'mask-icon', color: '#ff8a01', href: '/favicon.svg' }
    ]
  },

  // Global CSS: https://go.nuxtjs.dev/config-css
  css: ['~/assets/style/global.css'],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [],


  webfontloader: {
    google: {
      families: ['Poppins:400,700']
    }
  },

  // Auto import components: https://go.nuxtjs.dev/config-components
  components: true,

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/typescript
    // '@nuxt/typescript-build',
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: [
    'nuxt-webfontloader',
    '@nuxtjs/axios',
    '@nuxtjs/auth-next'
  ],

  auth: {
    strategies: {
      local: {
        token: {
          property: 'token',
          required: true
        },
        user: {
          autoFetch: false
        },
        endpoints: {
          login: {
            url: 'https://cooperchickenbot.herokuapp.com/auth/access-discord', 
            method: 'post' 
          },
          logout: false,

          // TODO: This one should actually exist.
          user: { 
            url: 'https://cooperchickenbot.herokuapp.com/auth/user', 
            method: 'get' 
          }
        }
      }
    }
  },

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {}
}
