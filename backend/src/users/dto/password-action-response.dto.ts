/** Resposta de PATCH /users/:id/reset-password e POST /users/:id/resend-password-email (FR-002a/FR-007a). */
export class PasswordActionResponseDto {
  message: string;
  emailDelivered: boolean;
}
