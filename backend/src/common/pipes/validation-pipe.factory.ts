import { ValidationPipe } from '@nestjs/common';

/**
 * Shared DTO convention (Constitution IV/VII): every request body/query is
 * validated on the backend regardless of client (web, mobile, direct API),
 * unknown properties are rejected, and primitive query/path params are
 * coerced to the DTO's declared types.
 */
export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
}
