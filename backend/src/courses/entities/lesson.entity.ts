export enum LessonType {
  VIDEO = 'video',
  DOCUMENT = 'document',
  QUIZ = 'quiz',
}

export class Lesson {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  type: LessonType;
  content: {
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
  };
  order: number;
  createdAt: Date;
  updatedAt: Date;
  
  constructor(partial: Partial<Lesson>) {
    Object.assign(this, partial);
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}