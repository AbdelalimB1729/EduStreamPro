import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/interfaces/user-role.enum';
import { Quiz, QuizStatus } from './entities/quiz.entity';
import { Question, QuestionType } from './entities/question.entity';

@Controller('quizzes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizzesController {
  private quizzes = new Map<string, Quiz>();
  private questions = new Map<string, Question>();
  private attempts = new Map<string, Map<string, any>>(); // userId -> quizId -> attempt

  @Post()
  async createQuiz(@Body() quizData: any, @Request() req) {
    if (req.user.role !== UserRole.INSTRUCTOR) {
      throw new BadRequestException('Only instructors can create quizzes');
    }

    const quizId = Date.now().toString();
    const quiz = new Quiz({
      ...quizData,
      id: quizId,
    });

    this.quizzes.set(quizId, quiz);
    return quiz;
  }

  @Put(':quizId')
  async updateQuiz(
    @Param('quizId') quizId: string,
    @Body() quizData: any,
    @Request() req,
  ) {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    Object.assign(quiz, {
      ...quizData,
      updatedAt: new Date(),
    });

    this.quizzes.set(quizId, quiz);
    return quiz;
  }

  @Post(':quizId/questions')
  async addQuestion(
    @Param('quizId') quizId: string,
    @Body() questionData: any,
    @Request() req,
  ) {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const questionId = Date.now().toString();
    const question = new Question({
      ...questionData,
      id: questionId,
      quizId,
      order: quiz.questions.length + 1,
    });

    this.questions.set(questionId, question);
    quiz.questions.push(question);
    return question;
  }

  @Put(':quizId/questions/:questionId')
  async updateQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
    @Body() questionData: any,
  ) {
    const question = this.questions.get(questionId);
    if (!question || question.quizId !== quizId) {
      throw new NotFoundException('Question not found');
    }

    Object.assign(question, {
      ...questionData,
      updatedAt: new Date(),
    });

    this.questions.set(questionId, question);
    return question;
  }

  @Delete(':quizId/questions/:questionId')
  async deleteQuestion(
    @Param('quizId') quizId: string,
    @Param('questionId') questionId: string,
  ) {
    const quiz = this.quizzes.get(quizId);
    const question = this.questions.get(questionId);
    
    if (!quiz || !question || question.quizId !== quizId) {
      throw new NotFoundException('Question not found');
    }

    quiz.questions = quiz.questions.filter(q => q.id !== questionId);
    this.questions.delete(questionId);
    return { success: true };
  }

  @Post(':quizId/start')
  async startQuiz(
    @Param('quizId') quizId: string,
    @Request() req,
  ) {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    if (quiz.status !== QuizStatus.PUBLISHED) {
      throw new BadRequestException('Quiz is not available');
    }

    // Initialize attempt
    const userAttempts = this.attempts.get(req.user.id) || new Map();
    if (userAttempts.has(quizId)) {
      throw new BadRequestException('Quiz already in progress');
    }

    const attempt = {
      startTime: new Date(),
      answers: new Map(),
      status: 'in_progress',
    };

    userAttempts.set(quizId, attempt);
    this.attempts.set(req.user.id, userAttempts);

    return {
      quizId,
      timeLimit: quiz.timeLimit,
      questionCount: quiz.questions.length,
    };
  }

  @Post(':quizId/submit')
  async submitQuiz(
    @Param('quizId') quizId: string,
    @Body() answers: { [key: string]: any },
    @Request() req,
  ) {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    const userAttempts = this.attempts.get(req.user.id);
    const attempt = userAttempts?.get(quizId);
    
    if (!attempt || attempt.status !== 'in_progress') {
      throw new BadRequestException('No active quiz attempt found');
    }

    // Calculate score
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const question of quiz.questions) {
      const answer = answers[question.id];
      if (!answer) continue;

      totalPoints += question.points;
      
      switch (question.type) {
        case QuestionType.MULTIPLE_CHOICE:
        case QuestionType.SINGLE_CHOICE:
        case QuestionType.TRUE_FALSE:
          if (this.validateChoiceAnswer(question, answer)) {
            earnedPoints += question.points;
          }
          break;
        case QuestionType.CODE:
          if (await this.validateCodeAnswer(question, answer)) {
            earnedPoints += question.points;
          }
          break;
      }
    }

    const score = (earnedPoints / totalPoints) * 100;
    const passed = score >= quiz.passingScore;

    // Update attempt
    attempt.status = 'completed';
    attempt.endTime = new Date();
    attempt.score = score;
    attempt.passed = passed;
    attempt.answers = answers;

    return {
      score,
      passed,
      totalQuestions: quiz.questions.length,
      correctAnswers: earnedPoints / Math.max(...quiz.questions.map(q => q.points)),
    };
  }

  @Get(':quizId')
  async getQuiz(@Param('quizId') quizId: string) {
    const quiz = this.quizzes.get(quizId);
    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }
    return quiz;
  }

  @Get('lesson/:lessonId')
  async getQuizByLesson(@Param('lessonId') lessonId: string) {
    const quiz = Array.from(this.quizzes.values()).find(
      q => q.lessonId === lessonId,
    );
    if (!quiz) {
      throw new NotFoundException('Quiz not found for this lesson');
    }
    return quiz;
  }

  @Get(':quizId/attempts')
  async getQuizAttempts(
    @Param('quizId') quizId: string,
    @Request() req,
  ) {
    const userAttempts = this.attempts.get(req.user.id);
    const attempt = userAttempts?.get(quizId);
    
    if (!attempt) {
      return null;
    }

    return attempt;
  }

  private validateChoiceAnswer(question: Question, answer: any): boolean {
    if (question.type === QuestionType.MULTIPLE_CHOICE) {
      const correctChoices = question.choices.filter(c => c.isCorrect).map(c => c.id);
      return (
        Array.isArray(answer) &&
        answer.length === correctChoices.length &&
        answer.every(a => correctChoices.includes(a))
      );
    } else {
      return question.choices.find(c => c.id === answer)?.isCorrect || false;
    }
  }

  private async validateCodeAnswer(question: Question, answer: string): Promise<boolean> {
    // In a real application, this would run the code in a sandbox
    // For now, we'll just check if all test cases pass
    for (const testCase of question.testCases) {
      try {
        // This is a placeholder for actual code execution
        const result = 'simulated output';
        if (result !== testCase.expectedOutput) {
          return false;
        }
      } catch (error) {
        return false;
      }
    }
    return true;
  }
}