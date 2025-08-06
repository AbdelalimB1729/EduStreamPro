<template>
  <div class="quiz-timer">
    <v-card
      :color="timerColor"
      :class="{ 'shake-animation': isWarning }"
    >
      <v-card-text class="d-flex align-center">
        <v-icon
          :color="timeRemaining <= warningThreshold ? 'white' : undefined"
          class="mr-2"
        >
          mdi-clock-outline
        </v-icon>
        <span
          class="text-h6"
          :class="{ 'white--text': timeRemaining <= warningThreshold }"
        >
          {{ formatTime(timeRemaining) }}
        </span>
      </v-card-text>
    </v-card>

    <!-- Time's Up Dialog -->
    <v-dialog
      v-model="showTimeUpDialog"
      persistent
      max-width="400"
    >
      <v-card>
        <v-card-title class="text-h5">
          Time's Up!
        </v-card-title>
        <v-card-text>
          Your time has expired. The quiz will be automatically submitted.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            @click="handleTimeUp"
          >
            Submit Quiz
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  initialTime: number; // in seconds
  warningTime?: number; // in seconds
}>();

const emit = defineEmits<{
  (e: 'time-up'): void;
  (e: 'time-update', timeRemaining: number): void;
}>();

// State
const timeRemaining = ref(props.initialTime);
const showTimeUpDialog = ref(false);
const timerInterval = ref<number | null>(null);
const warningThreshold = props.warningTime || 300; // 5 minutes default

// Computed
const timerColor = computed(() => {
  if (timeRemaining.value <= 60) return 'error';
  if (timeRemaining.value <= warningThreshold) return 'warning';
  return 'default';
});

const isWarning = computed(() => {
  return timeRemaining.value <= 60;
});

// Methods
const startTimer = () => {
  if (timerInterval.value) return;

  timerInterval.value = window.setInterval(() => {
    if (timeRemaining.value > 0) {
      timeRemaining.value--;
      emit('time-update', timeRemaining.value);

      // Show warning at specific intervals
      if (
        timeRemaining.value === warningThreshold ||
        timeRemaining.value === 60
      ) {
        showWarning();
      }
    } else {
      stopTimer();
      showTimeUpDialog.value = true;
    }
  }, 1000);
};

const stopTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }
};

const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(remainingSeconds)}`;
  }
  return `${minutes}:${padZero(remainingSeconds)}`;
};

const padZero = (num: number): string => {
  return num.toString().padStart(2, '0');
};

const showWarning = () => {
  // You could integrate with a notification system here
  console.warn(`${formatTime(timeRemaining.value)} remaining!`);
};

const handleTimeUp = () => {
  showTimeUpDialog.value = false;
  emit('time-up');
};

// Lifecycle
onMounted(() => {
  startTimer();
});

onUnmounted(() => {
  stopTimer();
});

// Watch for external time updates
watch(
  () => props.initialTime,
  (newTime) => {
    timeRemaining.value = newTime;
  },
);
</script>

<style scoped>
.quiz-timer {
  position: sticky;
  top: 16px;
  z-index: 100;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.shake-animation {
  animation: shake 0.5s ease-in-out;
}

.v-card {
  transition: background-color 0.3s ease;
}
</style>