<template>
  <div class="course-builder">
    <v-container>
      <!-- Header -->
      <v-row class="mb-6">
        <v-col cols="12">
          <v-card>
            <v-card-text>
              <div class="d-flex align-center">
                <div>
                  <h1 class="text-h4 mb-2">
                    {{ isEditing ? 'Edit Course' : 'Create New Course' }}
                  </h1>
                  <p class="text-subtitle-1">
                    {{ isEditing ? 'Update your course content' : 'Design your course structure' }}
                  </p>
                </div>
                <v-spacer />
                <v-btn
                  v-if="isEditing"
                  color="success"
                  :disabled="!canPublish"
                  @click="publishCourse"
                >
                  {{ course?.isPublished ? 'Unpublish' : 'Publish' }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Course Form -->
      <v-row>
        <v-col cols="12" md="8">
          <!-- Basic Information -->
          <v-card class="mb-6">
            <v-card-title>Basic Information</v-card-title>
            <v-card-text>
              <v-form ref="basicForm">
                <v-text-field
                  v-model="courseData.title"
                  label="Course Title"
                  :rules="[v => !!v || 'Title is required']"
                  required
                />

                <v-textarea
                  v-model="courseData.description"
                  label="Course Description"
                  :rules="[v => !!v || 'Description is required']"
                  required
                  rows="4"
                />

                <v-text-field
                  v-model.number="courseData.price"
                  label="Price"
                  type="number"
                  prefix="$"
                  :rules="[
                    v => v >= 0 || 'Price cannot be negative',
                    v => v <= 999.99 || 'Price cannot exceed $999.99',
                  ]"
                />

                <v-file-input
                  v-model="thumbnailFile"
                  label="Thumbnail"
                  accept="image/*"
                  :rules="[v => !isEditing || !!v || 'Thumbnail is required']"
                  show-size
                  prepend-icon="mdi-image"
                />
              </v-form>
            </v-card-text>
          </v-card>

          <!-- Modules -->
          <v-card>
            <v-card-title class="d-flex align-center">
              Modules
              <v-spacer />
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                @click="showAddModuleDialog = true"
              >
                Add Module
              </v-btn>
            </v-card-title>
            <v-card-text>
              <v-expansion-panels v-model="expandedModule">
                <v-expansion-panel
                  v-for="(module, moduleIndex) in courseData.modules"
                  :key="module.id"
                >
                  <v-expansion-panel-title>
                    <div class="d-flex align-center">
                      <v-icon
                        color="primary"
                        class="mr-2"
                      >
                        mdi-folder
                      </v-icon>
                      {{ module.title }}
                      <v-chip
                        class="ml-2"
                        size="small"
                      >
                        {{ module.lessons.length }} lessons
                      </v-chip>
                    </div>
                  </v-expansion-panel-title>
                  <v-expansion-panel-text>
                    <!-- Module Actions -->
                    <div class="d-flex align-center mb-4">
                      <v-btn
                        color="primary"
                        variant="text"
                        prepend-icon="mdi-pencil"
                        @click="editModule(module)"
                      >
                        Edit
                      </v-btn>
                      <v-btn
                        color="error"
                        variant="text"
                        prepend-icon="mdi-delete"
                        @click="deleteModule(moduleIndex)"
                      >
                        Delete
                      </v-btn>
                      <v-spacer />
                      <v-btn
                        color="primary"
                        prepend-icon="mdi-plus"
                        @click="addLesson(module)"
                      >
                        Add Lesson
                      </v-btn>
                    </div>

                    <!-- Lessons -->
                    <v-list>
                      <draggable
                        v-model="module.lessons"
                        item-key="id"
                        handle=".lesson-drag-handle"
                        @end="updateLessonOrder(module)"
                      >
                        <template #item="{ element: lesson }">
                          <v-list-item>
                            <template v-slot:prepend>
                              <v-icon
                                class="lesson-drag-handle"
                                color="grey"
                              >
                                mdi-drag
                              </v-icon>
                            </template>

                            <v-list-item-title>
                              {{ lesson.title }}
                            </v-list-item-title>

                            <v-list-item-subtitle>
                              {{ formatLessonType(lesson.type) }}
                            </v-list-item-subtitle>

                            <template v-slot:append>
                              <v-btn
                                icon="mdi-pencil"
                                variant="text"
                                size="small"
                                @click="editLesson(module, lesson)"
                              />
                              <v-btn
                                icon="mdi-delete"
                                variant="text"
                                size="small"
                                color="error"
                                @click="deleteLesson(module, lesson)"
                              />
                            </template>
                          </v-list-item>
                        </template>
                      </draggable>
                    </v-list>
                  </v-expansion-panel-text>
                </v-expansion-panel>
              </v-expansion-panels>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Sidebar -->
        <v-col cols="12" md="4">
          <!-- Course Status -->
          <v-card class="mb-6">
            <v-card-title>Course Status</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon
                      :color="course?.isPublished ? 'success' : 'warning'"
                    >
                      {{ course?.isPublished ? 'mdi-check-circle' : 'mdi-clock-outline' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>
                    {{ course?.isPublished ? 'Published' : 'Draft' }}
                  </v-list-item-title>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon color="primary">mdi-folder</v-icon>
                  </template>
                  <v-list-item-title>
                    {{ courseData.modules.length }} Modules
                  </v-list-item-title>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon color="primary">mdi-book-open-page-variant</v-icon>
                  </template>
                  <v-list-item-title>
                    {{ totalLessons }} Lessons
                  </v-list-item-title>
                </v-list-item>
              </v-list>

              <v-divider class="my-4" />

              <v-btn
                color="primary"
                block
                @click="saveCourse"
                :loading="saving"
              >
                Save Changes
              </v-btn>
            </v-card-text>
          </v-card>

          <!-- Requirements -->
          <v-card>
            <v-card-title>Publishing Requirements</v-card-title>
            <v-card-text>
              <v-list>
                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon
                      :color="courseData.title ? 'success' : 'error'"
                    >
                      {{ courseData.title ? 'mdi-check' : 'mdi-close' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>Course title</v-list-item-title>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon
                      :color="courseData.description ? 'success' : 'error'"
                    >
                      {{ courseData.description ? 'mdi-check' : 'mdi-close' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>Course description</v-list-item-title>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon
                      :color="thumbnailFile || course?.thumbnail ? 'success' : 'error'"
                    >
                      {{ thumbnailFile || course?.thumbnail ? 'mdi-check' : 'mdi-close' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>Course thumbnail</v-list-item-title>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon
                      :color="courseData.modules.length > 0 ? 'success' : 'error'"
                    >
                      {{ courseData.modules.length > 0 ? 'mdi-check' : 'mdi-close' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>At least one module</v-list-item-title>
                </v-list-item>

                <v-list-item>
                  <template v-slot:prepend>
                    <v-icon
                      :color="totalLessons > 0 ? 'success' : 'error'"
                    >
                      {{ totalLessons > 0 ? 'mdi-check' : 'mdi-close' }}
                    </v-icon>
                  </template>
                  <v-list-item-title>At least one lesson</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Add/Edit Module Dialog -->
    <v-dialog
      v-model="showModuleDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>
          {{ editingModule ? 'Edit Module' : 'Add Module' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="moduleForm">
            <v-text-field
              v-model="moduleData.title"
              label="Module Title"
              :rules="[v => !!v || 'Title is required']"
              required
            />

            <v-textarea
              v-model="moduleData.description"
              label="Module Description"
              :rules="[v => !!v || 'Description is required']"
              required
              rows="3"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="showModuleDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="saveModule"
          >
            {{ editingModule ? 'Update' : 'Add' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add/Edit Lesson Dialog -->
    <v-dialog
      v-model="showLessonDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title>
          {{ editingLesson ? 'Edit Lesson' : 'Add Lesson' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="lessonForm">
            <v-text-field
              v-model="lessonData.title"
              label="Lesson Title"
              :rules="[v => !!v || 'Title is required']"
              required
            />

            <v-textarea
              v-model="lessonData.description"
              label="Lesson Description"
              :rules="[v => !!v || 'Description is required']"
              required
              rows="3"
            />

            <v-select
              v-model="lessonData.type"
              label="Lesson Type"
              :items="lessonTypes"
              item-title="text"
              item-value="value"
              :rules="[v => !!v || 'Type is required']"
              required
            />

            <!-- Video Upload -->
            <div v-if="lessonData.type === 'video'">
              <v-file-input
                v-model="lessonVideo"
                label="Video File"
                accept="video/*"
                :rules="[
                  v => !editingLesson || !!v || !!lessonData.content?.url || 'Video is required',
                ]"
                show-size
                prepend-icon="mdi-video"
              />
            </div>

            <!-- Document Upload -->
            <div v-if="lessonData.type === 'document'">
              <v-file-input
                v-model="lessonDocument"
                label="Document"
                accept=".pdf,.doc,.docx"
                :rules="[
                  v => !editingLesson || !!v || !!lessonData.content?.url || 'Document is required',
                ]"
                show-size
                prepend-icon="mdi-file-document"
              />
            </div>

            <!-- Quiz Settings -->
            <div v-if="lessonData.type === 'quiz'">
              <v-text-field
                v-model.number="lessonData.content.timeLimit"
                label="Time Limit (minutes)"
                type="number"
                :rules="[
                  v => v > 0 || 'Time limit must be positive',
                  v => v <= 180 || 'Time limit cannot exceed 180 minutes',
                ]"
              />

              <v-text-field
                v-model.number="lessonData.content.passingScore"
                label="Passing Score (%)"
                type="number"
                :rules="[
                  v => v >= 0 || 'Score must be positive',
                  v => v <= 100 || 'Score cannot exceed 100%',
                ]"
              />
            </div>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="grey"
            variant="text"
            @click="showLessonDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="saveLesson"
            :loading="savingLesson"
          >
            {{ editingLesson ? 'Update' : 'Add' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useCourseStore } from '@/stores/course-store';
import { useSnackbarStore } from '@/stores/snackbar-store';
import { LessonType } from '@/types/course-types';
import draggable from 'vuedraggable';

const route = useRoute();
const router = useRouter();
const courseStore = useCourseStore();
const snackbarStore = useSnackbarStore();

// State
const course = computed(() => courseStore.currentCourse);
const isEditing = computed(() => !!route.params.id);
const saving = ref(false);
const savingLesson = ref(false);
const expandedModule = ref(0);
const thumbnailFile = ref(null);

// Forms
const basicForm = ref(null);
const moduleForm = ref(null);
const lessonForm = ref(null);

// Course Data
const courseData = ref({
  title: '',
  description: '',
  price: 0,
  modules: [],
});

// Module Dialog
const showModuleDialog = ref(false);
const editingModule = ref(null);
const moduleData = ref({
  title: '',
  description: '',
});

// Lesson Dialog
const showLessonDialog = ref(false);
const editingLesson = ref(null);
const currentModule = ref(null);
const lessonData = ref({
  title: '',
  description: '',
  type: LessonType.VIDEO,
  content: {
    timeLimit: 30,
    passingScore: 70,
  },
});
const lessonVideo = ref(null);
const lessonDocument = ref(null);

// Constants
const lessonTypes = [
  { text: 'Video', value: LessonType.VIDEO },
  { text: 'Document', value: LessonType.DOCUMENT },
  { text: 'Quiz', value: LessonType.QUIZ },
];

// Computed
const totalLessons = computed(() => {
  return courseData.value.modules.reduce(
    (total, module) => total + module.lessons.length,
    0,
  );
});

const canPublish = computed(() => {
  return (
    courseData.value.title &&
    courseData.value.description &&
    (thumbnailFile.value || course.value?.thumbnail) &&
    courseData.value.modules.length > 0 &&
    totalLessons.value > 0
  );
});

// Methods
const loadCourse = async () => {
  if (!isEditing.value) return;

  try {
    await courseStore.fetchCourse(route.params.id);
    courseData.value = {
      title: course.value.title,
      description: course.value.description,
      price: course.value.price,
      modules: [...course.value.modules],
    };
  } catch (error) {
    snackbarStore.showError('Failed to load course');
    router.push('/courses');
  }
};

const saveCourse = async () => {
  if (!basicForm.value) return;
  
  const { valid } = await basicForm.value.validate();
  if (!valid) return;

  try {
    saving.value = true;

    const formData = new FormData();
    formData.append('title', courseData.value.title);
    formData.append('description', courseData.value.description);
    formData.append('price', courseData.value.price.toString());
    
    if (thumbnailFile.value) {
      formData.append('thumbnail', thumbnailFile.value);
    }

    if (isEditing.value) {
      await courseStore.updateCourse(route.params.id, formData);
      snackbarStore.showSuccess('Course updated successfully');
    } else {
      const newCourse = await courseStore.createCourse(formData);
      snackbarStore.showSuccess('Course created successfully');
      router.push(`/courses/${newCourse.id}/edit`);
    }
  } catch (error) {
    snackbarStore.showError('Failed to save course');
  } finally {
    saving.value = false;
  }
};

const publishCourse = async () => {
  try {
    if (course.value.isPublished) {
      await courseStore.unpublishCourse(course.value.id);
      snackbarStore.showSuccess('Course unpublished');
    } else {
      await courseStore.publishCourse(course.value.id);
      snackbarStore.showSuccess('Course published');
    }
  } catch (error) {
    snackbarStore.showError('Failed to update course status');
  }
};

// Module Methods
const addModule = () => {
  editingModule.value = null;
  moduleData.value = {
    title: '',
    description: '',
  };
  showModuleDialog.value = true;
};

const editModule = (module) => {
  editingModule.value = module;
  moduleData.value = {
    title: module.title,
    description: module.description,
  };
  showModuleDialog.value = true;
};

const saveModule = async () => {
  if (!moduleForm.value) return;
  
  const { valid } = await moduleForm.value.validate();
  if (!valid) return;

  try {
    if (editingModule.value) {
      // Update existing module
      Object.assign(editingModule.value, moduleData.value);
    } else {
      // Add new module
      courseData.value.modules.push({
        id: Date.now().toString(),
        ...moduleData.value,
        lessons: [],
      });
    }

    showModuleDialog.value = false;
    snackbarStore.showSuccess(
      editingModule.value ? 'Module updated' : 'Module added',
    );
  } catch (error) {
    snackbarStore.showError('Failed to save module');
  }
};

const deleteModule = async (index) => {
  if (confirm('Are you sure you want to delete this module?')) {
    courseData.value.modules.splice(index, 1);
    snackbarStore.showSuccess('Module deleted');
  }
};

// Lesson Methods
const addLesson = (module) => {
  editingLesson.value = null;
  currentModule.value = module;
  lessonData.value = {
    title: '',
    description: '',
    type: LessonType.VIDEO,
    content: {
      timeLimit: 30,
      passingScore: 70,
    },
  };
  lessonVideo.value = null;
  lessonDocument.value = null;
  showLessonDialog.value = true;
};

const editLesson = (module, lesson) => {
  editingLesson.value = lesson;
  currentModule.value = module;
  lessonData.value = {
    ...lesson,
  };
  lessonVideo.value = null;
  lessonDocument.value = null;
  showLessonDialog.value = true;
};

const saveLesson = async () => {
  if (!lessonForm.value) return;
  
  const { valid } = await lessonForm.value.validate();
  if (!valid) return;

  try {
    savingLesson.value = true;

    const lessonContent = {
      ...lessonData.value.content,
    };

    if (lessonData.value.type === LessonType.VIDEO && lessonVideo.value) {
      // Upload video
      const formData = new FormData();
      formData.append('video', lessonVideo.value);
      const response = await courseStore.uploadVideo(formData);
      lessonContent.url = response.url;
    }

    if (lessonData.value.type === LessonType.DOCUMENT && lessonDocument.value) {
      // Upload document
      const formData = new FormData();
      formData.append('document', lessonDocument.value);
      const response = await courseStore.uploadDocument(formData);
      lessonContent.url = response.url;
    }

    const lesson = {
      id: editingLesson.value?.id || Date.now().toString(),
      title: lessonData.value.title,
      description: lessonData.value.description,
      type: lessonData.value.type,
      content: lessonContent,
    };

    if (editingLesson.value) {
      // Update existing lesson
      const index = currentModule.value.lessons.findIndex(
        l => l.id === editingLesson.value.id,
      );
      currentModule.value.lessons.splice(index, 1, lesson);
    } else {
      // Add new lesson
      currentModule.value.lessons.push(lesson);
    }

    showLessonDialog.value = false;
    snackbarStore.showSuccess(
      editingLesson.value ? 'Lesson updated' : 'Lesson added',
    );
  } catch (error) {
    snackbarStore.showError('Failed to save lesson');
  } finally {
    savingLesson.value = false;
  }
};

const deleteLesson = async (module, lesson) => {
  if (confirm('Are you sure you want to delete this lesson?')) {
    const index = module.lessons.findIndex(l => l.id === lesson.id);
    module.lessons.splice(index, 1);
    snackbarStore.showSuccess('Lesson deleted');
  }
};

const updateLessonOrder = (module) => {
  // Update lesson order numbers
  module.lessons.forEach((lesson, index) => {
    lesson.order = index + 1;
  });
};

const formatLessonType = (type: LessonType): string => {
  return lessonTypes.find(t => t.value === type)?.text || 'Unknown';
};

// Lifecycle
onMounted(() => {
  loadCourse();
});
</script>

<style scoped>
.course-builder {
  min-height: 100%;
  background-color: var(--v-background-base);
}

.lesson-drag-handle {
  cursor: move;
}
</style>