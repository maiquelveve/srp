import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cell } from './entities/cell.entity';
import { Inmate } from '../inmates/entities/inmate.entity';
import { CellsService } from './cells.service';
import { CellsController } from './cells.controller';
import { GalleryCellsController } from './gallery-cells.controller';
import { GalleriesModule } from '../galleries/galleries.module';

@Module({
  imports: [TypeOrmModule.forFeature([Cell, Inmate]), GalleriesModule],
  controllers: [CellsController, GalleryCellsController],
  providers: [CellsService],
  exports: [CellsService],
})
export class CellsModule {}
