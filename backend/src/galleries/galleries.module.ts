import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Gallery } from './entities/gallery.entity';
import { GalleriesService } from './galleries.service';
import { GalleriesController } from './galleries.controller';
import { UnitGalleriesController } from './unit-galleries.controller';
import { UnitsModule } from '../units/units.module';

@Module({
  imports: [TypeOrmModule.forFeature([Gallery]), UnitsModule],
  controllers: [GalleriesController, UnitGalleriesController],
  providers: [GalleriesService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
