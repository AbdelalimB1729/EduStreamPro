export enum QuizStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ACTIVE = 'active',
  COMPLETED = 'completed',
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  lessonId: string;
  courseId: string;
  questions: Question[];
  timeLimit: number;
  passingScore: number;
  status: QuizStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  SINGLE_CHOICE = 'single_choice',
  TRUE_FALSE = 'true_false',
  CODE = 'code',
}

export interface Choice {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface CodeTestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  text: string;
  points: number;
  order: number;
  explanation?: string;
  choices?: Choice[];
  codeTemplate?: string;
  testCases?: CodeTestCase[];
  createdAt: Date;
  updatedAt: Date;
}

export interface QuizAttempt {
  quizId: string;
  studentId: string;
  startTime: Date;
  endTime?: Date;
  answers: Map<string, any>;
  score?: number;
  passed?: boolean;
  status: 'in_progress' | 'completed';
}

export interface QuizSession {
  quizId: string;
  timeRemaining: number;
  currentQuestion: number;
  answers: Map<string, any>;
  status: 'active' | 'paused' | 'completed';
}