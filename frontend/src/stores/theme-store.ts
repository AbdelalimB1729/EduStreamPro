import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  // State
  const currentTheme = ref<'light' | 'dark'>('light');

  // Getters
  const theme = computed(() => currentTheme.value);

  // Actions
  const setTheme = (theme: 'light' | 'dark') => {
    currentTheme.value = theme;
  };

  const toggleTheme = () => {
    currentTheme.value = currentTheme.value === 'light' ? 'dark' : 'light';
  };

  return {
    // State
    currentTheme,

    // Getters
    theme,

    // Actions
    setTheme,
    toggleTheme,
  };
}, {
  persist: true,
});