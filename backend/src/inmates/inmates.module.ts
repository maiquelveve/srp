import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inmate } from './entities/inmate.entity';
import { InmateCellHistory } from './entities/inmate-cell-history.entity';
import { Movement } from '../movements/entities/movement.entity';
import { InmatesService } from './inmates.service';
import { InmatesController } from './inmates.controller';
import { CellHistoryService } from './cell-history.service';
import { CellsModule } from '../cells/cells.module';

@Module({
  imports: [TypeOrmModule.forFeature([Inmate, InmateCellHistory, Movement]), CellsModule],
  controllers: [InmatesController],
  providers: [InmatesService, CellHistoryService],
  exports: [InmatesService, CellHistoryService],
})
export class InmatesModule {}
