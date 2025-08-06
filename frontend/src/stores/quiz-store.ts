import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Quiz, Question, QuizSession, QuizAttempt } from '@/types/quiz-types';
import { apiService } from '@/services/api-service';
import { websocketService } from '@/services/websocket-service';

export const useQuizStore = defineStore('quiz', () => {
  // State
  const currentQuiz = ref<Quiz | null>(null);
  const currentSession = ref<QuizSession | null>(null);
  const attempts = ref<Map<string, QuizAttempt>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const isQuizActive = computed(() => 
    currentSession.value?.status === 'active'
  );

  const currentQuestion = computed(() => {
    if (!currentQuiz.value || !currentSession.value) return null;
    const questionIndex = currentSession.value.currentQuestion;
    return currentQuiz.value.questions[questionIndex];
  });

  const progress = computed(() => {
    if (!currentQuiz.value || !currentSession.value) return 0;
    return (currentSession.value.currentQuestion / currentQuiz.value.questions.length) * 100;
  });

  const timeRemaining = computed(() => 
    currentSession.value?.timeRemaining || 0
  );

  // Actions
  const fetchQuiz = async (quizId: string) => {
    try {
      loading.value = true;
      const response = await apiService.get(`/quizzes/${quizId}`);
      currentQuiz.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch quiz';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const startQuiz = async (quizId: string) => {
    try {
      loading.value = true;
      const response = await apiService.post(`/quizzes/${quizId}/start`);
      
      currentSession.value = {
        quizId,
        timeRemaining: response.data.timeLimit * 60,
        currentQuestion: 0,
        answers: new Map(),
        status: 'active',
      };

      // Connect to WebSocket
      websocketService.connect();
      websocketService.joinQuiz(quizId);

      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to start quiz';
      return false;
    } finally {
      loading.value = false;
    }
  };

  const submitAnswer = async (questionId: string, answer: any) => {
    try {
      if (!currentQuiz.value || !currentSession.value) {
        throw new Error('No active quiz session');
      }

      // Save answer locally
      currentSession.value.answers.set(questionId, answer);

      // Send answer to server via WebSocket
      await websocketService.submitAnswer(
        currentQuiz.value.id,
        questionId,
        answer,
      );

      // Move to next question
      if (currentSession.value.currentQuestion < currentQuiz.value.questions.length - 1) {
        currentSession.value.currentQuestion++;
      }

      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to submit answer';
      return false;
    }
  };

  const submitQuiz = async () => {
    try {
      if (!currentQuiz.value || !currentSession.value) {
        throw new Error('No active quiz session');
      }

      loading.value = true;

      // Convert answers Map to object
      const answers = Object.fromEntries(currentSession.value.answers);

      const response = await apiService.post(
        `/quizzes/${currentQuiz.value.id}/submit`,
        { answers },
      );

      // Save attempt
      const attempt: QuizAttempt = {
        quizId: currentQuiz.value.id,
        studentId: response.data.studentId,
        startTime: new Date(currentSession.value.startTime),
        endTime: new Date(),
        answers: currentSession.value.answers,
        score: response.data.score,
        passed: response.data.passed,
        status: 'completed',
      };

      attempts.value.set(currentQuiz.value.id, attempt);

      // Disconnect from WebSocket
      websocketService.disconnect();

      // Clear current session
      currentSession.value = null;

      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to submit quiz';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const updateTimeRemaining = (time: number) => {
    if (currentSession.value) {
      currentSession.value.timeRemaining = time;
    }
  };

  const handleTimeUp = async () => {
    if (currentSession.value?.status === 'active') {
      await submitQuiz();
    }
  };

  const resetQuizState = () => {
    currentQuiz.value = null;
    currentSession.value = null;
    error.value = null;
  };

  return {
    // State
    currentQuiz,
    currentSession,
    attempts,
    loading,
    error,

    // Getters
    isQuizActive,
    currentQuestion,
    progress,
    timeRemaining,

    // Actions
    fetchQuiz,
    startQuiz,
    submitAnswer,
    submitQuiz,
    updateTimeRemaining,
    handleTimeUp,
    resetQuizState,
  };
}, {
  persist: {
    paths: ['attempts'],
  },
});