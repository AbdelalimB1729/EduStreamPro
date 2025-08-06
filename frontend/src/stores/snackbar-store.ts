import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface SnackbarState {
  show: boolean;
  text: string;
  color: string;
  timeout: number;
}

export const useSnackbarStore = defineStore('snackbar', () => {
  // State
  const snackbar = ref<SnackbarState>({
    show: false,
    text: '',
    color: 'success',
    timeout: 3000,
  });

  // Actions
  const showMessage = (
    text: string,
    color: string = 'success',
    timeout: number = 3000,
  ) => {
    snackbar.value = {
      show: true,
      text,
      color,
      timeout,
    };
  };

  const showSuccess = (text: string) => {
    showMessage(text, 'success');
  };

  const showError = (text: string) => {
    showMessage(text, 'error', 5000);
  };

  const showWarning = (text: string) => {
    showMessage(text, 'warning', 4000);
  };

  const showInfo = (text: string) => {
    showMessage(text, 'info');
  };

  const hide = () => {
    snackbar.value.show = false;
  };

  return {
    // State
    snackbar,

    // Actions
    showMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hide,
  };
});