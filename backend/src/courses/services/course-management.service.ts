import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Course } from '../entities/course.entity';
import { Module } from '../entities/module.entity';
import { Lesson, LessonType } from '../entities/lesson.entity';
import { VideoProcessingService } from './video-processing.service';
import { S3Adapter } from '../../shared/storage/s3-adapter';
import * as tf from '@tensorflow/tfjs-node';
import { Matrix } from 'ml-matrix';
import { KMeans } from 'ml-kmeans';

@Injectable()
export class CourseManagementService {
  private courses = new Map<string, Course>();
  private modules = new Map<string, Module>();
  private lessons = new Map<string, Lesson>();

  private neuralModel: tf.LayersModel;
  private learningPathModel: tf.Sequential;
  private userEmbeddings: Map<string, Float32Array>;
  private courseEmbeddings: Map<string, Float32Array>;
  private difficultyModel: tf.Sequential;

  constructor(
    private readonly videoProcessingService: VideoProcessingService,
    private readonly s3Adapter: S3Adapter,
  ) {
    this.initializeNeuralModels();
  }

  private async initializeNeuralModels() {
    try {
      // Initialize recommendation model
      this.neuralModel = await tf.loadLayersModel(
        'file://models/recommendation/model.json',
      );

      // Initialize learning path model
      this.learningPathModel = tf.sequential({
        layers: [
          tf.layers.dense({
            units: 128,
            activation: 'relu',
            inputShape: [256],
          }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({
            units: 64,
            activation: 'relu',
          }),
          tf.layers.dense({
            units: 32,
            activation: 'softmax',
          }),
        ],
      });

      this.learningPathModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });

      // Initialize difficulty adjustment model
      this.difficultyModel = tf.sequential({
        layers: [
          tf.layers.lstm({
            units: 64,
            inputShape: [null, 10],
            returnSequences: true,
          }),
          tf.layers.dense({
            units: 32,
            activation: 'relu',
          }),
          tf.layers.dense({
            units: 1,
            activation: 'sigmoid',
          }),
        ],
      });

      this.difficultyModel.compile({
        optimizer: tf.train.rmsprop(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy'],
      });

      // Initialize embeddings storage
      this.userEmbeddings = new Map();
      this.courseEmbeddings = new Map();

      // Load pre-trained embeddings
      const embeddingsData = await this.s3Adapter.downloadFile(
        'models/embeddings/latest.json',
      );
      const embeddings = JSON.parse(embeddingsData.toString());
      
      for (const [userId, embedding] of Object.entries(embeddings.users)) {
        this.userEmbeddings.set(userId, new Float32Array(embedding));
      }
      
      for (const [courseId, embedding] of Object.entries(embeddings.courses)) {
        this.courseEmbeddings.set(courseId, new Float32Array(embedding));
      }
    } catch (error) {
      console.error('Failed to initialize neural models:', error);
    }
  }

  async createCourse(courseData: Partial<Course>): Promise<Course> {
    const courseId = Date.now().toString();
    const course = new Course({
      ...courseData,
      id: courseId,
    });
    this.courses.set(courseId, course);
    return course;
  }

  async updateCourse(courseId: string, courseData: Partial<Course>): Promise<Course> {
    const course = this.courses.get(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    Object.assign(course, {
      ...courseData,
      updatedAt: new Date(),
    });

    this.courses.set(courseId, course);
    return course;
  }

  async addModule(courseId: string, moduleData: Partial<Module>): Promise<Module> {
    const course = this.courses.get(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const moduleId = Date.now().toString();
    const module = new Module({
      ...moduleData,
      id: moduleId,
      courseId,
      order: course.modules.length + 1,
    });

    this.modules.set(moduleId, module);
    course.modules.push(module);
    return module;
  }

  async addLesson(moduleId: string, lessonData: Partial<Lesson>): Promise<Lesson> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    const lessonId = Date.now().toString();
    const lesson = new Lesson({
      ...lessonData,
      id: lessonId,
      moduleId,
      order: module.lessons.length + 1,
    });

    this.lessons.set(lessonId, lesson);
    module.lessons.push(lesson);
    return lesson;
  }

  async uploadVideoLesson(
    moduleId: string,
    title: string,
    description: string,
    videoBuffer: Buffer,
    filename: string,
  ): Promise<Lesson> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }

    // Create lesson with pending status
    const lesson = await this.addLesson(moduleId, {
      title,
      description,
      type: LessonType.VIDEO,
      content: {
        transcoding: {
          status: 'pending',
          progress: 0,
          variants: [],
        },
      },
    });

    try {
      // Process video and get variants
      const variants = await this.videoProcessingService.processVideo(
        videoBuffer,
        filename,
      );

      // Update lesson with processed video information
      lesson.content.transcoding.status = 'completed';
      lesson.content.transcoding.progress = 100;
      lesson.content.transcoding.variants = variants.map((url, index) => ({
        quality: this.getQualityFromUrl(url),
        url,
      }));

      this.lessons.set(lesson.id, lesson);
      return lesson;
    } catch (error) {
      lesson.content.transcoding.status = 'failed';
      this.lessons.set(lesson.id, lesson);
      throw new BadRequestException('Video processing failed');
    }
  }

  private getQualityFromUrl(url: string): string {
    if (url.includes('1080p')) return '1080p';
    if (url.includes('720p')) return '720p';
    if (url.includes('480p')) return '480p';
    return '360p';
  }

  async getCourse(courseId: string, userId?: string): Promise<Course> {
    const course = this.courses.get(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (userId) {
      // Apply neural recommendations and difficulty adjustments
      await this.applyPersonalization(course, userId);
    }

    return course;
  }

  private async applyPersonalization(course: Course, userId: string): Promise<void> {
    try {
      // Get user and course embeddings
      const userEmbedding = this.userEmbeddings.get(userId);
      const courseEmbedding = this.courseEmbeddings.get(course.id);

      if (!userEmbedding || !courseEmbedding) {
        // Generate embeddings if not available
        await this.generateEmbeddings(userId, course.id);
        return;
      }

      // Predict optimal learning path
      const pathPrediction = await this.predictLearningPath(
        userEmbedding,
        courseEmbedding,
        course,
      );

      // Adjust module and lesson order
      this.reorderContent(course, pathPrediction);

      // Adjust quiz difficulty
      await this.adjustQuizDifficulty(course, userId);
    } catch (error) {
      console.error('Failed to apply personalization:', error);
    }
  }

  private async generateEmbeddings(userId: string, courseId: string): Promise<void> {
    // Generate user embedding using interaction history
    const userFeatures = await this.extractUserFeatures(userId);
    const userTensor = tf.tensor2d([userFeatures]);
    const userEmbedding = this.neuralModel.predict(userTensor) as tf.Tensor;
    this.userEmbeddings.set(userId, new Float32Array(await userEmbedding.data()));

    // Generate course embedding using content features
    const courseFeatures = await this.extractCourseFeatures(courseId);
    const courseTensor = tf.tensor2d([courseFeatures]);
    const courseEmbedding = this.neuralModel.predict(courseTensor) as tf.Tensor;
    this.courseEmbeddings.set(courseId, new Float32Array(await courseEmbedding.data()));

    // Clean up tensors
    userTensor.dispose();
    userEmbedding.dispose();
    courseTensor.dispose();
    courseEmbedding.dispose();
  }

  private async predictLearningPath(
    userEmbedding: Float32Array,
    courseEmbedding: Float32Array,
    course: Course,
  ): Promise<number[]> {
    // Combine embeddings
    const combinedFeatures = tf.tensor2d([
      [...Array.from(userEmbedding), ...Array.from(courseEmbedding)],
    ]);

    // Get path prediction
    const prediction = this.learningPathModel.predict(combinedFeatures) as tf.Tensor;
    const pathScores = await prediction.data();

    // Clean up tensors
    combinedFeatures.dispose();
    prediction.dispose();

    // Map scores to module indices
    const moduleIndices = Array.from(pathScores)
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.index);

    return moduleIndices;
  }

  private reorderContent(course: Course, pathPrediction: number[]): void {
    // Reorder modules based on prediction
    const reorderedModules = pathPrediction
      .map(index => course.modules[index])
      .filter(Boolean);

    course.modules = reorderedModules;

    // Update module order numbers
    course.modules.forEach((module, index) => {
      module.order = index + 1;
    });
  }

  private async adjustQuizDifficulty(course: Course, userId: string): Promise<void> {
    // Get user performance history
    const performanceHistory = await this.getUserPerformanceHistory(userId);
    const performanceTensor = tf.tensor3d([performanceHistory]);

    // Predict optimal difficulty
    const prediction = this.difficultyModel.predict(performanceTensor) as tf.Tensor;
    const difficultyAdjustment = (await prediction.data())[0];

    // Clean up tensors
    performanceTensor.dispose();
    prediction.dispose();

    // Apply difficulty adjustment to quizzes
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        if (lesson.type === LessonType.QUIZ) {
          this.adjustQuizParameters(lesson, difficultyAdjustment);
        }
      }
    }
  }

  private async extractUserFeatures(userId: string): Promise<number[]> {
    // Extract user interaction features
    const features = [
      // Learning speed (normalized)
      await this.calculateLearningSpeed(userId),
      // Completion rate
      await this.calculateCompletionRate(userId),
      // Quiz performance
      await this.calculateAverageQuizScore(userId),
      // Engagement metrics
      await this.calculateEngagementScore(userId),
      // Learning style preferences
      ...await this.extractLearningStyleFeatures(userId),
    ];

    // Normalize features
    return this.normalizeFeatures(features);
  }

  private async extractCourseFeatures(courseId: string): Promise<number[]> {
    const course = await this.getCourse(courseId);
    
    // Extract course content features
    const features = [
      // Content complexity
      this.calculateContentComplexity(course),
      // Prerequisites level
      this.calculatePrerequisitesLevel(course),
      // Interactive elements ratio
      this.calculateInteractivityRatio(course),
      // Media diversity score
      this.calculateMediaDiversityScore(course),
      // Assessment frequency
      this.calculateAssessmentFrequency(course),
    ];

    // Normalize features
    return this.normalizeFeatures(features);
  }

  private adjustQuizParameters(lesson: Lesson, difficultyAdjustment: number): void {
    if (!lesson.content.quiz) return;

    const quiz = lesson.content.quiz;
    
    // Adjust time limit
    quiz.timeLimit = Math.round(
      quiz.timeLimit * (1 + (difficultyAdjustment - 0.5) * 0.4),
    );

    // Adjust passing score
    quiz.passingScore = Math.round(
      quiz.passingScore * (1 + (difficultyAdjustment - 0.5) * 0.2),
    );

    // Adjust question weights
    quiz.questions.forEach(question => {
      question.points = Math.round(
        question.points * (1 + (difficultyAdjustment - 0.5) * 0.3),
      );
    });
  }

  private normalizeFeatures(features: number[]): number[] {
    const matrix = new Matrix([features]);
    const normalized = matrix.scale();
    return normalized.getRow(0);
  }

  private async calculateLearningSpeed(userId: string): Promise<number> {
    // Calculate average time spent per lesson completion
    const completionTimes = Array.from(this.courses.values())
      .flatMap(course => course.modules)
      .flatMap(module => module.lessons)
      .map(lesson => {
        const progress = this.getUserLessonProgress(userId, lesson.id);
        return progress?.completionTime || 0;
      })
      .filter(time => time > 0);

    if (completionTimes.length === 0) return 0.5;

    const avgTime = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
    const maxExpectedTime = 3600; // 1 hour in seconds
    return Math.min(maxExpectedTime / avgTime, 1);
  }

  private async calculateCompletionRate(userId: string): Promise<number> {
    let totalLessons = 0;
    let completedLessons = 0;

    for (const course of this.courses.values()) {
      for (const module of course.modules) {
        for (const lesson of module.lessons) {
          totalLessons++;
          if (this.isLessonCompleted(userId, lesson.id)) {
            completedLessons++;
          }
        }
      }
    }

    return totalLessons > 0 ? completedLessons / totalLessons : 0;
  }

  private async calculateAverageQuizScore(userId: string): Promise<number> {
    const quizScores = Array.from(this.courses.values())
      .flatMap(course => course.modules)
      .flatMap(module => module.lessons)
      .filter(lesson => lesson.type === LessonType.QUIZ)
      .map(lesson => {
        const progress = this.getUserLessonProgress(userId, lesson.id);
        return progress?.quizScore || 0;
      })
      .filter(score => score > 0);

    if (quizScores.length === 0) return 0.5;
    return quizScores.reduce((a, b) => a + b, 0) / quizScores.length / 100;
  }

  private async calculateEngagementScore(userId: string): Promise<number> {
    // Calculate engagement based on various metrics
    const metrics = {
      discussionPosts: await this.countUserDiscussionPosts(userId),
      resourceDownloads: await this.countUserResourceDownloads(userId),
      videoReplays: await this.countUserVideoReplays(userId),
      notesTaken: await this.countUserNotes(userId),
      practiceAttempts: await this.countUserPracticeAttempts(userId),
    };

    // Weight and combine metrics
    const weights = {
      discussionPosts: 0.2,
      resourceDownloads: 0.15,
      videoReplays: 0.25,
      notesTaken: 0.2,
      practiceAttempts: 0.2,
    };

    const maxValues = {
      discussionPosts: 50,
      resourceDownloads: 100,
      videoReplays: 200,
      notesTaken: 300,
      practiceAttempts: 150,
    };

    let score = 0;
    for (const [metric, value] of Object.entries(metrics)) {
      const normalizedValue = Math.min(value / maxValues[metric], 1);
      score += normalizedValue * weights[metric];
    }

    return score;
  }

  private async extractLearningStyleFeatures(userId: string): Promise<number[]> {
    // Extract learning style preferences based on behavior
    const features = [];

    // Visual vs. Text preference
    features.push(await this.calculateVisualTextPreference(userId));

    // Interactive vs. Passive preference
    features.push(await this.calculateInteractivePreference(userId));

    // Social vs. Individual preference
    features.push(await this.calculateSocialPreference(userId));

    // Theoretical vs. Practical preference
    features.push(await this.calculateTheoreticalPreference(userId));

    // Sequential vs. Global preference
    features.push(await this.calculateSequentialPreference(userId));

    return features;
  }

  private calculateContentComplexity(course: Course): number {
    // Calculate complexity based on various factors
    const factors = {
      prerequisiteCount: this.countPrerequisites(course),
      technicalTerms: this.countTechnicalTerms(course),
      codeSnippets: this.countCodeSnippets(course),
      assessmentDifficulty: this.calculateAssessmentDifficulty(course),
      contentDepth: this.calculateContentDepth(course),
    };

    // Weight and combine factors
    const weights = {
      prerequisiteCount: 0.2,
      technicalTerms: 0.2,
      codeSnippets: 0.2,
      assessmentDifficulty: 0.2,
      contentDepth: 0.2,
    };

    let complexity = 0;
    for (const [factor, value] of Object.entries(factors)) {
      complexity += value * weights[factor];
    }

    return Math.min(complexity, 1);
  }

  private calculatePrerequisitesLevel(course: Course): number {
    return course.prerequisites?.length
      ? Math.min(course.prerequisites.length / 5, 1)
      : 0;
  }

  private calculateInteractivityRatio(course: Course): number {
    const totalContent = course.modules.reduce(
      (total, module) => total + module.lessons.length,
      0,
    );

    const interactiveContent = course.modules.reduce((total, module) => {
      return total + module.lessons.filter(lesson =>
        lesson.type === LessonType.QUIZ ||
        (lesson.type === LessonType.VIDEO && lesson.content.interactive)
      ).length;
    }, 0);

    return totalContent > 0 ? interactiveContent / totalContent : 0;
  }

  private calculateMediaDiversityScore(course: Course): number {
    const mediaTypes = new Set();
    let totalMedia = 0;

    course.modules.forEach(module => {
      module.lessons.forEach(lesson => {
        if (lesson.type === LessonType.VIDEO) {
          mediaTypes.add('video');
          totalMedia++;
        } else if (lesson.content?.attachments) {
          lesson.content.attachments.forEach(attachment => {
            mediaTypes.add(attachment.type);
            totalMedia++;
          });
        }
      });
    });

    const diversityRatio = mediaTypes.size / 5; // Normalize by expected number of media types
    const distributionScore = totalMedia > 0 ? Math.min(totalMedia / 20, 1) : 0;

    return (diversityRatio + distributionScore) / 2;
  }

  private calculateAssessmentFrequency(course: Course): number {
    const totalLessons = course.modules.reduce(
      (total, module) => total + module.lessons.length,
      0,
    );

    const assessments = course.modules.reduce((total, module) => {
      return total + module.lessons.filter(lesson =>
        lesson.type === LessonType.QUIZ ||
        lesson.content?.hasAssessment
      ).length;
    }, 0);

    const optimalRatio = 0.3; // One assessment every 3-4 lessons
    const actualRatio = totalLessons > 0 ? assessments / totalLessons : 0;
    
    return Math.min(actualRatio / optimalRatio, 1);
  }

  private async getUserPerformanceHistory(userId: string): Promise<number[][]> {
    // Get last 10 quiz attempts
    const attempts = Array.from(this.courses.values())
      .flatMap(course => course.modules)
      .flatMap(module => module.lessons)
      .filter(lesson => lesson.type === LessonType.QUIZ)
      .map(lesson => {
        const progress = this.getUserLessonProgress(userId, lesson.id);
        return progress?.quizAttempts || [];
      })
      .flat()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    // Extract features for each attempt
    return attempts.map(attempt => [
      attempt.score / 100,
      attempt.timeSpent / attempt.timeLimit,
      attempt.correctAnswers / attempt.totalQuestions,
      attempt.attemptNumber / 3, // Normalize by expected max attempts
      attempt.difficulty,
    ]);
  }

  async getModule(moduleId: string): Promise<Module> {
    const module = this.modules.get(moduleId);
    if (!module) {
      throw new NotFoundException('Module not found');
    }
    return module;
  }

  async getLesson(lessonId: string): Promise<Lesson> {
    const lesson = this.lessons.get(lessonId);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  async publishCourse(courseId: string): Promise<Course> {
    const course = this.courses.get(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.modules.length === 0) {
      throw new BadRequestException('Cannot publish course without modules');
    }

    course.isPublished = true;
    course.updatedAt = new Date();
    this.courses.set(courseId, course);
    return course;
  }

  async unpublishCourse(courseId: string): Promise<Course> {
    const course = this.courses.get(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    course.isPublished = false;
    course.updatedAt = new Date();
    this.courses.set(courseId, course);
    return course;
  }
}