import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movement } from './entities/movement.entity';
import { MovementType } from './entities/movement-type.entity';
import { MovementsService } from './movements.service';
import { MovementsController } from './movements.controller';
import { MovementTypesService } from './movement-types.service';
import { MovementTypesController } from './movement-types.controller';
import { InmatesModule } from '../inmates/inmates.module';
import { CellsModule } from '../cells/cells.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Movement, MovementType]),
    InmatesModule,
    CellsModule,
    AuditModule,
  ],
  controllers: [MovementsController, MovementTypesController],
  providers: [MovementsService, MovementTypesService],
  exports: [MovementsService],
})
export class MovementsModule {}
