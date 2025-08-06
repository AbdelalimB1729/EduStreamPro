import { Question } from './question.entity';

export enum QuizStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export class Quiz {
  id: string;
  title: string;
  description: string;
  lessonId: string;
  courseId: string;
  questions: Question[];
  timeLimit: number; // in minutes
  passingScore: number;
  status: QuizStatus;
  createdAt: Date;
  updatedAt: Date;
  
  constructor(partial: Partial<Quiz>) {
    Object.assign(this, partial);
    this.questions = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.status = QuizStatus.DRAFT;
  }
}