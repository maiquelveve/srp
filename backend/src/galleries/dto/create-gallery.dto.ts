import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { GalleryType } from '../entities/gallery.entity';

export class CreateGalleryDto {
  @IsInt()
  unitId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(GalleryType)
  type: GalleryType;
}
