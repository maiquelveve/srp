import { Body, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CellsService } from './cells.service';
import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { CellResponseDto } from './dto/cell-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@ApiTags('cells')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/cells')
export class CellsController {
  constructor(private readonly cellsService: CellsService) {}

  @ApiOperation({ summary: 'Cadastra uma cela em uma galeria' })
  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateCellDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CellResponseDto> {
    return this.cellsService.create(dto, currentUser.units);
  }

  @ApiOperation({ summary: 'Altera dados de uma cela ou a desativa/reativa' })
  @Patch(':id')
  @Roles(RoleName.WARDEN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCellDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CellResponseDto> {
    return this.cellsService.update(id, dto, currentUser.units);
  }
}
