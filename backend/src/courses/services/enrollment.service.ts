import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Course } from '../entities/course.entity';

@Injectable()
export class EnrollmentService {
  private enrollments = new Map<string, Set<string>>(); // studentId -> Set of courseIds
  private progress = new Map<string, Map<string, number>>(); // studentId -> (courseId -> progress)

  async enrollStudent(courseId: string, studentId: string, course: Course) {
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Check if already enrolled
    const studentEnrollments = this.enrollments.get(studentId) || new Set();
    if (studentEnrollments.has(courseId)) {
      throw new ConflictException('Student already enrolled in this course');
    }

    // Add enrollment
    studentEnrollments.add(courseId);
    this.enrollments.set(studentId, studentEnrollments);

    // Initialize progress
    const studentProgress = this.progress.get(studentId) || new Map();
    studentProgress.set(courseId, 0);
    this.progress.set(studentId, studentProgress);

    return {
      courseId,
      studentId,
      enrolledAt: new Date(),
      progress: 0,
    };
  }

  async unenrollStudent(courseId: string, studentId: string) {
    const studentEnrollments = this.enrollments.get(studentId);
    if (!studentEnrollments?.has(courseId)) {
      throw new NotFoundException('Enrollment not found');
    }

    // Remove enrollment
    studentEnrollments.delete(courseId);
    if (studentEnrollments.size === 0) {
      this.enrollments.delete(studentId);
    }

    // Remove progress
    const studentProgress = this.progress.get(studentId);
    if (studentProgress) {
      studentProgress.delete(courseId);
      if (studentProgress.size === 0) {
        this.progress.delete(studentId);
      }
    }

    return true;
  }

  async updateProgress(courseId: string, studentId: string, lessonId: string) {
    const studentEnrollments = this.enrollments.get(studentId);
    if (!studentEnrollments?.has(courseId)) {
      throw new NotFoundException('Enrollment not found');
    }

    const studentProgress = this.progress.get(studentId) || new Map();
    const currentProgress = studentProgress.get(courseId) || 0;
    
    // In a real application, calculate progress based on completed lessons
    const newProgress = Math.min(currentProgress + 10, 100);
    studentProgress.set(courseId, newProgress);
    this.progress.set(studentId, studentProgress);

    return {
      courseId,
      studentId,
      progress: newProgress,
      lastCompletedLesson: lessonId,
      updatedAt: new Date(),
    };
  }

  async getStudentEnrollments(studentId: string) {
    const studentEnrollments = this.enrollments.get(studentId) || new Set();
    const studentProgress = this.progress.get(studentId) || new Map();

    return Array.from(studentEnrollments).map(courseId => ({
      courseId,
      studentId,
      progress: studentProgress.get(courseId) || 0,
    }));
  }

  async getCourseEnrollments(courseId: string) {
    const courseEnrollments = [];
    for (const [studentId, enrollments] of this.enrollments.entries()) {
      if (enrollments.has(courseId)) {
        const progress = this.progress.get(studentId)?.get(courseId) || 0;
        courseEnrollments.push({
          courseId,
          studentId,
          progress,
        });
      }
    }
    return courseEnrollments;
  }
}