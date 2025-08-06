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

export class Question {
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
  
  constructor(partial: Partial<Question>) {
    Object.assign(this, partial);
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}