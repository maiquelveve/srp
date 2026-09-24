import { ServicePost } from '../entities/service-post.entity';

export class PostResponseDto {
  id: number;
  unitId: number;
  name: string;
  active: boolean;

  static fromEntity(post: ServicePost): PostResponseDto {
    const dto = new PostResponseDto();
    dto.id = post.id;
    dto.unitId = post.unit.id;
    dto.name = post.name;
    dto.active = post.active;
    return dto;
  }
}
