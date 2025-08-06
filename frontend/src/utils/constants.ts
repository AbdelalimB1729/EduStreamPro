export const API_BASE_URL = import.meta.env.VITE_API_URL;
export const WS_URL = import.meta.env.VITE_WS_URL;
export const CDN_BASE_URL = import.meta.env.VITE_CDN_URL;

export const VIDEO_QUALITIES = ['1080p', '720p', '480p', '360p'];

export const SUPPORTED_VIDEO_FORMATS = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
];

export const SUPPORTED_DOCUMENT_FORMATS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export const QUIZ_TIME_LIMITS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
];

export const PASSING_SCORES = [
  { value: 60, label: '60%' },
  { value: 70, label: '70%' },
  { value: 80, label: '80%' },
  { value: 90, label: '90%' },
];

export const ANALYTICS_PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

export const STORAGE_KEYS = {
  AUTH_TOKENS: 'auth_tokens',
  USER_PROFILE: 'user_profile',
  THEME: 'theme',
  LANGUAGE: 'language',
  COURSE_PROGRESS: 'course_progress',
  QUIZ_SESSION: 'quiz_session',
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  QUIZ_TIMEOUT: 'Time is up! Your quiz has been automatically submitted.',
  VIDEO_PROCESSING: 'Video is still processing. Please check back later.',
  INVALID_FILE: 'Invalid file format or size.',
};

export const SUCCESS_MESSAGES = {
  COURSE_CREATED: 'Course created successfully!',
  COURSE_UPDATED: 'Course updated successfully!',
  QUIZ_SUBMITTED: 'Quiz submitted successfully!',
  ENROLLMENT_SUCCESS: 'Successfully enrolled in the course!',
  PROGRESS_SAVED: 'Progress saved successfully!',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  COURSE: {
    LIST: '/courses',
    DETAIL: (id: string) => `/courses/${id}`,
    CREATE: '/courses/create',
    EDIT: (id: string) => `/courses/${id}/edit`,
  },
  QUIZ: {
    START: (id: string) => `/quizzes/${id}/start`,
    RESULT: (id: string) => `/quizzes/${id}/result`,
  },
  PROFILE: '/profile',
  SETTINGS: '/settings',
};