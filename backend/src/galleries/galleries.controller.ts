import { Body, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GalleriesService } from './galleries.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@ApiTags('galleries')
@ApiBearerAuth()
@Controller('api/v1/galleries')
export class GalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateGalleryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<GalleryResponseDto> {
    return this.galleriesService.create(dto, currentUser.units);
  }

  @Patch(':id')
  @Roles(RoleName.WARDEN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGalleryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<GalleryResponseDto> {
    return this.galleriesService.update(id, dto, currentUser.units);
  }
}
