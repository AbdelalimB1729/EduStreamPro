<template>
  <div class="learning-dashboard">
    <v-container>
      <!-- Welcome Section -->
      <v-row class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center">
                <div>
                  <h1 class="text-h4 mb-2">
                    Welcome back, {{ userProfile?.firstName }}!
                  </h1>
                  <p class="text-subtitle-1">
                    Continue your learning journey
                  </p>
                </div>
                <v-spacer />
                <v-btn
                  color="primary"
                  prepend-icon="mdi-book-open-page-variant"
                  to="/courses"
                >
                  Browse Courses
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Progress Overview -->
      <v-row class="mb-6">
        <v-col cols="12" md="4">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon
                  color="primary"
                  size="32"
                  class="mr-2"
                >
                  mdi-book-open
                </v-icon>
                <span class="text-h6">Enrolled Courses</span>
              </div>
              <div class="text-h3">{{ enrolledCourses.length }}</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon
                  color="success"
                  size="32"
                  class="mr-2"
                >
                  mdi-check-circle
                </v-icon>
                <span class="text-h6">Completed Lessons</span>
              </div>
              <div class="text-h3">{{ completedLessonsCount }}</div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="4">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center mb-2">
                <v-icon
                  color="info"
                  size="32"
                  class="mr-2"
                >
                  mdi-clock-outline
                </v-icon>
                <span class="text-h6">Learning Hours</span>
              </div>
              <div class="text-h3">{{ totalLearningHours }}</div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Continue Learning -->
      <v-row class="mb-6">
        <v-col cols="12">
          <h2 class="text-h5 mb-4">Continue Learning</h2>
          
          <div v-if="inProgressCourses.length > 0">
            <v-row>
              <v-col
                v-for="course in inProgressCourses"
                :key="course.id"
                cols="12"
                md="6"
                lg="4"
              >
                <v-card>
                  <v-img
                    :src="course.thumbnail"
                    height="200"
                    cover
                  />
                  <v-card-text>
                    <div class="d-flex align-center mb-2">
                      <div class="text-h6">{{ course.title }}</div>
                      <v-spacer />
                      <v-chip
                        :color="getProgressColor(course.progress)"
                        size="small"
                      >
                        {{ formatProgress(course.progress) }}
                      </v-chip>
                    </div>
                    <v-progress-linear
                      :model-value="course.progress"
                      :color="getProgressColor(course.progress)"
                      height="8"
                      rounded
                    />
                    <p class="mt-2 text-body-2">
                      {{ course.description }}
                    </p>
                  </v-card-text>
                  <v-card-actions>
                    <v-spacer />
                    <v-btn
                      color="primary"
                      :to="\`/courses/\${course.id}/learn\`"
                    >
                      Continue
                    </v-btn>
                  </v-card-actions>
                </v-card>
              </v-col>
            </v-row>
          </div>
          <v-alert
            v-else
            type="info"
            text="No courses in progress. Start learning today!"
            variant="tonal"
          />
        </v-col>
      </v-row>

      <!-- Recent Activity -->
      <v-row>
        <v-col cols="12">
          <h2 class="text-h5 mb-4">Recent Activity</h2>
          
          <v-timeline v-if="recentActivity.length > 0">
            <v-timeline-item
              v-for="activity in recentActivity"
              :key="activity.id"
              :dot-color="getActivityColor(activity.type)"
              size="small"
            >
              <template v-slot:opposite>
                {{ formatDate(activity.date) }}
              </template>
              <div class="text-subtitle-1">
                {{ activity.title }}
              </div>
              <div class="text-body-2">
                {{ activity.description }}
              </div>
            </v-timeline-item>
          </v-timeline>
          <v-alert
            v-else
            type="info"
            text="No recent activity"
            variant="tonal"
          />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth-store';
import { useCourseStore } from '@/stores/course-store';
import { formatProgress } from '@/utils/formatters';
import { formatDate } from '@/utils/formatters';

// Stores
const authStore = useAuthStore();
const courseStore = useCourseStore();

// Computed
const userProfile = computed(() => authStore.userProfile);
const enrolledCourses = computed(() => courseStore.myCourses);

const inProgressCourses = computed(() => {
  return enrolledCourses.value.filter(course => {
    const progress = courseStore.getProgress(course.id);
    return progress > 0 && progress < 100;
  });
});

const completedLessonsCount = computed(() => {
  return enrolledCourses.value.reduce((total, course) => {
    const progress = courseStore.getProgress(course.id);
    const lessonCount = course.modules.reduce(
      (sum, module) => sum + module.lessons.length,
      0,
    );
    return total + Math.floor((progress / 100) * lessonCount);
  }, 0);
});

const totalLearningHours = computed(() => {
  // In a real app, this would be calculated from actual watch time
  return Math.floor(completedLessonsCount.value * 0.5);
});

// State
const recentActivity = ref([
  {
    id: '1',
    type: 'lesson',
    title: 'Completed Lesson',
    description: 'Introduction to TypeScript',
    date: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
  },
  {
    id: '2',
    type: 'quiz',
    title: 'Passed Quiz',
    description: 'TypeScript Basics Quiz',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: '3',
    type: 'course',
    title: 'Enrolled in Course',
    description: 'Advanced TypeScript Development',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
]);

// Methods
const getProgressColor = (progress: number): string => {
  if (progress >= 80) return 'success';
  if (progress >= 50) return 'primary';
  return 'warning';
};

const getActivityColor = (type: string): string => {
  switch (type) {
    case 'lesson':
      return 'primary';
    case 'quiz':
      return 'success';
    case 'course':
      return 'info';
    default:
      return 'grey';
  }
};

// Lifecycle
onMounted(async () => {
  await courseStore.fetchEnrolledCourses();
});
</script>

<style scoped>
.learning-dashboard {
  min-height: 100%;
  background-color: var(--v-background-base);
}
</style>