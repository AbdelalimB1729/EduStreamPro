import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';
import { useQuizStore } from '@/stores/quiz-store';
import { useSnackbarStore } from '@/stores/snackbar-store';

class WebSocketService {
  private socket: Socket | null = null;
  private heartbeatInterval: number | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  private authStore = useAuthStore();
  private quizStore = useQuizStore();
  private snackbarStore = useSnackbarStore();

  public connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(import.meta.env.VITE_WS_URL, {
      path: '/quizzes',
      auth: {
        userId: this.authStore.userProfile?.id,
        token: this.authStore.tokens?.accessToken,
      },
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.setupEventListeners();
  }

  public disconnect(): void {
    if (this.socket) {
      this.clearHeartbeat();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    this.socket.on('disconnect', (reason) => {
      this.clearHeartbeat();
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.snackbarStore.showError(
          'Unable to connect to quiz server. Please try again later.',
        );
        this.disconnect();
      }
    });

    this.socket.on('participantJoined', (data) => {
      this.snackbarStore.showInfo(
        `${data.participantCount} participants in the quiz`,
      );
    });

    this.socket.on('participantLeft', (data) => {
      this.snackbarStore.showInfo(
        `${data.participantCount} participants remaining`,
      );
    });

    this.socket.on('quizCompleted', (data) => {
      this.quizStore.handleTimeUp();
      this.snackbarStore.showSuccess(
        `Quiz completed! Score: ${data.score}%. ${
          data.passed ? 'Passed!' : 'Failed.'
        }`,
      );
    });
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (this.socket?.connected && this.quizStore.currentQuiz) {
        this.socket.emit(
          'heartbeat',
          { quizId: this.quizStore.currentQuiz.id },
          (response) => {
            if (response.status === 'success') {
              this.quizStore.updateTimeRemaining(response.timeRemaining);
              
              if (response.timeRemaining === 0) {
                this.quizStore.handleTimeUp();
              }
            }
          },
        );
      }
    }, 1000);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public joinQuiz(quizId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit('joinQuiz', { quizId }, (response) => {
        if (response.status === 'joined') {
          resolve(true);
        } else {
          reject(new Error(response.message));
        }
      });
    });
  }

  public submitAnswer(
    quizId: string,
    questionId: string,
    answer: any,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.socket.emit(
        'submitAnswer',
        { quizId, questionId, answer },
        (response) => {
          if (response.status === 'success') {
            resolve(true);
          } else {
            reject(new Error(response.message));
          }
        },
      );
    });
  }

  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const websocketService = new WebSocketService();