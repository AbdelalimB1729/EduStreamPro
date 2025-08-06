export interface Course {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  thumbnail: string;
  price: number;
  modules: Module[];
  enrolledStudents: string[];
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  courseId: string;
  lessons: Lesson[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  type: LessonType;
  content: LessonContent;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum LessonType {
  VIDEO = 'video',
  DOCUMENT = 'document',
  QUIZ = 'quiz',
}

export interface LessonContent {
  url?: string;
  duration?: number;
  transcoding?: {
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    variants: {
      quality: string;
      url: string;
    }[];
  };
  encryptionKey?: string;
}

export interface CourseProgress {
  courseId: string;
  studentId: string;
  progress: number;
  lastCompletedLesson?: string;
  updatedAt: Date;
}