import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CellsService } from './cells.service';
import { CreateCellDto } from './dto/create-cell.dto';
import { CellResponseDto } from './dto/cell-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@ApiTags('cells')
@ApiBearerAuth()
@Controller('api/v1/cells')
export class CellsController {
  constructor(private readonly cellsService: CellsService) {}

  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateCellDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CellResponseDto> {
    return this.cellsService.create(dto, currentUser.units);
  }
}
