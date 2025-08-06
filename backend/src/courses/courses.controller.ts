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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../auth/interfaces/user-role.enum';
import { CourseManagementService } from './services/course-management.service';
import { EnrollmentService } from './services/enrollment.service';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoursesController {
  constructor(
    private readonly courseManagementService: CourseManagementService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  @Post()
  async createCourse(@Body() courseData: any, @Request() req) {
    if (req.user.role !== UserRole.INSTRUCTOR) {
      throw new BadRequestException('Only instructors can create courses');
    }

    return this.courseManagementService.createCourse({
      ...courseData,
      instructorId: req.user.id,
    });
  }

  @Put(':courseId')
  async updateCourse(
    @Param('courseId') courseId: string,
    @Body() courseData: any,
    @Request() req,
  ) {
    const course = await this.courseManagementService.getCourse(courseId);
    if (course.instructorId !== req.user.id) {
      throw new BadRequestException('Only course instructor can update the course');
    }

    return this.courseManagementService.updateCourse(courseId, courseData);
  }

  @Post(':courseId/modules')
  async addModule(
    @Param('courseId') courseId: string,
    @Body() moduleData: any,
    @Request() req,
  ) {
    const course = await this.courseManagementService.getCourse(courseId);
    if (course.instructorId !== req.user.id) {
      throw new BadRequestException('Only course instructor can add modules');
    }

    return this.courseManagementService.addModule(courseId, moduleData);
  }

  @Post(':courseId/modules/:moduleId/lessons')
  @UseInterceptors(FileInterceptor('video'))
  async addLesson(
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() lessonData: any,
    @UploadedFile() video: Express.Multer.File,
    @Request() req,
  ) {
    const course = await this.courseManagementService.getCourse(courseId);
    if (course.instructorId !== req.user.id) {
      throw new BadRequestException('Only course instructor can add lessons');
    }

    if (video) {
      return this.courseManagementService.uploadVideoLesson(
        moduleId,
        lessonData.title,
        lessonData.description,
        video.buffer,
        video.originalname,
      );
    }

    return this.courseManagementService.addLesson(moduleId, lessonData);
  }

  @Post(':courseId/enroll')
  async enrollInCourse(
    @Param('courseId') courseId: string,
    @Request() req,
  ) {
    if (req.user.role !== UserRole.STUDENT) {
      throw new BadRequestException('Only students can enroll in courses');
    }

    const course = await this.courseManagementService.getCourse(courseId);
    return this.enrollmentService.enrollStudent(courseId, req.user.id, course);
  }

  @Delete(':courseId/enroll')
  async unenrollFromCourse(
    @Param('courseId') courseId: string,
    @Request() req,
  ) {
    return this.enrollmentService.unenrollStudent(courseId, req.user.id);
  }

  @Post(':courseId/publish')
  async publishCourse(
    @Param('courseId') courseId: string,
    @Request() req,
  ) {
    const course = await this.courseManagementService.getCourse(courseId);
    if (course.instructorId !== req.user.id) {
      throw new BadRequestException('Only course instructor can publish the course');
    }

    return this.courseManagementService.publishCourse(courseId);
  }

  @Post(':courseId/unpublish')
  async unpublishCourse(
    @Param('courseId') courseId: string,
    @Request() req,
  ) {
    const course = await this.courseManagementService.getCourse(courseId);
    if (course.instructorId !== req.user.id) {
      throw new BadRequestException('Only course instructor can unpublish the course');
    }

    return this.courseManagementService.unpublishCourse(courseId);
  }

  @Post(':courseId/lessons/:lessonId/progress')
  async updateProgress(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Request() req,
  ) {
    if (req.user.role !== UserRole.STUDENT) {
      throw new BadRequestException('Only students can update progress');
    }

    return this.enrollmentService.updateProgress(
      courseId,
      req.user.id,
      lessonId,
    );
  }

  @Get(':courseId')
  async getCourse(@Param('courseId') courseId: string) {
    return this.courseManagementService.getCourse(courseId);
  }

  @Get(':courseId/modules/:moduleId')
  async getModule(@Param('moduleId') moduleId: string) {
    return this.courseManagementService.getModule(moduleId);
  }

  @Get(':courseId/modules/:moduleId/lessons/:lessonId')
  async getLesson(@Param('lessonId') lessonId: string) {
    return this.courseManagementService.getLesson(lessonId);
  }

  @Get('enrolled')
  async getEnrolledCourses(@Request() req) {
    return this.enrollmentService.getStudentEnrollments(req.user.id);
  }

  @Get(':courseId/enrollments')
  async getCourseEnrollments(
    @Param('courseId') courseId: string,
    @Request() req,
  ) {
    const course = await this.courseManagementService.getCourse(courseId);
    if (course.instructorId !== req.user.id) {
      throw new BadRequestException('Only course instructor can view enrollments');
    }

    return this.enrollmentService.getCourseEnrollments(courseId);
  }
}