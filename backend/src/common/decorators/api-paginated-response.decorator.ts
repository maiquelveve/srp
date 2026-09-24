import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

/**
 * Documents a `{ data: Item[], total: number }` response (`PaginatedResponseDto<Item>`).
 * The Swagger plugin cannot resolve the generic, so the item type is passed explicitly.
 */
export const ApiPaginatedResponse = <Item extends Type<unknown>>(
  item: Item,
  status: HttpStatus = HttpStatus.OK,
): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(PaginatedResponseDto, item),
    ApiResponse({
      status,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          {
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(item) } },
            },
          },
        ],
      },
    }),
  );
