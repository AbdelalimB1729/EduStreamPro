<template>
  <div class="code-evaluator">
    <v-card>
      <v-card-text>
        <div class="d-flex align-center mb-4">
          <v-select
            v-model="selectedLanguage"
            :items="supportedLanguages"
            label="Language"
            density="compact"
            class="language-select"
            :disabled="isSubmitted"
          />
          <v-spacer />
          <v-btn
            v-if="!isSubmitted"
            color="primary"
            size="small"
            prepend-icon="mdi-play"
            @click="runTests"
            :loading="isRunning"
            :disabled="!code.trim()"
          >
            Run Tests
          </v-btn>
        </div>

        <!-- Code Editor -->
        <div class="editor-container">
          <v-textarea
            v-model="code"
            :label="'Write your code here'"
            :placeholder="placeholder"
            :hint="hint"
            :disabled="isSubmitted"
            class="mb-4"
            auto-grow
            filled
            monospace
            :rows="10"
          />
        </div>

        <!-- Test Cases -->
        <div v-if="testCases.length > 0" class="test-cases mt-4">
          <v-expansion-panels>
            <v-expansion-panel>
              <v-expansion-panel-title>
                Test Cases
                <template v-slot:actions>
                  <v-chip
                    :color="getTestResultColor"
                    size="small"
                    class="ml-2"
                  >
                    {{ testResults.length }}/{{ testCases.length }} Passed
                  </v-chip>
                </template>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-list>
                  <v-list-item
                    v-for="(testCase, index) in testCases"
                    :key="index"
                    v-if="!testCase.isHidden"
                  >
                    <template v-slot:prepend>
                      <v-icon
                        :color="getTestCaseColor(index)"
                        class="mr-2"
                      >
                        {{ getTestCaseIcon(index) }}
                      </v-icon>
                    </template>
                    <v-list-item-title>
                      Test Case {{ index + 1 }}
                    </v-list-item-title>
                    <v-list-item-subtitle>
                      <div>Input: {{ testCase.input }}</div>
                      <div>Expected: {{ testCase.expectedOutput }}</div>
                      <div v-if="testResults[index]?.output">
                        Actual: {{ testResults[index].output }}
                      </div>
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>

        <!-- Console Output -->
        <div v-if="consoleOutput" class="console-output mt-4">
          <v-expansion-panels>
            <v-expansion-panel>
              <v-expansion-panel-title>
                Console Output
                <template v-slot:actions>
                  <v-icon
                    :color="hasError ? 'error' : 'success'"
                    size="small"
                  >
                    {{ hasError ? 'mdi-alert-circle' : 'mdi-check-circle' }}
                  </v-icon>
                </template>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <pre class="console-text" :class="{ 'has-error': hasError }">
                  {{ consoleOutput }}
                </pre>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { CodeTestCase } from '@/types/quiz-types';

const props = defineProps<{
  testCases: CodeTestCase[];
  initialCode?: string;
  language?: string;
  isSubmitted?: boolean;
}>();

const emit = defineEmits<{
  (e: 'run', results: { passed: boolean; testResults: any[] }): void;
}>();

// State
const code = ref(props.initialCode || '');
const selectedLanguage = ref(props.language || 'javascript');
const isRunning = ref(false);
const testResults = ref<any[]>([]);
const consoleOutput = ref('');
const hasError = ref(false);

// Constants
const supportedLanguages = [
  { title: 'JavaScript', value: 'javascript' },
  { title: 'Python', value: 'python' },
  { title: 'Java', value: 'java' },
];

// Computed
const placeholder = computed(() => {
  switch (selectedLanguage.value) {
    case 'javascript':
      return 'function solution(input) {\n  // Your code here\n}';
    case 'python':
      return 'def solution(input):\n    # Your code here\n    pass';
    case 'java':
      return 'public class Solution {\n    public static String solution(String input) {\n        // Your code here\n    }\n}';
    default:
      return '';
  }
});

const hint = computed(() => {
  return `Write your solution in ${
    supportedLanguages.find(l => l.value === selectedLanguage.value)?.title
  }`;
});

const getTestResultColor = computed(() => {
  if (testResults.value.length === 0) return 'grey';
  const passedCount = testResults.value.filter(r => r.passed).length;
  if (passedCount === testCases.length) return 'success';
  if (passedCount > 0) return 'warning';
  return 'error';
});

// Methods
const getTestCaseIcon = (index: number): string => {
  if (!testResults.value[index]) return 'mdi-circle-outline';
  return testResults.value[index].passed
    ? 'mdi-check-circle'
    : 'mdi-close-circle';
};

const getTestCaseColor = (index: number): string => {
  if (!testResults.value[index]) return 'grey';
  return testResults.value[index].passed ? 'success' : 'error';
};

const runTests = async () => {
  try {
    isRunning.value = true;
    consoleOutput.value = '';
    hasError.value = false;
    testResults.value = [];

    // In a real application, this would send the code to a secure backend
    // for execution. Here we're just simulating the process.
    await new Promise(resolve => setTimeout(resolve, 1000));

    const results = props.testCases.map(testCase => {
      try {
        // Simulate code execution
        const output = `Simulated output for input: ${testCase.input}`;
        const passed = Math.random() > 0.5; // Random pass/fail for demo

        return {
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          output,
          passed,
        };
      } catch (error) {
        return {
          input: testCase.input,
          expectedOutput: testCase.expectedOutput,
          output: error.message,
          passed: false,
        };
      }
    });

    testResults.value = results;
    const allPassed = results.every(r => r.passed);
    
    consoleOutput.value = allPassed
      ? 'All tests passed successfully!'
      : 'Some tests failed. Check the test cases for details.';
    
    hasError.value = !allPassed;

    emit('run', {
      passed: allPassed,
      testResults: results,
    });
  } catch (error) {
    consoleOutput.value = `Error: ${error.message}`;
    hasError.value = true;
  } finally {
    isRunning.value = false;
  }
};
</script>

<style scoped>
.code-evaluator {
  max-width: 800px;
  margin: 0 auto;
}

.language-select {
  max-width: 200px;
}

.editor-container {
  border: 1px solid var(--v-border-color);
  border-radius: 4px;
}

.console-text {
  font-family: monospace;
  white-space: pre-wrap;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.console-text.has-error {
  color: var(--v-error-base);
}

:deep(.v-textarea textarea) {
  font-family: monospace !important;
}
</style>