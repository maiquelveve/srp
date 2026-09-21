import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** One entry of `PATCH /routines/:id/schedule`'s `schedules` array. */
export class RoutineScheduleItemDto {
  /** 0 (domingo) .. 6 (sábado); omitido/null = todos os dias. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number | null;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, { message: 'time deve estar no formato HH:mm' })
  time: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
