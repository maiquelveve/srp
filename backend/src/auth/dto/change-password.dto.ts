import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/** contracts/auth.md — PATCH /api/v1/auth/change-password (FR-016/FR-017). */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  /** Mesma política de SetInitialPasswordDto (research.md #7). */
  @IsString()
  @MinLength(8)
  newPassword: string;

  /** Refresh token do dispositivo atual — preservado da revogação (FR-017a, research.md #1). */
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
