import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { User, AuthTokens, LoginCredentials, RegisterData } from '@/types/user-types';
import { apiService } from '@/services/api-service';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const tokens = ref<AuthTokens | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!tokens.value?.accessToken);
  const userProfile = computed(() => user.value);
  const userRole = computed(() => user.value?.role);

  // Actions
  const login = async (credentials: LoginCredentials) => {
    try {
      loading.value = true;
      error.value = null;

      const response = await apiService.post('/auth/login', credentials);
      tokens.value = response.data;
      await fetchUserProfile();

      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Login failed';
      return false;
    } finally {
      loading.value = false;
    }
  };

  const register = async (data: RegisterData) => {
    try {
      loading.value = true;
      error.value = null;

      const response = await apiService.post('/auth/register', data);
      tokens.value = response.data;
      await fetchUserProfile();

      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Registration failed';
      return false;
    } finally {
      loading.value = false;
    }
  };

  const logout = async () => {
    try {
      if (tokens.value) {
        await apiService.post('/auth/logout');
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      clearAuth();
    }
  };

  const refreshToken = async () => {
    try {
      if (!tokens.value?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiService.post('/auth/refresh', {
        refreshToken: tokens.value.refreshToken,
      });

      tokens.value = response.data;
      return true;
    } catch (err) {
      clearAuth();
      return false;
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await apiService.get('/auth/profile');
      user.value = response.data;
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      loading.value = true;
      error.value = null;

      const response = await apiService.put('/auth/profile', data);
      user.value = response.data;

      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to update profile';
      return false;
    } finally {
      loading.value = false;
    }
  };

  const clearAuth = () => {
    user.value = null;
    tokens.value = null;
    error.value = null;
  };

  return {
    // State
    user,
    tokens,
    loading,
    error,

    // Getters
    isAuthenticated,
    userProfile,
    userRole,

    // Actions
    login,
    register,
    logout,
    refreshToken,
    fetchUserProfile,
    updateProfile,
    clearAuth,
  };
}, {
  persist: {
    paths: ['tokens'],
  },
});