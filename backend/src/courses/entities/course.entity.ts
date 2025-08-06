import { Module } from './module.entity';

export class Course {
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
  
  constructor(partial: Partial<Course>) {
    Object.assign(this, partial);
    this.modules = [];
    this.enrolledStudents = [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.isPublished = false;
  }
}