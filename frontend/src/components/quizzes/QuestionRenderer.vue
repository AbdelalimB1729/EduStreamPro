<template>
  <div class="question-renderer">
    <v-card>
      <v-card-text>
        <!-- Question Text -->
        <div class="question-text mb-4">
          <div class="d-flex align-center">
            <span class="text-h6">Question {{ questionNumber }}</span>
            <v-chip
              class="ml-2"
              :color="getQuestionTypeColor"
              size="small"
            >
              {{ formatQuestionType }}
            </v-chip>
            <v-chip
              class="ml-2"
              color="primary"
              size="small"
            >
              {{ question.points }} points
            </v-chip>
          </div>
          <p class="mt-2 text-body-1">{{ question.text }}</p>
        </div>

        <!-- Multiple Choice Question -->
        <div v-if="question.type === QuestionType.MULTIPLE_CHOICE">
          <v-checkbox
            v-for="choice in question.choices"
            :key="choice.id"
            v-model="selectedChoices"
            :label="choice.text"
            :value="choice.id"
            :disabled="isSubmitted"
            hide-details
            class="mb-2"
          />
        </div>

        <!-- Single Choice Question -->
        <div v-else-if="question.type === QuestionType.SINGLE_CHOICE">
          <v-radio-group
            v-model="selectedChoice"
            :disabled="isSubmitted"
          >
            <v-radio
              v-for="choice in question.choices"
              :key="choice.id"
              :label="choice.text"
              :value="choice.id"
            />
          </v-radio-group>
        </div>

        <!-- True/False Question -->
        <div v-else-if="question.type === QuestionType.TRUE_FALSE">
          <v-radio-group
            v-model="selectedChoice"
            :disabled="isSubmitted"
          >
            <v-radio
              label="True"
              value="true"
            />
            <v-radio
              label="False"
              value="false"
            />
          </v-radio-group>
        </div>

        <!-- Code Question -->
        <div v-else-if="question.type === QuestionType.CODE">
          <v-textarea
            v-model="codeAnswer"
            :label="'Write your code here'"
            :placeholder="question.codeTemplate"
            :hint="'Use the provided template as a starting point'"
            :disabled="isSubmitted"
            class="mb-4"
            auto-grow
            filled
            monospace
          />

          <div v-if="question.testCases?.length && !question.testCases[0].isHidden">
            <div class="text-subtitle-1 mb-2">Test Cases:</div>
            <v-list>
              <v-list-item
                v-for="(testCase, index) in question.testCases"
                :key="index"
                v-if="!testCase.isHidden"
              >
                <template v-slot:prepend>
                  <v-icon
                    :color="getTestCaseColor(testCase, index)"
                    class="mr-2"
                  >
                    {{ getTestCaseIcon(testCase, index) }}
                  </v-icon>
                </template>
                <v-list-item-title>
                  Input: {{ testCase.input }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  Expected Output: {{ testCase.expectedOutput }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </div>
        </div>

        <!-- Feedback Section -->
        <div
          v-if="isSubmitted && question.explanation"
          class="mt-4 pa-4 rounded-lg"
          :class="isCorrect ? 'bg-success-lighten-4' : 'bg-error-lighten-4'"
        >
          <div class="d-flex align-center mb-2">
            <v-icon
              :color="isCorrect ? 'success' : 'error'"
              class="mr-2"
            >
              {{ isCorrect ? 'mdi-check-circle' : 'mdi-alert-circle' }}
            </v-icon>
            <span class="text-subtitle-1">
              {{ isCorrect ? 'Correct!' : 'Incorrect' }}
            </span>
          </div>
          <p class="text-body-2">{{ question.explanation }}</p>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn
          v-if="!isSubmitted"
          color="primary"
          @click="submitAnswer"
          :disabled="!isAnswered"
        >
          Submit Answer
        </v-btn>
        <v-btn
          v-else
          color="primary"
          @click="$emit('next-question')"
        >
          Next Question
        </v-btn>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Question, QuestionType, CodeTestCase } from '@/types/quiz-types';

const props = defineProps<{
  question: Question;
  questionNumber: number;
  isSubmitted?: boolean;
  testResults?: {
    passed: boolean;
    testCaseResults: boolean[];
  };
}>();

const emit = defineEmits<{
  (e: 'submit', answer: any): void;
  (e: 'next-question'): void;
}>();

// State
const selectedChoices = ref<string[]>([]);
const selectedChoice = ref<string>('');
const codeAnswer = ref(props.question.codeTemplate || '');

// Computed
const formatQuestionType = computed(() => {
  switch (props.question.type) {
    case QuestionType.MULTIPLE_CHOICE:
      return 'Multiple Choice';
    case QuestionType.SINGLE_CHOICE:
      return 'Single Choice';
    case QuestionType.TRUE_FALSE:
      return 'True/False';
    case QuestionType.CODE:
      return 'Code';
    default:
      return 'Unknown';
  }
});

const getQuestionTypeColor = computed(() => {
  switch (props.question.type) {
    case QuestionType.MULTIPLE_CHOICE:
      return 'info';
    case QuestionType.SINGLE_CHOICE:
      return 'primary';
    case QuestionType.TRUE_FALSE:
      return 'success';
    case QuestionType.CODE:
      return 'warning';
    default:
      return 'grey';
  }
});

const isAnswered = computed(() => {
  switch (props.question.type) {
    case QuestionType.MULTIPLE_CHOICE:
      return selectedChoices.value.length > 0;
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.TRUE_FALSE:
      return !!selectedChoice.value;
    case QuestionType.CODE:
      return !!codeAnswer.value.trim();
    default:
      return false;
  }
});

const isCorrect = computed(() => {
  if (!props.isSubmitted) return false;
  
  switch (props.question.type) {
    case QuestionType.CODE:
      return props.testResults?.passed ?? false;
    default:
      return false; // In a real app, this would be determined by the backend
  }
});

// Methods
const getTestCaseIcon = (testCase: CodeTestCase, index: number): string => {
  if (!props.isSubmitted) return 'mdi-circle-outline';
  if (!props.testResults) return 'mdi-circle-outline';
  return props.testResults.testCaseResults[index]
    ? 'mdi-check-circle'
    : 'mdi-close-circle';
};

const getTestCaseColor = (testCase: CodeTestCase, index: number): string => {
  if (!props.isSubmitted) return 'grey';
  if (!props.testResults) return 'grey';
  return props.testResults.testCaseResults[index] ? 'success' : 'error';
};

const submitAnswer = () => {
  let answer;
  switch (props.question.type) {
    case QuestionType.MULTIPLE_CHOICE:
      answer = selectedChoices.value;
      break;
    case QuestionType.SINGLE_CHOICE:
    case QuestionType.TRUE_FALSE:
      answer = selectedChoice.value;
      break;
    case QuestionType.CODE:
      answer = codeAnswer.value;
      break;
  }
  emit('submit', answer);
};
</script>

<style scoped>
.question-renderer {
  max-width: 800px;
  margin: 0 auto;
}

.question-text {
  border-left: 4px solid var(--v-primary-base);
  padding-left: 16px;
}
</style>