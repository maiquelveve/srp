import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { ServicePost } from './entities/service-post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UnitsService } from '../units/units.service';

const UNIQUE_VIOLATION_CODE = '23505';
const DUPLICATE_NAME_MESSAGE = 'Já existe um posto com este nome nesta unidade';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(ServicePost) private readonly postRepository: Repository<ServicePost>,
    private readonly unitsService: UnitsService,
  ) {}

  async list(
    query: ListPostsQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<PostResponseDto>> {
    let unitIds = callerUnitIds;
    if (query.unitId !== undefined) {
      const unit = await this.unitsService.findEntityInScope(query.unitId, callerUnitIds);
      unitIds = [unit.id];
    }
    if (unitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }

    const posts = await this.postRepository.find({
      where: {
        unit: { id: In(unitIds) },
        ...(query.includeInactive === 'true' ? {} : { active: true }),
      },
      relations: { unit: true },
      order: { name: 'ASC' },
    });
    return new PaginatedResponseDto(
      posts.map((post) => PostResponseDto.fromEntity(post)),
      posts.length,
    );
  }

  async create(dto: CreatePostDto, callerUnitIds: number[]): Promise<PostResponseDto> {
    const unit = await this.unitsService.findEntityInScope(dto.unitId, callerUnitIds);
    await this.assertNameAvailable(unit.id, dto.name);

    const post = await this.save(
      this.postRepository.create({ unit, name: dto.name, active: true }),
    );
    return PostResponseDto.fromEntity(post);
  }

  async update(id: number, dto: UpdatePostDto, callerUnitIds: number[]): Promise<PostResponseDto> {
    const post = await this.findEntityInScope(id, callerUnitIds);

    if (dto.name !== undefined && dto.name !== post.name) {
      await this.assertNameAvailable(post.unit.id, dto.name, post.id);
      post.name = dto.name;
    }
    if (dto.active !== undefined) {
      post.active = dto.active;
    }
    return PostResponseDto.fromEntity(await this.save(post));
  }

  /** Used by the Staff module to validate a `postId` is real and inside the caller's unit scope. */
  async findEntityInScope(id: number, callerUnitIds: number[]): Promise<ServicePost> {
    const post = await this.postRepository.findOne({
      where: { id },
      relations: { unit: true },
    });
    if (!post) {
      throw new NotFoundException('Posto não encontrado');
    }
    if (!callerUnitIds.includes(post.unit.id)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }
    return post;
  }

  private async assertNameAvailable(
    unitId: number,
    name: string,
    exceptPostId?: number,
  ): Promise<void> {
    const existing = await this.postRepository.findOne({
      where: { unit: { id: unitId }, name },
    });
    if (existing && existing.id !== exceptPostId) {
      throw new ConflictException(DUPLICATE_NAME_MESSAGE);
    }
  }

  /** Concurrent request slipped past the pre-check; the unique index is the real guard. */
  private async save(post: ServicePost): Promise<ServicePost> {
    try {
      const saved = await this.postRepository.save(post);
      saved.unit = post.unit;
      return saved;
    } catch (error) {
      const code = (error as QueryFailedError).driverError as { code?: string } | undefined;
      if (error instanceof QueryFailedError && code?.code === UNIQUE_VIOLATION_CODE) {
        throw new ConflictException(DUPLICATE_NAME_MESSAGE);
      }
      throw error;
    }
  }
}
