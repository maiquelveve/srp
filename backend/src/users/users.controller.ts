import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../common/decorators/skip-auto-audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

/** Cobre gestão de usuários (FR-030…FR-032) — contracts/structure.md. */
@ApiTags('users')
@ApiBearerAuth()
@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  list(
    @Query() query: ListUsersQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    return this.usersService.list(query, currentUser.units);
  }

  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.create(dto, currentUser.units);
  }

  @Patch(':id/deactivate')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit() // UsersService.deactivate() already records a richer before/after entry
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.usersService.deactivate(id, currentUser.sub);
  }
}
