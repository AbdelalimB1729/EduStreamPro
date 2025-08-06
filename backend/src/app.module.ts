import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/courses.module';
import { QuizzesModule } from './quizzes/quizzes.module';

// Shared modules and services
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // JWT Configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION'),
        },
      }),
      inject: [ConfigService],
    }),

    // Core modules
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AuthModule,
    CoursesModule,
    QuizzesModule,
    SharedModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}