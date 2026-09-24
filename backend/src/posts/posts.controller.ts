import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/**
 * Postos de serviço (FR-022a) — contracts/staff.md. Supervisor só consulta (para
 * escalar policiais); criar, renomear e desativar é exclusivo da Chefia/Diretor.
 */
@ApiTags('posts')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @ApiOperation({ summary: 'Lista os postos de serviço de uma unidade' })
  @ApiPaginatedResponse(PostResponseDto)
  @Get()
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  list(
    @Query() query: ListPostsQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<PostResponseDto>> {
    return this.postsService.list(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Cadastra um posto de serviço (somente Chefia/Diretor)' })
  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreatePostDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PostResponseDto> {
    return this.postsService.create(dto, currentUser.units);
  }

  @ApiOperation({
    summary: 'Renomeia, desativa ou reativa um posto de serviço (somente Chefia/Diretor)',
  })
  @Patch(':id')
  @Roles(RoleName.WARDEN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PostResponseDto> {
    return this.postsService.update(id, dto, currentUser.units);
  }
}
