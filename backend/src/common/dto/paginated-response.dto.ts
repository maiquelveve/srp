/**
 * Consistent list-response shape across every module (Constitution VII),
 * matching the `{ data, total }` envelope documented in contracts/*.md.
 */
export class PaginatedResponseDto<T> {
  data: T[];
  total: number;

  constructor(data: T[], total: number) {
    this.data = data;
    this.total = total;
  }
}
