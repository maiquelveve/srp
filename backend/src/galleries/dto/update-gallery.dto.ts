import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { GalleryType } from '../entities/gallery.entity';

export class UpdateGalleryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GalleryType)
  type?: GalleryType;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
