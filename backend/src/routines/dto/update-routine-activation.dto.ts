import { IsBoolean, IsDateString } from 'class-validator';

/** `PATCH /routines/:id/activation` — contracts/routines.md. */
export class UpdateRoutineActivationDto {
  @IsDateString()
  date: string;

  @IsBoolean()
  active: boolean;
}
