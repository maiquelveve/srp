import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ReplaceUnitsDto } from './dto/replace-units.dto';
import { AddUnitsDto } from './dto/add-units.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PasswordActionResponseDto } from './dto/password-action-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../common/decorators/skip-auto-audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Cobre gestão de usuários (FR-030…FR-032, feature 001) e sua administração completa (contracts/users.md, feature 002). */
@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Lista usuários, com filtro por perfil e unidade' })
  @ApiPaginatedResponse(UserResponseDto)
  @Get()
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  list(
    @Query() query: ListUsersQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.list(query, currentUser.units, currentUser.sub);
  }

  @ApiOperation({ summary: 'Cadastra um usuário (somente Chefia/Diretor)' })
  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.create(dto, currentUser.units);
  }

  @ApiOperation({
    summary: 'Edita os dados cadastrais de um usuário, incluindo o perfil (somente Chefia/Diretor)',
  })
  @Patch(':id')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit() // UsersService.update() already records a richer before/after entry
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto, currentUser.sub);
  }

  @ApiOperation({ summary: 'Desativa um usuário (somente Chefia/Diretor)' })
  @Patch(':id/deactivate')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit() // UsersService.deactivate() already records a richer before/after entry
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, currentUser.sub);
  }

  @ApiOperation({ summary: 'Reativa um usuário desativado (somente Chefia/Diretor)' })
  @Patch(':id/reactivate')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  reactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.reactivate(id, currentUser.sub);
  }

  @ApiOperation({
    summary: 'Trocar lotação: substitui a(s) unidade(s) do usuário (somente Chefia/Diretor)',
  })
  @Put(':id/units')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  replaceUnits(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReplaceUnitsDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.replaceUnits(id, dto, currentUser.sub);
  }

  @ApiOperation({
    summary:
      'Adicionar lotação: soma unidade(s) às já vinculadas ao usuário (somente Chefia/Diretor)',
  })
  @Post(':id/units')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  addUnits(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddUnitsDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.addUnits(id, dto, currentUser.sub);
  }

  @ApiOperation({
    summary:
      'Gera senha temporária, envia por e-mail e revoga as sessões do usuário (somente Chefia/Diretor)',
  })
  @Patch(':id/reset-password')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PasswordActionResponseDto> {
    return this.usersService.resetPassword(id, currentUser.sub);
  }

  @ApiOperation({
    summary:
      'Reenvia o e-mail de senha inicial ou de reset ainda pendente (somente Chefia/Diretor)',
  })
  @Post(':id/resend-password-email')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  resendPasswordEmail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PasswordActionResponseDto> {
    return this.usersService.resendPasswordEmail(id, currentUser.sub);
  }
}
