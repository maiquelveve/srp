import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule, APP_CONFIG } from './config/app-config.module';
import type { AppConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { UnitsModule } from './units/units.module';
import { GalleriesModule } from './galleries/galleries.module';
import { CellsModule } from './cells/cells.module';
import { InmatesModule } from './inmates/inmates.module';
import { MovementsModule } from './movements/movements.module';
import { RoutinesModule } from './routines/routines.module';
import { PostsModule } from './posts/posts.module';
import { StaffModule } from './staff/staff.module';
import { ReportsModule } from './reports/reports.module';
import { DocumentsModule } from './documents/documents.module';
import { AiModule } from './ai/ai.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createGlobalValidationPipe } from './common/pipes/validation-pipe.factory';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [
        { ttl: config.throttle.ttlMs, limit: config.throttle.limit },
      ],
    }),
    CommonModule,
    AuditModule,
    UsersModule,
    AuthModule,
    UnitsModule,
    GalleriesModule,
    CellsModule,
    InmatesModule,
    MovementsModule,
    RoutinesModule,
    PostsModule,
    StaffModule,
    ReportsModule,
    DocumentsModule,
    AiModule,
    KnowledgeModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useFactory: createGlobalValidationPipe },
    // Order matters: rate-limit first, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}
