export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateVideoFile = (file: File): {
  isValid: boolean;
  error?: string;
} => {
  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  const maxSize = 1024 * 1024 * 1024; // 1GB

  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid video format. Please use MP4, WebM, or QuickTime.',
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Video file size must not exceed 1GB.',
    };
  }

  return { isValid: true };
};

export const validateQuizDuration = (duration: number): boolean => {
  return duration >= 1 && duration <= 180; // 1-180 minutes
};

export const validateCourseTitle = (title: string): boolean => {
  return title.length >= 5 && title.length <= 100;
};

export const validateCoursePrice = (price: number): boolean => {
  return price >= 0 && price <= 999.99;
};

export const validateModuleOrder = (order: number, totalModules: number): boolean => {
  return order >= 1 && order <= totalModules + 1;
};

export const validateLessonOrder = (order: number, totalLessons: number): boolean => {
  return order >= 1 && order <= totalLessons + 1;
};