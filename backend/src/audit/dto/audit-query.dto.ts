import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** `GET /api/v1/audit?table=&recordId=&from=&to=` — contracts/reports-audit.md (FR-026). */
export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  table?: string;

  @IsOptional()
  @IsInt()
  recordId?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
