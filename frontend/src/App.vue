<template>
  <v-app :theme="theme">
    <v-navigation-drawer
      v-if="isAuthenticated"
      v-model="drawer"
      :rail="rail"
      permanent
      @click="rail = false"
    >
      <v-list-item
        prepend-avatar="https://randomuser.me/api/portraits/men/85.jpg"
        :title="userProfile?.firstName"
        :subtitle="userProfile?.email"
      />

      <v-divider />

      <v-list density="compact" nav>
        <v-list-item
          v-for="item in navigationItems"
          :key="item.title"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          :disabled="item.disabled"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar>
      <v-app-bar-nav-icon
        v-if="isAuthenticated"
        @click.stop="toggleDrawer"
      />
      <v-app-bar-title>EduStreamPro</v-app-bar-title>
      <v-spacer />
      
      <template v-if="isAuthenticated">
        <v-btn icon @click="toggleTheme">
          <v-icon>{{ theme === 'light' ? 'mdi-weather-night' : 'mdi-weather-sunny' }}</v-icon>
        </v-btn>
        <v-btn icon @click="logout">
          <v-icon>mdi-logout</v-icon>
        </v-btn>
      </template>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </v-container>
    </v-main>

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.timeout"
    >
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn
          color="white"
          variant="text"
          @click="snackbar.show = false"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { useSnackbarStore } from '@/stores/snackbar-store';
import { UserRole } from '@/types/user-types';

const router = useRouter();
const authStore = useAuthStore();
const themeStore = useThemeStore();
const snackbarStore = useSnackbarStore();

const drawer = ref(true);
const rail = ref(true);

const theme = computed(() => themeStore.theme);
const isAuthenticated = computed(() => authStore.isAuthenticated);
const userProfile = computed(() => authStore.userProfile);
const snackbar = computed(() => snackbarStore.snackbar);

const navigationItems = computed(() => {
  const items = [
    {
      title: 'Dashboard',
      icon: 'mdi-view-dashboard',
      to: '/dashboard',
    },
    {
      title: 'Courses',
      icon: 'mdi-book-open-page-variant',
      to: '/courses',
    },
  ];

  if (userProfile.value?.role === UserRole.INSTRUCTOR) {
    items.push(
      {
        title: 'Create Course',
        icon: 'mdi-plus-circle',
        to: '/courses/create',
      },
      {
        title: 'Analytics',
        icon: 'mdi-chart-bar',
        to: '/analytics',
      },
    );
  }

  items.push(
    {
      title: 'Profile',
      icon: 'mdi-account',
      to: '/profile',
    },
    {
      title: 'Settings',
      icon: 'mdi-cog',
      to: '/settings',
    },
  );

  return items;
});

const toggleDrawer = () => {
  drawer.value = !drawer.value;
  rail.value = false;
};

const toggleTheme = () => {
  themeStore.toggleTheme();
};

const logout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>