<template>
  <div class="progress-tracker">
    <v-card>
      <v-card-title class="d-flex align-center">
        Course Progress
        <v-spacer />
        <v-chip
          :color="progressColor"
          class="ml-2"
        >
          {{ formatProgress(overallProgress) }}
        </v-chip>
      </v-card-title>

      <v-card-text>
        <div class="modules-list">
          <div
            v-for="module in modules"
            :key="module.id"
            class="module-item"
          >
            <div class="module-header">
              <v-icon
                :color="getModuleColor(module)"
                class="mr-2"
              >
                {{ getModuleIcon(module) }}
              </v-icon>
              <span class="module-title">{{ module.title }}</span>
              <v-chip
                :color="getModuleColor(module)"
                size="small"
                class="ml-auto"
              >
                {{ formatProgress(getModuleProgress(module)) }}
              </v-chip>
            </div>

            <v-expand-transition>
              <div
                v-if="expandedModules.includes(module.id)"
                class="lessons-list"
              >
                <div
                  v-for="lesson in module.lessons"
                  :key="lesson.id"
                  class="lesson-item"
                  :class="{
                    'lesson-completed': isLessonCompleted(lesson),
                    'lesson-current': isCurrentLesson(lesson),
                  }"
                  @click="selectLesson(lesson)"
                >
                  <v-icon
                    :color="getLessonColor(lesson)"
                    size="small"
                    class="mr-2"
                  >
                    {{ getLessonIcon(lesson) }}
                  </v-icon>
                  <span class="lesson-title">{{ lesson.title }}</span>
                  <v-icon
                    v-if="isLessonCompleted(lesson)"
                    color="success"
                    size="small"
                    class="ml-auto"
                  >
                    mdi-check-circle
                  </v-icon>
                </div>
              </div>
            </v-expand-transition>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Module, Lesson, LessonType } from '@/types/course-types';
import { formatProgress } from '@/utils/formatters';

const props = defineProps<{
  modules: Module[];
  currentLessonId?: string;
  completedLessons: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'select-lesson', lesson: Lesson): void;
}>();

// State
const expandedModules = ref<string[]>([]);

// Computed
const overallProgress = computed(() => {
  const totalLessons = props.modules.reduce(
    (total, module) => total + module.lessons.length,
    0,
  );
  return (props.completedLessons.size / totalLessons) * 100;
});

const progressColor = computed(() => {
  if (overallProgress.value >= 100) return 'success';
  if (overallProgress.value >= 50) return 'primary';
  return 'warning';
});

// Methods
const getModuleProgress = (module: Module): number => {
  const completedInModule = module.lessons.filter(lesson =>
    props.completedLessons.has(lesson.id),
  ).length;
  return (completedInModule / module.lessons.length) * 100;
};

const getModuleColor = (module: Module): string => {
  const progress = getModuleProgress(module);
  if (progress >= 100) return 'success';
  if (progress > 0) return 'primary';
  return 'grey';
};

const getModuleIcon = (module: Module): string => {
  const progress = getModuleProgress(module);
  if (progress >= 100) return 'mdi-check-circle';
  if (progress > 0) return 'mdi-progress-check';
  return 'mdi-folder';
};

const getLessonIcon = (lesson: Lesson): string => {
  switch (lesson.type) {
    case LessonType.VIDEO:
      return 'mdi-play-circle';
    case LessonType.DOCUMENT:
      return 'mdi-file-document';
    case LessonType.QUIZ:
      return 'mdi-help-circle';
    default:
      return 'mdi-circle';
  }
};

const getLessonColor = (lesson: Lesson): string => {
  if (isLessonCompleted(lesson)) return 'success';
  if (isCurrentLesson(lesson)) return 'primary';
  return 'grey';
};

const isLessonCompleted = (lesson: Lesson): boolean => {
  return props.completedLessons.has(lesson.id);
};

const isCurrentLesson = (lesson: Lesson): boolean => {
  return lesson.id === props.currentLessonId;
};

const selectLesson = (lesson: Lesson) => {
  emit('select-lesson', lesson);
};

const toggleModule = (moduleId: string) => {
  const index = expandedModules.value.indexOf(moduleId);
  if (index === -1) {
    expandedModules.value.push(moduleId);
  } else {
    expandedModules.value.splice(index, 1);
  }
};

// Initialize with current module expanded
if (props.currentLessonId) {
  const currentModule = props.modules.find(module =>
    module.lessons.some(lesson => lesson.id === props.currentLessonId),
  );
  if (currentModule) {
    expandedModules.value = [currentModule.id];
  }
}
</script>

<style scoped>
.progress-tracker {
  height: 100%;
  overflow: hidden;
}

.modules-list {
  margin-top: 16px;
}

.module-item {
  margin-bottom: 8px;
}

.module-header {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.module-header:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.module-title {
  font-weight: 500;
  flex: 1;
}

.lessons-list {
  margin: 8px 0 16px 24px;
}

.lesson-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.lesson-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.lesson-title {
  flex: 1;
  font-size: 0.9em;
}

.lesson-completed {
  color: var(--v-theme-success);
}

.lesson-current {
  background-color: rgba(var(--v-theme-primary), 0.1);
  font-weight: 500;
}
</style>