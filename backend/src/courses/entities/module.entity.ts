import { Lesson } from './lesson.entity';

export class Module {
  id: string;
  title: string;
  description: string;
  courseId: string;
  lessons: Lesson[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
  
  constructor(partial: Partial<Module>) {
    Object.assign(this, partial);
    this.lessons = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}