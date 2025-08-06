import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useAuthStore } from '@/stores/auth-store';
import { useSnackbarStore } from '@/stores/snackbar-store';
import { ERROR_MESSAGES } from '@/utils/constants';

class ApiService {
  private api: AxiosInstance;
  private authStore = useAuthStore();
  private snackbarStore = useSnackbarStore();

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        const token = this.authStore.tokens?.accessToken;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle network errors
        if (!error.response) {
          this.snackbarStore.showError(ERROR_MESSAGES.NETWORK_ERROR);
          return Promise.reject(error);
        }

        // Handle 401 Unauthorized
        if (
          error.response.status === 401 &&
          !originalRequest._retry &&
          this.authStore.tokens?.refreshToken
        ) {
          originalRequest._retry = true;

          try {
            const refreshed = await this.authStore.refreshToken();
            if (refreshed) {
              originalRequest.headers.Authorization = `Bearer ${this.authStore.tokens.accessToken}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            this.snackbarStore.showError(ERROR_MESSAGES.SESSION_EXPIRED);
            this.authStore.logout();
            return Promise.reject(refreshError);
          }
        }

        // Handle other errors
        const errorMessage = error.response.data?.message || error.message;
        this.snackbarStore.showError(errorMessage);

        return Promise.reject(error);
      },
    );
  }

  public async get<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.api.get<T>(url, config);
  }

  public async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.api.post<T>(url, data, config);
  }

  public async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.api.put<T>(url, data, config);
  }

  public async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.api.delete<T>(url, config);
  }

  public async upload(
    url: string,
    file: File,
    onProgress?: (percentage: number) => void,
  ): Promise<AxiosResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentage = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          onProgress(percentage);
        }
      },
    });
  }

  public async downloadFile(url: string): Promise<Blob> {
    const response = await this.api.get(url, {
      responseType: 'blob',
    });
    return response.data;
  }
}

export const apiService = new ApiService();