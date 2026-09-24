import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movement } from '../movements/entities/movement.entity';
import { Inmate } from '../inmates/entities/inmate.entity';
import { InmateCellHistory } from '../inmates/entities/inmate-cell-history.entity';
import { Cell } from '../cells/entities/cell.entity';
import { Routine } from '../routines/entities/routine.entity';
import { RoutineDateOverride } from '../routines/entities/routine-date-override.entity';
import { StaffSchedule } from '../staff/entities/staff-schedule.entity';
import { UnitsModule } from '../units/units.module';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Movement,
      Inmate,
      InmateCellHistory,
      Cell,
      Routine,
      RoutineDateOverride,
      StaffSchedule,
    ]),
    UnitsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
