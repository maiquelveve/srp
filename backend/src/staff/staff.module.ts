import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffSchedule } from './entities/staff-schedule.entity';
import { MinimumStaffingConfig } from './entities/minimum-staffing-config.entity';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { UnitsModule } from '../units/units.module';
import { PostsModule } from '../posts/posts.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffSchedule, MinimumStaffingConfig, User]),
    UnitsModule,
    PostsModule,
  ],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
