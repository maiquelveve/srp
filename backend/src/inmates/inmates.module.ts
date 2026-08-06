import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inmate } from './entities/inmate.entity';
import { Movement } from '../movements/entities/movement.entity';
import { InmatesService } from './inmates.service';
import { InmatesController } from './inmates.controller';
import { CellsModule } from '../cells/cells.module';

@Module({
  imports: [TypeOrmModule.forFeature([Inmate, Movement]), CellsModule],
  controllers: [InmatesController],
  providers: [InmatesService],
  exports: [InmatesService],
})
export class InmatesModule {}
