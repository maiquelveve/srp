import { ApiProperty } from '@nestjs/swagger';

/**
 * Consistent list-response shape across every module (Constitution VII),
 * matching the `{ data, total }` envelope documented in contracts/*.md.
 */
export class PaginatedResponseDto<T> {
  /** Itens da página; o tipo do item é informado por `@ApiPaginatedResponse`. */
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  data: T[];
  total: number;

  constructor(data: T[], total: number) {
    this.data = data;
    this.total = total;
  }
}
