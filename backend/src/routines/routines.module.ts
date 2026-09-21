import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Routine } from './entities/routine.entity';
import { RoutineSchedule } from './entities/routine-schedule.entity';
import { RoutineDateOverride } from './entities/routine-date-override.entity';
import { RoutinesService } from './routines.service';
import { RoutinesController } from './routines.controller';
import { GalleriesModule } from '../galleries/galleries.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Routine, RoutineSchedule, RoutineDateOverride]),
    GalleriesModule,
  ],
  controllers: [RoutinesController],
  providers: [RoutinesService],
  exports: [RoutinesService],
})
export class RoutinesModule {}
