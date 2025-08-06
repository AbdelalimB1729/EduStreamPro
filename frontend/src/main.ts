import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { aliases, mdi } from 'vuetify/iconsets/mdi';
import { loadFonts } from './plugins/webfontloader';
import router from './router';
import App from './App.vue';

// Styles
import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import './assets/main.css';

// Load fonts
loadFonts();

// Create Vuetify instance
const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#1867C0',
          secondary: '#5CBBF6',
          accent: '#005CAF',
        },
      },
      dark: {
        colors: {
          primary: '#2196F3',
          secondary: '#424242',
          accent: '#FF4081',
        },
      },
    },
  },
});

// Create Pinia instance with persistence
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

// Create and mount app
const app = createApp(App);

app.use(pinia);
app.use(router);
app.use(vuetify);

app.mount('#app');