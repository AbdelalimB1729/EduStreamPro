<template>
  <div class="course-player">
    <v-container fluid>
      <v-row>
        <!-- Main Content Area -->
        <v-col cols="12" md="8">
          <div v-if="currentLesson">
            <!-- Video Player -->
            <video-player
              v-if="currentLesson.type === LessonType.VIDEO"
              :src="currentLesson.content.url"
              :thumbnail="currentLesson.content.thumbnail"
              @timeupdate="handleTimeUpdate"
              @ended="handleVideoEnded"
            />

            <!-- Document Viewer -->
            <v-card v-else-if="currentLesson.type === LessonType.DOCUMENT">
              <v-card-text>
                <iframe
                  :src="currentLesson.content.url"
                  class="document-viewer"
                  frameborder="0"
                />
              </v-card-text>
            </v-card>

            <!-- Quiz -->
            <v-card v-else-if="currentLesson.type === LessonType.QUIZ">
              <v-card-text>
                <v-btn
                  color="primary"
                  block
                  @click="startQuiz"
                  v-if="!quizStarted"
                >
                  Start Quiz
                </v-btn>
              </v-card-text>
            </v-card>

            <!-- Lesson Information -->
            <v-card class="mt-4">
              <v-card-title>{{ currentLesson.title }}</v-card-title>
              <v-card-text>
                <p>{{ currentLesson.description }}</p>
              </v-card-text>
            </v-card>

            <!-- Resources -->
            <resource-library
              class="mt-4"
              :resources="currentLesson.resources || []"
            />
          </div>
        </v-col>

        <!-- Sidebar -->
        <v-col cols="12" md="4">
          <progress-tracker
            :modules="course?.modules || []"
            :current-lesson-id="currentLesson?.id"
            :completed-lessons="completedLessons"
            @select-lesson="handleLessonSelect"
          />
        </v-col>
      </v-row>
    </v-container>

    <!-- Quiz Dialog -->
    <v-dialog
      v-model="showQuizDialog"
      fullscreen
      :scrim="false"
      transition="dialog-bottom-transition"
    >
      <quiz-session
        v-if="currentQuiz"
        :quiz="currentQuiz"
        @complete="handleQuizComplete"
        @close="showQuizDialog = false"
      />
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCourseStore } from '@/stores/course-store';
import { useQuizStore } from '@/stores/quiz-store';
import { useSnackbarStore } from '@/stores/snackbar-store';
import { LessonType } from '@/types/course-types';
import VideoPlayer from '@/components/learning/VideoPlayer.vue';
import ProgressTracker from '@/components/learning/ProgressTracker.vue';
import ResourceLibrary from '@/components/learning/ResourceLibrary.vue';
import QuizSession from '@/views/student/QuizSession.vue';

const route = useRoute();
const router = useRouter();
const courseStore = useCourseStore();
const quizStore = useQuizStore();
const snackbarStore = useSnackbarStore();

// State
const course = computed(() => courseStore.currentCourse);
const currentLesson = ref(null);
const completedLessons = ref(new Set());
const showQuizDialog = ref(false);
const quizStarted = ref(false);
const currentQuiz = ref(null);

// Methods
const loadCourse = async () => {
  try {
    await courseStore.fetchCourse(route.params.courseId);
    await courseStore.fetchEnrolledCourses();

    // Set initial lesson
    if (route.query.lessonId) {
      await handleLessonSelect(findLesson(route.query.lessonId));
    } else if (course.value?.modules[0]?.lessons[0]) {
      await handleLessonSelect(course.value.modules[0].lessons[0]);
    }
  } catch (error) {
    snackbarStore.showError('Failed to load course');
    router.push('/courses');
  }
};

const findLesson = (lessonId: string) => {
  for (const module of course.value?.modules || []) {
    const lesson = module.lessons.find(l => l.id === lessonId);
    if (lesson) return lesson;
  }
  return null;
};

const handleLessonSelect = async (lesson) => {
  if (!lesson) return;

  currentLesson.value = lesson;
  
  // Update URL without navigation
  router.replace({
    query: { ...route.query, lessonId: lesson.id },
  });

  // If it's a quiz, load quiz data
  if (lesson.type === LessonType.QUIZ) {
    try {
      const quiz = await quizStore.fetchQuiz(lesson.content.quizId);
      currentQuiz.value = quiz;
      quizStarted.value = false;
    } catch (error) {
      snackbarStore.showError('Failed to load quiz');
    }
  }
};

const handleTimeUpdate = async (time: number) => {
  // Mark lesson as completed when 90% watched
  if (
    currentLesson.value &&
    time / currentLesson.value.content.duration > 0.9 &&
    !completedLessons.value.has(currentLesson.value.id)
  ) {
    await markLessonCompleted(currentLesson.value.id);
  }
};

const handleVideoEnded = async () => {
  if (currentLesson.value) {
    await markLessonCompleted(currentLesson.value.id);
    snackbarStore.showSuccess('Lesson completed!');
  }
};

const markLessonCompleted = async (lessonId: string) => {
  try {
    await courseStore.updateProgress(course.value.id, lessonId);
    completedLessons.value.add(lessonId);
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
};

const startQuiz = () => {
  quizStarted.value = true;
  showQuizDialog.value = true;
};

const handleQuizComplete = async (results) => {
  showQuizDialog.value = false;
  if (results.passed) {
    await markLessonCompleted(currentLesson.value.id);
    snackbarStore.showSuccess('Quiz completed successfully!');
  } else {
    snackbarStore.showError('Quiz failed. Please try again.');
  }
};

// Lifecycle
onMounted(() => {
  loadCourse();
});
</script>

<style scoped>
.course-player {
  height: 100%;
}

.document-viewer {
  width: 100%;
  height: 800px;
  border: none;
}
</style>