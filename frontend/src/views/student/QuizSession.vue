<template>
  <div class="quiz-session">
    <v-app-bar>
      <v-btn icon @click="handleClose">
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-app-bar-title>{{ quiz.title }}</v-app-bar-title>
      <v-spacer />
      <quiz-timer
        v-if="isActive"
        :initial-time="quiz.timeLimit * 60"
        :warning-time="300"
        @time-up="handleTimeUp"
        @time-update="handleTimeUpdate"
      />
    </v-app-bar>

    <v-main>
      <v-container>
        <!-- Quiz Overview -->
        <div v-if="!isActive" class="quiz-overview">
          <v-card>
            <v-card-title>{{ quiz.title }}</v-card-title>
            <v-card-text>
              <p class="text-body-1">{{ quiz.description }}</p>

              <v-list>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-clock-outline</v-icon>
                  </template>
                  <v-list-item-title>Time Limit</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ quiz.timeLimit }} minutes
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-help-circle</v-icon>
                  </template>
                  <v-list-item-title>Questions</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ quiz.questions.length }} questions
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon>mdi-check-circle</v-icon>
                  </template>
                  <v-list-item-title>Passing Score</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ quiz.passingScore }}%
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>

              <v-alert
                type="warning"
                variant="tonal"
                class="mt-4"
              >
                <p><strong>Important Notes:</strong></p>
                <ul>
                  <li>You cannot pause or resume the quiz once started</li>
                  <li>All questions must be answered</li>
                  <li>You cannot return to previous questions</li>
                  <li>The quiz will auto-submit when time expires</li>
                </ul>
              </v-alert>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="primary"
                @click="startQuiz"
              >
                Start Quiz
              </v-btn>
            </v-card-actions>
          </v-card>
        </div>

        <!-- Quiz Questions -->
        <div v-else class="quiz-questions">
          <v-row>
            <v-col cols="12" md="8" class="mx-auto">
              <!-- Progress -->
              <v-card class="mb-4">
                <v-card-text>
                  <div class="d-flex align-center">
                    <div class="text-body-1">
                      Question {{ currentQuestionIndex + 1 }} of {{ quiz.questions.length }}
                    </div>
                    <v-spacer />
                    <v-progress-linear
                      :model-value="progress"
                      color="primary"
                      height="8"
                      rounded
                    />
                  </div>
                </v-card-text>
              </v-card>

              <!-- Current Question -->
              <question-renderer
                :question="currentQuestion"
                :question-number="currentQuestionIndex + 1"
                :is-submitted="isQuestionSubmitted"
                :test-results="questionTestResults"
                @submit="handleAnswerSubmit"
                @next-question="handleNextQuestion"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Results Dialog -->
        <v-dialog
          v-model="showResults"
          persistent
          max-width="500"
        >
          <v-card>
            <v-card-title>Quiz Results</v-card-title>
            <v-card-text>
              <div class="text-center my-4">
                <v-icon
                  size="64"
                  :color="quizResults.passed ? 'success' : 'error'"
                >
                  {{ quizResults.passed ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                </v-icon>
                <div class="text-h4 mt-2">
                  {{ quizResults.score }}%
                </div>
                <div class="text-subtitle-1">
                  {{ quizResults.passed ? 'Passed!' : 'Failed' }}
                </div>
              </div>

              <v-list>
                <v-list-item>
                  <v-list-item-title>Total Questions</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ quiz.questions.length }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <v-list-item-title>Correct Answers</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ quizResults.correctAnswers }}
                  </v-list-item-subtitle>
                </v-list-item>

                <v-list-item>
                  <v-list-item-title>Time Taken</v-list-item-title>
                  <v-list-item-subtitle>
                    {{ formatDuration(quizResults.timeTaken) }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn
                color="primary"
                @click="handleComplete"
              >
                Continue
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-container>
    </v-main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Quiz } from '@/types/quiz-types';
import { formatDuration } from '@/utils/formatters';
import { useQuizStore } from '@/stores/quiz-store';
import QuizTimer from '@/components/quizzes/QuizTimer.vue';
import QuestionRenderer from '@/components/quizzes/QuestionRenderer.vue';

const props = defineProps<{
  quiz: Quiz;
}>();

const emit = defineEmits<{
  (e: 'complete', results: any): void;
  (e: 'close'): void;
}>();

// Store
const quizStore = useQuizStore();

// State
const isActive = ref(false);
const currentQuestionIndex = ref(0);
const answers = ref(new Map());
const isQuestionSubmitted = ref(false);
const questionTestResults = ref(null);
const showResults = ref(false);
const quizResults = ref(null);
const startTime = ref<Date | null>(null);

// Computed
const currentQuestion = computed(() => {
  return props.quiz.questions[currentQuestionIndex.value];
});

const progress = computed(() => {
  return ((currentQuestionIndex.value + 1) / props.quiz.questions.length) * 100;
});

// Methods
const startQuiz = async () => {
  try {
    await quizStore.startQuiz(props.quiz.id);
    isActive.value = true;
    startTime.value = new Date();
  } catch (error) {
    console.error('Failed to start quiz:', error);
  }
};

const handleAnswerSubmit = async (answer: any) => {
  try {
    isQuestionSubmitted.value = true;
    
    // For code questions, evaluate the answer
    if (currentQuestion.value.type === 'code') {
      const results = await evaluateCode(answer);
      questionTestResults.value = results;
    }

    // Save answer
    answers.value.set(currentQuestion.value.id, answer);

    // Submit to server
    await quizStore.submitAnswer(currentQuestion.value.id, answer);
  } catch (error) {
    console.error('Failed to submit answer:', error);
  }
};

const handleNextQuestion = () => {
  isQuestionSubmitted.value = false;
  questionTestResults.value = null;

  if (currentQuestionIndex.value < props.quiz.questions.length - 1) {
    currentQuestionIndex.value++;
  } else {
    submitQuiz();
  }
};

const handleTimeUp = () => {
  submitQuiz();
};

const handleTimeUpdate = (time: number) => {
  // Update remaining time in store
  quizStore.updateTimeRemaining(time);
};

const submitQuiz = async () => {
  try {
    const results = await quizStore.submitQuiz();
    
    quizResults.value = {
      ...results,
      timeTaken: startTime.value
        ? Math.floor((new Date().getTime() - startTime.value.getTime()) / 1000)
        : 0,
    };

    showResults.value = true;
  } catch (error) {
    console.error('Failed to submit quiz:', error);
  }
};

const handleComplete = () => {
  emit('complete', quizResults.value);
};

const handleClose = () => {
  if (isActive.value) {
    if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
      emit('close');
    }
  } else {
    emit('close');
  }
};

const evaluateCode = async (code: string) => {
  // In a real app, this would send the code to a secure backend
  // Here we're just simulating the process
  await new Promise(resolve => setTimeout(resolve, 1000));
  return {
    passed: Math.random() > 0.5,
    testCaseResults: currentQuestion.value.testCases.map(() => Math.random() > 0.5),
  };
};
</script>

<style scoped>
.quiz-session {
  height: 100vh;
  background-color: var(--v-background-base);
}

.quiz-overview {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}
</style>