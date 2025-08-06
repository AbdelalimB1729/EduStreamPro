import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Course, Module, Lesson, CourseProgress } from '@/types/course-types';
import { apiService } from '@/services/api-service';

export const useCourseStore = defineStore('course', () => {
  // State
  const courses = ref<Course[]>([]);
  const currentCourse = ref<Course | null>(null);
  const enrolledCourses = ref<string[]>([]);
  const courseProgress = ref<Map<string, CourseProgress>>(new Map());
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const publishedCourses = computed(() => 
    courses.value.filter(course => course.isPublished)
  );

  const myCourses = computed(() => 
    courses.value.filter(course => enrolledCourses.value.includes(course.id))
  );

  const getProgress = computed(() => (courseId: string) => 
    courseProgress.value.get(courseId)?.progress || 0
  );

  // Actions
  const fetchCourses = async () => {
    try {
      loading.value = true;
      const response = await apiService.get('/courses');
      courses.value = response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch courses';
    } finally {
      loading.value = false;
    }
  };

  const fetchCourse = async (courseId: string) => {
    try {
      loading.value = true;
      const response = await apiService.get(`/courses/${courseId}`);
      currentCourse.value = response.data;
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch course';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const createCourse = async (courseData: Partial<Course>) => {
    try {
      loading.value = true;
      const response = await apiService.post('/courses', courseData);
      courses.value.push(response.data);
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to create course';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const updateCourse = async (courseId: string, courseData: Partial<Course>) => {
    try {
      loading.value = true;
      const response = await apiService.put(`/courses/${courseId}`, courseData);
      const index = courses.value.findIndex(c => c.id === courseId);
      if (index !== -1) {
        courses.value[index] = response.data;
      }
      if (currentCourse.value?.id === courseId) {
        currentCourse.value = response.data;
      }
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to update course';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const addModule = async (courseId: string, moduleData: Partial<Module>) => {
    try {
      loading.value = true;
      const response = await apiService.post(`/courses/${courseId}/modules`, moduleData);
      if (currentCourse.value?.id === courseId) {
        currentCourse.value.modules.push(response.data);
      }
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to add module';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const addLesson = async (
    courseId: string,
    moduleId: string,
    lessonData: Partial<Lesson>,
    file?: File,
  ) => {
    try {
      loading.value = true;
      const formData = new FormData();
      Object.entries(lessonData).forEach(([key, value]) => {
        formData.append(key, value as string);
      });
      if (file) {
        formData.append('video', file);
      }

      const response = await apiService.post(
        `/courses/${courseId}/modules/${moduleId}/lessons`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      if (currentCourse.value?.id === courseId) {
        const module = currentCourse.value.modules.find(m => m.id === moduleId);
        if (module) {
          module.lessons.push(response.data);
        }
      }

      return response.data;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to add lesson';
      return null;
    } finally {
      loading.value = false;
    }
  };

  const enrollInCourse = async (courseId: string) => {
    try {
      loading.value = true;
      await apiService.post(`/courses/${courseId}/enroll`);
      enrolledCourses.value.push(courseId);
      return true;
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to enroll in course';
      return false;
    } finally {
      loading.value = false;
    }
  };

  const updateProgress = async (
    courseId: string,
    lessonId: string,
  ) => {
    try {
      const response = await apiService.post(
        `/courses/${courseId}/lessons/${lessonId}/progress`,
      );
      courseProgress.value.set(courseId, response.data);
      return response.data;
    } catch (err) {
      console.error('Failed to update progress:', err);
      return null;
    }
  };

  const fetchEnrolledCourses = async () => {
    try {
      loading.value = true;
      const response = await apiService.get('/courses/enrolled');
      enrolledCourses.value = response.data.map(enrollment => enrollment.courseId);
      response.data.forEach(enrollment => {
        courseProgress.value.set(enrollment.courseId, {
          courseId: enrollment.courseId,
          studentId: enrollment.studentId,
          progress: enrollment.progress,
          updatedAt: new Date(enrollment.updatedAt),
        });
      });
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to fetch enrolled courses';
    } finally {
      loading.value = false;
    }
  };

  return {
    // State
    courses,
    currentCourse,
    enrolledCourses,
    courseProgress,
    loading,
    error,

    // Getters
    publishedCourses,
    myCourses,
    getProgress,

    // Actions
    fetchCourses,
    fetchCourse,
    createCourse,
    updateCourse,
    addModule,
    addLesson,
    enrollInCourse,
    updateProgress,
    fetchEnrolledCourses,
  };
}, {
  persist: {
    paths: ['enrolledCourses', 'courseProgress'],
  },
});